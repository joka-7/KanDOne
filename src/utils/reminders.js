import { parseDateOnly } from './recurrence.js';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const REMINDER_MINUTES = [0, 15, 30, 60, 120, 1440];

export const DEFAULT_REMINDER = { enabled: false, minutesBefore: 60 };
export const DEFAULT_DUE_TIME = '09:00';
export { REMINDER_MINUTES };

export function sanitizeDueTime(time) {
  return TIME_RE.test(time) ? time : '';
}

export function sanitizeReminder(reminder) {
  if (!reminder || typeof reminder !== 'object') return { ...DEFAULT_REMINDER };
  const enabled = Boolean(reminder.enabled);
  const minutesBefore = REMINDER_MINUTES.includes(Number(reminder.minutesBefore))
    ? Number(reminder.minutesBefore)
    : DEFAULT_REMINDER.minutesBefore;
  return { enabled, minutesBefore };
}

export function getTaskDueDateTime(task) {
  if (!task?.dueDate) return null;
  const date = parseDateOnly(task.dueDate);
  const time = sanitizeDueTime(task.dueTime) || DEFAULT_DUE_TIME;
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
}

export function buildReminderKey(task) {
  const minutesBefore = task.reminder?.minutesBefore ?? DEFAULT_REMINDER.minutesBefore;
  const dueTime = sanitizeDueTime(task.dueTime) || DEFAULT_DUE_TIME;
  return `${task.dueDate}T${dueTime}-${minutesBefore}`;
}

export function shouldNotifyTask(task, now = new Date()) {
  if (!task?.reminder?.enabled || !task.dueDate) return false;
  const dueAt = getTaskDueDateTime(task);
  if (!dueAt) return false;

  const minutesBefore = task.reminder.minutesBefore ?? DEFAULT_REMINDER.minutesBefore;
  const notifyAt = new Date(dueAt.getTime() - minutesBefore * 60_000);
  const notifyUntil = new Date(dueAt.getTime() + 5 * 60_000);
  if (now < notifyAt || now > notifyUntil) return false;
  return buildReminderKey(task) !== task.lastReminderKey;
}

export async function requestReminderPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export function formatDueDateTime(dateStr, timeStr, lang, formatDateFn) {
  if (!dateStr) return '';
  const dateLabel = formatDateFn(dateStr, lang);
  const time = sanitizeDueTime(timeStr);
  return time ? `${dateLabel} ${time}` : dateLabel;
}
