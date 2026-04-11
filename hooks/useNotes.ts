'use client';
import { useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createClerkSupabaseClient } from '@/lib/supabase/client';
import { useNotesStore } from '@/store/useNotesStore';
import { Note } from '@/types';

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
    await supabase.from('notes').delete().eq('id', id);
  }

  async function togglePin(note: Note) {
    await saveNote(note.id, { is_pinned: !note.is_pinned });
  }

  async function trashNote(id: string) {
    await saveNote(id, { is_trashed: true });
  }

  async function restoreNote(id: string) {
    await saveNote(id, { is_trashed: false });
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
