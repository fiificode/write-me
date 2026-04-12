"use client"
import { useEditor, EditorContent } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"
import { Placeholder } from "@tiptap/extension-placeholder"
import { Link } from "@tiptap/extension-link"
import { Image as BaseImage } from "@tiptap/extension-image"

/** draggable + resize handles fight ProseMirror / Safari; keep resize only. */
const Image = BaseImage.extend({ draggable: false })
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import { EditorToolbar } from "@/components/editor/EditorToolbar"
import { EditorHeader } from "@/components/notes/EditorHeader"
import { useNotes } from "@/hooks/useNotes"
import { Note } from "@/types"
import { useEffect } from "react"
import { useDebouncedCallback } from "use-debounce"

interface Props {
  note: Note
}

export function NoteEditor({ note }: Props) {
  const { saveNote, togglePin, trashNote } = useNotes()

  const debouncedSave = useDebouncedCallback(
    (id: string, content: unknown, text: string) => {
      const updates: Partial<Note> = {
        content: content as Record<string, unknown>,
        content_text: text,
      }

      // Only auto-extract title if it's currently Untitled
      if (note.title === "Untitled" || !note.title) {
        const lines = text.split("\n").filter(Boolean)
        if (lines[0]) {
          updates.title = lines[0].slice(0, 100)
        }
      }

      saveNote(id, updates)
    },
    800
  )

  const debouncedTitleSave = useDebouncedCallback(
    (id: string, title: string) => {
      saveNote(id, { title })
    },
    800
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Avoid two Link extensions (StarterKit + below); duplicates break setLink/toggleLink.
        link: false,
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline cursor-pointer",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      Image.configure({
        allowBase64: true,
        resize: {
          enabled: true,
          minWidth: 64,
          minHeight: 64,
          alwaysPreserveAspectRatio: true,
        },
        HTMLAttributes: {
          class: "rounded-lg max-w-full",
          draggable: "false",
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    immediatelyRender: false,
    content: note.content ?? "",
    onUpdate: ({ editor }) => {
      debouncedSave(note.id, editor.getJSON(), editor.getText())
    },
    editorProps: {
      attributes: {
        class: "writeup-editor focus:outline-none min-h-[calc(100vh-120px)]",
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    if (note.content) {
      editor.commands.setContent(note.content, { emitUpdate: false })
    } else {
      editor.commands.clearContent()
    }
  }, [note.id])

  return (
    <div className="flex h-full flex-col bg-white">
      <EditorHeader
        note={note}
        onPin={() => togglePin(note)}
        onTrash={() => trashNote(note.id)}
        onTitleChange={(title) => debouncedTitleSave(note.id, title)}
      />
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-12 py-8">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
