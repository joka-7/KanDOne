import { describe, it, expect, afterEach } from 'vitest';
import { formatDate, formatDuration } from '../utils/taskHelpers';

describe('formatDate', () => {
  const originalTZ = process.env.TZ;
  afterEach(() => { process.env.TZ = originalTZ; });

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
