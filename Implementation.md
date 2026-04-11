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
    await supabase.from('notes').delete().eq('id', id);
  }

  async function togglePin(note: Note) {
    await saveNote(note.id, { is_pinned: !note.is_pinned });
  }

  async function trashNote(id: string) {
    await saveNote(id, { is_trashed: true });
  }

  async function restoreNote(id: string) {
    await saveNote(id, { is_trashed: false });
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
    await supabase.from('folders').delete().eq('id', id);
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
        <body className={inter.className}>{children}</body>
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f5]">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">W</span>
          </div>
          <span className="font-semibold text-gray-900">Writeup</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Welcome back</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        <div className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleLogin} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
        <p className="text-sm text-gray-500 mt-4 text-center">
          No account?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">Sign up</Link>
        </p>
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f5]">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">W</span>
          </div>
          <span className="font-semibold text-gray-900">Writeup</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Create an account</h1>
        <p className="text-sm text-gray-500 mb-6">Start writing today</p>
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        <div className="space-y-3">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleSignup} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </div>
        <p className="text-sm text-gray-500 mt-4 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
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
import { StickyNote, Pin, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { useNotesStore } from '@/store/useNotesStore';
import { useFolders } from '@/hooks/useFolders';
import { useNotes } from '@/hooks/useNotes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function Sidebar() {
  const { activeView, setActiveView } = useNotesStore();
  const { folders, createFolder } = useFolders();
  const { createNote } = useNotes();
  const [foldersOpen, setFoldersOpen] = useState(true);
  const router = useRouter();
  const { signOut } = useAuth();
  const router = useRouter();

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
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Sign out
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
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const VIEW_LABELS: Record<string, string> = {
  all: 'All Notes',
  pinned: 'Pinned Notes',
  trash: 'Trash',
};

export function NoteListPanel() {
  const { activeView, searchQuery, setSearchQuery, activeNoteId } = useNotesStore();
  const { notes, togglePin, trashNote, deleteNote, restoreNote } = useNotes();
  const router = useRouter();

  const label = activeView.startsWith('folder:')
    ? 'Folder'
    : VIEW_LABELS[activeView] ?? 'Notes';

  return (
    <div className="w-72 flex-shrink-0 border-r border-gray-200 flex flex-col h-full bg-white">
      <div className="px-4 pt-5 pb-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-[15px]">
          {label}{' '}
          <span className="font-normal text-gray-400 text-sm">({notes.length})</span>
        </h2>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="pl-9 h-8 text-sm bg-gray-50 border-gray-200"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            No notes here
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isActive={note.id === activeNoteId}
              isTrashed={activeView === 'trash'}
              onClick={() => router.push(`/notes/${note.id}`)}
              onPin={() => togglePin(note)}
              onTrash={() => trashNote(note.id)}
              onDelete={() => deleteNote(note.id)}
              onRestore={() => restoreNote(note.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

---

## File: `components/notes/NoteCard.tsx`

```tsx
'use client';
import { Note } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { Pin, Trash2, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoteCardProps {
  note: Note;
  isActive: boolean;
  isTrashed: boolean;
  onClick: () => void;
  onPin: () => void;
  onTrash: () => void;
  onDelete: () => void;
  onRestore: () => void;
}

export function NoteCard({ note, isActive, isTrashed, onClick, onPin, onTrash, onDelete, onRestore }: NoteCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors',
        isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
      )}
    >
      {/* Pin */}
      <button
        onClick={(e) => { e.stopPropagation(); onPin(); }}
        className={cn(
          'absolute top-3 right-3 p-1 rounded transition-opacity',
          note.is_pinned ? 'opacity-100 text-blue-500' : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600'
        )}
        title={note.is_pinned ? 'Unpin' : 'Pin'}
      >
        <Pin className="w-3.5 h-3.5" fill={note.is_pinned ? 'currentColor' : 'none'} />
      </button>

      <h3 className="font-semibold text-sm text-gray-900 pr-6 truncate">{note.title}</h3>
      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
        {note.content_text || 'No additional text'}
      </p>

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">
          {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
        </span>
        <div className="flex items-center gap-1.5">
          {note.folder && (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded flex items-center gap-1">
              <span>{note.folder.icon}</span>
              <span>{note.folder.name}</span>
            </span>
          )}
          {isTrashed ? (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onRestore(); }}
                className="p-1 rounded text-green-500 hover:bg-green-50"
                title="Restore"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-1 rounded text-red-500 hover:bg-red-50"
                title="Delete permanently"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onTrash(); }}
              className="p-1 rounded text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Move to trash"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
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
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { useNotes } from '@/hooks/useNotes';
import { Note } from '@/types';
import { useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';

interface Props { note: Note; }

export function NoteEditor({ note }: Props) {
  const { saveNote } = useNotes();

  const debouncedSave = useDebouncedCallback(
    (id: string, content: unknown, text: string) => {
      const lines = text.split('\n').filter(Boolean);
      const title = lines[0]?.slice(0, 100) || 'Untitled';
      saveNote(id, { content: content as Record<string, unknown>, content_text: text, title });
    },
    800
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: note.content ?? '',
    onUpdate: ({ editor }) => {
      debouncedSave(note.id, editor.getJSON(), editor.getText());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[calc(100vh-120px)]',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (note.content) {
      editor.commands.setContent(note.content, false);
    } else {
      editor.commands.clearContent();
    }
  }, [note.id]);

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-12 py-8">
          <EditorContent editor={editor} className="writeup-editor" />
        </div>
      </div>
    </div>
  );
}
```

---

## File: `components/editor/EditorToolbar.tsx`

```tsx
'use client';
import { Editor } from '@tiptap/react';
import { Bold, Italic, List, ListOrdered, Undo, Redo } from 'lucide-react';
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
