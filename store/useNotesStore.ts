import { create } from 'zustand';
import { Note, NoteView } from '@/types';

interface NotesState {
  notes: Note[];
  isLoading: boolean;
  activeNoteId: string | null;
  activeView: NoteView;
  searchQuery: string;
  // Mobile UI state
  isSidebarOpen: boolean;
  isNoteListOpen: boolean;
  setNotes: (notes: Note[]) => void;
  setIsLoading: (loading: boolean) => void;
  setActiveNote: (id: string | null) => void;
  setActiveView: (view: NoteView) => void;
  setSearchQuery: (q: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setNoteListOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleNoteList: () => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  removeNote: (id: string) => void;
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: [],
  isLoading: false,
  activeNoteId: null,
  activeView: 'all',
  searchQuery: '',
  // Mobile UI state - defaults
  isSidebarOpen: false,
  isNoteListOpen: true,
  setNotes: (notes) => set({ notes }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setActiveNote: (id) => set({ activeNoteId: id }),
  setActiveView: (view) => set({ activeView: view }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setNoteListOpen: (isNoteListOpen) => set({ isNoteListOpen }),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  toggleNoteList: () => set((s) => ({ isNoteListOpen: !s.isNoteListOpen })),
  addNote: (note) => set((s) => ({ notes: [note, ...s.notes] })),
  updateNote: (id, updates) =>
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
  removeNote: (id) =>
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
}));
