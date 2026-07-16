import { describe, it, expect } from 'vitest';
import {
  computeNextDueDate, advanceRoutineTask, applyTaskStatusChange, sanitizeRoutine,
} from '../utils/recurrence.js';
import {
  buildReminderKey, getTaskDueDateTime, shouldNotifyTask, sanitizeDueTime,
  snoozeTaskReminder, isReminderSnoozed, sanitizeReminder,
} from '../utils/reminders.js';

describe('recurrence', () => {
  it('advances daily routines by interval days', () => {
    const routine = sanitizeRoutine({ enabled: true, frequency: 'daily', interval: 2, weekdays: [1] });
    expect(computeNextDueDate(routine, '2026-07-16')).toBe('2026-07-18');
  });

  it('finds the next weekday for weekly routines', () => {
    const routine = sanitizeRoutine({
      enabled: true, frequency: 'weekly', interval: 1, weekdays: [1, 3, 5],
    });
    expect(computeNextDueDate(routine, '2026-07-16')).toBe('2026-07-17');
  });

  it('advances monthly routines', () => {
    const routine = sanitizeRoutine({ enabled: true, frequency: 'monthly', interval: 1, weekdays: [1] });
    expect(computeNextDueDate(routine, '2026-07-16')).toBe('2026-08-16');
  });

  it('resets routine tasks when completed', () => {
    const task = {
      id: '1',
      status: 'active',
      dueDate: '2026-07-16',
      routine: sanitizeRoutine({ enabled: true, frequency: 'daily', interval: 1, weekdays: [1] }),
      steps: [{ id: 's1', status: 'done' }, { id: 's2', status: 'in_progress' }],
    };
    const next = applyTaskStatusChange(task, 'completed');
    expect(next.status).toBe('active');
    expect(next.dueDate).toBe('2026-07-17');
    expect(next.steps.every(s => s.status === 'todo')).toBe(true);
  });

  it('leaves non-routine tasks completed', () => {
    const task = { id: '1', status: 'active', routine: sanitizeRoutine({ enabled: false }) };
    const next = applyTaskStatusChange(task, 'completed');
    expect(next.status).toBe('completed');
  });

  it('clears reminder key when advancing routine', () => {
    const task = advanceRoutineTask({
      status: 'completed',
      dueDate: '2026-07-16',
      lastReminderKey: 'old',
      routine: sanitizeRoutine({ enabled: true, frequency: 'daily', interval: 1, weekdays: [1] }),
      steps: [],
    });
    expect(task.lastReminderKey).toBe('');
  });

  it('stops routine when next due is past end date', () => {
    const routine = sanitizeRoutine({
      enabled: true, frequency: 'daily', interval: 1, weekdays: [1], endDate: '2026-07-16',
    });
    expect(computeNextDueDate(routine, '2026-07-16')).toBe('');
    const task = advanceRoutineTask({
      status: 'completed',
      dueDate: '2026-07-16',
      routine,
      steps: [{ id: 's1', status: 'done' }],
    });
    expect(task.status).toBe('completed');
    expect(task.routine.enabled).toBe(false);
  });
});

describe('reminders', () => {
  it('builds a stable reminder key', () => {
    const task = {
      dueDate: '2026-07-16',
      dueTime: '09:30',
      reminder: { enabled: true, minutesBefore: 60 },
    };
    expect(buildReminderKey(task)).toBe('2026-07-16T09:30-60');
  });

  it('parses due date and time', () => {
    const due = getTaskDueDateTime({ dueDate: '2026-07-16', dueTime: '14:15' });
    expect(due.getHours()).toBe(14);
    expect(due.getMinutes()).toBe(15);
  });

  it('notifies only inside the reminder window once', () => {
    const task = {
      id: '1',
      dueDate: '2026-07-16',
      dueTime: '10:00',
      reminder: { enabled: true, minutesBefore: 60 },
      lastReminderKey: '',
    };
    const now = new Date(2026, 6, 16, 9, 5, 0);
    expect(shouldNotifyTask(task, now)).toBe(true);
    expect(shouldNotifyTask({ ...task, lastReminderKey: buildReminderKey(task) }, now)).toBe(false);
  });

  it('sanitizes due time', () => {
    expect(sanitizeDueTime('09:30')).toBe('09:30');
    expect(sanitizeDueTime('25:00')).toBe('');
  });

  it('skips notification while snoozed', () => {
    const task = {
      id: '1',
      dueDate: '2026-07-16',
      dueTime: '10:00',
      reminder: sanitizeReminder({
        enabled: true, minutesBefore: 60, snoozedUntil: '2099-01-01T00:00:00.000Z',
      }),
      lastReminderKey: '',
    };
    const now = new Date(2026, 6, 16, 9, 5, 0);
    expect(isReminderSnoozed(task.reminder, now)).toBe(true);
    expect(shouldNotifyTask(task, now)).toBe(false);
  });

  it('clears lastReminderKey when snoozing', () => {
    const task = {
      id: '1',
      dueDate: '2026-07-16',
      dueTime: '10:00',
      lastReminderKey: '2026-07-16T10:00-60',
      reminder: sanitizeReminder({ enabled: true, minutesBefore: 60 }),
    };
    const snoozed = snoozeTaskReminder(task, 15, new Date(2026, 6, 16, 9, 0, 0));
    expect(snoozed.lastReminderKey).toBe('');
    expect(snoozed.reminder.snoozedUntil).toBeTruthy();
  });
});
