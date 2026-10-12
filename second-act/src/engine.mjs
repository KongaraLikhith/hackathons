/**
 * Rank cancellation-recovery options against organizer-reported catalog data.
 *
 * Evidence values are relative cohort rank indices supplied by the evidence
 * provider, from 0 through 100. They are not enjoyment probabilities. Qloo's
 * returned order is normalized by the provider, not by this function; sample
 * values must remain visibly labeled sample data. Scores never change merely
 * because a budget, runtime limit, or exclusion removes another candidate.
 */
export function rankInventory({
  inventory,
  cohorts,
  support,
  constraints,
  excludedIds = [],
  fairness = 0.7,
} = {}) {
  validateRequest({ inventory, cohorts, support, constraints, excludedIds, fairness });
  const excluded = new Set(excludedIds);
  const ranked = [];
  const blocked = [];
  const relaxations = [];

  for (const film of inventory) {
    const issues = catalogIssues(film, constraints, excluded);
    const filmSupport = ownRecord(support, film.id) ? support[film.id] : undefined;
    const evidence = [];

    for (const cohort of cohorts) {
      const entry = ownRecord(filmSupport, cohort.id) ? filmSupport[cohort.id] : undefined;
      if (entry === undefined || entry === null) {
        issues.push({ code: 'missing_evidence', message: `Missing cohort evidence: ${cohort.name}.`, cohortId: cohort.id });
      } else if (!validEvidence(entry)) {
        issues.push({ code: 'invalid_evidence', message: `Invalid cohort evidence: ${cohort.name}.`, cohortId: cohort.id });
      } else {
        evidence.push({ cohort, entry });
      }
    }

    const result = evidence.length === cohorts.length ? scoreFilm(film, evidence, fairness) : null;
    if (issues.length === 0) {
      ranked.push(result);
      continue;
    }

    const reasons = issues.map((issue) => issue.message);
    const reasonCodes = [...new Set(issues.map((issue) => issue.code))];
    blocked.push({ film, reasons, reasonCodes, issues, ...(result ?? {}) });

    // An otherwise valid film may be reconsidered only if the organizer
    // explicitly adjusts the event budget and/or the runtime limit.
    if (result && issues.every((issue) => issue.code === 'budget' || issue.code === 'runtime')) {
      relaxations.push({
        ...result,
        reasons,
        reasonCodes,
        requiredBudget: Math.max(constraints.budget, film.cost),
        requiredRuntime: Math.max(constraints.maxRuntime, film.runtime),
        budgetIncrease: Math.max(0, film.cost - constraints.budget),
        runtimeIncrease: Math.max(0, film.runtime - constraints.maxRuntime),
      });
    }
  }

  ranked.sort(compareRanked);
  blocked.sort(compareFilms);
  relaxations.sort(compareRanked);
  const chosen = ranked[0] ?? null;
  const baseline = [...ranked].sort((a, b) => b.mean - a.mean || compareFilms(a, b))[0] ?? null;

  return {
    ranked,
    blocked,
    chosen,
    baseline,
    metrics: {
      chosenMinimum: chosen?.minimum ?? null,
      chosenMean: chosen?.mean ?? null,
      baselineMinimum: baseline?.minimum ?? null,
      baselineMean: baseline?.mean ?? null,
      minimumGain: chosen && baseline ? chosen.minimum - baseline.minimum : null,
      meanChange: chosen && baseline ? chosen.mean - baseline.mean : null,
      eligibleCount: ranked.length,
      blockedCount: blocked.length,
      cohortCount: cohorts.length,
    },
    infeasible: chosen === null,
    relaxations,
  };
}

function scoreFilm(film, evidence, fairness) {
  // Canonical cohort order makes floating-point accumulation independent of
  // the order in which an imported cohort list happened to be supplied.
  evidence.sort((a, b) => compareText(a.cohort.id, b.cohort.id));
  const scores = Object.fromEntries(evidence.map(({ cohort, entry }) => [cohort.id, entry.value]));
  const support = Object.fromEntries(evidence.map(({ cohort, entry }) => [cohort.id, { ...entry }]));
  // Scaling weights avoids overflowing intermediate products for large groups.
  const scale = evidence.reduce((maximum, { cohort }) => Math.max(maximum, cohort.size), 0);
  let weightedTotal = 0;
  let totalWeight = 0;
  let minimum = 101;
  let weakestCohort = null;
  for (const { cohort, entry } of evidence) {
    const weight = cohort.size / scale;
    weightedTotal += entry.value * weight;
    totalWeight += weight;
    if (entry.value < minimum || (entry.value === minimum && compareText(cohort.id, weakestCohort) < 0)) {
      minimum = entry.value;
      weakestCohort = cohort.id;
    }
  }
  const mean = weightedTotal / totalWeight;
  return { film, support, scores, minimum, mean, utility: fairness * minimum + (1 - fairness) * mean, weakestCohort };
}

function catalogIssues(film, constraints, excluded) {
  const issues = [];
  const add = (code, message, details = {}) => issues.push({ code, message, ...details });
  if (excluded.has(film.id)) add('excluded', 'Excluded by the organizer.');
  if (film.available !== true) add('unavailable', 'Unavailable in the organizer-reported catalog.');
  if (film.rightsConfirmed !== true) add('rights_unconfirmed', 'Screening rights are not confirmed in the organizer-reported catalog.');

  if (!finiteNumber(film.runtime) || film.runtime <= 0) {
    add('invalid_runtime', 'Runtime is missing or invalid.');
  } else if (film.runtime > constraints.maxRuntime) {
    add('runtime', `Runtime ${film.runtime} min exceeds the ${constraints.maxRuntime} min event limit.`, { actual: film.runtime, limit: constraints.maxRuntime });
  }
  if (!finiteNumber(film.cost) || film.cost < 0) {
    add('invalid_cost', 'Screening fee is missing or invalid.');
  } else if (film.cost > constraints.budget) {
    add('budget', `Screening fee ${film.cost} exceeds the ${constraints.budget} event budget.`, { actual: film.cost, limit: constraints.budget });
  }

  const hasStart = film.rightsStart !== undefined;
  const hasEnd = film.rightsEnd !== undefined;
  const startValid = hasStart && validDate(film.rightsStart);
  const endValid = hasEnd && validDate(film.rightsEnd);
  if (hasStart && !startValid) add('invalid_rights_start', 'The reported rights start date is invalid.');
  if (hasEnd && !endValid) add('invalid_rights_end', 'The reported rights end date is invalid.');
  if (startValid && endValid && film.rightsStart > film.rightsEnd) {
    add('invalid_rights_window', 'The reported rights start date is after its end date.');
  }
  if ((startValid || endValid) && constraints.eventDate === undefined) {
    add('missing_event_date', 'An event date is required to check the reported rights window.');
  } else if (constraints.eventDate !== undefined) {
    if (startValid && constraints.eventDate < film.rightsStart) {
      add('rights_not_started', `Reported screening rights begin on ${film.rightsStart}, after the event.`, { rightsStart: film.rightsStart, eventDate: constraints.eventDate });
    }
    if (endValid && constraints.eventDate > film.rightsEnd) {
      add('rights_expired', `Reported screening rights expired on ${film.rightsEnd}, before the event.`, { rightsEnd: film.rightsEnd, eventDate: constraints.eventDate });
    }
  }

  if (film.territory !== undefined) {
    if (!nonemptyString(film.territory)) {
      add('invalid_territory', 'The reported rights territory is invalid.');
    } else if (constraints.territory === undefined) {
      add('missing_event_territory', 'An event territory is required to check the reported screening rights.');
    } else if (film.territory.trim().toUpperCase() !== constraints.territory.trim().toUpperCase()) {
      add('territory_mismatch', `Reported rights territory ${film.territory} does not cover event territory ${constraints.territory}.`, { rightsTerritory: film.territory, eventTerritory: constraints.territory });
    }
  }
  if (film.screeningsRemaining !== undefined) {
    if (!Number.isSafeInteger(film.screeningsRemaining) || film.screeningsRemaining < 0) {
      add('invalid_screenings_remaining', 'The reported remaining screening count is invalid.');
    } else if (film.screeningsRemaining === 0) {
      add('no_screenings_remaining', 'No licensed screenings remain in the organizer-reported catalog.');
    }
  }
  return issues;
}

function validateRequest({ inventory, cohorts, support, constraints, excludedIds, fairness }) {
  if (!Array.isArray(inventory)) throw new TypeError('inventory must be an array.');
  if (!Array.isArray(cohorts) || cohorts.length === 0) throw new TypeError('cohorts must be a nonempty array.');
  validateIds(inventory, 'inventory');
  validateIds(cohorts, 'cohorts');
  for (const film of inventory) {
    if (!nonemptyString(film.title)) throw new TypeError(`Film ${film.id} requires a nonempty title.`);
  }
  for (const cohort of cohorts) {
    if (!nonemptyString(cohort.name)) throw new TypeError(`Cohort ${cohort.id} requires a nonempty name.`);
    if (!Number.isSafeInteger(cohort.size) || cohort.size <= 0) throw new RangeError(`Cohort ${cohort.id} size must be a positive safe integer.`);
  }
  if (!record(support)) throw new TypeError('support must be an object keyed by film and cohort IDs.');
  if (!record(constraints)) throw new TypeError('constraints must be an object.');
  if (!finiteNumber(constraints.budget) || constraints.budget < 0) throw new RangeError('constraints.budget must be a finite nonnegative number.');
  if (!finiteNumber(constraints.maxRuntime) || constraints.maxRuntime <= 0) throw new RangeError('constraints.maxRuntime must be a finite positive number.');
  if (constraints.eventDate !== undefined && !validDate(constraints.eventDate)) throw new TypeError('constraints.eventDate must be a valid YYYY-MM-DD date.');
  if (constraints.territory !== undefined && !nonemptyString(constraints.territory)) throw new TypeError('constraints.territory must be a nonempty string.');
  if (!Array.isArray(excludedIds) || excludedIds.some((id) => !nonemptyString(id))) throw new TypeError('excludedIds must be an array of nonempty string IDs.');
  if (!finiteNumber(fairness) || fairness < 0 || fairness > 1) throw new RangeError('fairness must be a finite number between 0 and 1.');
}

function validateIds(entries, label) {
  const ids = new Set();
  for (const entry of entries) {
    if (!record(entry) || !nonemptyString(entry.id)) throw new TypeError(`${label} entries require nonempty string IDs.`);
    if (ids.has(entry.id)) throw new TypeError(`${label} contains duplicate ID: ${entry.id}.`);
    ids.add(entry.id);
  }
}

function validEvidence(entry) {
  if (!record(entry) || !Object.hasOwn(entry, 'value') || !finiteNumber(entry.value) || entry.value < 0 || entry.value > 100) return false;
  return Object.hasOwn(entry, 'source') && (entry.source === 'sample' || entry.source === 'qloo');
}

function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function ownRecord(value, key) { return record(value) && Object.hasOwn(value, key); }
function finiteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
function nonemptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function compareText(a, b) { return a === b ? 0 : a < b ? -1 : 1; }
function compareFilms(a, b) {
  return compareText(a.film.title.toLowerCase(), b.film.title.toLowerCase()) || compareText(a.film.id, b.film.id);
}
function compareRanked(a, b) {
  return b.utility - a.utility || b.minimum - a.minimum || b.mean - a.mean || compareFilms(a, b);
}
