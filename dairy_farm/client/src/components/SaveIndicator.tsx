import { Check, Loader2, CloudOff, Circle } from 'lucide-react';
import type { SaveStatus } from '../useDebouncedSave';

export default function SaveIndicator({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, { icon: React.ElementType; text: string; className: string }> = {
    idle:    { icon: Circle,   text: '',              className: 'text-transparent' },
    unsaved: { icon: Circle,   text: 'Unsaved changes', className: 'text-amber-500' },
    saving:  { icon: Loader2,  text: 'Saving...',       className: 'text-slate-400' },
    saved:   { icon: Check,    text: 'Saved',           className: 'text-emerald-600' },
    error:   { icon: CloudOff, text: 'Failed to save',  className: 'text-red-500' },
  };

  const { icon: Icon, text, className } = map[status];
  if (status === 'idle') return <span className="h-4" />;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}>
      <Icon className={`w-3.5 h-3.5 ${status === 'saving' ? 'animate-spin' : ''}`} />
      {text}
    </span>
  );
}
