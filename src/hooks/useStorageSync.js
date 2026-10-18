import { useEffect, useRef } from 'react';

/**
 * Follow a localStorage key that another tab of this browser writes.
 *
 * Every tab keeps its own copy of the data in memory and rewrites the whole
 * value on each change, so a tab that never hears about another tab's write
 * erases it with its next save. The `storage` event fires only in the *other*
 * tabs, which is exactly the signal needed: adopt the new value, or react to
 * its removal (sign-out and data deletion clear the key).
 *
 * @param {string} key the localStorage key to watch
 * @param {(raw: string) => unknown} parse turns the stored text into the value `onChange` receives
 * @param {(value: unknown) => void} onChange another tab wrote `key`
 * @param {() => void} onRemoved another tab removed `key`
 */
export function useStorageSync(key, parse, onChange, onRemoved) {
  // Held in refs so a new callback identity never tears down the listener.
  const callbacks = useRef({ onChange, onRemoved });
  useEffect(() => { callbacks.current = { onChange, onRemoved }; });

  useEffect(() => {
    const listener = (event) => {
      if (event.storageArea !== window.localStorage || event.key !== key) return;
      if (event.newValue === null) callbacks.current.onRemoved();
      else callbacks.current.onChange(parse(event.newValue));
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, [key, parse]);
}
