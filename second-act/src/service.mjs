import { rankInventory } from './engine.mjs';
import { getLiveEvidence, getModelNotice } from './providers.mjs';
import { scenario as authoredScenario, sampleSupport } from './scenario.mjs';

// Keep the authored fixture separate from caller-owned request/response objects.
const DEFAULTS = structuredClone(authoredScenario);
const FIXTURE_SUPPORT = structuredClone(sampleSupport);
const FIXTURE_FILMS = new Map(DEFAULTS.inventory.map((film) => [film.id, film]));
const FIXTURE_COHORTS = new Map(DEFAULTS.cohorts.map((cohort) => [cohort.id, cohort]));
const DANGEROUS_IDS = new Set([...Object.getOwnPropertyNames(Object.prototype), 'prototype']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAMPLE_METHODOLOGY = 'Authored demonstration evidence: synthetic cohort-relative indices from 0 to 100, not Qloo responses, enjoyment probabilities, measured preferences, or attendance predictions. Evidence belongs only to its original movie identity and cohort taste anchors. Budget and runtime changes do not rescale it.';

export const scenario = structuredClone(DEFAULTS);

export class ServiceError extends Error {
  constructor(message, { code = 'INVALID_INPUT', status = 400 } = {}) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.status = status;
  }
}

/** Validate bounded organizer data, obtain explicit evidence, then rank it. */
export async function recover(body = {}, env = {}, { fetchImpl } = {}) {
  requireRecord(body, 'Recovery input');
  const mode = body.mode === undefined ? 'sample' : body.mode;
  if (mode !== 'sample' && mode !== 'live') invalid('mode must be sample or live.');
  const inventory = validateInventory(body.inventory === undefined ? DEFAULTS.inventory : body.inventory);
  const cohorts = validateCohorts(body.cohorts === undefined ? DEFAULTS.cohorts : body.cohorts);
  const constraints = validateConstraints(body.constraints === undefined ? DEFAULTS.constraints : body.constraints);
  const fairness = body.fairness === undefined ? DEFAULTS.fairness : body.fairness;
  boundedNumber(fairness, 'fairness', 0, 1);
  const requestedExclusions = validateExcluded(body.excludedIds === undefined ? [] : body.excludedIds);
  const inventoryIds = new Set(inventory.map((film) => film.id));
  // Exclusions refer to the current inventory. Dropping stale IDs also keeps
  // returned state within the same 20-film cap after automatic cancellation
  // exclusions are added, so a returned recovery can be submitted again.
  const excludedIds = requestedExclusions.filter((filmId) => inventoryIds.has(filmId));

  // This application recovers the fixed demonstration incident. A posted
  // incident or arbitrary film ID cannot override the cancelled title check.
  const cancelled = inventory.filter((film) => normalizedTitle(film.title) === normalizedTitle(DEFAULTS.incident.originalTitle));
  for (const film of cancelled) if (!excludedIds.includes(film.id)) excludedIds.push(film.id);
  const incident = { ...DEFAULTS.incident, eventDate: constraints.eventDate, audience: cohorts.reduce((total, cohort) => total + cohort.size, 0) };
  const trace = [
    { tool: 'catalog.validate', status: 'ok', detail: `Validated ${inventory.length} complete organizer-reported catalog records and ${cohorts.length} cohort profiles. Dates, territory and screening counts are reported constraints; this does not verify legal authority.` },
    { tool: 'incident.exclude', status: 'ok', detail: `${cancelled.length} inventory title(s) matching the cancelled original were excluded independently of their IDs. The recovery incident is ${DEFAULTS.incident.id}.` },
  ];

  let evidence;
  let methodology;
  if (mode === 'live') {
    // Preserve the reference pool. Eligibility constraints are applied after
    // Qloo returns an ordered list for the entire supplied inventory.
    const result = await getLiveEvidence({ inventory, cohorts }, env, { fetchImpl });
    evidence = result.support;
    methodology = result.methodology;
    trace.push(...result.trace);
  } else {
    const result = getSampleEvidence(inventory, cohorts);
    evidence = result.support;
    methodology = SAMPLE_METHODOLOGY;
    trace.push(...result.trace);
  }

  const ranking = rankInventory({ inventory, cohorts, support: evidence, constraints, excludedIds, fairness });
  trace.push(
    { tool: 'rank.score', status: ranking.infeasible ? 'blocked' : 'ok', detail: `${ranking.ranked.length} eligible replacement(s); ${ranking.blocked.length} blocked. Utility mixes the weakest cohort (${Math.round(fairness * 100)}%) with the size-weighted mean (${Math.round((1 - fairness) * 100)}%).` },
    { tool: 'repair.plan', status: ranking.relaxations.length ? 'ok' : 'blocked', detail: `${ranking.relaxations.length} otherwise valid candidate(s) have explicit budget/runtime adjustments. No constraint was changed automatically; rights, availability and missing evidence cannot be relaxed.` },
  );

  return {
    ...ranking, mode, provider: mode === 'sample' ? 'sample' : 'qloo',
    evidence, trace, methodology, incident, cohorts, inventory, constraints,
    fairness, excludedIds, createdAt: new Date().toISOString(),
  };
}

/** Draft from bounded public facts. Extra ledger/private fields are omitted. */
export async function createNotice(body, env = {}, { fetchImpl } = {}) {
  requireRecord(body, 'Notice input');
  requireRecord(body.film, 'film');
  requireRecord(body.incident, 'incident');
  requireRecord(body.evidence, 'evidence');
  const film = {
    title: text(body.film.title, 'film.title'),
    runtime: positiveNumber(body.film.runtime, 'film.runtime'),
    cost: nonnegativeNumber(body.film.cost, 'film.cost'),
  };
  const incident = {
    originalTitle: text(body.incident.originalTitle, 'incident.originalTitle'),
    eventDate: date(body.incident.eventDate, 'incident.eventDate'),
    startTime: time(body.incident.startTime, 'incident.startTime'),
    venue: text(body.incident.venue, 'incident.venue'),
    reason: text(body.incident.reason, 'incident.reason', 500),
  };
  const provider = body.evidence.provider;
  if (provider !== 'sample' && provider !== 'qloo') invalid('evidence.provider must be sample or qloo.');
  const names = body.evidence.cohortNames;
  if (!Array.isArray(names) || names.length > 3) invalid('evidence.cohortNames must be an array with at most 3 names.');
  const evidence = {
    provider,
    minimum: boundedNumber(body.evidence.minimum, 'evidence.minimum', 0, 100),
    mean: boundedNumber(body.evidence.mean, 'evidence.mean', 0, 100),
    cohortNames: names.map((name, index) => text(name, `evidence.cohortNames[${index}]`)),
  };
  return getModelNotice({ film, incident, evidence }, env, { fetchImpl });
}

function getSampleEvidence(inventory, cohorts) {
  const missingCohorts = cohorts.filter((cohort) => {
    const canonical = FIXTURE_COHORTS.get(cohort.id);
    return !canonical || anchorSignature(cohort.anchors) !== anchorSignature(canonical.anchors);
  });
  const validCohorts = new Set(cohorts.filter((cohort) => !missingCohorts.includes(cohort)).map((cohort) => cohort.id));
  const missingFilms = [];
  const support = Object.fromEntries(inventory.map((film) => {
    const canonical = FIXTURE_FILMS.get(film.id);
    if (!canonical || film.title !== canonical.title) {
      missingFilms.push(film.id);
      return [film.id, {}];
    }
    return [film.id, Object.fromEntries(cohorts.filter((cohort) => validCohorts.has(cohort.id)).map((cohort) => [cohort.id, { ...FIXTURE_SUPPORT[film.id][cohort.id] }]))];
  }));
  const missing = missingFilms.length > 0 || missingCohorts.length > 0;
  return {
    support,
    trace: [{
      tool: 'sample.evidence', status: missing ? 'error' : 'ok',
      ...(missing ? { code: 'MISSING_SAMPLE_EVIDENCE' } : {}),
      detail: missing
        ? `MISSING_SAMPLE_EVIDENCE: ${missingFilms.length} changed or unknown movie identity/identities and ${missingCohorts.length} changed or unknown cohort taste profile(s). Their fixture evidence is absent; use live Qloo evidence or restore the authored identities and anchors.`
        : 'Using visibly labeled authored sample indices for unchanged movie identities and cohort taste anchors. No provider was called.',
    }],
  };
}

function validateInventory(value) {
  collection(value, 'inventory', 20, true);
  uniqueIds(value, 'inventory');
  return value.map((entry, index) => {
    const label = `inventory[${index}]`;
    const film = {
      id: id(entry.id, `${label}.id`),
      title: text(entry.title, `${label}.title`),
      runtime: positiveNumber(entry.runtime, `${label}.runtime`),
      cost: nonnegativeNumber(entry.cost, `${label}.cost`),
      available: boolean(entry.available, `${label}.available`),
      rightsConfirmed: boolean(entry.rightsConfirmed, `${label}.rightsConfirmed`),
      rightsStart: date(entry.rightsStart, `${label}.rightsStart`),
      rightsEnd: date(entry.rightsEnd, `${label}.rightsEnd`),
      territory: text(entry.territory, `${label}.territory`, 100),
      screeningsRemaining: integer(entry.screeningsRemaining, `${label}.screeningsRemaining`, 0, 10_000),
    };
    for (const field of ['director', 'genre', 'contractRef']) if (entry[field] !== undefined) film[field] = text(entry[field], `${label}.${field}`);
    if (entry.color !== undefined) film.color = color(entry.color, `${label}.color`);
    if (entry.year !== undefined) film.year = integer(entry.year, `${label}.year`, 0, 9999);
    if (entry.qlooEntityId !== undefined) film.qlooEntityId = entityId(entry.qlooEntityId, `${label}.qlooEntityId`);
    return film;
  });
}

function validateCohorts(value) {
  collection(value, 'cohorts', 3);
  uniqueIds(value, 'cohorts');
  return value.map((entry, index) => {
    const label = `cohorts[${index}]`;
    collection(entry.anchors, `${label}.anchors`, 2);
    const cohort = {
      id: id(entry.id, `${label}.id`),
      name: text(entry.name, `${label}.name`),
      size: integer(entry.size, `${label}.size`, 1, 10_000),
      anchors: entry.anchors.map((anchor, anchorIndex) => {
        const prefix = `${label}.anchors[${anchorIndex}]`;
        requireRecord(anchor, prefix);
        if (!['movie', 'artist', 'book'].includes(anchor.kind)) invalid(`${prefix}.kind must be movie, artist or book.`);
        const result = { name: text(anchor.name, `${prefix}.name`), kind: anchor.kind };
        if (anchor.qlooEntityId !== undefined) result.qlooEntityId = entityId(anchor.qlooEntityId, `${prefix}.qlooEntityId`);
        return result;
      }),
    };
    if (entry.color !== undefined) cohort.color = color(entry.color, `${label}.color`);
    return cohort;
  });
}

function validateConstraints(value) {
  requireRecord(value, 'constraints');
  return {
    budget: nonnegativeNumber(value.budget, 'constraints.budget'),
    maxRuntime: positiveNumber(value.maxRuntime, 'constraints.maxRuntime'),
    eventDate: date(value.eventDate, 'constraints.eventDate'),
    territory: text(value.territory, 'constraints.territory', 100),
  };
}

function validateExcluded(value) {
  collection(value, 'excludedIds', 20, true);
  return [...new Set(value.map((value, index) => id(value, `excludedIds[${index}]`)))];
}

function collection(value, label, maximum, allowEmpty = false) {
  if (!Array.isArray(value) || value.length > maximum || (!allowEmpty && value.length === 0)) {
    invalid(`${label} must be an array with ${allowEmpty ? '0' : '1'} to ${maximum} entries.`);
  }
}
function uniqueIds(entries, label) {
  const seen = new Set();
  for (const [index, entry] of entries.entries()) {
    requireRecord(entry, `${label}[${index}]`);
    const value = id(entry.id, `${label}[${index}].id`);
    if (seen.has(value)) invalid(`${label} contains a duplicate ID: ${value}.`);
    seen.add(value);
  }
}
function requireRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid(`${label} must be a JSON object.`);
}
function id(value, label) {
  const result = text(value, label, 100);
  if (result !== value || DANGEROUS_IDS.has(result) || /[\u0000-\u001f\u007f]/.test(result)) invalid(`${label} must be a safe, nonempty ID without surrounding whitespace.`);
  return result;
}
function text(value, label, maximum = 200) {
  if (typeof value !== 'string' || value.length > maximum || !value.trim()) invalid(`${label} must be a nonempty string with at most ${maximum} characters.`);
  return value.trim();
}
function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(`${label} must be a finite number.`);
  return value;
}
function positiveNumber(value, label) {
  if (finite(value, label) <= 0) invalid(`${label} must be positive.`);
  return value;
}
function nonnegativeNumber(value, label) {
  if (finite(value, label) < 0) invalid(`${label} must be nonnegative.`);
  return value;
}
function boundedNumber(value, label, minimum, maximum) {
  finite(value, label);
  if (value < minimum || value > maximum) invalid(`${label} must be between ${minimum} and ${maximum}.`);
  return value;
}
function integer(value, label, minimum, maximum) {
  boundedNumber(value, label, minimum, maximum);
  if (!Number.isSafeInteger(value)) invalid(`${label} must be an integer.`);
  return value;
}
function boolean(value, label) {
  if (typeof value !== 'boolean') invalid(`${label} must be true or false; missing information cannot be assumed confirmed.`);
  return value;
}
function date(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(`${label} must be a valid YYYY-MM-DD date.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid(`${label} must be a valid YYYY-MM-DD date.`);
  return value;
}
function time(value, label) {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) invalid(`${label} must be a valid HH:MM time.`);
  return value;
}
function color(value, label) {
  if (typeof value !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) invalid(`${label} must be a hex color.`);
  return value;
}
function entityId(value, label) {
  if (typeof value !== 'string' || !UUID.test(value)) invalid(`${label} must be a Qloo UUID.`);
  return value.toLowerCase();
}
function anchorSignature(anchors) {
  return JSON.stringify(anchors.map((anchor) => [anchor.kind, anchor.name]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en')));
}
function normalizedTitle(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}
function invalid(message) { throw new ServiceError(message); }
