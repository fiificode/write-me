'use client';
import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createClerkSupabaseClient } from '@/lib/supabase/client';
import { useFoldersStore } from '@/store/useFoldersStore';
import { Folder } from '@/types';
import { toast } from 'sonner';

export function useFolders() {
  const { getToken, userId } = useAuth();
  const { folders, setFolders, addFolder, removeFolder } = useFoldersStore();

  useEffect(() => {
    async function fetchFolders() {
      const token = await getToken({ template: 'supabase' });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);
      const { data } = await supabase.from('folders').select('*').order('created_at');
      if (data) setFolders(data as Folder[]);
    }
    fetchFolders();
  }, [getToken, setFolders]);

  async function createFolder(name: string, icon = '📁') {
    if (!userId) return null;
    const token = await getToken({ template: 'supabase' });
    if (!token) return null;
    const supabase = createClerkSupabaseClient(token);
    
    const { data } = await supabase
      .from('folders')
      .insert({ user_id: userId, name, icon })
      .select()
      .single();
    if (data) {
      addFolder(data as Folder);
      toast.success('Folder created');
    }
    return data as Folder | null;
  }

  async function deleteFolder(id: string) {
    removeFolder(id);
    const token = await getToken({ template: 'supabase' });
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (!error) toast.success('Folder deleted');
    else toast.error('Failed to delete folder');
  }

  return { folders, createFolder, deleteFolder };
}
