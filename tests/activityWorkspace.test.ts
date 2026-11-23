import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentMessage, DailyCheckin } from '../src/types/domain';
import { cancelCounselingQuestionReminders, checkinSeries, dueReminder, emptyActivity, groupConversations, LEGACY_THREAD, messageRecordId, moveToToday, summarizeTitle, trackReminder } from '../src/lib/activityWorkspace';
import { koreaDate, untilKoreaMidnight } from '../src/lib/koreaDate';

const beforeMidnight = Date.parse('2026-11-22T14:59:59.999Z');
const nextDay = beforeMidnight + 1;
const thread = 'th_00000000-0000-4000-8000-000000000001';
const secondThread = 'th_00000000-0000-4000-8000-000000000002';

function message(part: string, content: string, date: string, threadId?: string): AgentMessage {
  return { id: messageRecordId(part, threadId), ownerId: 'test', role: 'user', content,
    supportType: '', suggestedAction: '', createdAt: date };
}

test('count the day from midnight in Korea across browser timezones', () => {
  assert.equal(koreaDate(beforeMidnight), '2026-11-22');
  assert.equal(koreaDate(nextDay), '2026-11-23');
  assert.equal(untilKoreaMidnight(beforeMidnight), 1);
  assert.equal(untilKoreaMidnight(nextDay), 86_400_000);
  const previous = { ...emptyActivity(), day: '2026-11-22', activeThreadId: thread };
  assert.equal(moveToToday(previous, '2026-11-22', secondThread), previous);
  const after = moveToToday(previous, '2026-11-23', secondThread);
  assert.equal(after.activeThreadId, secondThread);
  assert.equal(after.day, '2026-11-23');
});

test('group legacy and new threads independently with first-message titles and persistent ordering flags', () => {
  const messages = [
    message('old', '이전 대화', '2026-11-20'),
    message('first', '직무가 고민이에요. 어디에서 알아보면 좋을까요?', '2026-11-21', thread),
    message('second', '새 대화 내용', '2026-11-22', secondThread),
    message('third', '두 번째 메시지', '2026-11-23', thread),
  ];
  const groups = groupConversations(messages, { [secondThread]: { title: '직접 정한 제목', pinnedAt: 20 }, [thread]: { deleted: true } });
  assert.equal(groups[0].title, '직접 정한 제목');
  assert.equal(groups[1].title, '직무가 고민이에요.');
  assert.equal(groups[1].messages.length, 2);
  assert.equal(groups[1].deleted, true);
  assert.equal(groups[2].id, LEGACY_THREAD);
  assert.match(summarizeTitle('길고 긴 제목을 입력하면 한눈에 내용을 이해할 수 있게 제목 길이가 자동으로 줄어들도록 한 문장을 입력했어요'), /…$/);
});

test('tracking and displaying due reminders both require notification permission', () => {
  const proposal = { id: 'proposal', threadId: thread, title: '공고 비교', description: '업무 한 줄을 적어요.', durationMinutes: 5 };
  const off = emptyActivity();
  assert.equal(trackReminder(off, proposal, 1000), off);
  const on = trackReminder({ ...off, notifications: true }, proposal, 1000);
  assert.equal(on.reminders.length, 1);
  assert.equal(trackReminder(on, { ...proposal, id: 'repeat' }, 2000), on);
  assert.equal(dueReminder(on, 300999), undefined);
  assert.equal(dueReminder(on, 301000)?.id, 'proposal');
  assert.equal(dueReminder({ ...on, notifications: false }, 401000), undefined);
  assert.equal(dueReminder({ ...on, threadDetails: { [thread]: { deleted: true } } }, 401000), undefined);
});

test('weekly and monthly series leave missing days blank and show the latest check-in per day', () => {
  const checkin: DailyCheckin = { id: 'previous', ownerId: 'test', checkinDate: '2026-11-22', createdAt: '2026-11-22T03:00:00Z',
    moodLabel: '차분함', moodScore: 4, energyLevel: 3, reflection: '', selfCareSuggestion: '작은 행동을 골라요.' };
  const latest = { ...checkin, id: 'latest', createdAt: '2026-11-22T06:00:00Z', energyLevel: 5 };
  const week = checkinSeries([checkin, latest], '2026-11-23', 7);
  assert.equal(week.length, 7);
  assert.equal(week.at(-2)?.checkin?.id, 'latest');
  assert.equal(week.at(-1)?.checkin, undefined);
  assert.equal(checkinSeries([latest], '2026-11-23', 30)[0].date, '2026-10-25');
});

test('the counseling question prompt is never scheduled and existing pending copies are canceled', () => {
  const activity = { ...emptyActivity(), notifications: true };
  const prompt = {
    id: 'counseling', threadId: thread, title: '상담 질문 적기', durationMinutes: 10,
    description: ' 상담 기관에 물어보고 싶은 것 하나만 적어 보세요. ',
  };
  assert.equal(trackReminder(activity, prompt, 1000), activity);
  const normal = { ...prompt, id: 'normal', title: '공고 확인', description: '관심 있는 직무 공고 한 개를 확인해 보세요.' };
  const tracked = trackReminder(activity, normal, 1000);
  const completed = { ...prompt, id: 'completed', dueAt: 500, status: 'completed' as const, resolvedAt: 600 };
  const reminders = cancelCounselingQuestionReminders([
    { ...prompt, dueAt: 500, status: 'pending' }, completed, ...tracked.reminders,
  ]);
  assert.equal(reminders[0].status, 'skipped');
  assert.equal(reminders[1], completed);
  assert.equal(dueReminder({ ...tracked, reminders }, 1000), undefined);
  assert.equal(dueReminder({ ...tracked, reminders }, 601000)?.id, 'normal');
});
