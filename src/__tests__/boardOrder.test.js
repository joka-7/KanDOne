import { describe, it, expect } from 'vitest';
import {
  sanitizeBoardOrder,
  sortByBoardOrder,
  ensureBoardOrders,
  nextBoardOrder,
  applyBoardDrag,
  BOARD_ORDER_GAP,
} from '../utils/boardOrder';

describe('sanitizeBoardOrder', () => {
  it('keeps finite numbers', () => {
    expect(sanitizeBoardOrder(0)).toBe(0);
    expect(sanitizeBoardOrder(42.5)).toBe(42.5);
    expect(sanitizeBoardOrder('100')).toBe(100);
  });

  it('rejects missing or non-finite values', () => {
    expect(sanitizeBoardOrder(null)).toBeNull();
    expect(sanitizeBoardOrder(undefined)).toBeNull();
    expect(sanitizeBoardOrder('')).toBeNull();
    expect(sanitizeBoardOrder('nope')).toBeNull();
    expect(sanitizeBoardOrder(Number.NaN)).toBeNull();
  });
});

describe('ensureBoardOrders', () => {
  it('assigns per-status orders preserving relative array order when missing', () => {
    const tasks = ensureBoardOrders([
      { id: 'a', status: 'active' },
      { id: 'b', status: 'active' },
      { id: 'c', status: 'on_hold' },
    ]);
    expect(tasks.find((t) => t.id === 'a').boardOrder).toBe(0);
    expect(tasks.find((t) => t.id === 'b').boardOrder).toBe(BOARD_ORDER_GAP);
    expect(tasks.find((t) => t.id === 'c').boardOrder).toBe(0);
  });

  it('respects existing boardOrder when sorting a column', () => {
    const tasks = ensureBoardOrders([
      { id: 'a', status: 'active', boardOrder: 2000 },
      { id: 'b', status: 'active', boardOrder: 100 },
    ]);
    expect(sortByBoardOrder(tasks).map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('nextBoardOrder', () => {
  it('returns 0 for an empty column', () => {
    expect(nextBoardOrder([])).toBe(0);
  });

  it('returns max + gap', () => {
    expect(nextBoardOrder([
      { id: 'a', boardOrder: 0 },
      { id: 'b', boardOrder: 3000 },
    ])).toBe(3000 + BOARD_ORDER_GAP);
  });
});

describe('applyBoardDrag', () => {
  const base = [
    { id: 'a', status: 'active', boardOrder: 0, name: 'A' },
    { id: 'b', status: 'active', boardOrder: 1000, name: 'B' },
    { id: 'c', status: 'on_hold', boardOrder: 0, name: 'C' },
  ];

  it('reorders within a column', () => {
    const { tasks, changed } = applyBoardDrag(base, {
      activeId: 'b',
      overId: 'a',
      toStatus: 'active',
      applyStatusChange: (t, s) => ({ ...t, status: s }),
    });
    expect(changed).toBe(true);
    expect(sortByBoardOrder(tasks.filter((t) => t.status === 'active')).map((t) => t.id))
      .toEqual(['b', 'a']);
  });

  it('moves across columns and applies status change', () => {
    const { tasks, changed, movedTask } = applyBoardDrag(base, {
      activeId: 'a',
      overId: 'c',
      toStatus: 'on_hold',
      applyStatusChange: (t, s) => ({ ...t, status: s, moved: true }),
    });
    expect(changed).toBe(true);
    expect(movedTask.status).toBe('on_hold');
    expect(movedTask.moved).toBe(true);
    expect(sortByBoardOrder(tasks.filter((t) => t.status === 'on_hold')).map((t) => t.id))
      .toEqual(['a', 'c']);
    expect(tasks.filter((t) => t.status === 'active').map((t) => t.id)).toEqual(['b']);
  });

  it('appends when dropping on an empty column', () => {
    const { tasks, changed } = applyBoardDrag(base, {
      activeId: 'a',
      overId: null,
      toStatus: 'completed',
      applyStatusChange: (t, s) => ({ ...t, status: s }),
    });
    expect(changed).toBe(true);
    expect(tasks.find((t) => t.id === 'a').status).toBe('completed');
  });

  it('is a no-op when order does not change', () => {
    const { changed } = applyBoardDrag(base, {
      activeId: 'a',
      overId: 'a',
      toStatus: 'active',
      applyStatusChange: (t, s) => ({ ...t, status: s }),
    });
    expect(changed).toBe(false);
  });
});
