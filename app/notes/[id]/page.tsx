'use client';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useNotesStore } from '@/store/useNotesStore';
import { NoteEditor } from '@/components/notes/NoteEditor';

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  const { notes, setActiveNote } = useNotesStore();
  const note = notes.find((n) => n.id === id);

  useEffect(() => {
    setActiveNote(id);
    return () => setActiveNote(null);
  }, [id]);

  if (!note) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  return <NoteEditor key={note.id} note={note} />;
}
