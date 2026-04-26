import { useEffect } from 'react';
import { cn } from '@/lib/utils';

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-background border border-border shadow-lg p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-base font-semibold">{title}</div>
          <div className="mt-1.5 text-sm text-muted-foreground">{body}</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 h-10 rounded-md border border-border text-sm hover:bg-secondary disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'flex-1 h-10 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed',
              destructive
                ? 'bg-overdue-text text-white hover:opacity-90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
