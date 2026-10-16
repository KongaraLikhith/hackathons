// These checks run the built application inside workerd, with an in-process
// provider fixture. They validate runtime compatibility, not live Qloo access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, Log, LogLevel } from 'miniflare';
import { scenario } from '../src/scenario.mjs';

const key = 'worker-runtime-fixture-key';
const uuid = n => `abcdefab-cdef-4abc-8def-${n.toString(16).padStart(12, '0')}`;
const common = { modules: true, compatibilityDate: '2026-07-30', log: new Log(LogLevel.NONE), persist: false };
const response = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const body = data => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

test('workerd rejects redirect:error before contacting an outbound service', async t => {
  let calls = 0;
  const mf = new Miniflare({ ...common,
    script: `export default { async fetch() { try { await fetch('https://hackathon.api.qloo.com/search', {redirect:'error'}); return new Response('unexpected'); } catch(e) {return new Response(e.message, {status:500});} } }`,
    outboundService() { calls++; return response({}); },
  });
  t.after(() => mf.dispose());
  const result = await mf.dispatchFetch('https://second-act.example/');
  assert.equal(result.status, 500);
  assert.match(await result.text(), /Invalid redirect value/);
  assert.equal(calls, 0);
});

test('built Worker completes the live-mode search → insights → ranking path with provider fixtures', async t => {
  const identities = new Map(); let next = 1; const calls = [];
  for (const entry of [...scenario.inventory.map(f => ({ name: f.title, kind: 'movie' })), ...scenario.cohorts.flatMap(c => c.anchors)]) {
    const mapKey = `${entry.kind}:${entry.name}`;
    if (!identities.has(mapKey)) identities.set(mapKey, { entity_id: uuid(next++), name: entry.name, type: 'urn:entity', subtype: `urn:entity:${entry.kind}` });
  }
  const mf = new Miniflare({ ...common, scriptPath: 'dist/server/index.js', bindings: { QLOO_API_KEY: key, LIVE_CALLS_ENABLED: 'true' },
    outboundService(request) {
      const url = new URL(request.url); calls.push(url);
      assert.equal(url.origin, 'https://hackathon.api.qloo.com');
      assert.equal(request.headers.get('x-api-key'), key);
      if (url.pathname === '/search') {
        const kind = url.searchParams.get('types').split(':').at(-1);
        const entity = identities.get(`${kind}:${url.searchParams.get('query')}`);
        return response({ results: entity ? [entity] : [] });
      }
      assert.equal(url.pathname, '/v2/insights');
      return response({ results: { entities: url.searchParams.get('filter.results.entities').split(',').map(id => ({ entity_id: id, type: 'urn:entity', subtype: 'urn:entity:movie' })) } });
    },
  });
  t.after(() => mf.dispose());
  const result = await mf.dispatchFetch('https://second-act.example/api/recover', body({ mode: 'live' }));
  const data = await result.json();
  assert.equal(result.status, 200, JSON.stringify(data));
  assert.equal(data.provider, 'qloo'); assert.equal(data.mode, 'live');
  assert.equal(data.chosen.film.id, 'wilderpeople');
  assert.equal(calls.filter(u => u.pathname === '/v2/insights').length, 3);
  assert.ok(calls.some(u => u.pathname === '/search'));
  assert.ok(!JSON.stringify(data).includes(key));
});

test('built Worker rejects a redirect without forwarding the key to its destination', async t => {
  const calls = [];
  const mf = new Miniflare({ ...common, scriptPath: 'dist/server/index.js', bindings: { QLOO_API_KEY: key, LIVE_CALLS_ENABLED: 'true' },
    outboundService(request) { calls.push(request.url); return new Response(null, { status: 302, headers: { location: 'https://api.qloo.com/v2/insights' } }); },
  });
  t.after(() => mf.dispose());
  const result = await mf.dispatchFetch('https://second-act.example/api/recover', body({ mode: 'live',
    inventory: scenario.inventory.slice(0, 2).map((f, i) => ({ ...f, qlooEntityId: uuid(i + 1) })),
    cohorts: [{ ...scenario.cohorts[0], anchors: [{ name: 'Spirited Away', kind: 'movie', qlooEntityId: uuid(3) }] }],
  }));
  const data = await result.json();
  assert.equal(result.status, 502); assert.equal(data.code, 'PROVIDER_REQUEST_REJECTED');
  assert.equal(calls.length, 1); assert.equal(new URL(calls[0]).origin, 'https://hackathon.api.qloo.com');
  assert.ok(!JSON.stringify(data).includes(key));
});
