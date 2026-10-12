import test from 'node:test';
import assert from 'node:assert/strict';
import { rankInventory } from '../src/engine.mjs';
import { scenario, sampleSupport, constraints as eventConstraints } from '../src/scenario.mjs';

const film = (id, overrides = {}) => ({ id, title: id, runtime: 90, cost: 200, available: true, rightsConfirmed: true, ...overrides });
const cohorts = [{ id: 'majority', name: 'Regulars', size: 90 }, { id: 'minority', name: 'Newcomers', size: 10 }];
const evidence = (a, b, source = 'sample') => ({ majority: { value: a, source }, minority: { value: b, source } });
const request = (overrides = {}) => ({
  inventory: [film('popular'), film('bridge')],
  cohorts,
  support: { popular: evidence(100, 10), bridge: evidence(70, 65) },
  constraints: { budget: 300, maxRuntime: 120, eventDate: '2026-10-20', territory: 'US' },
  ...overrides,
});

test('minority protection chooses a shared-fit film over the popular baseline', () => {
  const result = rankInventory(request());
  assert.equal(result.chosen.film.id, 'bridge');
  assert.equal(result.baseline.film.id, 'popular');
  assert.equal(result.chosen.minimum, 65);
  assert.equal(result.chosen.weakestCohort, 'minority');
  assert.deepEqual(result.chosen.scores, { majority: 70, minority: 65 });
  assert.ok(Math.abs(result.chosen.mean - 69.5) < 1e-10);
  assert.equal(result.metrics.minimumGain, 55);
  assert.equal(result.infeasible, false);
});

test('fairness endpoints select the weighted mean or worst-cohort objective', () => {
  assert.equal(rankInventory(request({ fairness: 0 })).chosen.film.id, 'popular');
  const result = rankInventory(request({ fairness: 1 }));
  assert.equal(result.chosen.film.id, 'bridge');
  assert.equal(result.chosen.utility, 65);
});

test('unavailable, unlicensed and explicitly excluded titles never win or relax', () => {
  for (const overrides of [{ available: false }, { rightsConfirmed: false }]) {
    const result = rankInventory(request({ inventory: [film('popular', overrides), film('bridge')] }));
    assert.equal(result.chosen.film.id, 'bridge');
    assert.equal(result.blocked[0].film.id, 'popular');
    assert.deepEqual(result.relaxations, []);
  }
  const result = rankInventory(request({ excludedIds: ['bridge'] }));
  assert.equal(result.chosen.film.id, 'popular');
  assert.ok(result.blocked[0].reasonCodes.includes('excluded'));
});

test('missing cohort evidence disqualifies a title; genuine zero remains valid', () => {
  const result = rankInventory(request({ support: { popular: { majority: { value: 100, source: 'qloo' } }, bridge: evidence(0, 0) } }));
  assert.equal(result.chosen.film.id, 'bridge');
  assert.equal(result.chosen.utility, 0);
  assert.equal(result.blocked[0].issues.find((issue) => issue.code === 'missing_evidence').cohortId, 'minority');
  assert.deepEqual(result.relaxations, []);
});

test('invalid evidence never contaminates scores or treats missing values as zero', () => {
  for (const value of [NaN, Infinity, -1, 101, '60', null, undefined]) {
    const result = rankInventory(request({ support: { popular: evidence(value, 100), bridge: evidence(70, 65) } }));
    assert.equal(result.chosen.film.id, 'bridge');
    assert.ok(result.blocked[0].reasonCodes.includes('invalid_evidence'));
  }
  const badSource = rankInventory(request({ support: { popular: evidence(100, 100, 'inferred'), bridge: evidence(70, 65) } }));
  assert.equal(badSource.chosen.film.id, 'bridge');
});

test('all impossible yields null choices and exact, explicit constraint relaxations', () => {
  const result = rankInventory(request({
    inventory: [film('popular', { cost: 500, runtime: 150 }), film('bridge', { available: false, cost: 600, runtime: 160 })],
  }));
  assert.equal(result.chosen, null);
  assert.equal(result.baseline, null);
  assert.equal(result.infeasible, true);
  assert.equal(result.metrics.chosenMinimum, null);
  assert.equal(result.metrics.minimumGain, null);
  assert.equal(result.relaxations.length, 1);
  assert.equal(result.relaxations[0].film.id, 'popular');
  assert.equal(result.relaxations[0].requiredBudget, 500);
  assert.equal(result.relaxations[0].requiredRuntime, 150);
  assert.equal(result.relaxations[0].budgetIncrease, 200);
  assert.equal(result.relaxations[0].runtimeIncrease, 30);
  assert.deepEqual(new Set(result.blocked.find((row) => row.film.id === 'bridge').reasonCodes), new Set(['unavailable', 'budget', 'runtime']));
});

test('constraint equality qualifies and changing constraints never rescales evidence', () => {
  const tight = request({ inventory: [film('popular', { cost: 301 }), film('bridge', { cost: 300, runtime: 120 })] });
  const before = rankInventory(tight);
  const after = rankInventory({ ...tight, constraints: { ...tight.constraints, budget: 400 } });
  assert.equal(before.ranked.length, 1);
  assert.equal(after.ranked.length, 2);
  assert.deepEqual(before.chosen.scores, after.ranked.find((row) => row.film.id === 'bridge').scores);
  assert.equal(before.chosen.utility, after.ranked.find((row) => row.film.id === 'bridge').utility);
});

test('organizer-reported rights windows, territory and screening counts fail closed', () => {
  const cases = [
    [{ rightsStart: '2026-10-21' }, 'rights_not_started'],
    [{ rightsEnd: '2026-10-19' }, 'rights_expired'],
    [{ territory: 'CA' }, 'territory_mismatch'],
    [{ screeningsRemaining: 0 }, 'no_screenings_remaining'],
    [{ screeningsRemaining: -1 }, 'invalid_screenings_remaining'],
    [{ screeningsRemaining: 0.5 }, 'invalid_screenings_remaining'],
    [{ rightsStart: '2026-02-30' }, 'invalid_rights_start'],
    [{ rightsEnd: 'tomorrow' }, 'invalid_rights_end'],
    [{ rightsStart: '2026-11-01', rightsEnd: '2026-10-01' }, 'invalid_rights_window'],
  ];
  for (const [overrides, code] of cases) {
    const result = rankInventory(request({ inventory: [film('popular', overrides), film('bridge')] }));
    assert.ok(result.blocked[0].reasonCodes.includes(code), code);
    assert.equal(result.chosen.film.id, 'bridge');
    assert.deepEqual(result.relaxations, []);
  }
  const equality = rankInventory(request({ inventory: [film('popular', { rightsStart: '2026-10-20', rightsEnd: '2026-10-20', territory: 'us', screeningsRemaining: 1 })] }));
  assert.equal(equality.chosen.film.id, 'popular');
});

test('rights ledger cannot be validated without the relevant event fields', () => {
  const result = rankInventory(request({ inventory: [film('popular', { rightsStart: '2026-10-01', territory: 'US' })], constraints: { budget: 300, maxRuntime: 120 } }));
  assert.equal(result.infeasible, true);
  assert.deepEqual(new Set(result.blocked[0].reasonCodes), new Set(['missing_event_date', 'missing_event_territory']));
});

test('malformed runtime and fee block films, and empty inventory is safely infeasible', () => {
  for (const overrides of [{ runtime: NaN }, { runtime: 0 }, { cost: -1 }, { cost: '200' }]) {
    const result = rankInventory(request({ inventory: [film('popular', overrides)] }));
    assert.equal(result.infeasible, true);
    assert.equal(result.relaxations.length, 0);
  }
  const empty = rankInventory(request({ inventory: [] }));
  assert.equal(empty.infeasible, true);
  assert.deepEqual(empty.ranked, []);
  assert.equal(empty.metrics.eligibleCount, 0);
});

test('ties are deterministic by title then ID, independent of input order', () => {
  const inventory = [film('z', { title: 'Same' }), film('a', { title: 'Same' }), film('b', { title: 'Earlier' })];
  const support = Object.fromEntries(inventory.map((entry) => [entry.id, evidence(50, 50)]));
  const first = rankInventory(request({ inventory, support }));
  const reversed = rankInventory(request({ inventory: [...inventory].reverse(), cohorts: [...cohorts].reverse(), support }));
  assert.deepEqual(first.ranked.map((row) => row.film.id), ['b', 'a', 'z']);
  assert.deepEqual(reversed.ranked.map((row) => row.film.id), ['b', 'a', 'z']);
  assert.equal(first.chosen.weakestCohort, 'majority');
  assert.equal(reversed.chosen.weakestCohort, 'majority');
});

test('provider scores and Qloo zero-based rank metadata are preserved without reinterpretation', () => {
  const support = { popular: { majority: { value: 100, source: 'qloo', rank: 0, count: 1 }, minority: { value: 25, source: 'qloo', rank: 3, count: 5 } } };
  const result = rankInventory(request({ inventory: [film('popular')], support }));
  assert.deepEqual(result.chosen.scores, { majority: 100, minority: 25 });
  assert.deepEqual(result.chosen.support, support.popular);
});

test('request validation rejects invalid shapes and nonfinite constraints', () => {
  const invalid = [
    { inventory: null },
    { inventory: [film('duplicate'), film('duplicate')] },
    { inventory: [film('a', { title: '' })] },
    { cohorts: [] },
    { cohorts: [{ id: 'a', name: 'A', size: 0 }] },
    { cohorts: [{ id: 'a', name: 'A', size: Infinity }] },
    { support: null },
    { constraints: { budget: Infinity, maxRuntime: 120 } },
    { constraints: { budget: -1, maxRuntime: 120 } },
    { constraints: { budget: 0, maxRuntime: NaN } },
    { constraints: { budget: 0, maxRuntime: 0 } },
    { constraints: { budget: 0, maxRuntime: 90, eventDate: '2026-02-30' } },
    { fairness: NaN },
    { fairness: -0.1 },
    { fairness: 1.1 },
    { excludedIds: 'popular' },
  ];
  for (const overrides of invalid) assert.throws(() => rankInventory(request(overrides)));
  assert.throws(() => rankInventory());
});

test('large cohort counts remain finite and input data is not mutated', () => {
  const input = request({ cohorts: [{ id: 'majority', name: 'Regulars', size: Number.MAX_SAFE_INTEGER }, { id: 'minority', name: 'Newcomers', size: Number.MAX_SAFE_INTEGER }] });
  const original = structuredClone(input);
  const result = rankInventory(input);
  assert.deepEqual(input, original);
  for (const row of result.ranked) {
    for (const score of [row.minimum, row.mean, row.utility]) assert.ok(Number.isFinite(score));
  }
  for (const value of Object.values(result.metrics)) assert.ok(value === null || Number.isFinite(value));
});

test('inherited evidence does not satisfy a missing cohort', () => {
  const inherited = Object.create({ minority: { value: 100, source: 'sample' } });
  inherited.majority = { value: 100, source: 'sample' };
  const result = rankInventory(request({ support: { popular: inherited, bridge: evidence(70, 65) } }));
  assert.equal(result.chosen.film.id, 'bridge');
  assert.ok(result.blocked[0].reasonCodes.includes('missing_evidence'));
});

test('evidence provenance must be an own field and survive serialization', () => {
  const inheritedSource = Object.assign(Object.create({ source: 'qloo' }), { value: 100 });
  const result = rankInventory(request({ support: { popular: { majority: inheritedSource, minority: { value: 100, source: 'qloo' } }, bridge: evidence(70, 65) } }));
  assert.equal(result.chosen.film.id, 'bridge');
  assert.ok(result.blocked[0].reasonCodes.includes('invalid_evidence'));
  assert.equal(JSON.parse(JSON.stringify(result.chosen.support)).majority.source, 'sample');
});

test('cohort permutation cannot change a close result through floating-point addition order', () => {
  const groups = ['c1', 'c2', 'c3', 'c4'].map((id) => ({ id, name: id, size: 1 }));
  const byGroup = (values) => Object.fromEntries(groups.map((group, index) => [group.id, { value: values[index], source: 'sample' }]));
  const input = request({
    inventory: [film('a'), film('b')], cohorts: groups, fairness: 0,
    support: { a: byGroup([100, 1e-14, 1e-14, 0]), b: byGroup([1e-14, 1e-14, 100, 0]) },
  });
  const first = rankInventory(input);
  const second = rankInventory({ ...input, cohorts: [...groups].reverse() });
  assert.equal(first.chosen.film.id, second.chosen.film.id);
  assert.deepEqual(first.ranked.map((row) => [row.film.id, row.mean]), second.ranked.map((row) => [row.film.id, row.mean]));
});

test('the actual demonstration imports its event limits and reported rights ledger', () => {
  const result = rankInventory({ ...scenario, support: sampleSupport });
  assert.equal(result.chosen.film.id, 'wilderpeople');
  assert.equal(result.baseline.film.id, 'sing-street');
  assert.equal(result.metrics.minimumGain, 39);
  for (const entry of result.ranked) {
    assert.ok(entry.film.cost <= eventConstraints.budget);
    assert.ok(entry.film.runtime <= eventConstraints.maxRuntime);
  }
  assert.ok(result.blocked.find((entry) => entry.film.id === 'grand-budapest').reasonCodes.includes('rights_expired'));
  assert.ok(result.blocked.find((entry) => entry.film.id === 'before-sunrise').reasonCodes.includes('territory_mismatch'));
  assert.ok(result.blocked.find((entry) => entry.film.id === 'princess').reasonCodes.includes('no_screenings_remaining'));
});
