'use client';
import { useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createClerkSupabaseClient } from '@/lib/supabase/client';
import { useNotesStore } from '@/store/useNotesStore';
import { Note } from '@/types';
import { toast } from 'sonner';

export function useNotes() {
  const { getToken, userId } = useAuth();
  const { notes, setNotes, addNote, updateNote, removeNote, activeView, searchQuery } =
    useNotesStore();

  const fetchNotes = useCallback(async () => {
    const token = await getToken({ template: 'supabase' });
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);
    const { data } = await supabase
      .from('notes')
      .select('*, folder:folders(id, name, icon)')
      .order('updated_at', { ascending: false });
    if (data) setNotes(data as Note[]);
  }, [getToken, setNotes]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function createNote(folderId?: string) {
    if (!userId) return null;
    const token = await getToken({ template: 'supabase' });
    if (!token) return null;
    const supabase = createClerkSupabaseClient(token);
    
    const { data, error } = await supabase
      .from('notes')
      .insert({ user_id: userId, folder_id: folderId ?? null, title: 'Untitled' })
      .select('*, folder:folders(id, name, icon)')
      .single();
    if (data && !error) {
      addNote(data as Note);
      toast.success('Note created');
      return data as Note;
    }
    return null;
  }

  async function saveNote(id: string, updates: Partial<Note>) {
    updateNote(id, updates); // optimistic
    const token = await getToken({ template: 'supabase' });
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);

    const { data } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id)
      .select('*, folder:folders(id, name, icon)')
      .single();
    if (data) updateNote(id, data as Note);
  }

  async function deleteNote(id: string) {
    removeNote(id);
    const token = await getToken({ template: 'supabase' });
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (!error) toast.success('Note deleted forever');
    else toast.error('Failed to delete note');
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
