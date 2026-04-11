'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { useNotes } from '@/hooks/useNotes';
import { Note } from '@/types';
import { useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';

interface Props { note: Note; }

export function NoteEditor({ note }: Props) {
  const { saveNote } = useNotes();

  const debouncedSave = useDebouncedCallback(
    (id: string, content: unknown, text: string) => {
      const lines = text.split('\n').filter(Boolean);
      const title = lines[0]?.slice(0, 100) || 'Untitled';
      saveNote(id, { content: content as Record<string, unknown>, content_text: text, title });
    },
    800
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
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
    <div className="flex flex-col h-full">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-12 py-8">
          <EditorContent editor={editor} className="writeup-editor" />
        </div>
      </div>
    </div>
  );
}
