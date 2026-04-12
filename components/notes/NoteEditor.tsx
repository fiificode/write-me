'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { EditorHeader } from './EditorHeader';
import { useNotes } from '@/hooks/useNotes';
import { Note } from '@/types';
import { useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';

interface Props { note: Note; }

export function NoteEditor({ note }: Props) {
  const { saveNote, togglePin, trashNote } = useNotes();

  const debouncedSave = useDebouncedCallback(
    (id: string, content: unknown, text: string) => {
      const updates: Partial<Note> = { content: content as Record<string, unknown>, content_text: text };
      
      // Only auto-extract title if it's currently Untitled
      if (note.title === 'Untitled' || !note.title) {
        const lines = text.split('\n').filter(Boolean);
        if (lines[0]) {
          updates.title = lines[0].slice(0, 100);
        }
      }
      
      saveNote(id, updates);
    },
    800
  );

  const debouncedTitleSave = useDebouncedCallback((id: string, title: string) => {
    saveNote(id, { title });
  }, 800);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto',
        },
      }),
    ],
    immediatelyRender: false,
    content: note.content ?? '',
    onUpdate: ({ editor }) => {
      debouncedSave(note.id, editor.getJSON(), editor.getText());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[calc(100vh-120px)]',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (note.content) {
      editor.commands.setContent(note.content, { emitUpdate: false });
    } else {
      editor.commands.clearContent();
    }
  }, [note.id]);

  return (
    <div className="flex flex-col h-full bg-white">
      <EditorHeader
        note={note}
        onPin={() => togglePin(note)}
        onTrash={() => trashNote(note.id)}
        onTitleChange={(title) => debouncedTitleSave(note.id, title)}
      />
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-12 py-8">
          <EditorContent editor={editor} className="writeup-editor" />
        </div>
      </div>
    </div>
  );
}
