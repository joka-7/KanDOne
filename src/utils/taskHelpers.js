import { DEFAULT_ROUTINE, parseDateOnly } from './recurrence';
import { DEFAULT_REMINDER, getTaskDueDateTime } from './reminders';
import { TASKS_TERMINAL_STATUSES } from '../statuses';

export const DURATION_UNITS = ['minute', 'hour', 'day', 'month'];

export const safeStr = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return String(v);
};

export const STEP_STATUS_CYCLE = ['todo', 'in_progress', 'done', 'blocked'];

export const cycleStepStatus = (current) => {
  const idx = STEP_STATUS_CYCLE.indexOf(current);
  return STEP_STATUS_CYCLE[(idx + 1) % STEP_STATUS_CYCLE.length];
};

export const makeInitialDuration = () => ({ value: '', unit: 'hour' });

/** Effort reuses the duration shape, but its values are snapped to the ladder. */
export const makeInitialEffort = () => ({ value: '', unit: 'hour' });

export const makeInitialTask = () => ({
  name: '',
  description: '',
  status: 'active',
  priority: 'medium',
  impact: 'medium',
  urgency: '',
  type: '',
  effort: makeInitialEffort(),
  dueDate: '',
  dueTime: '',
  duration: makeInitialDuration(),
  labelIds: [],
  cardColor: '',
  routine: { ...DEFAULT_ROUTINE },
  reminder: { ...DEFAULT_REMINDER },
  lastReminderKey: '',
  boardOrder: 0,
  steps: [],
  notes: '',
});

export const getProgress = (task) => {
  const steps = Array.isArray(task.steps) ? task.steps : [];
  if (steps.length === 0) return null;
  const done = steps.filter(s => s.status === 'done').length;
  return { done, total: steps.length };
};

export const getNextPendingStep = (task) => {
  const steps = Array.isArray(task.steps) ? task.steps : [];
  return steps.find(s => s.status !== 'done' && s.status !== 'blocked') || null;
};

/**
 * A task is overdue when it has a due date/time in the past and hasn't
 * reached a terminal status (completed/cancelled) — nothing in the app
 * currently flags this on the board, list, or detail views.
 */
export const isTaskOverdue = (task, now = new Date()) => {
  if (!task?.dueDate) return false;
  if (TASKS_TERMINAL_STATUSES.includes(task.status)) return false;
  const dueAt = getTaskDueDateTime(task);
  return Boolean(dueAt) && dueAt.getTime() < now.getTime();
};

/** Update a task in place by id, or prepend it as new if its id isn't present. */
export function mergeTaskIntoList(tasks, task) {
  const exists = tasks.find(t => t.id === task.id);
  return exists ? tasks.map(t => (t.id === task.id ? task : t)) : [task, ...tasks];
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const formatDate = (dateStr, lang) => {
  if (!dateStr) return '';
  try {
    // Date-only strings must parse as local time, not UTC — new Date('2026-07-16')
    // parses as UTC midnight, which renders as the previous day west of UTC.
    const d = DATE_ONLY_RE.test(dateStr) ? parseDateOnly(dateStr) : new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : lang === 'fr' ? 'fr-FR' : 'en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(d);
  } catch { return dateStr; }
};

export const formatDuration = (duration, tt) => {
  const value = safeStr(duration?.value).trim();
  if (!value) return null;
  const unit = DURATION_UNITS.includes(duration?.unit) ? duration.unit : 'hour';
  return `${value} ${tt(`duration.${unit}`, unit)}`;
};

/** Due-date and step-due-date entries for the Calendar view. */
export function buildCalendarEvents(tasks) {
  const events = [];
  tasks.forEach(task => {
    const taskName = safeStr(task.name) || 'Untitled';
    if (task.dueDate) {
      events.push({ date: task.dueDate, title: taskName, type: 'task', parentId: task.id });
    }
    (task.steps || []).forEach(step => {
      if (!step.dueDate) return;
      const stepTitle = safeStr(step.title);
      events.push({
        date: step.dueDate,
        title: stepTitle ? `${taskName} – ${stepTitle}` : taskName,
        type: 'step',
        parentId: task.id,
      });
    });
  });
  return events;
}

/** Due-date and step-due-date entries for the Timeline view, sorted chronologically. */
export function buildTimelineEvents(tasks) {
  const events = [];
  tasks.forEach(task => {
    if (task.dueDate) {
      events.push({
        date: task.dueDate,
        taskName: safeStr(task.name),
        status: task.status,
        notes: safeStr(task.notes),
        parentId: task.id,
        isStep: false,
      });
    }
    (task.steps || []).forEach(step => {
      if (!step.dueDate) return;
      const overdue = task.dueDate && new Date(step.dueDate) > new Date(task.dueDate);
      events.push({
        date: step.dueDate,
        taskName: safeStr(task.name),
        stepTitle: safeStr(step.title),
        stepStatus: step.status,
        parentId: task.id,
        isStep: true,
        overdue,
      });
    });
  });
  return events.sort((a, b) => new Date(safeStr(a.date)) - new Date(safeStr(b.date)));
}
