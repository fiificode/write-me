"use client"
import { useRef, type ChangeEvent } from "react"
import { useEditorState, type Editor } from "@tiptap/react"
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
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/** Add a scheme when missing so TipTap Link accepts the href (e.g. example.com → https://…). */
function normalizeHref(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return trimmed
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  if (trimmed.startsWith("//")) return `https:${trimmed}`
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?")) return trimmed
  return `https://${trimmed}`
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  children: React.ReactNode
  title?: string
}

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  children,
  title,
}: ToolbarButtonProps) {
  return (
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
}

function ToolbarSeparator() {
  return <div className="mx-0.5 h-5 w-px self-center bg-gray-200" />
}

interface Props {
  editor: Editor | null
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const idleToolbar = {
  heading1: false,
  heading2: false,
  paragraph: false,
  bold: false,
  italic: false,
  bulletList: false,
  orderedList: false,
  link: false,
  table: false,
  canUndo: false,
  canRedo: false,
}

export function EditorToolbar({ editor }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pendingImageInsertPos = useRef<number | null>(null)

  const ui =
    useEditorState({
      editor,
      selector: ({ editor: ed }) => {
        if (!ed || ed.isDestroyed) return idleToolbar
        return {
          heading1: ed.isActive("heading", { level: 1 }),
          heading2: ed.isActive("heading", { level: 2 }),
          paragraph: ed.isActive("paragraph"),
          bold: ed.isActive("bold"),
          italic: ed.isActive("italic"),
          bulletList: ed.isActive("bulletList"),
          orderedList: ed.isActive("orderedList"),
          link: ed.isActive("link"),
          table: ed.isActive("table"),
          canUndo: ed.can().undo(),
          canRedo: ed.can().redo(),
        }
      },
    }) ?? idleToolbar

  if (!editor) return null

  const setLink = () => {
    // prompt() blurs the editor and clears the selection in many browsers — restore range after.
    const { from, to } = editor.state.selection
    const previousHref = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("URL", previousHref ?? "")
    if (url === null) return

    const chain = editor.chain().focus().setTextSelection({ from, to })

    if (url.trim() === "") {
      chain.unsetLink().run()
      return
    }
    const href = normalizeHref(url)
    const ok = chain.toggleLink({ href }).run()
    if (!ok) {
      toast.error("Could not add link — check the URL (use https://… if unsure).")
    }
  }

  const openImageUpload = () => {
    pendingImageInsertPos.current = editor.state.selection.from
    imageInputRef.current?.click()
  }

  const onImageFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = ""
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be 5 MB or smaller.")
      return
    }

    const from = pendingImageInsertPos.current
    pendingImageInsertPos.current = null
    if (from == null) return

    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result
      if (typeof src !== "string") return
      const ok = editor.chain().focus().setTextSelection(from).setImage({ src }).run()
      if (!ok) {
        toast.error("Could not insert image here — try a new line or outside lists/code blocks.")
      }
    }
    reader.onerror = () => toast.error("Could not read that image.")
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex items-center gap-0.5 border-b border-gray-100 bg-white px-4 py-2">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={onImageFileChange}
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={ui.heading1}
        title="Heading 1"
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={ui.heading2}
        title="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        isActive={ui.paragraph}
        title="Normal"
      >
        Normal
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={ui.bold}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={ui.italic}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={ui.bulletList}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={ui.orderedList}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton onClick={setLink} isActive={ui.link} title="Link">
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={openImageUpload} title="Upload image">
        <ImageIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
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
      </ToolbarButton>

      {ui.table && (
        <>
          <ToolbarSeparator />
          <ToolbarButton
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Add Row"
          >
            <SquarePlus className="h-3.5 w-3.5 text-blue-600" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="Delete Row"
          >
            <SquareMinus className="h-3.5 w-3.5 text-red-600" />
          </ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Add Column"
          >
            <SquarePlus className="h-3.5 w-3.5 text-green-600" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Delete Column"
          >
            <SquareMinus className="h-3.5 w-3.5 text-orange-600" />
          </ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete Table"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </ToolbarButton>
        </>
      )}

      <ToolbarSeparator />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!ui.canUndo}
        title="Undo"
      >
        <Undo className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!ui.canRedo}
        title="Redo"
      >
        <Redo className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  )
}
