import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function WorkspaceDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="m-auto max-h-[min(85dvh,48rem)] w-[min(calc(100%-2rem),42rem)] overflow-hidden rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-0 text-[var(--tg-text)] shadow-xl backdrop:bg-slate-950/55"
    >
      <div className="flex max-h-[min(85dvh,48rem)] min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--tg-border)] px-4 py-2.5 sm:px-6">
          <h2 id={titleId} className="text-lg font-bold text-[var(--tg-text-strong)]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl hover:bg-[var(--tg-primary-soft)]">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </dialog>
  );
}
