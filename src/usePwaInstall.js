import { useState, useEffect, useCallback, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);

  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const mq = typeof window.matchMedia === 'function'
      && window.matchMedia('(display-mode: standalone)');
    return (mq && mq.matches) || window.navigator.standalone === true;
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const runInstall = useCallback(async (t) => {
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') setInstallPrompt(null);
      return;
    }
    if (isIOS) {
      window.alert(t('header.iosInstallHint'));
      return;
    }
    window.alert(t('header.chromeInstallHint'));
  }, [installPrompt, isIOS]);

  return {
    installPrompt,
    isIOS,
    isStandalone,
    // The Android app is already installed; it has nothing to offer here.
    canInstall: !isStandalone && !Capacitor.isNativePlatform(),
    runInstall,
  };
}
