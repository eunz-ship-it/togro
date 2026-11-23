import { useState } from 'react';
import { Bell, Download, History, Moon, Sun } from 'lucide-react';
import type { ActionReminder, ChatThread } from '../lib/activityWorkspace';
import { formatKoreaTime, recordTime } from '../lib/koreaDate';
import type { ActivityLog, DailyCheckin, GoalActivityLog } from '../types/domain';
import { WorkspaceDialog } from './WorkspaceDialog';

export type Theme = 'light' | 'dark';

export function ActionReminderBanner({ reminder, busy, error, onDone, onLater }: {
  reminder: ActionReminder;
  busy: boolean;
  error: string;
  onDone: () => void;
  onLater: () => void;
}) {
  return (
    <section aria-label="실행 확인 알림" className="w-full shrink-0 border-b border-[var(--tg-mint-border)] bg-[var(--tg-secondary-soft)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Bell className="mt-0.5 size-4 shrink-0 text-[var(--tg-success)]" aria-hidden="true" />
          <div role="status">
            <p className="text-sm font-bold text-[var(--tg-text-strong)]">‘{reminder.title}’ 해보셨나요?</p>
            <p className="mt-0.5 text-sm text-[var(--tg-text-muted)]">{reminder.durationMinutes}분 제안 · {reminder.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={onLater} disabled={busy} className="tg-btn-secondary cursor-pointer px-3">10분 뒤 다시</button>
          <button type="button" onClick={onDone} disabled={busy} className="tg-btn-mint cursor-pointer px-3">{busy ? '저장 중…' : '실행 완료'}</button>
        </div>
        {error && <p role="alert" className="w-full text-sm text-[var(--tg-error)]">{error}</p>}
      </div>
    </section>
  );
}

const reminderStatus = (reminder: ActionReminder) => ({
  pending: '확인 대기', completed: '완료', skipped: '알림 취소',
})[reminder.status];

export function WorkspaceHistory({ threads, logs, reminders, onOpenThread }: {
  threads: ChatThread[];
  logs: GoalActivityLog[];
  reminders: ActionReminder[];
  onOpenThread: (id: string) => void;
}) {
  const [tab, setTab] = useState<'chat' | 'practice'>('chat');
  const [limit, setLimit] = useState(12);
  const practice = [
    ...logs.map((item) => ({
      id: item.id, title: item.changedField || item.actionType,
      summary: [item.actionType, item.newValue].filter(Boolean).join(' · '), time: item.createdAt,
    })),
    ...reminders.filter((item) => item.status === 'completed' && !item.roadmapId).map((item) => ({
      id: item.id, title: item.title, summary: '대화에서 제안한 행동 · 완료', time: item.resolvedAt,
    })),
  ].sort((a, b) => recordTime(b.time) - recordTime(a.time));
  const rows = tab === 'chat' ? threads.length : practice.length;

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2"><History aria-hidden="true" className="size-5" /><h1 className="text-2xl font-bold text-[var(--tg-text-strong)]">히스토리 내역</h1></div>
      <div role="group" aria-label="히스토리 종류" className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={tab === 'chat'} onClick={() => { setTab('chat'); setLimit(12); }} className={`${tab === 'chat' ? 'tg-btn-primary' : 'tg-btn-secondary'} cursor-pointer px-4 text-sm`}>대화 이력</button>
        <button type="button" aria-pressed={tab === 'practice'} onClick={() => { setTab('practice'); setLimit(12); }} className={`${tab === 'practice' ? 'tg-btn-primary' : 'tg-btn-secondary'} cursor-pointer px-4 text-sm`}>실천 이력</button>
      </div>
      <ul className="overflow-hidden rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)]">
        {!rows && <li className="p-5 text-sm text-[var(--tg-text-muted)]">아직 기록이 없어요.</li>}
        {tab === 'chat' ? threads.slice(0, limit).map((thread) => (
          <li key={thread.id} className="border-b border-[var(--tg-border)] last:border-0">
            <button type="button" onClick={() => onOpenThread(thread.id)} className="flex w-full cursor-pointer flex-wrap justify-between gap-1 px-4 py-3 text-left hover:bg-[var(--tg-primary-soft)]">
              <span className="font-semibold">{thread.title}</span><span className="text-sm text-[var(--tg-text-muted)]">{formatKoreaTime(thread.updatedAt)}</span>
            </button>
          </li>
        )) : practice.slice(0, limit).map((item) => (
          <li key={item.id} className="flex flex-wrap justify-between gap-2 border-b border-[var(--tg-border)] px-4 py-3 last:border-0">
            <div><p className="font-semibold">{item.title}</p><p className="text-sm text-[var(--tg-text-muted)]">{item.summary}</p></div>
            <time className="text-sm text-[var(--tg-text-muted)]">{formatKoreaTime(item.time)}</time>
          </li>
        ))}
      </ul>
      {limit < rows && <button type="button" onClick={() => setLimit((n) => n + 12)} className="tg-btn-secondary cursor-pointer px-4 text-sm">기록 더 보기</button>}
    </section>
  );
}

export function WorkspaceSettings({ theme, notifications, allThreads, checkins, logs, reminders, auditLogs, demo, onClose, onTheme, onNotifications, onRestore, onCancelReminder, onExport, onNextDay }: {
  theme: Theme;
  notifications: boolean;
  allThreads: ChatThread[];
  checkins: DailyCheckin[];
  logs: GoalActivityLog[];
  reminders: ActionReminder[];
  auditLogs: ActivityLog[];
  demo: boolean;
  onClose: () => void;
  onTheme: (theme: Theme) => void;
  onNotifications: (enabled: boolean) => void;
  onRestore: (id: string) => void;
  onCancelReminder: (id: string) => void;
  onExport: () => void;
  onNextDay: () => void;
}) {
  const [category, setCategory] = useState('checkins');
  const [limit, setLimit] = useState(15);
  const [exportError, setExportError] = useState('');
  const trash = allThreads.filter((thread) => thread.deleted);
  const live = allThreads.filter((thread) => !thread.deleted);
  const total = { checkins: checkins.length, chat: live.length, practice: logs.length, reminders: reminders.length, audit: auditLogs.length }[category] ?? 0;
  const card = 'space-y-3 rounded-2xl border border-[var(--tg-border)] p-4';
  const labelClass = 'text-sm font-semibold text-[var(--tg-text-strong)]';
  const rows = 'space-y-2 text-sm';

  return (
    <WorkspaceDialog title="설정 및 데이터 관리" onClose={onClose}>
      <div className="space-y-4">
        <div className={card}>
          <h3 className={labelClass}>화면 모드</h3>
          <div role="group" aria-label="화면 모드" className="flex flex-wrap gap-2">
            {(['light', 'dark'] as const).map((mode) => {
              const Icon = mode === 'light' ? Sun : Moon;
              return <button key={mode} type="button" aria-pressed={theme === mode} onClick={() => onTheme(mode)}
                className={`${theme === mode ? 'tg-btn-primary' : 'tg-btn-secondary'} inline-flex cursor-pointer items-center gap-2 px-3 text-sm`}>
                <Icon className="size-4" aria-hidden="true" />{mode === 'light' ? '라이트 모드' : '다크 모드'}
              </button>;
            })}
          </div>
        </div>
        <div className={card}>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span><span className={labelClass}>실행 확인 알림 허용</span><span className="mt-0.5 block text-sm text-[var(--tg-text-muted)]">제안 시간이 지나면 앱 안에서 실행 여부를 물어요.</span></span>
            <input type="checkbox" checked={notifications} onChange={(event) => onNotifications(event.target.checked)} className="size-5 shrink-0 accent-[var(--tg-chart-mood)]" />
          </label>
        </div>
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className={labelClass}>전체 로그 및 데이터</h3>
            <button type="button" onClick={() => { try { onExport(); setExportError(''); } catch { setExportError('내보내지 못했어요. 다시 시도해 주세요.'); } }} className="tg-btn-secondary inline-flex cursor-pointer items-center gap-2 px-3 text-sm"><Download className="size-4" aria-hidden="true" />JSON 내보내기</button>
          </div>
          {exportError && <p role="alert" className="text-sm text-[var(--tg-error)]">{exportError}</p>}
          <label className="block space-y-1 text-sm font-semibold">
            볼 기록
            <select className="tg-input mt-1 block w-full px-3 py-2" value={category} onChange={(event) => { setCategory(event.target.value); setLimit(15); }}>
              <option value="checkins">체크인 ({checkins.length})</option>
              <option value="chat">대화 ({live.length})</option>
              <option value="practice">실천 변경 로그 ({logs.length})</option>
              <option value="reminders">실행 확인 ({reminders.length})</option>
              {auditLogs.length > 0 && <option value="audit">활동 로그 ({auditLogs.length})</option>}
            </select>
          </label>
          <div className="rounded-xl bg-[var(--tg-bg)] p-3">
            {!total && <p className="text-sm text-[var(--tg-text-muted)]">아직 기록이 없어요.</p>}
            {category === 'checkins' && <ul className={rows}>{checkins.slice(0, limit).map((item) => <li key={item.id}><details><summary className="cursor-pointer font-semibold">{item.checkinDate} · {item.moodLabel} · 기분 {item.moodScore}/5 · 에너지 {item.energyLevel}/5</summary>{item.reflection && <p className="my-1 whitespace-pre-wrap">{item.reflection}</p>}<p className="my-1">{item.selfCareSuggestion}</p></details></li>)}</ul>}
            {category === 'chat' && <ul className={rows}>{live.slice(0, limit).map((thread) => <li key={thread.id}><details><summary className="cursor-pointer font-semibold">{thread.title}</summary><ol className="my-2 space-y-2">{thread.messages.map((message) => <li key={message.id} className="whitespace-pre-wrap">{message.role === 'assistant' ? 'TOGRO' : '나'} · {message.content}</li>)}</ol></details></li>)}</ul>}
            {category === 'practice' && <ul className={rows}>{logs.slice(0, limit).map((item) => <li key={item.id}><details><summary className="cursor-pointer font-semibold">{item.changedField} · {item.newValue}</summary><p>{formatKoreaTime(item.createdAt)} · {item.actionType} · {item.previousValue} → {item.newValue}</p>{item.reason && <p>{item.reason}</p>}</details></li>)}</ul>}
            {category === 'audit' && <ul className={rows}>{auditLogs.slice(0, limit).map((item) => <li key={item.id}><details><summary className="cursor-pointer font-semibold">{item.actionType} · {item.targetSection}</summary><p>{formatKoreaTime(item.createdAt)} · {item.summary}</p></details></li>)}</ul>}
            {category === 'reminders' && <ul className={rows}>{reminders.slice(0, limit).map((item) => <li key={item.id} className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{item.title} · {reminderStatus(item)}</p><p>{formatKoreaTime(item.resolvedAt ?? item.dueAt)}</p></div>{item.status === 'pending' && <button type="button" onClick={() => onCancelReminder(item.id)} className="cursor-pointer underline">알림 취소</button>}</li>)}</ul>}
            {limit < total && <button type="button" onClick={() => setLimit((n) => n + 15)} className="mt-3 cursor-pointer text-sm font-semibold underline">기록 더 보기</button>}
          </div>
        </div>
        <div className={card}>
          <h3 className={labelClass}>삭제된 대화</h3>
          {trash.length ? <ul className={rows}>{trash.map((thread) => (
            <li key={thread.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{thread.title}</span><button type="button" onClick={() => onRestore(thread.id)} className="tg-btn-secondary shrink-0 cursor-pointer px-3 text-sm">복구</button></li>
          ))}</ul> : <p className="text-sm text-[var(--tg-text-muted)]">삭제된 대화가 없어요.</p>}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {demo ? <button type="button" onClick={onNextDay} className="tg-btn-secondary cursor-pointer px-3">KST 다음 날 전환 시연</button>
            : <a href="?demo=1" target="_blank" rel="noopener" className="tg-btn-secondary inline-flex items-center px-3">샘플 데이터로 시연하기</a>}
        </div>
      </div>
    </WorkspaceDialog>
  );
}
