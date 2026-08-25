/**
 * Computed task priority: urgency × impact × effort → a 0–100 score.
 *
 * The point is to answer "what do I do next?" without the user hand-ranking a
 * backlog. Three inputs, all cheap to fill in:
 *
 *   urgency — by when. Derived from the due date, or stated directly for
 *             tasks that have no date ("someday I should…").
 *   impact  — how much it matters.
 *   effort  — how much work it is, from the quantized ladder in effortScale.
 *
 * BISE ("Big Impact, Small Effort") is the combination worth surfacing first:
 * it is the cheapest way to move the needle, and it is exactly what gets lost
 * in a date-sorted list.
 */
import { getTaskDueDateTime } from './reminders.js';
import { parseDateOnly } from './recurrence.js';
import { resolveEffortTier, DEFAULT_EFFORT_TIERS } from './effortScale.js';
import { TASKS_TERMINAL_STATUSES } from '../statuses.js';

/** Urgency buckets, most urgent first. Order defines "which of these wins". */
export const URGENCY_LEVELS = ['overdue', 'now', 'today', 'week', 'month', 'someday'];

/** The subset a user can pick by hand — `overdue` is only ever derived. */
export const URGENCY_CHOICES = ['now', 'today', 'week', 'month', 'someday'];

export const IMPACT_LEVELS = ['high', 'medium', 'low'];

const URGENCY_WEIGHT = {
  overdue: 1,
  now: 1,
  today: 0.85,
  week: 0.6,
  month: 0.35,
  someday: 0.15,
  '': 0.15,
};

const IMPACT_WEIGHT = { high: 1, medium: 0.6, low: 0.25 };

const EFFORT_WEIGHT = { small: 1, medium: 0.55, large: 0.2 };

/** Urgency dominates, then impact; effort breaks ties toward the quick win. */
const WEIGHTS = { urgency: 0.45, impact: 0.35, effort: 0.2 };

/** Score thresholds for the colour band on cards. */
const BAND_THRESHOLDS = [
  { band: 'critical', min: 75 },
  { band: 'high', min: 55 },
  { band: 'medium', min: 35 },
  { band: 'low', min: 0 },
];

/** Band → Tailwind classes. Literal strings so Tailwind keeps them. */
export const BAND_STYLES = {
  critical: { stripe: 'border-l-red-500', pill: 'bg-red-100 text-red-700 border-red-200' },
  high: { stripe: 'border-l-amber-500', pill: 'bg-amber-100 text-amber-700 border-amber-200' },
  medium: { stripe: 'border-l-sky-500', pill: 'bg-sky-100 text-sky-700 border-sky-200' },
  low: { stripe: 'border-l-gray-300', pill: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export const getBandStyle = (band) => BAND_STYLES[band] || BAND_STYLES.low;

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Whole days from `now`'s calendar day to the due date's calendar day. */
function daysUntil(dueDate, now) {
  const due = startOfDay(parseDateOnly(dueDate));
  const today = startOfDay(now);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Urgency implied by the task's own due date/time.
 * Returns '' when the task has no date at all.
 */
export function deriveUrgencyFromDate(task, now = new Date()) {
  if (!task?.dueDate) return '';
  if (!TASKS_TERMINAL_STATUSES.includes(task.status)) {
    const dueAt = getTaskDueDateTime(task);
    if (dueAt && dueAt.getTime() < now.getTime()) return 'overdue';
  }
  const days = daysUntil(task.dueDate, now);
  if (days <= 0) return 'now';
  if (days === 1) return 'today';
  if (days <= 7) return 'week';
  if (days <= 31) return 'month';
  return 'someday';
}

/**
 * The task's real urgency: whichever of the derived and the hand-picked value
 * is more urgent. Keeping both means a quick-pick can fill a real due date
 * (so reminders and the calendar still work) while a dateless task can still
 * say "this is a this-week thing".
 */
export function getEffectiveUrgency(task, now = new Date()) {
  const derived = deriveUrgencyFromDate(task, now);
  const manual = URGENCY_CHOICES.includes(task?.urgency) ? task.urgency : '';
  if (!derived) return manual;
  if (!manual) return derived;
  const rank = (level) => URGENCY_LEVELS.indexOf(level);
  return rank(manual) < rank(derived) ? manual : derived;
}

/**
 * Effort actually used for scoring. Falls back to the legacy free-form
 * `duration` field so tasks created before the effort ladder existed still
 * rank sensibly without a migration.
 */
export function getScoringEffort(task) {
  const effort = task?.effort;
  if (effort && effort.value !== '' && effort.value !== null && effort.value !== undefined) {
    return effort;
  }
  return task?.duration || null;
}

function resolveBand(score) {
  return BAND_THRESHOLDS.find((entry) => score >= entry.min)?.band || 'low';
}

/** impact × effort quadrant — the BISE matrix. */
function resolveQuadrant(impact, tier) {
  const bigImpact = impact === 'high';
  if (tier === 'small') return bigImpact ? 'bise' : 'fillIn';
  if (tier === 'large') return bigImpact ? 'bigProject' : 'later';
  return bigImpact ? 'bigProject' : 'later';
}

/**
 * Full priority readout for one task.
 *
 * @returns {{score:number, urgency:string, impact:string, effortTier:string,
 *            quadrant:string, band:string, isBise:boolean, isDoNow:boolean}}
 */
export function scoreTask(task, { tiers = DEFAULT_EFFORT_TIERS, now = new Date() } = {}) {
  const urgency = getEffectiveUrgency(task, now);
  const impact = IMPACT_LEVELS.includes(task?.impact) ? task.impact : 'medium';
  const effortTier = resolveEffortTier(getScoringEffort(task), tiers);

  const u = URGENCY_WEIGHT[urgency] ?? URGENCY_WEIGHT[''];
  const i = IMPACT_WEIGHT[impact];
  const e = EFFORT_WEIGHT[effortTier];

  const score = Math.round(100 * (WEIGHTS.urgency * u + WEIGHTS.impact * i + WEIGHTS.effort * e));

  return {
    score,
    urgency,
    impact,
    effortTier,
    quadrant: resolveQuadrant(impact, effortTier),
    band: resolveBand(score),
    isBise: impact === 'high' && effortTier === 'small',
    isDoNow: urgency === 'overdue' || urgency === 'now' || urgency === 'today',
  };
}

/**
 * Groups for the Priority view, in the order they should be worked.
 * `doNow` is deliberately checked before the quadrants: a deadline today beats
 * a nice quadrant.
 */
export const PRIORITY_GROUPS = ['doNow', 'bise', 'bigProject', 'fillIn', 'later'];

/** Bucket tasks into the PRIORITY_GROUPS, each sorted by score descending. */
export function groupTasksByPriority(tasks, options = {}) {
  const groups = Object.fromEntries(PRIORITY_GROUPS.map((id) => [id, []]));

  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const priority = scoreTask(task, options);
    const group = priority.isDoNow ? 'doNow' : priority.quadrant;
    groups[group].push({ task, priority });
  });

  PRIORITY_GROUPS.forEach((id) => { groups[id].sort(compareScored); });
  return groups;
}

/** Score desc, BISE ahead on a tie, then id for a stable render order. */
function compareScored(a, b) {
  if (a.priority.score !== b.priority.score) return b.priority.score - a.priority.score;
  if (a.priority.isBise !== b.priority.isBise) return a.priority.isBise ? -1 : 1;
  return String(a.task?.id ?? '').localeCompare(String(b.task?.id ?? ''));
}

/**
 * Sort tasks by score descending. BISE wins ties so a cheap high-impact task
 * never sits below an equally-scored expensive one, and the id is the final
 * tiebreak to keep the order stable across renders.
 */
export function sortByScore(tasks, options = {}) {
  return [...(tasks || [])]
    .map((task) => ({ task, priority: scoreTask(task, options) }))
    .sort(compareScored)
    .map((entry) => entry.task);
}

/** Sort by due date ascending; tasks without a date sink to the bottom. */
export function sortByDueDate(tasks) {
  return [...(tasks || [])].sort((a, b) => {
    if (!a?.dueDate && !b?.dueDate) return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
    if (!a?.dueDate) return 1;
    if (!b?.dueDate) return -1;
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  });
}

/**
 * Due date/time a quick-pick should write, so picking "This week" fills a real
 * date the calendar, timeline and reminders can all use.
 * Returns null for `someday`, which intentionally leaves the date alone.
 */
export function urgencyToDueDate(urgency, now = new Date()) {
  const day = startOfDay(now);
  const offsets = { now: 0, today: 0, week: 7, month: 30 };
  if (!(urgency in offsets)) return null;
  const target = new Date(day.getFullYear(), day.getMonth(), day.getDate() + offsets[urgency]);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  const dueDate = `${yyyy}-${mm}-${dd}`;
  if (urgency !== 'now') return { dueDate, dueTime: '' };
  // "Now" means today, within the hour — round up to the next quarter hour.
  const soon = new Date(now.getTime() + 15 * 60_000);
  const hh = String(soon.getHours()).padStart(2, '0');
  const min = String(Math.floor(soon.getMinutes() / 15) * 15).padStart(2, '0');
  return { dueDate, dueTime: `${hh}:${min}` };
}
