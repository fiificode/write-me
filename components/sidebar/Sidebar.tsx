'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StickyNote, Pin, Trash2, Plus, ChevronDown, ChevronRight, LogOut, Search } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useNotesStore } from '@/store/useNotesStore';
import { useFolders } from '@/hooks/useFolders';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/alert-dialog';

export function Sidebar() {
  const { activeView, setActiveView } = useNotesStore();
  const { folders, createFolder, deleteFolder } = useFolders();
  const { searchQuery, setSearchQuery } = useNotesStore();
  const { signOut } = useAuth();
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const router = useRouter();

  async function handleAddFolder(e: React.FormEvent) {
    e.preventDefault();
    if (newFolderName.trim()) {
      await createFolder(newFolderName.trim());
      setNewFolderName('');
      setIsAddingFolder(false);
    }
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
      {/* Logo Component */}
      <div className="px-3 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">W</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">Writeup</span>
        </div>
      </div>

      {/* Search Bar - Moved from NoteListPanel */}
      <div className="px-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-9 pr-3 py-1.5 bg-gray-200/50 border-none rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
          />
        </div>
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
            onClick={() => setIsAddingFolder(true)}
            className="text-gray-400 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {isAddingFolder && (
          <form onSubmit={handleAddFolder} className="px-3 mb-2">
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={() => !newFolderName && setIsAddingFolder(false)}
              placeholder="Folder name..."
              className="w-full px-2 py-1 bg-white border border-blue-200 rounded text-sm focus:outline-none"
            />
          </form>
        )}

        {foldersOpen && (
          <div className="mt-0.5 space-y-0.5">
            {folders.map((folder) => {
              const viewId = `folder:${folder.id}` as const;
              const isActive = activeView === viewId;
              
              return (
                <div 
                  key={folder.id} 
                  className={cn(
                    'group w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors',
                    isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <button
                    onClick={() => { setActiveView(viewId); router.push('/notes'); }}
                    className="flex items-center gap-2.5 flex-1 text-left truncate"
                  >
                    <span className="text-base leading-none">{folder.icon}</span>
                    <span className="truncate">{folder.name}</span>
                  </button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete folder?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete &quot;{folder.name}&quot;? 
                          Notes inside will become uncategorized but won&apos;t be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={async () => {
                            if (isActive) setActiveView('all');
                            await deleteFolder(folder.id);
                          }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
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
