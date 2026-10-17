import { describe, it, expect } from 'vitest';
import { shouldRateLimitByDefault } from '../services/aiAssistant';

describe('shouldRateLimitByDefault', () => {
  it.each([
    ['a real browser', { isTest: false, isAutomated: false }, true],
    ['a unit-test run', { isTest: true, isAutomated: false }, false],
    ['a Playwright-driven browser', { isTest: false, isAutomated: true }, false],
  ])('in %s returns %s', (_scenario, env, expected) => {
    expect(shouldRateLimitByDefault(env)).toBe(expected);
  });
});
