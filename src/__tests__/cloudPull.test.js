import { describe, it, expect, vi } from 'vitest';
import { pullTasks, pullLabels } from '../utils/cloudPull';

const task = (id, name = `task ${id}`) => ({ id, name, status: 'active', steps: [] });
const label = (id, text = `label ${id}`) => ({ id, text, color: '#64748b' });
const ids = (list) => list.map((item) => item.id).sort();
const noPending = () => ({ edited: new Set(), deleted: new Set() });

/** Dependencies for pullTasks, recording what the pull did. */
function taskPull({ cloud = null, local = [], pending = noPending(), loadFails = null } = {}) {
  const state = { local: [...local], applied: null, saved: null, removed: [] };
  const deferred = {};
  const load = vi.fn(() => new Promise((resolve, reject) => {
    deferred.finish = () => (loadFails ? reject(loadFails) : resolve(cloud));
  }));
  const deps = {
    mode: 'tasks',
    load,
    getLocal: () => state.local,
    getPending: () => pending,
    apply: vi.fn((tasks) => { state.applied = tasks; }),
    save: vi.fn(async (tasks) => { state.saved = tasks; }),
    remove: vi.fn(async (id) => { state.removed.push(id); }),
  };
  return { deps, state, finishLoad: () => deferred.finish() };
}

describe('pullTasks', () => {
  it('keeps a task added while the cloud read was still running, and uploads it', async () => {
    // After a reconnect the read can take seconds, and people keep typing.
    const { deps, state, finishLoad } = taskPull({
      cloud: { items: [task('1')], deletedIds: [] },
      local: [task('1')],
    });

    const pulled = pullTasks(deps);
    state.local = [...state.local, task('new', 'added during the pull')];
    finishLoad();
    await pulled;

    expect(ids(state.applied)).toEqual(['1', 'new']);
    expect(ids(state.saved)).toEqual(['new']);
  });

  it('uploads tasks created offline and keeps tasks only the cloud has', async () => {
    const { deps, state, finishLoad } = taskPull({
      cloud: { items: [task('cloud-only')], deletedIds: [] },
      local: [task('made-offline')],
    });

    const pulled = pullTasks(deps);
    finishLoad();
    await pulled;

    expect(ids(state.applied)).toEqual(['cloud-only', 'made-offline']);
    expect(ids(state.saved)).toEqual(['made-offline']);
  });

  it('uploads nothing when the cloud already has everything', async () => {
    const { deps, state, finishLoad } = taskPull({
      cloud: { items: [task('1')], deletedIds: [] },
      local: [task('1')],
    });

    const pulled = pullTasks(deps);
    finishLoad();
    await pulled;

    expect(state.saved).toEqual([]);
  });

  it('drops a task another device deleted instead of uploading it again', async () => {
    const { deps, state, finishLoad } = taskPull({
      cloud: { items: [task('kept')], deletedIds: ['gone'] },
      local: [task('kept'), task('gone')],
    });

    const pulled = pullTasks(deps);
    finishLoad();
    await pulled;

    expect(ids(state.applied)).toEqual(['kept']);
    expect(state.saved).toEqual([]);
  });

  it('keeps a local edit that has not reached the cloud over the cloud copy', async () => {
    const { deps, state, finishLoad } = taskPull({
      cloud: { items: [task('1', 'old name')], deletedIds: [] },
      local: [task('1', 'edited offline')],
      pending: { edited: new Set(['1']), deleted: new Set() },
    });

    const pulled = pullTasks(deps);
    finishLoad();
    await pulled;

    expect(state.applied.map((t) => t.name)).toEqual(['edited offline']);
    expect(ids(state.saved)).toEqual(['1']);
  });

  it('replays a delete made while offline instead of bringing the task back', async () => {
    const { deps, state, finishLoad } = taskPull({
      cloud: { items: [task('1'), task('2')], deletedIds: [] },
      local: [task('1')],
      pending: { edited: new Set(), deleted: new Set(['2']) },
    });

    const pulled = pullTasks(deps);
    finishLoad();
    await pulled;

    expect(ids(state.applied)).toEqual(['1']);
    expect(state.removed).toEqual(['2']);
  });

  it('reports how many tasks the cloud held', async () => {
    const { deps, finishLoad } = taskPull({ cloud: { items: [task('1'), task('2')], deletedIds: [] } });

    const pulled = pullTasks(deps);
    finishLoad();

    await expect(pulled).resolves.toBe(2);
  });

  it('treats a cloud that holds nothing yet as empty and uploads every local task', async () => {
    const { deps, state, finishLoad } = taskPull({ cloud: null, local: [task('1'), task('2')] });

    const pulled = pullTasks(deps);
    finishLoad();

    await expect(pulled).resolves.toBe(0);
    expect(ids(state.saved)).toEqual(['1', '2']);
  });

  it('changes nothing, locally or in the cloud, when the read fails', async () => {
    const failure = Object.assign(new Error('offline'), { code: 'offline' });
    const { deps, state, finishLoad } = taskPull({ local: [task('1')], loadFails: failure });

    const pulled = pullTasks(deps);
    finishLoad();

    await expect(pulled).rejects.toBe(failure);
    expect(deps.apply).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
    expect(state.removed).toEqual([]);
  });
});

describe('pullLabels', () => {
  function labelPull({ cloud = null, local = [] } = {}) {
    const state = { local: [...local], applied: null, saved: null };
    const deferred = {};
    const deps = {
      load: vi.fn(() => new Promise((resolve) => { deferred.finish = () => resolve(cloud); })),
      getLocal: () => state.local,
      apply: vi.fn((labels) => { state.applied = labels; }),
      save: vi.fn(async (labels) => { state.saved = labels; }),
    };
    return { deps, state, finishLoad: () => deferred.finish() };
  }

  it('keeps a label added while the cloud read was still running, and uploads the result', async () => {
    const { deps, state, finishLoad } = labelPull({ cloud: [label('1')], local: [label('1')] });

    const pulled = pullLabels(deps);
    state.local = [...state.local, label('new')];
    finishLoad();
    await pulled;

    expect(ids(state.applied)).toEqual(['1', 'new']);
    expect(ids(state.saved)).toEqual(['1', 'new']);
  });

  it('adds the cloud labels this device does not have', async () => {
    const { deps, state, finishLoad } = labelPull({ cloud: [label('a'), label('b')], local: [] });

    const pulled = pullLabels(deps);
    finishLoad();

    await expect(pulled).resolves.toBe(2);
    expect(ids(state.applied)).toEqual(['a', 'b']);
    expect(state.saved).toBeNull();
  });

  it('changes nothing when the read fails', async () => {
    const deps = {
      load: vi.fn(async () => { throw new Error('offline'); }),
      getLocal: () => [label('1')],
      apply: vi.fn(),
      save: vi.fn(),
    };

    await expect(pullLabels(deps)).rejects.toThrow('offline');
    expect(deps.apply).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
  });
});
