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
  const { notes, setNotes, addNote, updateNote, removeNote, activeView, searchQuery } =
    useNotesStore();

  const syncFromDexie = useCallback(async () => {
    if (!userId) return;
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
  }, [userId, setNotes]);

  const fetchNotes = useCallback(async () => {
    if (!userId) return;

    await syncFromDexie();

    if (!isOnline()) return;

    const token = await getToken({ template: 'supabase' });
    if (!token) return;

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
  }, [getToken, userId, syncFromDexie]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    if (!online || !userId) return;

    const currentUserId = userId;

    async function sync() {
      const token = await getToken({ template: 'supabase' });
      if (!token) return;
      await processQueue(token);
      await fullSync(token, currentUserId);
      await syncFromDexie();
    }

    sync();
  }, [online, getToken, userId, syncFromDexie]);

  async function createNote(folderId?: string) {
    if (!userId) return null;
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
      const token = await getToken({ template: 'supabase' });
      if (token) {
        await processQueue(token);
        await syncFromDexie();
      }
    }

    return noteWithFolder as Note;
  }

  async function saveNote(id: string, updates: Partial<Note>) {
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
      const token = await getToken({ template: 'supabase' });
      if (token) {
        await processQueue(token);
        await syncFromDexie();
      }
    }
  }

  async function deleteNote(id: string) {
    await db.notes.delete(id);
    await queueSync('delete', 'notes', id);
    removeNote(id);
    toast.success('Note deleted forever');

    if (isOnline()) {
      const token = await getToken({ template: 'supabase' });
      if (token) {
        await processQueue(token);
      }
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

  return { notes: filteredNotes, allNotes: notes, createNote, saveNote, deleteNote, togglePin, trashNote, restoreNote };
}
