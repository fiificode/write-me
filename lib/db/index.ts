import Dexie, { Table } from 'dexie';
import { Note, Folder } from '@/types';

export interface LocalNote extends Omit<Note, 'folder'> {
  folder?: Pick<Folder, 'id' | 'name' | 'icon'> | null;
  pendingSync?: boolean;
  localUpdatedAt?: string;
}

export interface LocalFolder extends Folder {
  pendingSync?: boolean;
}

export interface SyncQueueItem {
  id?: number;
  operation: 'create' | 'update' | 'delete';
  table: 'notes' | 'folders';
  recordId: string;
  payload?: Partial<LocalNote | LocalFolder>;
  timestamp: string;
}

class NotesDB extends Dexie {
  notes!: Table<LocalNote>;
  folders!: Table<LocalFolder>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('NotesDB');
    this.version(1).stores({
      notes: 'id, user_id, folder_id, is_pinned, is_trashed, updated_at, pendingSync',
      folders: 'id, user_id, pendingSync',
      syncQueue: '++id, table, recordId, timestamp',
    });
  }
}

export const db = new NotesDB();
