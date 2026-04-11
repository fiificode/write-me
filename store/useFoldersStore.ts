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
