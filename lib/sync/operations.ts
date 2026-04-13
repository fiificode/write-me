import { db, LocalNote, LocalFolder } from '@/lib/db';
import { queueSync } from '@/lib/sync/manager';
import { Note, Folder } from '@/types';

export async function createNoteLocally(
  userId: string,
  folderId?: string | null
): Promise<LocalNote> {
  const now = new Date().toISOString();
  const note: LocalNote = {
    id: crypto.randomUUID(),
    user_id: userId,
    folder_id: folderId ?? null,
    title: 'Untitled',
    content: null,
    content_text: null,
    is_pinned: false,
    is_trashed: false,
    created_at: now,
    updated_at: now,
    pendingSync: true,
    localUpdatedAt: now,
  };

  await db.notes.add(note);
  await queueSync('create', 'notes', note.id, note);

  return note;
}

export async function updateNoteLocally(
  id: string,
  updates: Partial<LocalNote>
): Promise<void> {
  const now = new Date().toISOString();
  await db.notes.update(id, {
    ...updates,
    updated_at: now,
    pendingSync: true,
    localUpdatedAt: now,
  });
  await queueSync('update', 'notes', id, updates);
}

export async function deleteNoteLocally(id: string): Promise<void> {
  await db.notes.delete(id);
  await queueSync('delete', 'notes', id);
}

export async function getLocalNotes(userId: string): Promise<LocalNote[]> {
  return db.notes.where('user_id').equals(userId).toArray();
}

export async function createFolderLocally(
  userId: string,
  name: string,
  icon = '📁'
): Promise<LocalFolder> {
  const now = new Date().toISOString();
  const folder: LocalFolder = {
    id: crypto.randomUUID(),
    user_id: userId,
    name,
    icon,
    created_at: now,
    pendingSync: true,
  };

  await db.folders.add(folder);
  await queueSync('create', 'folders', folder.id, folder);

  return folder;
}

export async function deleteFolderLocally(id: string): Promise<void> {
  await db.folders.delete(id);
  await queueSync('delete', 'folders', id);
}

export async function getLocalFolders(userId: string): Promise<LocalFolder[]> {
  return db.folders.where('user_id').equals(userId).toArray();
}

export async function getLocalNote(id: string): Promise<LocalNote | undefined> {
  return db.notes.get(id);
}

export async function getLocalFolder(id: string): Promise<LocalFolder | undefined> {
  return db.folders.get(id);
}
