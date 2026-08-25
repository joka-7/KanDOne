/**
 * The effort ladder: a fixed set of ticks spanning minutes → years.
 *
 * Effort is *quantized* rather than free-typed so that two tasks estimated a
 * week apart are comparable, and so every value can carry a stable colour.
 * The ramp runs bright (quick) → dim (long), which is what makes a board
 * scannable at a glance.
 */

/** Minutes per unit. Calendar-based, matching how `duration` already reads. */
const MINUTES_PER_UNIT = {
  minute: 1,
  hour: 60,
  day: 60 * 24,
  month: 60 * 24 * 30,
  year: 60 * 24 * 365,
};

/** Units on the ladder, shortest first. Extends DURATION_UNITS with `year`. */
export const EFFORT_UNITS = ['minute', 'hour', 'day', 'month', 'year'];

const TICK_VALUES = {
  minute: [1, 5, 10, 30],
  hour: [1, 2, 5, 10],
  day: [1, 2, 5, 15, 25],
  month: [1, 2, 3, 6, 9],
  year: [1, 2, 3, 4, 5],
};

/**
 * All 23 ticks in strictly ascending order of `minutes`.
 * `index` is the canonical identity of a tick — tier cut-points are stored as
 * indexes, so the order of this array is part of the persisted data contract.
 */
export const EFFORT_TICKS = EFFORT_UNITS.flatMap((unit) =>
  TICK_VALUES[unit].map((value) => ({
    id: `${unit}-${value}`,
    value,
    unit,
    minutes: value * MINUTES_PER_UNIT[unit],
  })),
).map((tick, index) => ({ ...tick, index }));

export const EFFORT_TICK_COUNT = EFFORT_TICKS.length;

/**
 * Per-tick colour, bright → dim as effort grows.
 *
 * These must stay literal strings: Tailwind scans source text, so a class
 * built by interpolation (`bg-${hue}-300`) is purged from the bundle.
 */
export const EFFORT_TICK_CLASSES = [
  // Hue carries the unit (vivid green = quick … grey = a long haul); darkness
  // carries the magnitude within that unit. Every pair clears WCAG AA 4.5:1 —
  // shade 600 with white text does not, which is why the ramps skip it.
  // minutes
  'bg-emerald-300 text-emerald-950 border-emerald-400',
  'bg-emerald-400 text-emerald-950 border-emerald-500',
  'bg-emerald-500 text-emerald-950 border-emerald-600',
  'bg-emerald-700 text-white border-emerald-800',
  // hours
  'bg-teal-300 text-teal-950 border-teal-400',
  'bg-teal-400 text-teal-950 border-teal-500',
  'bg-teal-500 text-teal-950 border-teal-600',
  'bg-teal-700 text-white border-teal-800',
  // days
  'bg-sky-300 text-sky-950 border-sky-400',
  'bg-sky-400 text-sky-950 border-sky-500',
  'bg-sky-500 text-sky-950 border-sky-600',
  'bg-sky-700 text-white border-sky-800',
  'bg-sky-800 text-white border-sky-900',
  // months
  'bg-indigo-300 text-indigo-950 border-indigo-400',
  'bg-indigo-400 text-indigo-950 border-indigo-500',
  'bg-indigo-600 text-white border-indigo-700',
  'bg-indigo-700 text-white border-indigo-800',
  'bg-indigo-800 text-white border-indigo-900',
  // years
  'bg-slate-300 text-slate-950 border-slate-400',
  'bg-slate-400 text-slate-950 border-slate-500',
  'bg-slate-500 text-white border-slate-600',
  'bg-slate-600 text-white border-slate-700',
  'bg-slate-700 text-white border-slate-800',
];

/** Colour for a tick index; falls back to a neutral chip when unset. */
export const getEffortTickClass = (index) =>
  EFFORT_TICK_CLASSES[index] || 'bg-gray-100 text-gray-600 border-gray-200';

/** Ticks belonging to one unit (for rendering the picker one row at a time). */
export const getTicksForUnit = (unit) =>
  EFFORT_TICKS.filter((tick) => tick.unit === unit);

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return NaN;
  return typeof value === 'number' ? value : Number(value);
};

/** Total minutes for an {value, unit} pair, or null when it isn't a number. */
export function effortToMinutes(effort) {
  const n = toNumber(effort?.value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const per = MINUTES_PER_UNIT[effort?.unit];
  return per ? n * per : null;
}

/** Exact tick index for a {value, unit} pair, or -1 when it isn't on the ladder. */
export function findTickIndex(effort) {
  const n = toNumber(effort?.value);
  if (!Number.isFinite(n)) return -1;
  return EFFORT_TICKS.findIndex((tick) => tick.unit === effort?.unit && tick.value === n);
}

/**
 * Nearest tick to an arbitrary {value, unit}, compared in log space so that
 * "3 hours" lands on 2h/5h by ratio rather than by raw distance (which would
 * bias everything toward the large end of the ladder).
 *
 * This is what lets pre-existing free-form `duration` values act as effort
 * without a data migration.
 */
export function snapToTick(effort) {
  const exact = findTickIndex(effort);
  if (exact !== -1) return EFFORT_TICKS[exact];

  const minutes = effortToMinutes(effort);
  if (minutes === null) return null;

  let best = EFFORT_TICKS[0];
  let bestDistance = Infinity;
  for (const tick of EFFORT_TICKS) {
    const distance = Math.abs(Math.log(tick.minutes) - Math.log(minutes));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = tick;
    }
  }
  return best;
}

/** Default cut-points: small ≤ 2 hours, medium ≤ 2 days, large beyond. */
export const DEFAULT_EFFORT_TIERS = { smallMaxIndex: 5, mediumMaxIndex: 9 };

export const EFFORT_TIERS = ['small', 'medium', 'large'];

/** Clamp stored cut-points into range and keep small strictly below medium. */
export function sanitizeEffortTiers(raw) {
  const clamp = (n, fallback) => {
    // Number(null) and Number('') are both 0, which would silently read as a
    // deliberate cut-point at the very bottom of the ladder.
    if (n === null || n === undefined || n === '') return fallback;
    const value = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(EFFORT_TICK_COUNT - 2, Math.max(0, Math.round(value)));
  };
  const smallMaxIndex = clamp(raw?.smallMaxIndex, DEFAULT_EFFORT_TIERS.smallMaxIndex);
  let mediumMaxIndex = clamp(raw?.mediumMaxIndex, DEFAULT_EFFORT_TIERS.mediumMaxIndex);
  if (mediumMaxIndex <= smallMaxIndex) mediumMaxIndex = smallMaxIndex + 1;
  return { smallMaxIndex, mediumMaxIndex };
}

export function parseEffortTiersPayload(raw) {
  if (!raw) return { ...DEFAULT_EFFORT_TIERS };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return sanitizeEffortTiers(parsed);
  } catch {
    return { ...DEFAULT_EFFORT_TIERS };
  }
}

/**
 * Which tier an effort falls into, given the user's cut-points.
 * Unset effort is treated as `medium` so an unestimated task neither jumps the
 * queue as a quick win nor sinks as a big project.
 */
export function resolveEffortTier(effort, tiers = DEFAULT_EFFORT_TIERS) {
  const tick = snapToTick(effort);
  if (!tick) return 'medium';
  const { smallMaxIndex, mediumMaxIndex } = sanitizeEffortTiers(tiers);
  if (tick.index <= smallMaxIndex) return 'small';
  if (tick.index <= mediumMaxIndex) return 'medium';
  return 'large';
}

/** Human-readable tick label, e.g. "30 min" — `tt` supplies the unit word. */
export function formatEffort(effort, tt) {
  const tick = snapToTick(effort);
  if (!tick) return null;
  return `${tick.value} ${tt(`duration.${tick.unit}`, tick.unit)}`;
}
