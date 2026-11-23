import type { AgentMessage, DailyCheckin, MoodLabel } from '../types/domain';
import { buildCheckinSuggestion } from './checkinAdvice';
import { emptyActivity, messageRecordId, type ActivityWorkspace } from './activityWorkspace';
import { koreaDate, offsetDate } from './koreaDate';
import { EMPTY_GUEST_WORKSPACE, GUEST_UID, type GuestWorkspaceSnapshot } from './workspaceData';

const demoId = (n: number) => `th_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const samples = [
  ['공공기관으로 갈지 사기업을 준비할지 고민이에요', '관심 직무의 공고를 각각 하나 골라 업무와 전형을 비교해 보세요.'],
  ['낮과 밤이 바뀌어서 생활 리듬을 되찾고 싶어요', '내일 일어날 시간을 정한 뒤 알람을 한 개 설정해 보세요.'],
  ['기획·사무 직무를 직접 체험해 볼 수 있을까요?', '미래내일 일경험 공고에서 관심 분야와 지역을 선택해 보세요.'],
  ['다음 주 면접에서 어떤 질문부터 연습할까요?', '관심 공고에 적힌 업무 하나를 골라 비슷한 경험을 한 문장으로 정리해 보세요.'],
  ['계획은 세웠는데 매일 실천하기가 어려워요', '오늘 가장 부담이 적은 행동 하나를 5분만 시작해 보세요.'],
  ['혼자 준비하니 방향이 맞는지 모르겠어요', '지금 준비 중인 직무와 궁금한 점을 한 줄씩 적어 보세요.'],
  ['일정을 너무 많이 잡아서 계속 미루게 돼요', '가장 가까운 마감 하나를 고르고 첫 행동만 적어보세요.'],
  ['기획 직무에 필요한 기본 도구가 궁금해요', '관심 공고 한 개에서 자주 쓰는 도구 이름을 적어보세요.'],
  ['발표 초안을 어디부터 작성할까요?', '청중에게 전달할 핵심 문장 하나를 먼저 적어봐요.'],
  ['취업 준비에 쓸 수 있는 시간이 많지 않아요', '오늘 가능한 시간에 들어갈 행동 하나만 골라보세요.'],
  ['면접 연습 결과를 기록하고 싶어요', '오늘 답변 중 잘 설명한 부분과 놓친 부분을 한 줄씩 적어요.'],
  ['데이터 교육을 처음 알아보고 있어요', '기초 과정 한 개에서 수강 시간과 필수 요건을 확인해 보세요.'],
] as const;

export const DEMO_KEY = 'togro.demo.workspace.v1';

export function makeDemo(now = Date.now()): GuestWorkspaceSnapshot {
  const today = koreaDate(now);
  const moods: MoodLabel[] = ['막막함', '괜찮음', '지침', '차분함', '의욕 있음', '불안함', '괜찮음'];
  const scores = [2, 4, 2, 3, 5, 3, 4];
  const checkins: DailyCheckin[] = Array.from({ length: 30 }, (_, index) => {
    const date = offsetDate(today, -index);
    const input = {
      moodLabel: moods[(index + 1) % moods.length],
      moodScore: scores[(index + 1) % scores.length],
      energyLevel: scores[(index + 3) % scores.length],
      availableMinutes: index % 3 === 0 ? 15 : 20,
      reflection: index % 4 === 0 ? '공고 한 개를 읽고 발표 자료의 첫 장을 정리하고 싶어요.' : '',
    };
    return { ...input, id: `demo-checkin-${date}`, ownerId: GUEST_UID, checkinDate: date,
      createdAt: `${date}T08:00:00+09:00`, selfCareSuggestion: buildCheckinSuggestion(input) };
  }).filter((_, index) => index !== 10 && index !== 19);
  const messages: AgentMessage[] = samples.flatMap(([first, reply], index) => {
    const date = offsetDate(today, index - samples.length + 1);
    const id = demoId(index + 1);
    return [
      { id: messageRecordId('demo-user', id), role: 'user', ownerId: GUEST_UID, content: first, supportType: '', suggestedAction: '', createdAt: `${date}T09:00:00+09:00` },
      { id: messageRecordId('demo-assistant', id), role: 'assistant', ownerId: GUEST_UID, content: reply, supportType: '', suggestedAction: '', createdAt: `${date}T09:01:00+09:00` },
    ];
  });
  return {
    ...EMPTY_GUEST_WORKSPACE, checkins, messages,
    profile: {
      ownerId: GUEST_UID, nickname: '손은영 (시연)', age: 26, ageGroup: '25-29세', region: '대구',
      jobPrepStatus: '진로·직무 탐색 중', interests: ['기획·사무'], currentGoalFocus: '진로 방향 탐색',
      onboardingCompleted: true, onboardingSkipped: false,
    },
    roadmaps: [{
      id: 'demo-roadmap', ownerId: GUEST_UID, title: '이번 주 기획·사무 직무 탐색', goalType: '취업 준비', timeframe: '이번 주 (7일)',
      summary: '작은 행동 두 가지로 관심 직무를 비교해 봐요.', status: 'active', progressPercent: 50, adjustmentReason: '',
    }],
    tasksByRoadmap: {
      'demo-roadmap': [
        { id: 'demo-task-1', ownerId: GUEST_UID, roadmapId: 'demo-roadmap', title: '관심 공고 하나 찾기', cadence: 'daily',
          dayLabel: '어제', scheduledDate: offsetDate(today, -1), durationMinutes: 10, completed: true, status: '완료', blockerNote: '', adjustedFrom: '', sortOrder: 0 },
        { id: 'demo-task-2', ownerId: GUEST_UID, roadmapId: 'demo-roadmap', title: '기획·사무 공고 한 줄 비교하기', cadence: 'daily',
          dayLabel: '오늘', scheduledDate: today, durationMinutes: 10, completed: false, status: '진행 예정', blockerNote: '', adjustedFrom: '', sortOrder: 1 },
      ],
    },
    goalLogs: [{
      id: 'demo-log', ownerId: GUEST_UID, roadmapId: 'demo-roadmap', taskId: 'demo-task-1', actionType: '실천 상태 변경',
      changedField: '관심 공고 하나 찾기', previousValue: '진행 예정', newValue: '완료',
      actor: '사용자 수정', reason: '데모 실천 기록', createdAt: `${offsetDate(today, -1)}T09:00:00+09:00`,
    }],
  };
}

export function demoActivity(now: number): ActivityWorkspace {
  return {
    ...emptyActivity(),
    day: koreaDate(now), activeThreadId: demoId(samples.length),
    threadDetails: { [demoId(1)]: { pinnedAt: 2 }, [demoId(2)]: { pinnedAt: 1 } },
    reminders: [{
      id: 'demo-reminder', threadId: demoId(1), title: '기획·사무 공고 한 줄 비교하기',
      description: '공공기관과 사기업 공고에서 눈에 들어오는 업무를 한 줄씩 적어보세요.',
      durationMinutes: 10, dueAt: now - 60_000, status: 'pending', roadmapId: 'demo-roadmap',
    }],
  };
}
