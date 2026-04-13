'use client';
import { useState, useEffect } from 'react';
import { Note } from '@/types';
import { Pin, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Props {
  note: Note;
  onPin: () => void;
  onTrash: () => void;
  onTitleChange: (title: string) => void;
  onBack?: () => void;
}

export function EditorHeader({ note, onPin, onTrash, onTitleChange, onBack }: Props) {
  const [localTitle, setLocalTitle] = useState(note.title || '');

  // Keep local state in sync when switching notes
  useEffect(() => {
    setLocalTitle(note.title || '');
  }, [note.id]);

  const handleChange = (val: string) => {
    setLocalTitle(val);
    onTitleChange(val);
  };

  return (
    <div className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-gray-100 bg-white">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors shrink-0 sm:hidden"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </button>
        )}
        <input
          type="text"
          value={localTitle}
          placeholder="Untitled"
          onChange={(e) => handleChange(e.target.value)}
          className="font-semibold text-gray-900 text-lg bg-transparent border-none focus:outline-none focus:ring-0 flex-1 min-w-0"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPin}
          className={cn(
            'h-8 px-2.5 text-xs flex items-center gap-1.5',
            note.is_pinned ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-500 hover:text-gray-900'
          )}
        >
          <Pin className={cn('w-3.5 h-3.5', note.is_pinned && 'fill-current')} />
          {note.is_pinned ? 'Pinned' : 'Pin'}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Move to trash?</AlertDialogTitle>
              <AlertDialogDescription>
                This will move the note to the trash. You can restore it later from the trash panel.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onTrash} className="bg-red-600 hover:bg-red-700">
                Move to Trash
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
