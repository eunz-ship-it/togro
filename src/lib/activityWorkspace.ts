import type { AgentMessage, DailyCheckin, DailyGoalsResult } from '../types/domain';
import { koreaDate, offsetDate, recordTime } from './koreaDate';

export const LEGACY_THREAD = 'legacy';
export const CHAT_TITLE_LIMIT = 60;
const THREAD_PREFIX = /^(th_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})__/i;

export const newThreadId = () => `th_${crypto.randomUUID()}`;
export const messageRecordId = (id: string, threadId?: string) =>
  threadId && threadId !== LEGACY_THREAD ? `${threadId}__${id}` : id;
export const messageThreadId = (message: AgentMessage) => message.id.match(THREAD_PREFIX)?.[1] ?? LEGACY_THREAD;

export type ThreadDetails = { title?: string; pinnedAt?: number; deleted?: boolean };
export type ActionReminder = {
  id: string;
  threadId: string;
  title: string;
  description: string;
  dueAt: number;
  durationMinutes: number;
  roadmapId?: string;
  status: 'pending' | 'completed' | 'skipped';
  resolvedAt?: number;
};

export type DailyGoalPlan = DailyGoalsResult & { date: string; savedIndexes: number[] };

export type ActivityWorkspace = {
  day?: string;
  demoDayAdvance?: number;
  activeThreadId: string;
  threadDetails: Record<string, ThreadDetails>;
  notifications: boolean;
  reminders: ActionReminder[];
  dailyGoalPlan?: DailyGoalPlan;
};

export function emptyActivity(): ActivityWorkspace {
  return { activeThreadId: '', threadDetails: {}, notifications: false, reminders: [] };
}

export function summarizeTitle(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ').replace(/^[“"']|[”"']$/g, '');
  if (!normalized) return '이전 대화';
  const first = normalized.match(/^.{1,60}?[.!?。](?:\s|$)/)?.[0].trim();
  if (first) return first;
  const characters = Array.from(normalized);
  if (characters.length <= 42) return normalized;
  const shortened = characters.slice(0, 41).join('');
  const boundary = shortened.lastIndexOf(' ');
  return `${boundary > 23 ? shortened.slice(0, boundary) : shortened}…`;
}

export function groupConversations(messages: AgentMessage[], threadDetails: ActivityWorkspace['threadDetails']) {
  const map = new Map<string, AgentMessage[]>();
  for (const message of messages) {
    const id = messageThreadId(message);
    const thread = map.get(id);
    if (thread) thread.push(message);
    else map.set(id, [message]);
  }
  return Array.from(map, ([id, items]) => {
    const detail = threadDetails[id];
    return {
      id, messages: items,
      title: detail?.title || summarizeTitle(items.find((item) => item.role === 'user')?.content ?? ''),
      pinnedAt: detail?.pinnedAt ?? 0,
      deleted: Boolean(detail?.deleted),
      updatedAt: recordTime(items.at(-1)?.createdAt),
    };
  }).sort((a, b) => b.pinnedAt - a.pinnedAt || b.updatedAt - a.updatedAt);
}

export type ChatThread = ReturnType<typeof groupConversations>[number];

export function moveToToday(activity: ActivityWorkspace, day: string, newId: string, latest?: ChatThread): ActivityWorkspace {
  if (activity.day === day && activity.activeThreadId) return activity;
  const savedDay = activity.day ?? (latest?.updatedAt ? koreaDate(latest.updatedAt) : undefined);
  const activeThreadId = savedDay === day ? activity.activeThreadId || latest?.id || newId : newId;
  return { ...activity, day, activeThreadId };
}

export function dueReminder(activity: ActivityWorkspace, now: number): ActionReminder | undefined {
  if (!activity.notifications) return;
  return activity.reminders.filter((item) =>
    item.status === 'pending' && item.dueAt <= now && !activity.threadDetails[item.threadId]?.deleted,
  ).sort((a, b) => a.dueAt - b.dueAt)[0];
}

function isCounselingQuestionPrompt(reminder: Pick<ActionReminder, 'title' | 'description'>) {
  return [reminder.title, reminder.description].some((text) =>
    text.normalize('NFC').replace(/[\s.!?。]/g, '') === '상담기관에물어보고싶은것하나만적어보세요',
  );
}

export function cancelCounselingQuestionReminders(reminders: ActionReminder[]): ActionReminder[] {
  return reminders.map((reminder) => reminder.status === 'pending' && isCounselingQuestionPrompt(reminder)
    ? { ...reminder, status: 'skipped' }
    : reminder);
}

export function trackReminder(activity: ActivityWorkspace, proposal: Omit<ActionReminder, 'status' | 'dueAt'>, now: number): ActivityWorkspace {
  if (!activity.notifications || activity.threadDetails[proposal.threadId]?.deleted || isCounselingQuestionPrompt(proposal)) return activity;
  if (activity.reminders.some((item) => item.id === proposal.id || (
    item.threadId === proposal.threadId && item.status === 'pending'
    && (item.title === proposal.title || item.description === proposal.description)
  ))) return activity;
  return {
    ...activity,
    reminders: [...activity.reminders, { ...proposal, status: 'pending', dueAt: now + proposal.durationMinutes * 60_000 }],
  };
}

export function checkinSeries(checkins: DailyCheckin[], endDate: string, numberOfDays: number) {
  const byDate = new Map<string, DailyCheckin>();
  for (const checkin of checkins) {
    const previous = byDate.get(checkin.checkinDate);
    if (!previous || recordTime(checkin.createdAt) > recordTime(previous.createdAt)) byDate.set(checkin.checkinDate, checkin);
  }
  return Array.from({ length: numberOfDays }, (_, index) => {
    const date = offsetDate(endDate, index + 1 - numberOfDays);
    return { date, checkin: byDate.get(date) };
  });
}
