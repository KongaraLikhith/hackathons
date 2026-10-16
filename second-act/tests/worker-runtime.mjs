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
  for (const entry of [...scenario.inventory.map(f => ({ name: f.title, kind: 'movie', year: f.year })), ...scenario.cohorts.flatMap(c => c.anchors)]) {
    const mapKey = `${entry.kind}:${entry.name}`;
    if (!identities.has(mapKey)) identities.set(mapKey, { entity_id: uuid(next++), name: entry.name, type: 'urn:entity', subtype: `urn:entity:${entry.kind}`, ...(entry.year ? { properties: { release_year: entry.year } } : {}) });
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

test('built Worker resolves same-name film years and returns all remaining identity choices for one confirmation', async t => {
  const identities = new Map(); let next = 30; const calls = [];
  for (const entry of [...scenario.inventory.map(f => ({ name: f.title, kind: 'movie', year: f.year })), ...scenario.cohorts.flatMap(c => c.anchors)]) {
    const mapKey = `${entry.kind}:${entry.name}`;
    if (!identities.has(mapKey)) identities.set(mapKey, { entity_id: uuid(next++), name: entry.name, type: 'urn:entity', subtype: `urn:entity:${entry.kind}`, ...(entry.year ? { properties: { release_year: entry.year } } : {}) });
  }
  const mf = new Miniflare({ ...common, scriptPath: 'dist/server/index.js', bindings: { QLOO_API_KEY: key, LIVE_CALLS_ENABLED: 'true' },
    outboundService(request) {
      const url = new URL(request.url); calls.push(url);
      if (url.pathname === '/search') {
        const kind = url.searchParams.get('types').split(':').at(-1);
        const name = url.searchParams.get('query');
        const entity = identities.get(`${kind}:${name}`);
        if (kind === 'movie' && name === 'Chef') return response({ results: [entity, { ...entity, entity_id: uuid(800), properties: { release_year: 2017 } }] });
        if (name === 'Norwegian Wood' || name === 'David Bowie') return response({ results: [entity,
          { ...entity, entity_id: uuid(name === 'Norwegian Wood' ? 801 : 802), disambiguation: 'Another fixture work', properties: { description: 'Fixture description; not a default identity.' }, untrusted: 'not returned to the client' },
        ] });
        return response({ results: entity ? [entity] : [] });
      }
      return response({ results: { entities: url.searchParams.get('filter.results.entities').split(',').map(id => ({ entity_id: id, subtype: 'urn:entity:movie' })) } });
    },
  });
  t.after(() => mf.dispose());
  const result = await mf.dispatchFetch('https://second-act.example/api/recover', body({ mode: 'live' }));
  const data = await result.json();
  assert.equal(result.status, 422, JSON.stringify(data));
  assert.equal(data.resolutions.length, 2);
  assert.ok(data.resolutions.every(r => r.target.type === 'anchor' && r.candidates.length === 2));
  assert.ok(data.resolvedEntities.some(r => r.target.filmId === 'chef'));
  assert.ok(!JSON.stringify(data).includes('untrusted'));
  assert.ok(!JSON.stringify(data).includes(key));
  assert.equal(calls.filter(u => u.pathname === '/v2/insights').length, 0);
  const replay = { ...structuredClone(scenario), mode: 'live' };
  function bind(target, entityId) {
    const entry = target.type === 'inventory' ? replay.inventory.find(f => f.id === target.filmId) : replay.cohorts.find(c => c.id === target.cohortId).anchors[target.anchorIndex];
    entry.qlooEntityId = entityId;
  }
  for (const r of data.resolvedEntities) bind(r.target, r.entityId);
  for (const r of data.resolutions) bind(r.target, r.candidates[0].entityId);
  const searches = calls.filter(u => u.pathname === '/search').length;
  const continued = await mf.dispatchFetch('https://second-act.example/api/recover', body(replay));
  const complete = await continued.json();
  assert.equal(continued.status, 200, JSON.stringify(complete));
  assert.equal(complete.provider, 'qloo'); assert.equal(complete.chosen.film.id, 'wilderpeople');
  assert.equal(calls.filter(u => u.pathname === '/search').length, searches);
  assert.equal(calls.filter(u => u.pathname === '/v2/insights').length, 3);
});
