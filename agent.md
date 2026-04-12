# Writeup — Notes App

## Project Overview
A clean, Notion-inspired notes application built with Next.js 14 (App Router), Zustand for client state, Shadcn UI + Tailwind CSS for the interface, and Supabase for persistence.

### Key Features
- **Tiptap-based Editor**: Rich text editing with auto-save.
- **Media Support**: Easily insert **Images** and **Links** via the toolbar.
- **Organization**: Nested folders and pinning for important notes.
- **Privacy**: Clerk-powered auth with Supabase RLS policies.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| State | Zustand |
| UI | Shadcn UI + Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Rich Text | Tiptap editor |
| Auth | Clerk Auth |

---

## Project Structure

```
writeup/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Redirects to /notes
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   └── notes/
│       ├── layout.tsx              # Three-panel shell
│       └── [id]/page.tsx           # Note editor view
├── components/
│   ├── sidebar/
│   │   └── Sidebar.tsx             # Nav + Search + Folders
│   ├── notes/
│   │   ├── NoteListPanel.tsx       # Filtered note list + New Note
│   │   ├── NoteCard.tsx            # Note summary card
│   │   ├── NoteEditor.tsx          # Main editor layout
│   │   └── EditorHeader.tsx        # Note Title, Pin, Delete
│   ├── editor/
│   │   ├── EditorToolbar.tsx       # Tiptap formatting
│   │   └── extensions.ts           # Tiptap extensions config
│   └── ui/                         # Shadcn components
├── store/
│   ├── useNotesStore.ts            # Zustand store
│   └── useFoldersStore.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser client
│   │   ├── server.ts               # Server client
│   │   └── proxy.ts
│   └── utils.ts
├── hooks/
│   ├── useNotes.ts                 # Data fetching + mutations
│   └── useFolders.ts
├── types/
│   └── index.ts
└── supabase/
    └── migrations/
        └── 001_initial.sql
```

---

## Database Schema (Supabase)

```sql
-- Run in Supabase SQL editor

create table folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  icon text default '📁',
  created_at timestamptz default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  folder_id uuid references folders(id) on delete set null,
  title text not null default 'Untitled',
  content jsonb,                    -- Tiptap JSON
  content_text text,                -- Plain text for search/preview
  is_pinned boolean default false,
  is_trashed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at
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

-- RLS
alter table folders enable row level security;
alter table notes enable row level security;

create policy "Users own their folders" on folders
  for all using (auth.jwt() ->> 'sub' = user_id);

create policy "Users own their notes" on notes
  for all using (auth.jwt() ->> 'sub' = user_id);
```

---

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Installation

```bash
npx create-next-app@latest writeup --typescript --tailwind --app
cd writeup

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# State
npm install zustand

# Shadcn UI
npx shadcn@latest init
npx shadcn@latest add button input dropdown-menu separator tooltip scroll-area

# Rich text editor
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-typography @tiptap/extension-color @tiptap/extension-text-style

# Date formatting
npm install date-fns

# Icons
npm install lucide-react
```

---

## Key Files to Implement

### 1. `types/index.ts`
```typescript
export interface Folder {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  content: Record<string, unknown> | null; // Tiptap JSON
  content_text: string | null;
  is_pinned: boolean;
  is_trashed: boolean;
  created_at: string;
  updated_at: string;
  folder?: Folder;
}

export type NoteView = 'all' | 'pinned' | 'trash' | `folder:${string}`;
```

---

### 2. `store/useNotesStore.ts`
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

### 3. `store/useFoldersStore.ts`
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

### 4. `lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr';

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
```

---

### 5. `hooks/useNotes.ts`
```typescript
'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useNotesStore } from '@/store/useNotesStore';
import { Note } from '@/types';

export function useNotes() {
  const { notes, setNotes, addNote, updateNote, removeNote, activeView, searchQuery } =
    useNotesStore();
  const supabase = createClient();

  useEffect(() => {
    fetchNotes();
    // Realtime subscription
    const channel = supabase
      .channel('notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, fetchNotes)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchNotes() {
    const { data } = await supabase
      .from('notes')
      .select('*, folder:folders(id, name, icon)')
      .order('updated_at', { ascending: false });
    if (data) setNotes(data as Note[]);
  }

  async function createNote(folderId?: string) {
    const { data: { user } } = await supabase.auth.getUser(); // Note: With Clerk, we usually pass user_id from Clerk's useUser hook
    if (!user) return null;
    const { data } = await supabase
      .from('notes')
      .insert({ user_id: user.id, folder_id: folderId ?? null, title: 'Untitled' })
      .select('*, folder:folders(id, name, icon)')
      .single();
    if (data) addNote(data as Note);
    return data as Note | null;
  }

  async function saveNote(id: string, updates: Partial<Note>) {
    const { data } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id)
      .select('*, folder:folders(id, name, icon)')
      .single();
    if (data) updateNote(id, data as Note);
  }

  async function deleteNote(id: string) {
    await supabase.from('notes').delete().eq('id', id);
    removeNote(id);
  }

  async function togglePin(id: string, current: boolean) {
    await saveNote(id, { is_pinned: !current });
  }

  async function trashNote(id: string) {
    await saveNote(id, { is_trashed: true });
  }

  // Filter notes based on active view + search
  const filteredNotes = notes.filter((note) => {
    if (activeView === 'trash') return note.is_trashed;
    if (note.is_trashed) return false;
    if (activeView === 'pinned') return note.is_pinned;
    if (activeView.startsWith('folder:')) {
      const fid = activeView.replace('folder:', '');
      return note.folder_id === fid;
    }
    // 'all'
    return true;
  }).filter((note) => {
    if (!searchQuery) return true;
    return (
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content_text?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return { notes: filteredNotes, createNote, saveNote, deleteNote, togglePin, trashNote };
}
```

---

### 6. Three-Panel Layout `app/notes/layout.tsx`
```tsx
'use client';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { NoteList } from '@/components/notes/NoteList';
import { useNotesStore } from '@/store/useNotesStore';

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left: Navigation sidebar ~220px */}
      <Sidebar />
      {/* Middle: Note list ~300px */}
      <NoteList />
      {/* Right: Editor — fills remaining space */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
```

---

### 7. Editor `components/notes/NoteEditor.tsx`
```tsx
'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { useNotes } from '@/hooks/useNotes';
import { useCallback, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';

interface Props { note: Note; }

export function NoteEditor({ note }: Props) {
  const { saveNote } = useNotes();

  const save = useDebouncedCallback((id: string, content: unknown, text: string, title: string) => {
    saveNote(id, { content: content as Record<string, unknown>, content_text: text, title });
  }, 800);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    immediatelyRender: false,
    content: note.content ?? '',
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const text = editor.getText();
      // Extract first line as title
      const firstLine = text.split('\n')[0] || 'Untitled';
      save(note.id, json, text, firstLine);
    },
  });

  useEffect(() => {
    if (editor && note.content) {
      editor.commands.setContent(note.content);
    }
  }, [note.id]);

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto px-12 py-8 max-w-3xl mx-auto w-full">
        <EditorContent editor={editor} className="prose prose-neutral max-w-none min-h-full" />
      </div>
    </div>
  );
}
```

---

## UI Design Reference (from screenshot)

### Color Palette
```css
/* tailwind.config.ts — extend */
colors: {
  sidebar: '#f7f7f5',       /* warm off-white sidebar bg */
  panel: '#ffffff',          /* note list panel */
  accent: '#2563eb',         /* blue active state */
  muted: '#6b7280',          /* timestamps, secondary text */
  border: '#e5e7eb',         /* dividers */
  active-card: '#dbeafe',    /* selected note card bg */
}
```

### Typography
- Headings in editor: `font-semibold text-2xl` (H1), `text-xl` (H2)
- Note card title: `font-semibold text-sm`
- Preview text: `text-xs text-muted-foreground line-clamp-2`
- Timestamp: `text-xs text-muted-foreground`

### Layout Dimensions
| Panel | Width |
|-------|-------|
| Sidebar | `w-56` (224px) |
| Note list | `w-72` (288px) |
| Editor | `flex-1` |

---

## Component Behavior Notes

### Sidebar
- **New Note** button at top right (blue `+ New Note`)
- Active nav item has blue left border + light blue bg
- Folders can be expanded/collapsed
- Clicking a folder filters the note list via `setActiveView('folder:<id>')`

### Note List
- Header shows current view title + note count e.g. `All Notes (6)`
- Each card: title, 2-line preview, relative timestamp, folder badge (right), pin icon (top right)
- Selected card has a blue-tinted background
- Clicking a card navigates to `/notes/[id]`

### Editor Toolbar
- Format buttons: H1, H2, Normal, **B**, *I*, bullet list, numbered list, undo, redo
- Dividers between button groups (as seen in screenshot)
- Active format button appears highlighted

### Auto-save
- Debounce saves on content change (800ms)
- Title auto-extracted from first heading or first line of text

---

## Agent Instructions

When modifying this codebase:

1. **Always** use the Zustand store as the single source of truth for UI state. Supabase is the persistence layer — never read directly from Supabase in render paths.
2. **Optimistic updates**: Update the store immediately, then persist to Supabase. Roll back on error.
3. **Note content** is stored as Tiptap JSON in Supabase (`jsonb` column). Always parse/serialize correctly.
4. **Debounce** all editor saves to avoid excessive Supabase writes (800ms recommended).
5. **RLS is enabled** — always ensure the user is authenticated before any DB operation. Use Clerk's `useAuth()` or `auth()` to get the session token and pass it as a Bearer token to Supabase.
6. Use **Server Components** for data bootstrapping on initial load. Use **Client Components** only where interactivity requires it.
7. All new Shadcn components should be added via `npx shadcn@latest add <component>`, never manually.
8. Keep the three-panel layout responsive: on mobile, show only one panel at a time.
9. Folder icons support any emoji — store them as text in the `icon` column.
10. When trashing a note, **do not delete** — set `is_trashed = true`. Only delete permanently from the Trash view.
