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
