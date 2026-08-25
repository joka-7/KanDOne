import { describe, it, expect } from 'vitest';
import {
  EFFORT_TICKS,
  EFFORT_TICK_CLASSES,
  DEFAULT_EFFORT_TIERS,
  findTickIndex,
  snapToTick,
  resolveEffortTier,
  sanitizeEffortTiers,
  getTicksForUnit,
  formatEffort,
} from '../utils/effortScale';

describe('EFFORT_TICKS', () => {
  it('covers the full minutes → years ladder', () => {
    expect(EFFORT_TICKS).toHaveLength(23);
    expect(getTicksForUnit('minute').map(t => t.value)).toEqual([1, 5, 10, 30]);
    expect(getTicksForUnit('hour').map(t => t.value)).toEqual([1, 2, 5, 10]);
    expect(getTicksForUnit('day').map(t => t.value)).toEqual([1, 2, 5, 15, 25]);
    expect(getTicksForUnit('month').map(t => t.value)).toEqual([1, 2, 3, 6, 9]);
    expect(getTicksForUnit('year').map(t => t.value)).toEqual([1, 2, 3, 4, 5]);
  });

  it('is strictly ascending in minutes, so index order is effort order', () => {
    for (let i = 1; i < EFFORT_TICKS.length; i += 1) {
      expect(EFFORT_TICKS[i].minutes).toBeGreaterThan(EFFORT_TICKS[i - 1].minutes);
    }
  });

  it('has exactly one colour per tick', () => {
    expect(EFFORT_TICK_CLASSES).toHaveLength(EFFORT_TICKS.length);
  });

  it('indexes match array position', () => {
    EFFORT_TICKS.forEach((tick, i) => expect(tick.index).toBe(i));
  });
});

describe('snapToTick', () => {
  it('returns an exact tick unchanged', () => {
    expect(snapToTick({ value: 30, unit: 'minute' }).id).toBe('minute-30');
    expect(findTickIndex({ value: 30, unit: 'minute' })).toBe(3);
  });

  it('snaps a legacy free-form duration onto the ladder', () => {
    // Pre-existing tasks have arbitrary duration values; they must still rank.
    expect(snapToTick({ value: 3, unit: 'hour' }).id).toBe('hour-2');
    expect(snapToTick({ value: 7, unit: 'day' }).id).toBe('day-5');
    expect(snapToTick({ value: 100, unit: 'year' }).id).toBe('year-5');
  });

  it('compares by ratio, not raw distance', () => {
    // 45min is 1.33x from an hour but 1.5x from 30min, so an hour is nearer.
    expect(snapToTick({ value: 45, unit: 'minute' }).id).toBe('hour-1');
  });

  it('accepts numeric strings, since form inputs produce them', () => {
    expect(snapToTick({ value: '5', unit: 'hour' }).id).toBe('hour-5');
  });

  it('returns null for anything unusable', () => {
    expect(snapToTick(null)).toBeNull();
    expect(snapToTick({ value: '', unit: 'hour' })).toBeNull();
    expect(snapToTick({ value: 'abc', unit: 'hour' })).toBeNull();
    expect(snapToTick({ value: 0, unit: 'hour' })).toBeNull();
    expect(snapToTick({ value: 5, unit: 'fortnight' })).toBeNull();
  });
});

describe('resolveEffortTier', () => {
  it('uses the default cut-points: small ≤ 2h, medium ≤ 2d', () => {
    expect(resolveEffortTier({ value: 30, unit: 'minute' })).toBe('small');
    expect(resolveEffortTier({ value: 2, unit: 'hour' })).toBe('small');
    expect(resolveEffortTier({ value: 5, unit: 'hour' })).toBe('medium');
    expect(resolveEffortTier({ value: 2, unit: 'day' })).toBe('medium');
    expect(resolveEffortTier({ value: 5, unit: 'day' })).toBe('large');
    expect(resolveEffortTier({ value: 1, unit: 'year' })).toBe('large');
  });

  it('respects user-chosen cut-points', () => {
    // Someone who thinks in weeks: small up to 1 day, medium up to 25 days.
    const tiers = { smallMaxIndex: 8, mediumMaxIndex: 12 };
    expect(resolveEffortTier({ value: 1, unit: 'day' }, tiers)).toBe('small');
    expect(resolveEffortTier({ value: 15, unit: 'day' }, tiers)).toBe('medium');
    expect(resolveEffortTier({ value: 1, unit: 'month' }, tiers)).toBe('large');
  });

  it('treats an unestimated task as medium so it neither jumps nor sinks', () => {
    expect(resolveEffortTier(null)).toBe('medium');
    expect(resolveEffortTier({ value: '', unit: 'hour' })).toBe('medium');
  });
});

describe('sanitizeEffortTiers', () => {
  it('falls back to the defaults for junk', () => {
    expect(sanitizeEffortTiers(null)).toEqual(DEFAULT_EFFORT_TIERS);
    expect(sanitizeEffortTiers({ smallMaxIndex: 'x', mediumMaxIndex: null })).toEqual(DEFAULT_EFFORT_TIERS);
  });

  it('keeps small strictly below medium even when stored inverted', () => {
    const tiers = sanitizeEffortTiers({ smallMaxIndex: 9, mediumMaxIndex: 2 });
    expect(tiers.smallMaxIndex).toBeLessThan(tiers.mediumMaxIndex);
  });

  it('clamps out-of-range indexes', () => {
    const tiers = sanitizeEffortTiers({ smallMaxIndex: -5, mediumMaxIndex: 999 });
    expect(tiers.smallMaxIndex).toBe(0);
    expect(tiers.mediumMaxIndex).toBeLessThan(EFFORT_TICKS.length);
  });
});

describe('formatEffort', () => {
  const tt = (_key, fallback) => fallback;
  it('renders the snapped tick, not the raw input', () => {
    expect(formatEffort({ value: 3, unit: 'hour' }, tt)).toBe('2 hour');
  });
  it('returns null when there is nothing to show', () => {
    expect(formatEffort({ value: '', unit: 'hour' }, tt)).toBeNull();
  });
});
