'use client';

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  promptInstall: () => Promise<void>;
  dismiss: () => void;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const TEST_KEY = 'pwa-test-mode';

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if previously dismissed and not expired
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const dismissTime = parseInt(dismissedAt, 10);
      if (Date.now() - dismissTime < DISMISS_DURATION) {
        setIsDismissed(true);
      } else {
        localStorage.removeItem(DISMISS_KEY);
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }, []);

  // Enable test mode via console: localStorage.setItem('pwa-test-mode', 'true')
  const isTestMode = typeof window !== 'undefined' && localStorage.getItem(TEST_KEY) === 'true';

  // Expose trigger for manual testing in console
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { triggerPWAInstall?: () => void }).triggerPWAInstall = () => {
        const mockEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
        Object.defineProperty(mockEvent, 'platforms', { value: ['web'] });
        Object.defineProperty(mockEvent, 'userChoice', { value: Promise.resolve({ outcome: 'accepted', platform: 'web' }) });
        Object.defineProperty(mockEvent, 'prompt', { value: () => Promise.resolve() });
        setDeferredPrompt(mockEvent);
        localStorage.removeItem(DISMISS_KEY);
      };
    }
  }, []);

  return {
    isInstallable: (!!deferredPrompt || isTestMode) && !isInstalled && !isDismissed,
    isInstalled,
    deferredPrompt,
    promptInstall,
    dismiss,
  };
}
