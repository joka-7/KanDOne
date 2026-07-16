const ROUTINE_FREQUENCIES = new Set(['daily', 'weekly', 'monthly']);
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_ROUTINE = {
  enabled: false,
  frequency: 'weekly',
  interval: 1,
  weekdays: [1, 2, 3, 4, 5],
  endDate: '',
};

export function sanitizeRoutine(routine) {
  if (!routine || typeof routine !== 'object') return { ...DEFAULT_ROUTINE };
  const enabled = Boolean(routine.enabled);
  const frequency = ROUTINE_FREQUENCIES.has(routine.frequency) ? routine.frequency : 'weekly';
  const interval = Math.min(30, Math.max(1, parseInt(routine.interval, 10) || 1));
  let weekdays = Array.isArray(routine.weekdays)
    ? routine.weekdays.map(d => Number(d)).filter(d => d >= 0 && d <= 6)
    : [...DEFAULT_ROUTINE.weekdays];
  if (weekdays.length === 0) weekdays = [...DEFAULT_ROUTINE.weekdays];
  const endDate = DATE_ONLY_RE.test(routine.endDate) ? routine.endDate : '';
  return { enabled, frequency, interval, weekdays: [...new Set(weekdays)].sort(), endDate };
}

export function isPastRoutineEnd(routine, dateStr) {
  const safe = sanitizeRoutine(routine);
  if (!safe.endDate || !dateStr) return false;
  return dateStr > safe.endDate;
}

export function parseDateOnly(dateStr) {
  if (!DATE_ONLY_RE.test(dateStr)) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function computeNextDueDate(routine, currentDueDate, fromDate = new Date()) {
  const safeRoutine = sanitizeRoutine(routine);
  if (!safeRoutine.enabled) return currentDueDate || '';

  const base = currentDueDate ? parseDateOnly(currentDueDate) : new Date(fromDate);
  const interval = safeRoutine.interval;

  if (safeRoutine.frequency === 'daily') {
    const next = formatDateOnly(addDays(base, interval));
    return isPastRoutineEnd(safeRoutine, next) ? '' : next;
  }

  if (safeRoutine.frequency === 'monthly') {
    const nextDate = new Date(base);
    nextDate.setMonth(nextDate.getMonth() + interval);
    const next = formatDateOnly(nextDate);
    return isPastRoutineEnd(safeRoutine, next) ? '' : next;
  }

  const weekdays = new Set(safeRoutine.weekdays);
  let candidate = addDays(base, 1);
  for (let i = 0; i < 366; i += 1) {
    if (weekdays.has(candidate.getDay())) {
      const next = formatDateOnly(candidate);
      return isPastRoutineEnd(safeRoutine, next) ? '' : next;
    }
    candidate = addDays(candidate, 1);
  }
  return '';
}

export function advanceRoutineTask(task) {
  if (!task?.routine?.enabled) return task;
  const nextDue = computeNextDueDate(task.routine, task.dueDate);
  if (!nextDue) {
    return {
      ...task,
      status: 'completed',
      routine: { ...sanitizeRoutine(task.routine), enabled: false },
      lastReminderKey: '',
      reminder: task.reminder ? { ...task.reminder, snoozedUntil: '' } : task.reminder,
    };
  }
  return {
    ...task,
    status: 'active',
    dueDate: nextDue,
    lastReminderKey: '',
    reminder: task.reminder ? { ...task.reminder, snoozedUntil: '' } : task.reminder,
    steps: (task.steps || []).map(step => ({ ...step, status: 'todo' })),
  };
}

export function applyTaskStatusChange(task, newStatus) {
  if (newStatus === 'completed' && task?.routine?.enabled) {
    return advanceRoutineTask({ ...task, status: 'completed' });
  }
  return { ...task, status: newStatus };
}
