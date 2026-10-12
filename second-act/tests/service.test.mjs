import test from 'node:test';
import assert from 'node:assert/strict';
import { recover, createNotice, scenario } from '../src/service.mjs';
import { scenario as canonicalScenario } from '../src/scenario.mjs';

const copy = (value) => structuredClone(value);
const input = (overrides = {}) => ({ ...copy(canonicalScenario), mode: 'sample', ...overrides });
const invalidInput = (error) => {
  assert.equal(error.status, 400);
  assert.equal(error.code, 'INVALID_INPUT');
  return true;
};
const uuid = (number) => `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const json = (value) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('sample defaults expose the scenario and return an auditable replacement without network calls', async () => {
  let calls = 0;
  const result = await recover({}, {}, { fetchImpl: async () => { calls++; throw new Error('Sample must stay offline'); } });
  assert.deepEqual(scenario, canonicalScenario);
  assert.equal(calls, 0);
  assert.equal(result.mode, 'sample');
  assert.equal(result.chosen.film.id, 'wilderpeople');
  assert.equal(result.baseline.film.id, 'sing-street');
  assert.equal(result.metrics.minimumGain, 39);
  assert.deepEqual(result.cohorts, canonicalScenario.cohorts);
  assert.deepEqual(result.inventory, canonicalScenario.inventory);
  assert.deepEqual(result.constraints, canonicalScenario.constraints);
  assert.equal(result.fairness, canonicalScenario.fairness);
  assert.deepEqual(result.excludedIds, []);
  assert.equal(result.incident.originalTitle, canonicalScenario.incident.originalTitle);
  assert.ok(result.evidence && typeof result.evidence === 'object');
  assert.ok(Array.isArray(result.trace));
  assert.equal(typeof result.methodology, 'string');
  assert.ok(Number.isFinite(Date.parse(result.createdAt)));
});

test('recover keeps caller state unchanged across exclusions and constraints', async () => {
  const body = input({ excludedIds: ['wilderpeople'], constraints: { ...canonicalScenario.constraints, budget: 180 } });
  const before = copy(body);
  const result = await recover(body, {});
  assert.deepEqual(body, before);
  assert.notEqual(result.chosen?.film.id, 'wilderpeople');
  assert.ok(result.ranked.every((row) => row.film.cost <= 180));
  assert.ok(result.blocked.find((row) => row.film.id === 'wilderpeople').reasonCodes.includes('excluded'));
});

test('automatic cancelled-title exclusions stay bounded and returned state can be replayed', async () => {
  const inventory = [
    { ...copy(canonicalScenario.inventory[0]), id: 'import-original', title: 'Moonrise Kingdom' },
    copy(canonicalScenario.inventory[0]),
  ];
  const excludedIds = Array.from({ length: 20 }, (_, index) => `stale-${index}`);
  const result = await recover(input({ inventory, excludedIds }), {});
  assert.deepEqual(result.excludedIds, ['import-original']);
  const replay = await recover(result, {});
  assert.deepEqual(replay.excludedIds, result.excludedIds);
  assert.equal(replay.chosen.film.id, result.chosen.film.id);
});

test('sample evidence survives organizer renaming and cohort sizes but uses new weighted sizes', async () => {
  const cohorts = copy(canonicalScenario.cohorts);
  cohorts[0].name = 'Saturday members';
  cohorts[0].size = 1;
  cohorts[1].size = 1;
  cohorts[2].size = 100;
  const result = await recover(input({ cohorts, fairness: 0 }), {});
  assert.equal(result.cohorts[0].name, 'Saturday members');
  assert.equal(result.chosen.film.id, 'farewell');
  assert.deepEqual(result.chosen.scores, { regulars: 77, newcomers: 82, filmclub: 91 });
  assert.ok(Math.abs(result.chosen.mean - (77 + 82 + 9100) / 102) < 1e-10);
});

test('sample data never labels a changed movie title or unfamiliar ID as evidenced', async (t) => {
  for (const override of [{ title: 'An unrelated film' }, { id: 'imported-film' }]) {
    await t.test(JSON.stringify(override), async () => {
      const film = { ...copy(canonicalScenario.inventory[0]), ...override };
      const result = await recover(input({ inventory: [film] }), {});
      assert.equal(result.infeasible, true);
      assert.equal(result.chosen, null);
      assert.ok(result.blocked[0].reasonCodes.includes('missing_evidence'));
      assert.deepEqual(result.relaxations, []);
    });
  }
});

test('changing a cohort taste anchor or cohort identity invalidates fixture evidence', async (t) => {
  const variants = [
    { id: 'new-taste-group' },
    { anchors: [{ kind: 'movie', name: 'Alien' }, { kind: 'artist', name: 'David Bowie' }] },
    { anchors: [{ kind: 'book', name: 'The Grand Budapest Hotel' }, { kind: 'artist', name: 'David Bowie' }] },
  ];
  for (const override of variants) {
    await t.test(JSON.stringify(override), async () => {
      const cohorts = copy(canonicalScenario.cohorts);
      cohorts[0] = { ...cohorts[0], ...override };
      const result = await recover(input({ cohorts }), {});
      assert.equal(result.infeasible, true);
      assert.equal(result.chosen, null);
      assert.ok(result.blocked.every((row) => row.reasonCodes.includes('missing_evidence')));
      assert.deepEqual(result.relaxations, []);
    });
  }
});

test('an imported inventory must carry a complete rights ledger before provider access', async (t) => {
  for (const field of ['rightsStart', 'rightsEnd', 'territory', 'screeningsRemaining']) {
    await t.test(`missing ${field}`, async () => {
      const film = copy(canonicalScenario.inventory[0]);
      delete film[field];
      let calls = 0;
      await assert.rejects(recover(input({ mode: 'live', inventory: [film] }), { QLOO_API_KEY: 'test' }, {
        fetchImpl: async () => { calls++; throw new Error('Validation must happen first'); },
      }), invalidInput);
      assert.equal(calls, 0);
    });
  }
});

test('collection and taste-anchor caps reject excess work before network access', async (t) => {
  const variants = [
    { inventory: Array.from({ length: 21 }, (_, i) => ({ ...copy(canonicalScenario.inventory[0]), id: `film-${i}` })) },
    { cohorts: Array.from({ length: 4 }, (_, i) => ({ ...copy(canonicalScenario.cohorts[0]), id: `group-${i}` })) },
    { cohorts: [{ ...copy(canonicalScenario.cohorts[0]), anchors: Array.from({ length: 3 }, (_, i) => ({ kind: 'movie', name: `Anchor ${i}` })) }] },
  ];
  for (const overrides of variants) {
    await t.test(Object.keys(overrides)[0], async () => {
      let calls = 0;
      await assert.rejects(recover(input({ ...overrides, mode: 'live' }), { QLOO_API_KEY: 'test' }, {
        fetchImpl: async () => { calls++; },
      }), invalidInput);
      assert.equal(calls, 0);
    });
  }
  const atLimit = Array.from({ length: 20 }, (_, i) => ({ ...copy(canonicalScenario.inventory[0]), id: `film-${i}` }));
  const accepted = await recover(input({ inventory: atLimit }), {});
  assert.equal(accepted.inventory.length, 20);
});

test('constraint and fairness validation rejects nonfinite or incorrectly typed numbers', async (t) => {
  const variants = [
    { constraints: { ...canonicalScenario.constraints, budget: -1 } },
    { constraints: { ...canonicalScenario.constraints, budget: Infinity } },
    { constraints: { ...canonicalScenario.constraints, budget: '220' } },
    { constraints: { ...canonicalScenario.constraints, maxRuntime: 0 } },
    { constraints: { ...canonicalScenario.constraints, maxRuntime: NaN } },
    { fairness: -0.1 }, { fairness: 1.1 }, { fairness: '0.7' }, { fairness: Infinity },
  ];
  for (const [index, overrides] of variants.entries()) {
    await t.test(String(index), async () => assert.rejects(recover(input(overrides), {}), invalidInput));
  }
  const noBudget = await recover(input({ constraints: { ...canonicalScenario.constraints, budget: 0 } }), {});
  assert.equal(noBudget.infeasible, true);
  for (const fairness of [0, 1]) assert.equal((await recover(input({ fairness }), {})).fairness, fairness);
});

test('event date and territory must be present and valid in an imported constraint object', async (t) => {
  for (const change of [{ eventDate: undefined }, { eventDate: '2026-02-30' }, { territory: undefined }, { territory: '' }]) {
    await t.test(JSON.stringify(change), async () => assert.rejects(recover(input({ constraints: { ...canonicalScenario.constraints, ...change } }), {}), invalidInput));
  }
});

test('inventory booleans, runtime and fee are validated strictly instead of coercing values', async (t) => {
  for (const override of [
    { available: undefined }, { available: 'true' }, { rightsConfirmed: undefined }, { rightsConfirmed: 1 },
    { runtime: 0 }, { runtime: '101' }, { runtime: Infinity }, { cost: -1 }, { cost: '180' }, { cost: NaN },
  ]) {
    await t.test(JSON.stringify(override), async () => assert.rejects(recover(input({ inventory: [{ ...copy(canonicalScenario.inventory[0]), ...override }] }), {}), invalidInput));
  }
  const unavailable = await recover(input({ inventory: [{ ...copy(canonicalScenario.inventory[0]), available: false }] }), {});
  assert.equal(unavailable.infeasible, true);
  assert.ok(unavailable.blocked[0].reasonCodes.includes('unavailable'));
});

test('cohort counts and bounded names reject invalid request data', async (t) => {
  const variants = [
    { cohorts: [{ ...copy(canonicalScenario.cohorts[0]), size: 0 }] },
    { cohorts: [{ ...copy(canonicalScenario.cohorts[0]), size: 1.5 }] },
    { cohorts: [{ ...copy(canonicalScenario.cohorts[0]), size: 10_001 }] },
    { cohorts: [{ ...copy(canonicalScenario.cohorts[0]), name: 'x'.repeat(201) }] },
    { inventory: [{ ...copy(canonicalScenario.inventory[0]), title: 'x'.repeat(201) }] },
    { cohorts: [{ ...copy(canonicalScenario.cohorts[0]), anchors: [{ kind: 'movie', name: 'x'.repeat(201) }] }] },
    { cohorts: [{ ...copy(canonicalScenario.cohorts[0]), anchors: [{ kind: 'website', name: 'Example' }] }] },
  ];
  for (const [index, overrides] of variants.entries()) await t.test(String(index), async () => assert.rejects(recover(input(overrides), {}), invalidInput));
});

test('request IDs reject empty, duplicate and prototype-special names', async (t) => {
  for (const id of ['', '__proto__', 'constructor', 'prototype']) {
    await t.test(`film ${id}`, async () => assert.rejects(recover(input({ inventory: [{ ...copy(canonicalScenario.inventory[0]), id }] }), {}), invalidInput));
    await t.test(`cohort ${id}`, async () => assert.rejects(recover(input({ cohorts: [{ ...copy(canonicalScenario.cohorts[0]), id }] }), {}), invalidInput));
  }
  const film = copy(canonicalScenario.inventory[0]);
  await assert.rejects(recover(input({ inventory: [film, copy(film)] }), {}), invalidInput);
  const cohort = copy(canonicalScenario.cohorts[0]);
  await assert.rejects(recover(input({ cohorts: [cohort, copy(cohort)] }), {}), invalidInput);
  assert.equal({}.polluted, undefined);
});

test('unsupported modes and malformed top-level input get a client validation error', async (t) => {
  for (const body of [null, [], 'sample', input({ mode: 'automatic' }), input({ excludedIds: 'wilderpeople' })]) {
    await t.test(String(body), async () => assert.rejects(recover(body, {}), invalidInput));
  }
});

test('live mode with no API key fails before making a request and never substitutes sample evidence', async () => {
  let calls = 0;
  await assert.rejects(recover(input({ mode: 'live' }), {}, { fetchImpl: async () => { calls++; } }), (error) => {
    assert.equal(error.code, 'MISSING_API_KEY');
    assert.equal(error.provider, 'qloo');
    return true;
  });
  assert.equal(calls, 0);
});

test('live provider sees the fixed full inventory before rights, budget or exclusion filtering', async () => {
  const inventory = copy(canonicalScenario.inventory.slice(0, 3)).map((film, index) => ({ ...film, qlooEntityId: uuid(index + 1) }));
  const cohorts = copy(canonicalScenario.cohorts).map((cohort, index) => ({ ...cohort, anchors: cohort.anchors.map((anchor, anchorIndex) => ({ ...anchor, qlooEntityId: uuid(10 + index * 2 + anchorIndex) })) }));
  const requests = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/v2/insights');
    const requested = parsed.searchParams.get('filter.results.entities').split(',');
    requests.push(requested);
    return json({ results: { entities: requested.map((entity_id) => ({ entity_id, subtype: 'urn:entity:movie' })) } });
  };
  const env = { QLOO_API_KEY: 'test-server-secret' };
  const open = await recover(input({ mode: 'live', inventory, cohorts, constraints: { ...canonicalScenario.constraints, budget: 1000, maxRuntime: 150 } }), env, { fetchImpl });
  const tight = await recover(input({ mode: 'live', inventory, cohorts, constraints: { ...canonicalScenario.constraints, budget: 160, maxRuntime: 110 }, excludedIds: ['wilderpeople'] }), env, { fetchImpl });
  assert.equal(requests.length, 6);
  for (const request of requests) assert.deepEqual(request, inventory.map((film) => film.qlooEntityId));
  assert.equal(open.provider, 'qloo');
  assert.equal(tight.provider, 'qloo');
  assert.equal(tight.mode, 'live');
  assert.equal(tight.chosen.film.id, 'sing-street');
  assert.deepEqual(tight.chosen.scores, open.ranked.find((row) => row.film.id === 'sing-street').scores);
  assert.equal(tight.chosen.minimum, 0);
  assert.ok(!JSON.stringify(tight).includes(env.QLOO_API_KEY));
});

test('the cancelled original stays excluded under an imported ID, normalized title and spoofed incident', async () => {
  const inventory = [
    { ...copy(canonicalScenario.inventory[0]), id: 'import-original', title: ' mOoNrIsE   KiNgDoM ', qlooEntityId: uuid(1) },
    { ...copy(canonicalScenario.inventory[0]), qlooEntityId: uuid(2) },
  ];
  const cohorts = copy(canonicalScenario.cohorts).map((cohort, index) => ({
    ...cohort,
    anchors: cohort.anchors.map((anchor, anchorIndex) => ({ ...anchor, qlooEntityId: uuid(10 + index * 2 + anchorIndex) })),
  }));
  let calls = 0;
  const result = await recover(input({
    mode: 'live', inventory, cohorts,
    incident: { ...canonicalScenario.incident, originalTitle: 'A different cancelled film' },
  }), { QLOO_API_KEY: 'test-server-secret' }, {
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      assert.equal(parsed.pathname, '/v2/insights');
      assert.deepEqual(parsed.searchParams.get('filter.results.entities').split(','), [uuid(1), uuid(2)]);
      calls++;
      return json({ results: { entities: [
        { entity_id: uuid(1), subtype: 'urn:entity:movie' },
        { entity_id: uuid(2), subtype: 'urn:entity:movie' },
      ] } });
    },
  });
  assert.equal(calls, cohorts.length);
  assert.equal(result.incident.originalTitle, canonicalScenario.incident.originalTitle);
  assert.equal(result.chosen.film.id, 'wilderpeople');
  assert.equal(result.chosen.minimum, 0);
  assert.ok(result.excludedIds.includes('import-original'));
  for (const cohort of cohorts) assert.equal(result.evidence['import-original'][cohort.id].value, 100);
  assert.ok(result.blocked.find((row) => row.film.id === 'import-original').reasonCodes.includes('excluded'));
  assert.ok(result.ranked.every((row) => row.film.id !== 'import-original'));
  assert.ok(result.relaxations.every((row) => row.film.id !== 'import-original'));
});

test('createNotice validates a selected film before contacting its provider', async (t) => {
  for (const body of [null, {}, { film: null }, { film: { title: '' } }, { film: { title: 'x'.repeat(201) } }]) {
    await t.test(JSON.stringify(body), async () => {
      let calls = 0;
      await assert.rejects(createNotice(body, {}, { fetchImpl: async () => { calls++; } }), invalidInput);
      assert.equal(calls, 0);
    });
  }
});

test('createNotice rejects malformed screening facts and evidence before making a model call', async (t) => {
  const facts = {
    film: { title: 'Hunt for the Wilderpeople', runtime: 101, cost: 180 },
    incident: { originalTitle: 'Moonrise Kingdom', eventDate: '2026-10-24', startTime: '19:30', venue: 'The Lantern Cinema', reason: 'Distributor withdrawal' },
    evidence: { provider: 'sample', minimum: 82, mean: 85, cohortNames: ['Regulars'] },
  };
  const variants = [
    { film: { ...facts.film, runtime: 0 } },
    { film: { ...facts.film, cost: -1 } },
    { incident: { ...facts.incident, eventDate: '2026-02-30' } },
    { incident: { ...facts.incident, startTime: '25:00' } },
    { incident: { ...facts.incident, venue: '' } },
    { evidence: { ...facts.evidence, provider: 'invented' } },
    { evidence: { ...facts.evidence, minimum: -1 } },
    { evidence: { ...facts.evidence, mean: Infinity } },
    { evidence: { ...facts.evidence, cohortNames: ['A', 'B', 'C', 'D'] } },
  ];
  let calls = 0;
  for (const [index, overrides] of variants.entries()) {
    await t.test(String(index), async () => assert.rejects(createNotice({ ...copy(facts), ...overrides }, {
      NEBIUS_API_KEY: 'test-nebius-secret', NEBIUS_MODEL: 'nvidia/Nemotron-Example',
    }, { fetchImpl: async () => { calls++; } }), invalidInput));
  }
  assert.equal(calls, 0);
});

test('createNotice sends only bounded public facts and returns a labeled model draft', async () => {
  let payload;
  const result = await createNotice({
    film: { title: 'Hunt for the Wilderpeople', runtime: 101, cost: 180, rightsConfirmed: true, privateContract: 'PRIVATE-LEDGER' },
    incident: { originalTitle: 'Moonrise Kingdom', eventDate: '2026-10-24', startTime: '19:30', venue: 'The Lantern Cinema', reason: 'Distributor withdrawal', customerEmails: ['PRIVATE-EMAIL'] },
    evidence: { provider: 'sample', minimum: 82, mean: 85, cohortNames: ['Regulars'], hiddenKey: 'PRIVATE-EVIDENCE' },
    arbitraryInstructions: 'PRIVATE-INSTRUCTIONS',
  }, { NEBIUS_API_KEY: 'test-nebius-secret', NEBIUS_MODEL: 'nvidia/Nemotron-Example' }, {
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.tokenfactory.nebius.com/v1/chat/completions');
      payload = JSON.parse(options.body);
      return json({ choices: [{ message: { content: 'We propose Hunt for the Wilderpeople as the replacement, pending final organizer checks.' } }] });
    },
  });
  const sent = JSON.stringify(payload);
  for (const value of ['PRIVATE-LEDGER', 'PRIVATE-EMAIL', 'PRIVATE-EVIDENCE', 'PRIVATE-INSTRUCTIONS', 'test-nebius-secret']) assert.ok(!sent.includes(value));
  assert.equal(result.generated, true);
  assert.equal(result.provider, 'nebius');
  assert.match(result.notice, /pending/);
  assert.match(result.disclosure, /AI-generated/);
});
