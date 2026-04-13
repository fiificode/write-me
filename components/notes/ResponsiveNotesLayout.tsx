"use client"
import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useNotesStore } from "@/store/useNotesStore"
import { Sidebar, MobileMenuButton } from "@/components/sidebar/Sidebar"
import { NoteListPanel } from "@/components/notes/NoteListPanel"
import { NoteEditor } from "@/components/notes/NoteEditor"
import { Loader2 } from "lucide-react"

export function ResponsiveNotesLayout() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const {
    isSidebarOpen,
    setSidebarOpen,
    isNoteListOpen,
    setNoteListOpen,
    activeNoteId,
    setActiveNote,
    notes,
  } = useNotesStore()

  const note = notes.find((n) => n.id === id)

  // Handle URL changes for note selection
  useEffect(() => {
    if (id) {
      setActiveNote(id)
      // On mobile, when a note is selected, hide the note list
      setNoteListOpen(false)
    } else {
      setActiveNote(null)
    }
  }, [id, setActiveNote, setNoteListOpen])

  // Handle back button to show note list
  function handleBackToNotes() {
    setNoteListOpen(true)
    setActiveNote(null)
    router.push("/notes")
  }

  // Close sidebar when clicking overlay on mobile
  function handleOverlayClick() {
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={handleOverlayClick}
          />
          {/* Sidebar */}
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Desktop sidebar - always visible on large screens */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile menu button */}
      <MobileMenuButton />

      {/* Note list panel */}
      <div
        className={`${
          isNoteListOpen ? "flex" : "hidden"
        } sm:flex w-full sm:w-72 sm:shrink-0 flex-col`}
      >
        <NoteListPanel
          onBack={id ? handleBackToNotes : undefined}
          className={`${
            id ? "hidden sm:flex" : "flex"
          } w-full sm:w-72`}
        />
      </div>

      {/* Note editor */}
      <main className="flex-1 overflow-hidden border-l border-gray-100">
        {id ? (
          note ? (
            <NoteEditor key={note.id} note={note} onBack={handleBackToNotes} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Select a note or create a new one
          </div>
        )}
      </main>
    </div>
  )
}
