import { useEffect, useRef } from 'react';

const OVERLAY_MARK = 'kandoneOverlay';

// History entries this module removes itself. The tab-level popstate handler
// must not treat them as the user navigating back.
let programmaticPops = 0;

/** True once for each history step the overlay hooks took on their own. */
export function consumeProgrammaticPop() {
  if (programmaticPops === 0) return false;
  programmaticPops -= 1;
  return true;
}

/** Whether a popstate event's state belongs to an overlay rather than a tab view. */
export function isOverlayState(state) {
  return Boolean(state?.[OVERLAY_MARK]);
}

/**
 * Make the browser's (and Android's) Back button close an overlay instead of
 * leaving the app: opening pushes a history entry, Back pops it and closes,
 * and closing any other way removes the entry again.
 *
 * @param {boolean} isOpen
 * @param {() => void} close
 * @param {string} id unique per overlay, so one cannot pop another's entry
 */
export function useBackClose(isOpen, close, id) {
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });

  useEffect(() => {
    if (!isOpen) return undefined;
    window.history.pushState({ ...window.history.state, [OVERLAY_MARK]: id }, '');
    let poppedByUser = false;
    const onPop = () => {
      if (window.history.state?.[OVERLAY_MARK] === id) return;
      poppedByUser = true;
      window.removeEventListener('popstate', onPop);
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (poppedByUser || window.history.state?.[OVERLAY_MARK] !== id) return;
      programmaticPops += 1;
      window.history.back();
    };
  }, [isOpen, id]);
}
