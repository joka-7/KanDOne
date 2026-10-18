import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBackClose, consumeProgrammaticPop } from '../hooks/useBackClose';

const back = () => act(async () => {
  window.history.back();
  await new Promise((resolve) => { setTimeout(resolve, 20); });
});

describe('useBackClose', () => {
  it('closes the overlay on Back and leaves the entry behind it in place', async () => {
    const close = vi.fn();
    const before = window.history.length;
    const { rerender } = renderHook(({ open }) => useBackClose(open, close, 'a'), { initialProps: { open: false } });

    rerender({ open: true });
    const pushed = window.history.length - before;
    await back();

    expect([pushed, close.mock.calls.length]).toEqual([1, 1]);
  });

  it('removes its own history entry when closed another way, and reports that step as its own', async () => {
    const close = vi.fn();
    const { rerender } = renderHook(({ open }) => useBackClose(open, close, 'b'), { initialProps: { open: false } });
    rerender({ open: true });
    const marked = window.history.state;

    rerender({ open: false });
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 20); }); });

    expect([marked !== null, window.history.state?.kandoneOverlay, close.mock.calls.length, consumeProgrammaticPop()])
      .toEqual([true, undefined, 0, true]);
  });
});
