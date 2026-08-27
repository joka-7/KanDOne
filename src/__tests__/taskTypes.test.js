import { describe, it, expect } from 'vitest';
import {
  TASK_TYPES, TYPE_GROUPS, UNTYPED, TYPE_ICONS,
  resolveTaskType, groupTasksByType, sortByType, getTypeStyle,
} from '../utils/taskTypes';

describe('TASK_TYPES', () => {
  it('has an icon for every type', () => {
    TASK_TYPES.forEach((type) => expect(TYPE_ICONS[type]).toBeTruthy());
  });

  it('has a style for every type, plus a fallback for anything else', () => {
    TASK_TYPES.forEach((type) => expect(getTypeStyle(type)).toMatch(/bg-/));
    expect(getTypeStyle('not-a-real-type')).toBe(getTypeStyle('other'));
  });

  it('TYPE_GROUPS is every type plus the untyped bucket, in that order', () => {
    expect(TYPE_GROUPS).toEqual([...TASK_TYPES, UNTYPED]);
  });
});

describe('resolveTaskType', () => {
  it('returns the task type when it is a known type', () => {
    expect(resolveTaskType({ type: 'buy' })).toBe('buy');
  });

  it('falls back to untyped for missing, empty, or unrecognised values', () => {
    expect(resolveTaskType({})).toBe(UNTYPED);
    expect(resolveTaskType({ type: '' })).toBe(UNTYPED);
    expect(resolveTaskType({ type: 'not-a-real-type' })).toBe(UNTYPED);
    expect(resolveTaskType(null)).toBe(UNTYPED);
  });
});

describe('groupTasksByType', () => {
  it('buckets every task, including untyped ones', () => {
    const tasks = [
      { id: '1', type: 'buy' },
      { id: '2', type: 'buy' },
      { id: '3', type: 'call' },
      { id: '4' },
    ];
    const groups = groupTasksByType(tasks);
    expect(groups.buy.map(t => t.id)).toEqual(['1', '2']);
    expect(groups.call.map(t => t.id)).toEqual(['3']);
    expect(groups.untyped.map(t => t.id)).toEqual(['4']);
    expect(groups.fix).toEqual([]);
  });

  it('every TYPE_GROUPS id is present even when nothing is in it', () => {
    const groups = groupTasksByType([]);
    TYPE_GROUPS.forEach((id) => expect(groups[id]).toEqual([]));
  });

  it('tolerates a non-array input', () => {
    expect(groupTasksByType(null).untyped).toEqual([]);
  });
});

describe('sortByType', () => {
  it('clusters same-type tasks together in TYPE_GROUPS order', () => {
    const tasks = [
      { id: 'a', type: 'other' },
      { id: 'b', type: 'fix' },
      { id: 'c' }, // untyped
      { id: 'd', type: 'fix' },
      { id: 'e', type: 'buy' },
    ];
    const order = sortByType(tasks).map(t => t.id);
    // fix (b, d) < buy (e) < other (a) < untyped (c), each cluster internally
    // ordered by id.
    expect(order).toEqual(['b', 'd', 'e', 'a', 'c']);
  });

  it('does not mutate the input array', () => {
    const tasks = [{ id: 'b', type: 'buy' }, { id: 'a', type: 'fix' }];
    sortByType(tasks);
    expect(tasks.map(t => t.id)).toEqual(['b', 'a']);
  });
});
