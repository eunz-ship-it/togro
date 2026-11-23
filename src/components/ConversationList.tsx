import { useState } from 'react';
import { Ellipsis, Pin, SquarePen } from 'lucide-react';
import { CHAT_TITLE_LIMIT, type ChatThread, type ThreadDetails } from '../lib/activityWorkspace';

export function ConversationList({ threads, activeId, onSelect, onNew, onUpdate }: {
  threads: ChatThread[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onUpdate: (id: string, updates: ThreadDetails) => void;
}) {
  const [menuId, setMenuId] = useState('');
  const [editing, setEditing] = useState('');
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const pinned = threads.filter((thread) => thread.pinnedAt);
  const others = threads.filter((thread) => !thread.pinnedAt);

  const renderRows = (rows: ChatThread[]) => (
    <ul className="space-y-0.5">
      {rows.map((thread) => (
        <li key={thread.id} className="group rounded-lg">
          {editing === thread.id ? (
            <form className="space-y-2 rounded-lg border border-[var(--tg-border)] p-2" onSubmit={(event) => {
              event.preventDefault();
              if (!draft.trim()) return;
              onUpdate(thread.id, { title: draft.trim() });
              setEditing('');
              setFeedback('제목을 저장했어요.');
            }}>
              <input aria-label="대화 제목" autoFocus maxLength={CHAT_TITLE_LIMIT} value={draft} onChange={(event) => setDraft(event.target.value)} className="tg-input w-full px-2 py-1.5 text-sm" />
              <div className="flex gap-2">
                <button type="submit" disabled={!draft.trim()} className="tg-btn-primary px-3 text-sm">저장</button>
                <button type="button" onClick={() => setEditing('')} className="tg-btn-secondary px-3 text-sm">취소</button>
              </div>
            </form>
          ) : (
            <>
              <div className={`flex min-h-10 items-center gap-1 rounded-lg hover:bg-[var(--tg-primary-soft)] ${activeId === thread.id ? 'bg-[var(--tg-primary-soft)]' : ''}`}>
                <button type="button" onClick={() => { setMenuId(''); onSelect(thread.id); }} aria-current={activeId === thread.id ? 'true' : undefined} title={thread.title} className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-1.5 px-2 text-left text-sm">
                  {Boolean(thread.pinnedAt) && <Pin className="size-3.5 shrink-0 text-[var(--tg-success)]" aria-label="고정됨" />}
                  <span className="truncate">{thread.title}</span>
                </button>
                <button type="button" aria-label={`${thread.title} 대화 옵션`} aria-expanded={menuId === thread.id}
                  onClick={() => setMenuId((current) => current === thread.id ? '' : thread.id)}
                  className="tg-thread-options grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg hover:bg-[var(--tg-surface)]">
                  <Ellipsis className="size-5" aria-hidden="true" />
                </button>
              </div>
              {menuId === thread.id && (
                <div className="mx-1 my-1 space-y-0.5 rounded-xl border border-[var(--tg-border)] p-1 text-sm">
                  <button type="button" className="block min-h-9 w-full cursor-pointer rounded px-3 text-left hover:bg-[var(--tg-primary-soft)]" onClick={() => {
                    onUpdate(thread.id, { pinnedAt: thread.pinnedAt ? undefined : Date.now() });
                    setMenuId('');
                  }}>{thread.pinnedAt ? '상단 고정 해제' : '상단 고정'}</button>
                  <button type="button" className="block min-h-9 w-full cursor-pointer rounded px-3 text-left hover:bg-[var(--tg-primary-soft)]" onClick={() => {
                    setDraft(thread.title); setEditing(thread.id); setMenuId('');
                  }}>제목 수정</button>
                  <button type="button" className="block min-h-9 w-full cursor-pointer rounded px-3 text-left text-[var(--tg-error)] hover:bg-[var(--tg-error-soft)]" onClick={() => {
                    onUpdate(thread.id, { deleted: true });
                    setMenuId('');
                    setFeedback('대화를 삭제했어요. 설정에서 복구할 수 있어요.');
                  }}>대화 삭제</button>
                </div>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label="최근 대화" className="flex min-h-0 flex-1 flex-col border-t border-[var(--tg-border)] px-3 pt-3">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <h3 className="px-2 text-sm font-bold text-[var(--tg-text-strong)]">최근 대화</h3>
        <button type="button" onClick={onNew} aria-label="새 고민" title="새 고민" className="grid size-9 cursor-pointer place-items-center rounded-lg hover:bg-[var(--tg-primary-soft)]"><SquarePen className="size-4" aria-hidden="true" /></button>
      </div>
      <div className="max-h-[min(53dvh,27rem)] min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-3">
        {pinned.length > 0 && <div><p className="mb-1 px-2 text-xs font-semibold text-[var(--tg-success)]">상단 고정</p>{renderRows(pinned)}</div>}
        {others.length > 0 && renderRows(others)}
        {!threads.length && <p className="px-2 text-sm text-[var(--tg-text-muted)]">아직 저장된 대화가 없어요.</p>}
        {feedback && <p role="status" className="px-2 text-xs text-[var(--tg-text-muted)]">{feedback}</p>}
      </div>
    </section>
  );
}
