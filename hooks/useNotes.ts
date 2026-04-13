'use client';
import { useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createClerkSupabaseClient } from '@/lib/supabase/client';
import { useNotesStore } from '@/store/useNotesStore';
import { Note } from '@/types';
import { toast } from 'sonner';
import { db, LocalNote } from '@/lib/db';
import { queueSync, processQueue, fullSync, isOnline } from '@/lib/sync/manager';
import { useOnlineStatus } from '@/lib/sync/hooks';

export function useNotes() {
  const { getToken, userId } = useAuth();
  const online = useOnlineStatus();
  const { notes, setNotes, setIsLoading, addNote, updateNote, removeNote, activeView, searchQuery, isLoading } =
    useNotesStore();

  const syncFromDexie = useCallback(async () => {
    if (!userId) return;
    try {
      const localNotes = await db.notes.where('user_id').equals(userId).toArray();
      const notesWithFolder = await Promise.all(
        localNotes.map(async (n) => {
          if (n.folder_id) {
            const folder = await db.folders.get(n.folder_id);
            return { ...n, folder: folder ? { id: folder.id, name: folder.name, icon: folder.icon } : null };
          }
          return { ...n, folder: null };
        })
      );
      setNotes(notesWithFolder as Note[]);
    } catch (error) {
      console.error('Failed to sync notes from Dexie:', error);
    }
  }, [userId, setNotes]);

  const fetchNotes = useCallback(async () => {
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
        // getToken might fail offline, that's okay
        setIsLoading(false);
        return;
      }
      if (!token) {
        setIsLoading(false);
        return;
      }

      const supabase = createClerkSupabaseClient(token);
      const { data } = await supabase
        .from('notes')
        .select('*, folder:folders(id, name, icon)')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (data) {
        for (const note of data as (Note & { folder?: Pick<import('@/types').Folder, 'id' | 'name' | 'icon'> | null })[]) {
          const existing = await db.notes.get(note.id);
          if (!existing || !existing.pendingSync) {
            await db.notes.put({ ...note, pendingSync: false } as LocalNote);
          }
        }
        await syncFromDexie();
      }
    } catch (error) {
      console.error('Failed to fetch notes from Supabase:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, userId, syncFromDexie, setIsLoading]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    if (!online || !userId) return;

    const currentUserId = userId;

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
        await fullSync(token, currentUserId);
        await syncFromDexie();
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }

    sync();
  }, [online, getToken, userId, syncFromDexie]);

  async function createNote(folderId?: string) {
    if (!userId) return null;
    try {
      const now = new Date().toISOString();
      const note: LocalNote = {
        id: crypto.randomUUID(),
        user_id: userId,
        folder_id: folderId ?? null,
        title: 'Untitled',
        content: null,
        content_text: null,
        is_pinned: false,
        is_trashed: false,
        created_at: now,
        updated_at: now,
        pendingSync: true,
        localUpdatedAt: now,
      };

      await db.notes.add(note);
      await queueSync('create', 'notes', note.id, note);

      let folder = null;
      if (folderId) {
        folder = await db.folders.get(folderId);
      }
      const noteWithFolder = {
        ...note,
        folder: folder ? { id: folder.id, name: folder.name, icon: folder.icon } : null,
      };
      addNote(noteWithFolder as Note);
      toast.success('Note created');

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

      return noteWithFolder as Note;
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error('Failed to create note');
      return null;
    }
  }

  async function saveNote(id: string, updates: Partial<Note>) {
    try {
      const now = new Date().toISOString();
      const existingNote = await db.notes.get(id);
      if (!existingNote) return;

      const updatedNote = {
        ...updates,
        updated_at: now,
        pendingSync: true,
        localUpdatedAt: now,
      };

      await db.notes.update(id, updatedNote as Partial<LocalNote>);
      await queueSync('update', 'notes', id, updates);

      updateNote(id, { ...updates, updated_at: now });

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
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  }

  async function deleteNote(id: string) {
    try {
      await db.notes.delete(id);
      await queueSync('delete', 'notes', id);
      removeNote(id);
      toast.success('Note deleted forever');

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
      console.error('Failed to delete note:', error);
      toast.error('Failed to delete note');
    }
  }

  async function togglePin(note: Note) {
    const newPinStatus = !note.is_pinned;
    await saveNote(note.id, { is_pinned: newPinStatus });
    toast.success(newPinStatus ? 'Note pinned' : 'Note unpinned');
  }

  async function trashNote(id: string) {
    await saveNote(id, { is_trashed: true });
    toast.success('Note moved to trash');
  }

  async function restoreNote(id: string) {
    await saveNote(id, { is_trashed: false });
    toast.success('Note restored');
  }

  const filteredNotes = notes
    .filter((note) => {
      if (activeView === 'trash') return note.is_trashed;
      if (note.is_trashed) return false;
      if (activeView === 'pinned') return note.is_pinned;
      if (activeView.startsWith('folder:')) {
        return note.folder_id === activeView.replace('folder:', '');
      }
      return true;
    })
    .filter((note) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        note.title.toLowerCase().includes(q) ||
        (note.content_text ?? '').toLowerCase().includes(q)
      );
    });

  return { notes: filteredNotes, allNotes: notes, isLoading, createNote, saveNote, deleteNote, togglePin, trashNote, restoreNote };
}
