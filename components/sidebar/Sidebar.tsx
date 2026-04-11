'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StickyNote, Pin, Trash2, Plus, ChevronDown, ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useNotesStore } from '@/store/useNotesStore';
import { useFolders } from '@/hooks/useFolders';
import { useNotes } from '@/hooks/useNotes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Sidebar() {
  const { activeView, setActiveView } = useNotesStore();
  const { folders, createFolder } = useFolders();
  const { createNote } = useNotes();
  const { signOut } = useAuth();
  const [foldersOpen, setFoldersOpen] = useState(true);
  const router = useRouter();

  async function handleNewNote() {
    const note = await createNote();
    if (note) router.push(`/notes/${note.id}`);
  }

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  const navItems = [
    { id: 'all' as const, label: 'All Notes', icon: StickyNote },
    { id: 'pinned' as const, label: 'Pinned Notes', icon: Pin },
    { id: 'trash' as const, label: 'Trash', icon: Trash2 },
  ];

  return (
    <aside className="w-56 h-full bg-[#f7f7f5] border-r border-gray-200 flex flex-col py-4 flex-shrink-0">
      {/* Logo + New Note */}
      <div className="px-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">W</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">Writeup</span>
        </div>
        <Button
          size="sm"
          onClick={handleNewNote}
          className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-3 h-3 mr-1" />
          New Note
        </Button>
      </div>

      {/* Nav items */}
      <nav className="px-2 space-y-0.5">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveView(id); router.push('/notes'); }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
              activeView === id
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="my-3 border-t border-gray-200 mx-3" />

      {/* Folders */}
      <div className="px-2 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-1.5">
          <button
            onClick={() => setFoldersOpen(!foldersOpen)}
            className="text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 flex items-center gap-1"
          >
            {foldersOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Folders
          </button>
          <button
            onClick={async () => {
              const name = prompt('Folder name:');
              if (name?.trim()) await createFolder(name.trim());
            }}
            className="text-gray-400 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {foldersOpen && (
          <div className="mt-0.5 space-y-0.5">
            {folders.map((folder) => {
              const viewId = `folder:${folder.id}` as const;
              return (
                <button
                  key={folder.id}
                  onClick={() => { setActiveView(viewId); router.push('/notes'); }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
                    activeView === viewId
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <span className="text-base leading-none">{folder.icon}</span>
                  <span className="truncate">{folder.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="px-5 mt-2">
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-2"
        >
          <LogOut className="w-3 h-3" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
