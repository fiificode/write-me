'use client';
import { useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createClerkSupabaseClient } from '@/lib/supabase/client';
import { useFoldersStore } from '@/store/useFoldersStore';
import { Folder } from '@/types';
import { toast } from 'sonner';
import { db, LocalFolder } from '@/lib/db';
import { queueSync, processQueue, isOnline } from '@/lib/sync/manager';
import { useOnlineStatus } from '@/lib/sync/hooks';

export function useFolders() {
  const { getToken, userId } = useAuth();
  const online = useOnlineStatus();
  const { folders, setFolders, setIsLoading, addFolder, removeFolder } = useFoldersStore();

  const syncFromDexie = useCallback(async () => {
    if (!userId) return;
    try {
      const localFolders = await db.folders.where('user_id').equals(userId).toArray();
      setFolders(localFolders as Folder[]);
    } catch (error) {
      console.error('Failed to sync folders from Dexie:', error);
    }
  }, [userId, setFolders]);

  const fetchFolders = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);

    await syncFromDexie();

    if (!isOnline()) {
      setIsLoading(false);
      return;
    }

    try {
      let token: string | null = null;
      try {
        token = await getToken({ template: 'supabase' });
      } catch {
        // getToken might fail offline
        setIsLoading(false);
        return;
      }
      if (!token) {
        setIsLoading(false);
        return;
      }

      const supabase = createClerkSupabaseClient(token);
      const { data } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at');

      if (data) {
        for (const folder of data as Folder[]) {
          const existing = await db.folders.get(folder.id);
          if (!existing || !existing.pendingSync) {
            await db.folders.put({ ...folder, pendingSync: false } as LocalFolder);
          }
        }
        await syncFromDexie();
      }
    } catch (error) {
      console.error('Failed to fetch folders from Supabase:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, userId, syncFromDexie, setIsLoading]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    if (!online || !userId) return;

    async function sync() {
      try {
        let token: string | null = null;
        try {
          token = await getToken({ template: 'supabase' });
        } catch {
          return;
        }
        if (!token) return;
        await processQueue(token);
        await syncFromDexie();
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }

    sync();
  }, [online, getToken, userId, syncFromDexie]);

  async function createFolder(name: string, icon = '📁') {
    if (!userId) return null;
    try {
      const now = new Date().toISOString();
      const folder: LocalFolder = {
        id: crypto.randomUUID(),
        user_id: userId,
        name,
        icon,
        created_at: now,
        pendingSync: true,
      };

      await db.folders.add(folder);
      await queueSync('create', 'folders', folder.id, folder);
      addFolder(folder as Folder);
      toast.success('Folder created');

      if (isOnline()) {
        let token: string | null = null;
        try {
          token = await getToken({ template: 'supabase' });
        } catch {
          // getToken might fail offline
        }
        if (token) {
          await processQueue(token);
          await syncFromDexie();
        }
      }

      return folder as Folder;
    } catch (error) {
      console.error('Failed to create folder:', error);
      toast.error('Failed to create folder');
      return null;
    }
  }

  async function deleteFolder(id: string) {
    try {
      await db.folders.delete(id);
      await queueSync('delete', 'folders', id);
      removeFolder(id);
      toast.success('Folder deleted');

      if (isOnline()) {
        let token: string | null = null;
        try {
          token = await getToken({ template: 'supabase' });
        } catch {
          // getToken might fail offline
        }
        if (token) {
          await processQueue(token);
        }
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
      toast.error('Failed to delete folder');
    }
  }

  return { folders, createFolder, deleteFolder };
}
