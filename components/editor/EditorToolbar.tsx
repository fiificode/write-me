"use client"
import { Editor } from "@tiptap/react"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  SquarePlus,
  SquareMinus,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  editor: Editor | null
}

export function EditorToolbar({ editor }: Props) {
  if (!editor) return null

  const Btn = ({
    onClick,
    isActive = false,
    disabled = false,
    children,
    title,
  }: {
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    children: React.ReactNode
    title?: string
  }) => (
    <button
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-30",
        isActive
          ? "bg-gray-200 text-gray-900"
          : "text-gray-600 hover:bg-gray-100"
      )}
    >
      {children}
    </button>
  )

  const Sep = () => <div className="mx-0.5 h-5 w-px self-center bg-gray-200" />

  const setLink = () => {
    const url = window.prompt("URL")
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  const addImage = () => {
    const url = window.prompt("Image URL")
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  return (
    <div className="flex items-center gap-0.5 border-b border-gray-100 bg-white px-4 py-2">
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        H1
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        H2
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setParagraph().run()}
        isActive={editor.isActive("paragraph")}
        title="Normal"
      >
        Normal
      </Btn>
      <Sep />
      <Btn
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </Btn>
      <Sep />
      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </Btn>
      <Sep />
      <Btn onClick={setLink} isActive={editor.isActive("link")} title="Link">
        <LinkIcon className="h-3.5 w-3.5" />
      </Btn>
      <Btn onClick={addImage} title="Image">
        <ImageIcon className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        title="Insert Table"
      >
        <TableIcon className="h-3.5 w-3.5" />
      </Btn>

      {editor.isActive("table") && (
        <>
          <Sep />
          <Btn
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Add Row"
          >
            <SquarePlus className="h-3.5 w-3.5 text-blue-600" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="Delete Row"
          >
            <SquareMinus className="h-3.5 w-3.5 text-red-600" />
          </Btn>
          <Sep />
          <Btn
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Add Column"
          >
            <SquarePlus className="h-3.5 w-3.5 text-green-600" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Delete Column"
          >
            <SquareMinus className="h-3.5 w-3.5 text-orange-600" />
          </Btn>
          <Sep />
          <Btn
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete Table"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </Btn>
        </>
      )}

      <Sep />
      <Btn
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo className="h-3.5 w-3.5" />
      </Btn>
    </div>
  )
}
