import { describe, it, expect } from 'vitest';
import { resolveLabelsOnSignIn, resolveTasksOnSignIn } from '../utils/labelSync.js';

describe('resolveLabelsOnSignIn', () => {
  it('cloud wins for a label id that exists on both sides', () => {
    const local = [{ id: '1', text: 'Local', color: '#fca5a5' }];
    const cloud = [{ id: '1', text: 'Cloud', color: '#93c5fd' }];
    const result = resolveLabelsOnSignIn(local, cloud);
    expect(result.labels).toHaveLength(1);
    expect(result.labels[0].text).toBe('Cloud');
    expect(result.pushToCloud).toBe(false);
  });

  it('keeps a local-only label instead of discarding it — regression for the reconnect data-loss bug', () => {
    // A label created while the app hadn't yet heard back from Firebase (or
    // while genuinely offline) must survive the cloud pull that follows,
    // not vanish the instant cloud data — which doesn't have it — arrives.
    const local = [
      { id: '1', text: 'Already synced', color: '#fca5a5' },
      { id: '2', text: 'Made while disconnected', color: '#86efac' },
    ];
    const cloud = [{ id: '1', text: 'Already synced', color: '#fca5a5' }];
    const result = resolveLabelsOnSignIn(local, cloud);
    expect(result.labels.map(l => l.text).sort()).toEqual(['Already synced', 'Made while disconnected'].sort());
    expect(result.pushToCloud).toBe(true);
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

describe('resolveTasksOnSignIn', () => {
  it('cloud wins for a task id that exists on both sides', () => {
    const local = [{ id: '1', name: 'Local task', status: 'active', steps: [] }];
    const cloud = [{ id: '1', name: 'Cloud task', status: 'active', steps: [] }];
    const result = resolveTasksOnSignIn(local, cloud);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].name).toBe('Cloud task');
    expect(result.pushToCloud).toBe(false);
  });

  it('keeps a local-only task instead of discarding it — regression for the reconnect data-loss bug', () => {
    // Reported bug: app opens "disconnected", the user works locally, then
    // Firebase's persisted session resolves and pulls a non-empty (but
    // older/unrelated) cloud snapshot — that pull must not wipe out the work
    // the user just did, just because its id isn't in the cloud copy yet.
    const local = [
      { id: '1', name: 'Already synced', status: 'active', steps: [] },
      { id: 'new', name: 'Made while disconnected', status: 'active', steps: [] },
    ];
    const cloud = [{ id: '1', name: 'Already synced', status: 'active', steps: [] }];
    const result = resolveTasksOnSignIn(local, cloud);
    expect(result.tasks.map(t => t.name).sort()).toEqual(['Already synced', 'Made while disconnected'].sort());
    expect(result.pushToCloud).toBe(true);
  });

  it('keeps local tasks and flags push when cloud is empty', () => {
    const local = [{ id: '1', name: 'Only local', status: 'active', steps: [] }];
    const result = resolveTasksOnSignIn(local, []);
    expect(result.tasks[0].name).toBe('Only local');
    expect(result.pushToCloud).toBe(true);
  });

  it('keeps local tasks and flags push when cloud is null (loadAllItems empty case)', () => {
    const local = [{ id: '1', name: 'Only local', status: 'active', steps: [] }];
    const result = resolveTasksOnSignIn(local, null);
    expect(result.tasks[0].name).toBe('Only local');
    expect(result.pushToCloud).toBe(true);
  });

  it('returns empty when neither side has tasks', () => {
    const result = resolveTasksOnSignIn([], null);
    expect(result.tasks).toEqual([]);
    expect(result.pushToCloud).toBe(false);
  });
});
