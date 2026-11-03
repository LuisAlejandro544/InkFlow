/**
 * @file usePWAInstall.ts
 * @description Hook de instalación in-app para Progressive Web App (PWA) nativa.
 * Maneja el evento beforeinstallprompt, detecta si la app ya está instalada en modo standalone,
 * identifica el entorno de desarrollo/previsualización y ofrece soporte para dispositivos iOS Safari y Android Chromium.
 */

import { useEffect, useState } from 'react';
import { detectIsStandalone, detectIsDevOrPreview } from '../engine/environmentDetector';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDevOrPreview, setIsDevOrPreview] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone = detectIsStandalone(
        window.matchMedia('(display-mode: standalone)').matches,
        (window.navigator as unknown as { standalone?: boolean }).standalone,
        document.referrer || ''
      );
      setIsInstalled(isStandalone);

      const devEnv = detectIsDevOrPreview(window.location.hostname, window.location.search);
      setIsDevOrPreview(devEnv);

      // Detectar dispositivos iOS Safari
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isDevOrPreview,
    install,
  };
}
