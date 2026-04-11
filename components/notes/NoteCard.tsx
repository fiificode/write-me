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
