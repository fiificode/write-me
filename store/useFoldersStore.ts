import { create } from 'zustand';
import { Folder } from '@/types';

interface FoldersState {
  folders: Folder[];
  isLoading: boolean;
  setFolders: (folders: Folder[]) => void;
  setIsLoading: (loading: boolean) => void;
  addFolder: (folder: Folder) => void;
  removeFolder: (id: string) => void;
}

export const useFoldersStore = create<FoldersState>((set) => ({
  folders: [],
  isLoading: false,
  setFolders: (folders) => set({ folders }),
  setIsLoading: (isLoading) => set({ isLoading }),
  addFolder: (folder) => set((s) => ({ folders: [...s.folders, folder] })),
  removeFolder: (id) =>
    set((s) => ({ folders: s.folders.filter((f) => f.id !== id) })),
}));
