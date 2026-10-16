"""Bounded live checks. Credentials stay in memory; output is sanitized."""
import getpass
import json
import os
from pathlib import Path
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

QLOO = 'https://hackathon.api.qloo.com'
APP = 'https://second-act-cinema-desk.likhithk085.chatgpt.site'
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


class CheckFailed(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


opener = urllib.request.build_opener(NoRedirect)


def request(url, key=None, body=None):
    headers = {'Accept': 'application/json'}
    if key:
        if urllib.parse.urlsplit(url).scheme + '://' + urllib.parse.urlsplit(url).netloc != QLOO:
            raise CheckFailed('Credential destination is not the assigned Qloo host.')
        headers['X-Api-Key'] = key
    data = None
    if body is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with opener.open(req, timeout=45) as response:
            raw = response.read(1024 * 1024 + 1)
            if len(raw) > 1024 * 1024:
                raise CheckFailed('Response exceeds the one MiB verifier limit.')
            result = json.loads(raw)
    except urllib.error.HTTPError as error:
        # Never print upstream response bodies or authentication headers.
        raise CheckFailed(f'HTTP {error.code} from {urllib.parse.urlsplit(url).netloc}.') from None
    except urllib.error.URLError as error:
        reason = str(error.reason)
        if 'Tunnel connection failed: 403' in reason:
            raise CheckFailed('Workspace proxy denied the connection before reaching the service.') from None
        raise CheckFailed(f'Network request failed ({type(error.reason).__name__}).') from None
    except (ValueError, TimeoutError):
        raise CheckFailed('Response was not usable JSON or timed out.') from None
    if not isinstance(result, dict) or result.get('success') is False:
        raise CheckFailed('The service returned an unsuccessful or incompatible response.')
    return result


def normalize(value):
    if not isinstance(value, str):
        return ''
    return ''.join(c for c in unicodedata.normalize('NFD', value) if not unicodedata.combining(c)).lower().strip()


def main():
    key = os.environ.get('QLOO_API_KEY') or getpass.getpass('Qloo event key (hidden): ')
    if not key.strip():
        raise CheckFailed('A Qloo event key is required.')
    key = key.strip()
    report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'qlooOrigin': QLOO, 'app': APP, 'checks': []}
    success = False
    try:
        found = []
        for title in ['Hunt for the Wilderpeople', 'Sing Street', 'Spirited Away']:
            query = urllib.parse.urlencode({'query': title, 'types': 'urn:entity:movie', 'take': 12})
            response = request(QLOO + '/search?' + query, key=key)
            entities = response.get('results')
            if not isinstance(entities, list):
                raise CheckFailed('Search did not return results[].')
            matches = {e['entity_id'].lower(): e for e in entities if isinstance(e, dict)
                       and normalize(e.get('name', '')) == normalize(title)
                       and UUID.fullmatch(e.get('entity_id', ''))
                       and (e.get('subtype') == 'urn:entity:movie' or e.get('type') == 'urn:entity:movie'
                            or 'urn:entity:movie' in e.get('types', []))}
            if len(matches) != 1:
                raise CheckFailed(f'{title}: expected one exact movie identity, found {len(matches)}.')
            entity_id, entity = next(iter(matches.items()))
            found.append(entity_id)
            report['checks'].append({'tool': 'qloo.search', 'status': 'ok', 'name': entity['name'], 'entityId': entity_id})
        query = urllib.parse.urlencode({'filter.type': 'urn:entity:movie', 'signal.interests.entities': found[2],
                                       'filter.results.entities': ','.join(found[:2]), 'feature.explainability': 'true', 'take': 50})
        response = request(QLOO + '/v2/insights?' + query, key=key)
        result = response.get('results')
        entities = result.get('entities') if isinstance(result, dict) else None
        if not isinstance(entities, list) or len(entities) > 50:
            raise CheckFailed('Insights did not return a bounded results.entities array.')
        order = []
        for e in entities:
            entity_id = e.get('entity_id', '').lower() if isinstance(e, dict) else ''
            if entity_id not in found[:2] or entity_id in order:
                raise CheckFailed('Insights returned an unrequested or duplicate entity.')
            order.append(entity_id)
        if not order:
            raise CheckFailed('No bounded candidate had provider evidence; the demo needs another verified case.')
        report['checks'].append({'tool': 'qloo.insights', 'status': 'ok', 'returnedOrder': order})
        response = request(APP + '/api/recover', body={'mode': 'live'})
        if response.get('provider') != 'qloo' or response.get('mode') != 'live':
            raise CheckFailed('Full recovery did not identify live Qloo evidence.')
        trace = response.get('trace', [])
        report['checks'].append({'tool': 'second-act.recover', 'status': 'ok',
                                 'selectedFilm': (response.get('chosen') or {}).get('film', {}).get('title'),
                                 'toolTrace': [{'tool': t.get('tool'), 'status': t.get('status')} for t in trace]})
        success = True
    except CheckFailed as error:
        report['failure'] = str(error)
    report['status'] = 'passed' if success else 'incomplete'
    serialized = json.dumps(report, indent=2)
    if key in serialized:
        raise CheckFailed('Unexpected credential content in report; no report written.')
    destination = Path(__file__).resolve().parent.parent / 'work/live-verification.json'
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(serialized + '\n')
    print(serialized)
    return 0 if success else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except CheckFailed as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
