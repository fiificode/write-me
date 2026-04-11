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
