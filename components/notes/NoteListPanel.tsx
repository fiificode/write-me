"use client"
import { useRouter } from "next/navigation"
import { useNotesStore } from "@/store/useNotesStore"
import { useNotes } from "@/hooks/useNotes"
import { NoteCard } from "@/components/notes/NoteCard"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

const VIEW_LABELS: Record<string, string> = {
  all: "All Notes",
  pinned: "Pinned Notes",
  trash: "Trash",
}

interface NoteListPanelProps {
  onBack?: () => void
  className?: string
}

export function NoteListPanel({ onBack, className }: NoteListPanelProps) {
  const { activeView, activeNoteId, isNoteListOpen, setNoteListOpen } = useNotesStore()
  const { notes, isLoading, createNote, togglePin, trashNote, deleteNote, restoreNote } =
    useNotes()
  const router = useRouter()

  async function handleNewNote() {
    const folderId = activeView.startsWith("folder:")
      ? activeView.replace("folder:", "")
      : undefined
    const note = await createNote(folderId)
    if (note) {
      router.push(`/notes/${note.id}`)
      // On mobile, also close the note list to show editor
      if (onBack) {
        setNoteListOpen(false)
      }
    }
  }

  function handleNoteClick(noteId: string) {
    router.push(`/notes/${noteId}`)
    // On mobile, close the note list when a note is selected
    if (onBack) {
      setNoteListOpen(false)
    }
  }

  const label = activeView.startsWith("folder:")
    ? "Folder"
    : VIEW_LABELS[activeView] ?? "Notes"

  return (
    <div
      className={cn(
        "flex w-72 shrink-0 flex-col border-r border-gray-200 bg-white",
        className
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-gray-100 px-4">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-500" />
            </button>
          )}
          <h2 className="truncate font-semibold text-[15px] text-gray-900">
            {label}{" "}
            <span className="ml-1 font-normal text-sm text-gray-400">
              ({notes.length})
            </span>
          </h2>
        </div>
        <Button
          onClick={handleNewNote}
          size="sm"
          className="flex h-8 cursor-pointer items-center gap-1.5 px-3 text-xs text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New Note</span>
        </Button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-300">
            📭 No notes here
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isActive={note.id === activeNoteId}
              isTrashed={activeView === "trash"}
              onClick={() => handleNoteClick(note.id)}
              onPin={() => togglePin(note)}
              onTrash={() => trashNote(note.id)}
              onDelete={() => deleteNote(note.id)}
              onRestore={() => restoreNote(note.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
