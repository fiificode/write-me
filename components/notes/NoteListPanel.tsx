'use client';
import { useRouter } from 'next/navigation';
import { useNotesStore } from '@/store/useNotesStore';
import { useNotes } from '@/hooks/useNotes';
import { NoteCard } from './NoteCard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const VIEW_LABELS: Record<string, string> = {
  all: 'All Notes',
  pinned: 'Pinned Notes',
  trash: 'Trash',
};

export function NoteListPanel() {
  const { activeView, activeNoteId } = useNotesStore();
  const { notes, createNote, togglePin, trashNote, deleteNote, restoreNote } = useNotes();
  const router = useRouter();

  async function handleNewNote() {
    const folderId = activeView.startsWith('folder:') ? activeView.replace('folder:', '') : undefined;
    const note = await createNote(folderId);
    if (note) router.push(`/notes/${note.id}`);
  }

  const label = activeView.startsWith('folder:')
    ? 'Folder'
    : VIEW_LABELS[activeView] ?? 'Notes';

  return (
    <div className="w-72 flex-shrink-0 border-r border-gray-200 flex flex-col h-full bg-white">
      <div className="px-4 h-14 flex items-center justify-between border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-[15px] truncate">
          {label} <span className="font-normal text-gray-400 text-sm ml-1">({notes.length})</span>
        </h2>
        <Button
          onClick={handleNewNote}
          size="sm"
          className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New Note
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            No notes here
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isActive={note.id === activeNoteId}
              isTrashed={activeView === 'trash'}
              onClick={() => router.push(`/notes/${note.id}`)}
              onPin={() => togglePin(note)}
              onTrash={() => trashNote(note.id)}
              onDelete={() => deleteNote(note.id)}
              onRestore={() => restoreNote(note.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
