import { STATUSES_TASKS } from './statuses';
import { sanitizeRoutine } from './utils/recurrence.js';
import { sanitizeDueTime, sanitizeReminder } from './utils/reminders.js';
import { sanitizeBoardOrder } from './utils/boardOrder.js';
import { snapToTick } from './utils/effortScale.js';
import { IMPACT_LEVELS, URGENCY_CHOICES } from './utils/taskPriority.js';
import { TASK_TYPES } from './utils/taskTypes.js';

/** Generate a cryptographically random ID (fallback to timestamp if crypto unavailable) */
export function generateId() {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    // Browser environment - use crypto
    const arr = new Uint8Array(12);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  // Fallback: timestamp + random suffix
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function safeStr(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    try { return JSON.stringify(val); } catch { return ''; }
  }
  return String(val);
}

const TASK_STATUS_IDS = new Set(STATUSES_TASKS.map(s => s.id));
const TASK_PRIORITIES = new Set(['high', 'medium', 'low']);
const TASK_IMPACTS = new Set(IMPACT_LEVELS);
const TASK_URGENCIES = new Set(URGENCY_CHOICES);
const TASK_TYPE_IDS = new Set(TASK_TYPES);
const STEP_STATUSES = new Set(['todo', 'in_progress', 'done', 'blocked']);
const DURATION_UNITS = new Set(['minute', 'hour', 'day', 'month']);
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// A device's tasks are one Drive file that every pull downloads whole, so an
// unbounded text field makes every sync slower for every device. Worst case
// (200 full steps per task) stays near 0.55 MB per task.
export const MAX_TITLE_LEN = 500;
export const MAX_LONG_TEXT_LEN = 20_000;
export const MAX_STEP_NOTES_LEN = 2_000;

function sanitizeDuration(duration) {
  if (!duration || typeof duration !== 'object') return { value: '', unit: 'hour' };
  const value = safeStr(duration.value).slice(0, 10);
  const unit = DURATION_UNITS.has(duration.unit) ? duration.unit : 'hour';
  return { value, unit };
}

/**
 * Effort is stored only as a point on the ladder. Anything else — a legacy
 * free-form duration, a hand-edited JSON import — is snapped to the nearest
 * tick so every stored effort is directly comparable.
 */
function sanitizeEffort(effort) {
  if (!effort || typeof effort !== 'object') return { value: '', unit: 'hour' };
  const tick = snapToTick(effort);
  return tick ? { value: tick.value, unit: tick.unit } : { value: '', unit: 'hour' };
}

function sanitizeLabelIds(labelIds) {
  if (!Array.isArray(labelIds)) return [];
  return labelIds.slice(0, 50).map(id => String(id).slice(0, 64)).filter(Boolean);
}

/** Card background tint: a valid hex color, or '' for the default (white) card. */
function sanitizeCardColor(color) {
  return HEX_COLOR_RE.test(color) ? color : '';
}

/** Whitelist fields for the shared task/step label library (localStorage). */
export function sanitizeTaskLabels(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 200).map((l) => ({
    id: l.id ? String(l.id).slice(0, 64) : generateId(),
    text: safeStr(l.text).slice(0, 60),
    color: HEX_COLOR_RE.test(l.color) ? l.color : '#64748b',
  })).filter(l => l.text);
}

export function parseTaskLabelsStoragePayload(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return sanitizeTaskLabels(parsed);
  } catch {
    return [];
  }
}

function sanitizeTaskSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.slice(0, 200).map((s) => ({
    id: s.id ? String(s.id).slice(0, 64) : generateId(),
    title: safeStr(s.title).slice(0, MAX_TITLE_LEN),
    status: STEP_STATUSES.has(s.status) ? s.status : 'todo',
    notes: safeStr(s.notes).slice(0, MAX_STEP_NOTES_LEN),
    dueDate: safeStr(s.dueDate),
    duration: sanitizeDuration(s.duration),
    effort: sanitizeEffort(s.effort),
    labelIds: sanitizeLabelIds(s.labelIds),
  }));
}

/** Whitelist fields for tasks mode (import + localStorage). */
export function sanitizeTaskRecords(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 10000).map((t) => ({
    id: t.id ? String(t.id).slice(0, 64) : generateId(),
    name: safeStr(t.name).slice(0, MAX_TITLE_LEN) || 'Unnamed',
    description: safeStr(t.description || '').slice(0, MAX_LONG_TEXT_LEN),
    status: TASK_STATUS_IDS.has(t.status) ? t.status : 'active',
    priority: TASK_PRIORITIES.has(t.priority) ? t.priority : 'medium',
    impact: TASK_IMPACTS.has(t.impact) ? t.impact : 'medium',
    urgency: TASK_URGENCIES.has(t.urgency) ? t.urgency : '',
    type: TASK_TYPE_IDS.has(t.type) ? t.type : '',
    dueDate: safeStr(t.dueDate || ''),
    dueTime: sanitizeDueTime(t.dueTime),
    duration: sanitizeDuration(t.duration),
    effort: sanitizeEffort(t.effort),
    labelIds: sanitizeLabelIds(t.labelIds),
    cardColor: sanitizeCardColor(t.cardColor),
    routine: sanitizeRoutine(t.routine),
    reminder: sanitizeReminder(t.reminder),
    lastReminderKey: safeStr(t.lastReminderKey || '').slice(0, 64),
    boardOrder: sanitizeBoardOrder(t.boardOrder) ?? 0,
    steps: sanitizeTaskSteps(t.steps),
    notes: safeStr(t.notes || '').slice(0, MAX_LONG_TEXT_LEN),
  }));
}

export function parseTaskStoragePayload(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return sanitizeTaskRecords(parsed);
  } catch {
    return [];
  }
}
