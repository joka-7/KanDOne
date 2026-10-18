import { describe, it, expect } from 'vitest';
import { FOCUS_PULL_MIN_INTERVAL_MS, isFocusPullDue } from '../utils/focusPull';

describe('isFocusPullDue', () => {
  const NOW = 1_700_000_000_000;

  it.each([
    ['no pull has happened yet', null, true],
    ['the last pull was just now', NOW, false],
    ['the last pull was a moment ago', NOW - 1_000, false],
    ['the last pull was one tick inside the interval', NOW - FOCUS_PULL_MIN_INTERVAL_MS + 1, false],
    ['the last pull was exactly one interval ago', NOW - FOCUS_PULL_MIN_INTERVAL_MS, true],
    ['the last pull was long ago', NOW - 10 * FOCUS_PULL_MIN_INTERVAL_MS, true],
    ['the clock moved backwards since the last pull', NOW + 60_000, true],
  ])('when %s, returns %s', (_scenario, lastPullAt, expected) => {
    expect(isFocusPullDue(lastPullAt, NOW)).toBe(expected);
  });
});
