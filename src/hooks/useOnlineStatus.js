import { useSyncExternalStore } from 'react';

function subscribe(onChange) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Whether the browser reports a network; follows the `online`/`offline` events. */
export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, () => navigator.onLine !== false, () => true);
}
