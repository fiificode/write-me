import { db, LocalNote, LocalFolder, SyncQueueItem } from '@/lib/db';
import { createClerkSupabaseClient } from '@/lib/supabase/client';
import { Note, Folder } from '@/types';

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

export async function queueSync(
  operation: 'create' | 'update' | 'delete',
  table: 'notes' | 'folders',
  recordId: string,
  payload?: Partial<LocalNote | LocalFolder>
): Promise<void> {
  await db.syncQueue.add({
    operation,
    table,
    recordId,
    payload,
    timestamp: new Date().toISOString(),
  });
}

export async function processQueue(supabaseAccessToken: string): Promise<void> {
  if (!isOnline()) return;

  const supabase = createClerkSupabaseClient(supabaseAccessToken);
  const queueItems = await db.syncQueue.orderBy('timestamp').toArray();

  for (const item of queueItems) {
    try {
      await processQueueItem(item, supabase);
      await db.syncQueue.delete(item.id!);
    } catch (error) {
      console.error('Failed to process sync queue item:', error);
      break;
    }
  }
}

async function processQueueItem(
  item: SyncQueueItem,
  supabase: ReturnType<typeof createClerkSupabaseClient>
): Promise<void> {
  if (item.table === 'notes') {
    await syncNote(item, supabase);
  } else {
    await syncFolder(item, supabase);
  }
}

async function syncNote(
  item: SyncQueueItem,
  supabase: ReturnType<typeof createClerkSupabaseClient>
): Promise<void> {
  const localNote = await db.notes.get(item.recordId);

  if (item.operation === 'delete') {
    await supabase.from('notes').delete().eq('id', item.recordId);
    return;
  }

  const { data: serverNote } = await supabase
    .from('notes')
    .select('*, folder:folders(id, name, icon)')
    .eq('id', item.recordId)
    .maybeSingle();

  if (item.operation === 'create') {
    if (!serverNote) {
      const payload = item.payload as Partial<LocalNote>;
      await supabase.from('notes').insert({
        id: item.recordId,
        user_id: payload.user_id,
        folder_id: payload.folder_id ?? null,
        title: payload.title ?? 'Untitled',
        content: payload.content ?? null,
        content_text: payload.content_text ?? null,
        is_pinned: payload.is_pinned ?? false,
        is_trashed: payload.is_trashed ?? false,
      });
    }
    await db.notes.update(item.recordId, { pendingSync: false });
    return;
  }

  if (item.operation === 'update') {
    const localUpdatedAt = localNote?.localUpdatedAt || localNote?.updated_at;
    const serverUpdatedAt = serverNote?.updated_at;

    const localTime = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;
    const serverTime = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;

    if (localTime >= serverTime || !serverNote) {
      const payload = item.payload as Partial<LocalNote>;
      const { data } = await supabase
        .from('notes')
        .update(payload)
        .eq('id', item.recordId)
        .select('*, folder:folders(id, name, icon)')
        .single();

      if (data) {
        await db.notes.update(item.recordId, {
          ...(data as LocalNote),
          pendingSync: false,
          localUpdatedAt: undefined,
        });
      }
    } else {
      if (serverNote) {
        await db.notes.update(item.recordId, {
          ...(serverNote as LocalNote),
          pendingSync: false,
          localUpdatedAt: undefined,
        });
      }
    }
  }
}

async function syncFolder(
  item: SyncQueueItem,
  supabase: ReturnType<typeof createClerkSupabaseClient>
): Promise<void> {
  if (item.operation === 'delete') {
    await supabase.from('folders').delete().eq('id', item.recordId);
    return;
  }

  const { data: serverFolder } = await supabase
    .from('folders')
    .select('*')
    .eq('id', item.recordId)
    .maybeSingle();

  if (item.operation === 'create') {
    if (!serverFolder) {
      const payload = item.payload as Partial<LocalFolder>;
      await supabase.from('folders').insert({
        id: item.recordId,
        user_id: payload.user_id,
        name: payload.name ?? 'New Folder',
        icon: payload.icon ?? '📁',
      });
    }
    await db.folders.update(item.recordId, { pendingSync: false });
    return;
  }

  if (item.operation === 'update') {
    const localFolder = await db.folders.get(item.recordId);
    const localUpdatedAt = localFolder?.created_at;
    const serverUpdatedAt = serverFolder?.created_at;

    const localTime = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;
    const serverTime = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;

    if (localTime >= serverTime || !serverFolder) {
      const payload = item.payload as Partial<LocalFolder>;
      await supabase.from('folders').update(payload).eq('id', item.recordId);
      await db.folders.update(item.recordId, { pendingSync: false });
    }
  }
}

export async function fullSync(supabaseAccessToken: string, userId: string): Promise<void> {
  if (!isOnline()) return;

  const supabase = createClerkSupabaseClient(supabaseAccessToken);

  const { data: serverNotes } = await supabase
    .from('notes')
    .select('*, folder:folders(id, name, icon)')
    .eq('user_id', userId);

  const { data: serverFolders } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId);

  if (serverNotes) {
    const localNotes = await db.notes.where('user_id').equals(userId).toArray();
    const localMap = new Map(localNotes.map((n) => [n.id, n]));

    for (const note of serverNotes as (Note & { folder?: Pick<Folder, 'id' | 'name' | 'icon'> | null })[]) {
      const local = localMap.get(note.id);
      if (!local || !local.pendingSync) {
        await db.notes.put({ ...note, pendingSync: false } as LocalNote);
      }
    }

    for (const local of localNotes) {
      if (local.pendingSync) {
        const serverNote = serverNotes?.find((n) => n.id === local.id);
        if (!serverNote || new Date(local.updated_at).getTime() >= new Date(serverNote.updated_at).getTime()) {
          await db.notes.update(local.id, { pendingSync: false });
        }
      }
    }
  }

  if (serverFolders) {
    const localFolders = await db.folders.where('user_id').equals(userId).toArray();
    const localMap = new Map(localFolders.map((f) => [f.id, f]));

    for (const folder of serverFolders as Folder[]) {
      const local = localMap.get(folder.id);
      if (!local || !local.pendingSync) {
        await db.folders.put({ ...folder, pendingSync: false } as LocalFolder);
      }
    }
  }
}

export async function getPendingSyncCount(): Promise<number> {
  return db.syncQueue.count();
}

export async function clearSyncQueue(): Promise<void> {
  await db.syncQueue.clear();
}
