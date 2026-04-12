# Writeup — Full Implementation Code

## File: `types/index.ts`

```typescript
export interface Folder {
  id: string;
  user_id: string; // Clerk User ID
  name: string;
  icon: string;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string; // Clerk User ID
  folder_id: string | null;
  title: string;
  content: Record<string, unknown> | null;
  content_text: string | null;
  is_pinned: boolean;
  is_trashed: boolean;
  created_at: string;
  updated_at: string;
  folder?: Pick<Folder, 'id' | 'name' | 'icon'> | null;
}

export type NoteView = 'all' | 'pinned' | 'trash' | `folder:${string}`;
```

---

## File: `supabase/migrations/001_initial.sql`

```sql
create table folders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null, -- Stores Clerk User ID
  name text not null,
  icon text default '📁',
  created_at timestamptz default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null, -- Stores Clerk User ID
  folder_id uuid references folders(id) on delete set null,
  title text not null default 'Untitled',
  content jsonb,
  content_text text,
  is_pinned boolean default false,
  is_trashed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger notes_updated_at
  before update on notes
  for each row execute function update_updated_at();

alter table folders enable row level security;
alter table notes enable row level security;

-- Policy for Clerk Auth
create policy "Users own their folders" on folders
  for all using (auth.jwt() ->> 'sub' = user_id);

create policy "Users own their notes" on notes
  for all using (auth.jwt() ->> 'sub' = user_id);
```

---

## File: `lib/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export const createClerkSupabaseClient = (supabaseAccessToken: string) =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${supabaseAccessToken}`,
        },
      },
    }
  );
```

---

## File: `lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
};
```

---

## File: `proxy.ts`

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/notes(.*)"]);

// In Next.js 16+, the exported function should be named 'proxy'
export const proxy = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sign-in|sign-up).*)',
  ],
};
```

---

## File: `store/useNotesStore.ts`

```typescript
import { create } from 'zustand';
import { Note, NoteView } from '@/types';

interface NotesState {
  notes: Note[];
  activeNoteId: string | null;
  activeView: NoteView;
  searchQuery: string;
  setNotes: (notes: Note[]) => void;
  setActiveNote: (id: string | null) => void;
  setActiveView: (view: NoteView) => void;
  setSearchQuery: (q: string) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  removeNote: (id: string) => void;
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: [],
  activeNoteId: null,
  activeView: 'all',
  searchQuery: '',
  setNotes: (notes) => set({ notes }),
  setActiveNote: (id) => set({ activeNoteId: id }),
  setActiveView: (view) => set({ activeView: view }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  addNote: (note) => set((s) => ({ notes: [note, ...s.notes] })),
  updateNote: (id, updates) =>
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
  removeNote: (id) =>
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
}));
```

---

## File: `store/useFoldersStore.ts`

```typescript
import { create } from 'zustand';
import { Folder } from '@/types';

interface FoldersState {
  folders: Folder[];
  setFolders: (folders: Folder[]) => void;
  addFolder: (folder: Folder) => void;
  removeFolder: (id: string) => void;
}

export const useFoldersStore = create<FoldersState>((set) => ({
  folders: [],
  setFolders: (folders) => set({ folders }),
  addFolder: (folder) => set((s) => ({ folders: [...s.folders, folder] })),
  removeFolder: (id) =>
    set((s) => ({ folders: s.folders.filter((f) => f.id !== id) })),
}));
```

---

## File: `hooks/useNotes.ts`

```typescript
'use client';
import { useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createClerkSupabaseClient } from '@/lib/supabase/client';
import { useNotesStore } from '@/store/useNotesStore';
import { Note } from '@/types';

export function useNotes() {
  const { getToken, userId } = useAuth();
  const { notes, setNotes, addNote, updateNote, removeNote, activeView, searchQuery } =
    useNotesStore();

  const fetchNotes = useCallback(async () => {
    const token = await getToken({ template: 'supabase' });
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);
    const { data } = await supabase
      .from('notes')
      .select('*, folder:folders(id, name, icon)')
      .order('updated_at', { ascending: false });
    if (data) setNotes(data as Note[]);
  }, [getToken, setNotes]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function createNote(folderId?: string) {
    if (!userId) return null;
    const token = await getToken({ template: 'supabase' });
    if (!token) return null;
    const supabase = createClerkSupabaseClient(token);
    
    const { data, error } = await supabase
      .from('notes')
      .insert({ user_id: userId, folder_id: folderId ?? null, title: 'Untitled' })
      .select('*, folder:folders(id, name, icon)')
      .single();
    if (data && !error) {
      addNote(data as Note);
      toast.success('Note created');
      return data as Note;
    }
    return null;
  }

  async function saveNote(id: string, updates: Partial<Note>) {
    updateNote(id, updates); // optimistic
    const token = await getToken({ template: 'supabase' });
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);

    const { data } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id)
      .select('*, folder:folders(id, name, icon)')
      .single();
    if (data) updateNote(id, data as Note);
  }

  async function deleteNote(id: string) {
    removeNote(id);
    const token = await getToken({ template: 'supabase' });
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (!error) toast.success('Note deleted forever');
    else toast.error('Failed to delete note');
  }

  async function togglePin(note: Note) {
    const newPinStatus = !note.is_pinned;
    await saveNote(note.id, { is_pinned: newPinStatus });
    toast.success(newPinStatus ? 'Note pinned' : 'Note unpinned');
  }

  async function trashNote(id: string) {
    await saveNote(id, { is_trashed: true });
    toast.success('Note moved to trash');
  }

  async function restoreNote(id: string) {
    await saveNote(id, { is_trashed: false });
    toast.success('Note restored');
  }

  const filteredNotes = notes
    .filter((note) => {
      if (activeView === 'trash') return note.is_trashed;
      if (note.is_trashed) return false;
      if (activeView === 'pinned') return note.is_pinned;
      if (activeView.startsWith('folder:')) {
        return note.folder_id === activeView.replace('folder:', '');
      }
      return true;
    })
    .filter((note) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        note.title.toLowerCase().includes(q) ||
        (note.content_text ?? '').toLowerCase().includes(q)
      );
    });

  return { notes: filteredNotes, allNotes: notes, createNote, saveNote, deleteNote, togglePin, trashNote, restoreNote };
}
```

---

## File: `hooks/useFolders.ts`

```typescript
'use client';
import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createClerkSupabaseClient } from '@/lib/supabase/client';
import { useFoldersStore } from '@/store/useFoldersStore';
import { Folder } from '@/types';

export function useFolders() {
  const { getToken, userId } = useAuth();
  const { folders, setFolders, addFolder, removeFolder } = useFoldersStore();

  useEffect(() => {
    async function fetchFolders() {
      const token = await getToken({ template: 'supabase' });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);
      const { data } = await supabase.from('folders').select('*').order('created_at');
      if (data) setFolders(data as Folder[]);
    }
    fetchFolders();
  }, [getToken, setFolders]);

  async function createFolder(name: string, icon = '📁') {
    if (!userId) return null;
    const token = await getToken({ template: 'supabase' });
    if (!token) return null;
    const supabase = createClerkSupabaseClient(token);
    
    const { data } = await supabase
      .from('folders')
      .insert({ user_id: userId, name, icon })
      .select()
      .single();
    if (data) addFolder(data as Folder);
    return data as Folder | null;
  }

  async function deleteFolder(id: string) {
    removeFolder(id);
    const token = await getToken({ template: 'supabase' });
    if (!token) return;
    const supabase = createClerkSupabaseClient(token);
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (!error) toast.success('Folder deleted');
    else toast.error('Failed to delete folder');
  }

  return { folders, createFolder, deleteFolder };
}
```

---

## File: `app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Writeup',
  description: 'A clean, fast notes app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <TooltipProvider>
            {children}
            <Toaster position="bottom-right" richColors />
          </TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

---

## File: `app/page.tsx`

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/notes');
}
```

---

## File: `app/(auth)/login/page.tsx`

```tsx
'use client';
import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f5]">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">W</span>
          </div>
          <span className="font-bold text-xl text-gray-900">Writeup</span>
        </div>
        <SignIn appearance={{
          elements: {
            formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-sm normal-case',
          }
        }} />
      </div>
    </div>
  );
}
```

---

## File: `app/(auth)/signup/page.tsx`

```tsx
'use client';
import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f5]">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">W</span>
          </div>
          <span className="font-bold text-xl text-gray-900">Writeup</span>
        </div>
        <SignUp appearance={{
          elements: {
            formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-sm normal-case',
          }
        }} />
      </div>
    </div>
  );
}
```

---

## File: `app/notes/layout.tsx`

```tsx
import { Sidebar } from '@/components/sidebar/Sidebar';
import { NoteListPanel } from '@/components/notes/NoteListPanel';

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <NoteListPanel />
      <main className="flex-1 overflow-hidden border-l border-gray-100">
        {children}
      </main>
    </div>
  );
}
```

---

## File: `app/notes/page.tsx`

```tsx
export default function NotesPage() {
  return (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
      Select a note or create a new one
    </div>
  );
}
```

---

## File: `app/notes/[id]/page.tsx`

```tsx
'use client';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useNotesStore } from '@/store/useNotesStore';
import { NoteEditor } from '@/components/notes/NoteEditor';

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  const { notes, setActiveNote } = useNotesStore();
  const note = notes.find((n) => n.id === id);

  useEffect(() => {
    setActiveNote(id);
    return () => setActiveNote(null);
  }, [id]);

  if (!note) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  return <NoteEditor key={note.id} note={note} />;
}
```

---

## File: `components/sidebar/Sidebar.tsx`

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StickyNote, Pin, Trash2, Plus, ChevronDown, ChevronRight, LogOut, Search } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useNotesStore } from '@/store/useNotesStore';
import { useFolders } from '@/hooks/useFolders';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { activeView, setActiveView, searchQuery, setSearchQuery } = useNotesStore();
  const { folders, createFolder } = useFolders();
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

  const navItems = [
    { id: 'all' as const, label: 'All Notes', icon: StickyNote },
    { id: 'pinned' as const, label: 'Pinned Notes', icon: Pin },
    { id: 'trash' as const, label: 'Trash', icon: Trash2 },
  ];

  return (
    <aside className="w-56 h-full bg-[#f7f7f5] border-r border-gray-200 flex flex-col py-4 flex-shrink-0">
      <div className="px-3 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">W</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">Writeup</span>
        </div>
      </div>

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

      <nav className="px-2 space-y-0.5">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveView(id); router.push('/notes'); }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
              activeView === id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-2 mt-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-1.5">
          <button onClick={() => setFoldersOpen(!foldersOpen)} className="text-xs font-semibold text-gray-500 flex items-center gap-1 uppercase tracking-wider">
            {foldersOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Folders
          </button>
          <button onClick={() => setIsAddingFolder(true)} className="text-gray-400 hover:text-blue-600">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {isAddingFolder && (
          <form onSubmit={handleAddFolder} className="px-3 mb-2">
            <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onBlur={() => !newFolderName && setIsAddingFolder(false)} placeholder="Folder name..." className="w-full px-2 py-1 bg-white border border-blue-200 rounded text-sm focus:outline-none" />
          </form>
        )}

        {foldersOpen && (
          <div className="mt-0.5 space-y-0.5">
            {folders.map((folder) => {
              const viewId = `folder:${folder.id}` as const;
              const isActive = activeView === viewId;
              return (
                <div key={folder.id} className={cn('group w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors', isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100')}>
                  <button onClick={() => { setActiveView(viewId); router.push('/notes'); }} className="...">
                    <span>{folder.icon}</span>
                    <span className="truncate">{folder.name}</span>
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 p-1 rounded-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete folder?</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure? Notes inside will become uncategorized.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => { if (isActive) setActiveView('all'); await deleteFolder(folder.id); }} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-5 mt-2">
        <button onClick={() => signOut().then(() => router.push('/login'))} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-2">
          <LogOut className="w-3 h-3" /> Sign out
        </button>
      </div>
    </aside>
  );
}
```

---

## File: `components/notes/NoteListPanel.tsx`

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useNotesStore } from '@/store/useNotesStore';
import { useNotes } from '@/hooks/useNotes';
import { NoteCard } from './NoteCard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const VIEW_LABELS: Record<string, string> = {
  all: 'All Notes',
  pinned: 'Pinned Notes',
  trash: 'Trash',
};

export function NoteListPanel() {
  const { activeView, activeNoteId } = useNotesStore();
  const { notes, createNote, togglePin, trashNote, deleteNote, restoreNote } = useNotes();
  const router = useRouter();

  async function handleNewNote() {
    const folderId = activeView.startsWith('folder:') ? activeView.replace('folder:', '') : undefined;
    const note = await createNote(folderId);
    if (note) router.push(`/notes/${note.id}`);
  }

  const label = activeView.startsWith('folder:') ? 'Folder' : VIEW_LABELS[activeView] ?? 'Notes';

  return (
    <div className="w-72 flex-shrink-0 border-r border-gray-200 flex flex-col h-full bg-white">
      <div className="px-4 h-14 flex items-center justify-between border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-[15px] truncate">
          {label} <span className="font-normal text-gray-400 text-sm ml-1">({notes.length})</span>
        </h2>
        <Button onClick={handleNewNote} size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New Note
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? <div className="flex items-center justify-center h-32 text-sm text-gray-400">No notes here</div> : notes.map((note) => (
          <NoteCard key={note.id} note={note} isActive={note.id === activeNoteId} isTrashed={activeView === 'trash'} onClick={() => router.push(`/notes/${note.id}`)} onPin={() => togglePin(note)} onTrash={() => trashNote(note.id)} onDelete={() => deleteNote(note.id)} onRestore={() => restoreNote(note.id)} />
        ))}
      </div>
    </div>
  );
}
```

---

## File: `components/notes/EditorHeader.tsx`

```tsx
'use client';
import { Note } from '@/types';
import { Pin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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

interface Props {
  note: Note;
  onPin: () => void;
  onTrash: () => void;
  onTitleChange: (title: string) => void;
}

export function EditorHeader({ note, onPin, onTrash, onTitleChange }: Props) {
  return (
    <div className="h-14 px-6 flex items-center justify-between border-b border-gray-100 bg-white">
      <input
        type="text"
        value={note.title || ''}
        placeholder="Untitled"
        onChange={(e) => onTitleChange(e.target.value)}
        className="font-semibold text-gray-900 text-lg bg-transparent border-none focus:outline-none focus:ring-0 flex-1 min-w-0"
      />
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onPin} className={cn('h-8 px-2.5 text-xs flex items-center gap-1.5', note.is_pinned ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-500 hover:text-gray-900')}>
          <Pin className={cn('w-3.5 h-3.5', note.is_pinned && 'fill-current')} /> {note.is_pinned ? 'Pinned' : 'Pin'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onTrash} className="h-8 px-2.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-1.5">
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
}
```

---

## File: `components/notes/NoteEditor.tsx`

```tsx
'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { EditorHeader } from './EditorHeader';
import { useNotes } from '@/hooks/useNotes';
import { Note } from '@/types';
import { useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';

interface Props { note: Note; }

export function NoteEditor({ note }: Props) {
  const { saveNote, togglePin, trashNote } = useNotes();

  const debouncedSave = useDebouncedCallback((id: string, content: unknown, text: string) => {
    const lines = text.split('\n').filter(Boolean);
    const title = lines[0]?.slice(0, 100) || 'Untitled';
    saveNote(id, { content: content as Record<string, unknown>, content_text: text, title });
  }, 800);

  const debouncedTitleSave = useDebouncedCallback((id: string, title: string) => {
    saveNote(id, { title });
  }, 800);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto',
        },
      }),
    ],
    immediatelyRender: false,
    content: note.content ?? '',
    onUpdate: ({ editor }) => debouncedSave(note.id, editor.getJSON(), editor.getText()),
  });

  useEffect(() => {
    if (editor && note.content) editor.commands.setContent(note.content, { emitUpdate: false });
    else if (editor) editor.commands.clearContent();
  }, [note.id, editor]);

  return (
    <div className="flex flex-col h-full bg-white">
      <EditorHeader note={note} onPin={() => togglePin(note)} onTrash={() => trashNote(note.id)} onTitleChange={(title) => debouncedTitleSave(note.id, title)} />
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-12 py-8">
          <EditorContent editor={editor} className="writeup-editor" />
        </div>
      </div>
    </div>
  );
}
'use client';
import { Editor } from '@tiptap/react';
import { Bold, Italic, List, ListOrdered, Undo, Redo, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props { editor: Editor | null; }

export function EditorToolbar({ editor }: Props) {
  if (!editor) return null;

  const Btn = ({
    onClick,
    isActive = false,
    disabled = false,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title?: string;
  }) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={cn(
        'px-2.5 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-30',
        isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'
      )}
    >
      {children}
    </button>
  );

  const Sep = () => <div className="w-px h-5 bg-gray-200 mx-0.5 self-center" />;

  const setLink = () => {
    const url = window.prompt('URL');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('Image URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="flex items-center gap-0.5 px-4 py-2 border-b border-gray-100 bg-white">
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1">H1</Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</Btn>
      <Btn onClick={() => editor.chain().focus().setParagraph().run()} isActive={editor.isActive('paragraph')} title="Normal">Normal</Btn>
      <Sep />
      <Btn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold"><Bold className="w-3.5 h-3.5" /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic"><Italic className="w-3.5 h-3.5" /></Btn>
      <Sep />
      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet list"><List className="w-3.5 h-3.5" /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered list"><ListOrdered className="w-3.5 h-3.5" /></Btn>
      <Sep />
      <Btn onClick={setLink} isActive={editor.isActive('link')} title="Link"><LinkIcon className="w-3.5 h-3.5" /></Btn>
      <Btn onClick={addImage} title="Image"><ImageIcon className="w-3.5 h-3.5" /></Btn>
      <Sep />
      <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo"><Undo className="w-3.5 h-3.5" /></Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo"><Redo className="w-3.5 h-3.5" /></Btn>
    </div>
  );
}
```

---

## File: `app/globals.css` (additions)

```css
/* Add these to your globals.css after the Tailwind directives */

/* Tiptap placeholder */
.tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}

/* Editor typography */
.writeup-editor h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  color: #111827;
  line-height: 1.3;
}

.writeup-editor h1:first-child,
.writeup-editor h2:first-child {
  margin-top: 0;
}

.writeup-editor h2 {
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 1.25rem;
  margin-bottom: 0.4rem;
  color: #111827;
}

.writeup-editor p {
  margin-bottom: 0.5rem;
  line-height: 1.75;
  color: #374151;
}

.writeup-editor ul,
.writeup-editor ol {
  padding-left: 1.5rem;
  margin-bottom: 0.75rem;
}

.writeup-editor li {
  margin-bottom: 0.25rem;
  line-height: 1.7;
  color: #374151;
}

.writeup-editor strong {
  font-weight: 600;
  color: #111827;
}

.writeup-editor em {
  font-style: italic;
}
```

---

## Setup Commands (run in order)

```bash
# 1. Create project
npx create-next-app@latest writeup --typescript --tailwind --app --src-dir=false --import-alias="@/*"
cd writeup

# 2. Install dependencies
npm install @supabase/supabase-js @clerk/nextjs
npm install zustand
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder
npm install date-fns use-debounce lucide-react

# 3. Init Shadcn
npx shadcn@latest init
npx shadcn@latest add button input separator scroll-area tooltip

# 4. Add env vars
echo "NEXT_PUBLIC_SUPABASE_URL=your_url_here" >> .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here" >> .env.local
echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key_here" >> .env.local
echo "CLERK_SECRET_KEY=your_key_here" >> .env.local

# 5. Run the SQL migration in your Supabase SQL editor

# 6. Start dev server
npm run dev
```
