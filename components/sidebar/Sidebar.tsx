"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  StickyNote,
  Pin,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  LogOut,
  Search,
  Menu,
  X,
} from "lucide-react"
import { useAuth } from "@clerk/nextjs"
import { useNotesStore } from "@/store/useNotesStore"
import { useFolders } from "@/hooks/useFolders"
import { cn } from "@/lib/utils"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import Image from "next/image"

interface SidebarProps {
  onClose?: () => void
  className?: string
}

export function Sidebar({ onClose, className }: SidebarProps) {
  const { activeView, setActiveView, setSidebarOpen } = useNotesStore()
  const { folders, createFolder, deleteFolder } = useFolders()
  const { searchQuery, setSearchQuery } = useNotesStore()
  const { signOut } = useAuth()
  const [foldersOpen, setFoldersOpen] = useState(true)
  const [isAddingFolder, setIsAddingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const router = useRouter()

  async function handleAddFolder(e: React.FormEvent) {
    e.preventDefault()
    if (newFolderName.trim()) {
      await createFolder(newFolderName.trim())
      setNewFolderName("")
      setIsAddingFolder(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    router.push("/login")
    setSidebarOpen(false)
  }

  function handleNavClick(view: string) {
    setActiveView(view as typeof activeView)
    router.push("/notes")
    if (onClose) onClose()
  }

  const navItems = [
    { id: "all", label: "All Notes", icon: StickyNote },
    { id: "pinned", label: "Pinned Notes", icon: Pin },
    { id: "trash", label: "Trash", icon: Trash2 },
  ]

  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-gray-200 bg-[#f7f7f5] py-4",
        className
      )}
    >
      {/* Header with logo and mobile close */}
      <div className="mb-4 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            width={148}
            height={148}
            alt="Writeup"
            className="h-10 w-auto object-contain"
          />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 transition-colors hover:bg-gray-200"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-4 px-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full rounded-md border-none bg-gray-200/50 py-1.5 pr-3 pl-9 text-sm placeholder:text-gray-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Nav items */}
      <nav className="space-y-0.5 px-2">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleNavClick(id)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
              activeView === id
                ? "bg-primary/10 font-medium text-primary"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="mx-3 my-3 border-t border-gray-200" />

      {/* Folders */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="flex items-center justify-between px-3 py-1.5">
          <button
            onClick={() => setFoldersOpen(!foldersOpen)}
            className="flex items-center gap-1 text-xs font-semibold tracking-wider text-gray-500 uppercase hover:text-gray-700"
          >
            {foldersOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Folders
          </button>
          <button
            onClick={() => setIsAddingFolder(true)}
            className="text-gray-400 transition-colors hover:text-blue-600"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {isAddingFolder && (
          <form onSubmit={handleAddFolder} className="mb-2 px-3">
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={() => !newFolderName && setIsAddingFolder(false)}
              placeholder="Folder name..."
              className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-sm focus:outline-none"
            />
          </form>
        )}

        {foldersOpen && (
          <div className="mt-0.5 space-y-0.5">
            {folders.map((folder) => {
              const viewId = `folder:${folder.id}`
              const isActive = activeView === viewId

              return (
                <div
                  key={folder.id}
                  className={cn(
                    "group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <button
                    onClick={() => handleNavClick(viewId)}
                    className="flex flex-1 items-center gap-2.5 truncate text-left"
                  >
                    <span className="text-base leading-none">
                      {folder.icon}
                    </span>
                    <span className="truncate">{folder.name}</span>
                  </button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-sm p-1 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete folder?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete &quot;{folder.name}
                          &quot;? Notes inside will become uncategorized but
                          won&apos;t be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            if (isActive) setActiveView("all")
                            await deleteFolder(folder.id)
                          }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="mt-2 px-5">
        <button
          onClick={handleSignOut}
          className="flex cursor-pointer items-center gap-2 text-xs text-gray-400 transition-colors hover:text-gray-600"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </aside>
  )
}

// Mobile menu button component
export function MobileMenuButton() {
  const { toggleSidebar, isSidebarOpen } = useNotesStore()

  if (isSidebarOpen) return null

  return (
    <button
      onClick={toggleSidebar}
      className="fixed bottom-4 left-4 z-50 rounded-full bg-primary p-3 text-white shadow-lg transition-colors hover:bg-primary/90 lg:hidden"
    >
      <Menu className="h-6 w-6" />
    </button>
  )
}
