import { describe, it, expect } from 'vitest';
import { resolveLabelsOnSignIn } from '../utils/labelSync.js';

describe('resolveLabelsOnSignIn', () => {
  it('prefers cloud labels when both exist', () => {
    const local = [{ id: '1', text: 'Local', color: '#fca5a5' }];
    const cloud = [{ id: '2', text: 'Cloud', color: '#93c5fd' }];
    const result = resolveLabelsOnSignIn(local, cloud);
    expect(result.labels).toHaveLength(1);
    expect(result.labels[0].text).toBe('Cloud');
    expect(result.pushToCloud).toBe(false);
  });

  it('keeps local labels and flags push when cloud is empty', () => {
    const local = [{ id: '1', text: 'Work', color: '#fca5a5' }];
    const result = resolveLabelsOnSignIn(local, []);
    expect(result.labels[0].text).toBe('Work');
    expect(result.pushToCloud).toBe(true);
  });

  it('returns empty when neither side has labels', () => {
    const result = resolveLabelsOnSignIn([], null);
    expect(result.labels).toEqual([]);
    expect(result.pushToCloud).toBe(false);
  });
});
