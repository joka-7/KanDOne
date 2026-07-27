import { describe, it, expect, afterEach } from 'vitest';
import { formatDate, formatDuration, isTaskOverdue } from '../utils/taskHelpers';

describe('formatDate', () => {
  const originalTZ = process.env.TZ;
  afterEach(() => {
    // `process.env.TZ = undefined` stringifies to the literal "undefined"
    // (Node env vars are always strings), which ICU then treats as an
    // unrecognized zone and silently falls back to UTC — corrupting the
    // timezone for every test that runs afterward in this process, not just
    // this file. Delete the key instead when it was never set originally.
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  it('renders a date-only string on the correct calendar day regardless of timezone', () => {
    // Regression test for a bug where new Date('2026-07-16') was parsed as UTC
    // midnight, which rendered as 2026-07-15 in negative-offset timezones.
    process.env.TZ = 'America/New_York';
    expect(formatDate('2026-07-16', 'en')).toBe('07/16/2026');
  });

  it('renders the same date-only string the same way in a positive-offset timezone', () => {
    process.env.TZ = 'Pacific/Auckland';
    expect(formatDate('2026-07-16', 'en')).toBe('07/16/2026');
  });

  it('returns empty string for an empty input', () => {
    expect(formatDate('', 'en')).toBe('');
  });

  it('falls back to the raw string for an unparseable date', () => {
    expect(formatDate('not-a-date', 'en')).toBe('not-a-date');
  });
});

describe('formatDuration', () => {
  const tt = (key, fallback) => fallback;

  it('returns null when there is no value', () => {
    expect(formatDuration({ value: '', unit: 'hour' }, tt)).toBeNull();
    expect(formatDuration(undefined, tt)).toBeNull();
  });

  it('formats a value with its unit', () => {
    expect(formatDuration({ value: '3', unit: 'hour' }, tt)).toBe('3 hour');
  });

  it('falls back to hour for an invalid unit', () => {
    expect(formatDuration({ value: '2', unit: 'fortnight' }, tt)).toBe('2 hour');
  });
});

describe('isTaskOverdue', () => {
  const now = new Date(2026, 6, 20, 12, 0, 0);

  it('returns false when there is no due date', () => {
    expect(isTaskOverdue({ status: 'active', dueDate: '' }, now)).toBe(false);
  });

  it('returns true for a due date in the past on an active task', () => {
    expect(isTaskOverdue({ status: 'active', dueDate: '2026-07-19' }, now)).toBe(true);
  });

  it('returns false for a due date later today when no due time is set (defaults to 09:00)', () => {
    // Default due time is 09:00 — "now" here is past that, so this checks the
    // opposite: a due date in the future is never overdue.
    expect(isTaskOverdue({ status: 'active', dueDate: '2026-07-21' }, now)).toBe(false);
  });

  it('respects an explicit due time on the due date itself', () => {
    expect(isTaskOverdue({ status: 'active', dueDate: '2026-07-20', dueTime: '09:00' }, now)).toBe(true);
    expect(isTaskOverdue({ status: 'active', dueDate: '2026-07-20', dueTime: '18:00' }, now)).toBe(false);
  });

  it('is never overdue once completed', () => {
    expect(isTaskOverdue({ status: 'completed', dueDate: '2026-07-01' }, now)).toBe(false);
  });

  it('is never overdue once cancelled', () => {
    expect(isTaskOverdue({ status: 'cancelled', dueDate: '2026-07-01' }, now)).toBe(false);
  });

  it('is overdue for on_hold tasks past their due date', () => {
    expect(isTaskOverdue({ status: 'on_hold', dueDate: '2026-07-01' }, now)).toBe(true);
  });
});
