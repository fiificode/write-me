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
  const { folders, setFolders, addFolder, removeFolder } = useFoldersStore();

  const syncFromDexie = useCallback(async () => {
    if (!userId) return;
    const localFolders = await db.folders.where('user_id').equals(userId).toArray();
    setFolders(localFolders as Folder[]);
  }, [userId, setFolders]);

  const fetchFolders = useCallback(async () => {
    if (!userId) return;

    await syncFromDexie();

    if (!isOnline()) return;

    const token = await getToken({ template: 'supabase' });
    if (!token) return;

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
  }, [getToken, userId, syncFromDexie]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    if (!online || !userId) return;

    async function sync() {
      const token = await getToken({ template: 'supabase' });
      if (!token) return;
      await processQueue(token);
      await syncFromDexie();
    }

    sync();
  }, [online, getToken, userId, syncFromDexie]);

  async function createFolder(name: string, icon = '📁') {
    if (!userId) return null;
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
      const token = await getToken({ template: 'supabase' });
      if (token) {
        await processQueue(token);
        await syncFromDexie();
      }
    }

    return folder as Folder;
  }

  async function deleteFolder(id: string) {
    await db.folders.delete(id);
    await queueSync('delete', 'folders', id);
    removeFolder(id);
    toast.success('Folder deleted');

    if (isOnline()) {
      const token = await getToken({ template: 'supabase' });
      if (token) {
        await processQueue(token);
      }
    }
  }

  return { folders, createFolder, deleteFolder };
}
