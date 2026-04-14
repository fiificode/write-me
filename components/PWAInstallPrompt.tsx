'use client';

import { Download, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';

export function PWAInstallPrompt() {
  const { isInstallable, promptInstall, dismiss } = usePWAInstall();

  if (!isInstallable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 md:max-w-sm z-50">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Download className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm">
              Install Writeup
            </h3>
            <p className="text-gray-500 text-xs mt-0.5">
              Add this app to your home screen for quick access
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                onClick={promptInstall}
              >
                Install
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-gray-500 hover:text-gray-700"
                onClick={dismiss}
              >
                Not now
              </Button>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
