'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { processQueue, fullSync, isOnline, getPendingSyncCount } from '@/lib/sync/manager';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setOnline(navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

interface SyncStatus {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
}

export function useSyncStatus(): SyncStatus {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 5000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  return { pendingCount, isSyncing, lastSyncedAt };
}

export function useSyncOnReconnect() {
  const { getToken, userId } = useAuth();
  const online = useOnlineStatus();

  useEffect(() => {
    if (!online || !userId) return;

    const currentUserId = userId;

    async function sync() {
      const token = await getToken({ template: 'supabase' });
      if (!token) return;
      await processQueue(token);
      await fullSync(token, currentUserId);
    }

    sync();
  }, [online, getToken, userId]);
}
