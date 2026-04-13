"use client"
import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useNotesStore } from "@/store/useNotesStore"
import { Sidebar, MobileMenuButton } from "@/components/sidebar/Sidebar"
import { NoteListPanel } from "@/components/notes/NoteListPanel"
import { NoteEditor } from "@/components/notes/NoteEditor"
import { cn } from "@/lib/utils"
import { Loader2, PanelLeftClose, PanelLeft } from "lucide-react"

export function ResponsiveNotesLayout() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const {
    isSidebarOpen,
    setSidebarOpen,
    isNoteListOpen,
    setNoteListOpen,
    isDesktopSidebarOpen,
    toggleDesktopSidebar,
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
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden",
          isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={handleOverlayClick}
      />
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out lg:hidden",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Desktop sidebar - collapsible on large screens */}
      <div
        className={cn(
          "hidden lg:flex shrink-0 transition-all duration-300 ease-in-out",
          isDesktopSidebarOpen ? "w-64" : "w-0"
        )}
      >
        <div className="relative w-64 overflow-hidden h-full">
          <Sidebar />
          {/* Toggle inside sidebar header - top right, no overlap with logo */}
          <button
            onClick={toggleDesktopSidebar}
            className="absolute top-3.5 right-3 z-10 flex items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title="Hide sidebar"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Desktop sidebar toggle - shown only when sidebar is collapsed */}
      {!isDesktopSidebarOpen && (
        <button
          onClick={toggleDesktopSidebar}
          className="hidden lg:flex absolute top-3 left-3 z-30 items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          title="Show sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      )}

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
