import type { DailyCheckin, MoodLabel } from '../types/domain';

export type CheckinAdviceInput = Pick<
  DailyCheckin, 'moodLabel' | 'moodScore' | 'energyLevel' | 'availableMinutes' | 'reflection'
>;

export type CheckinAdviceResult = {
  selfCareSuggestion: string;
  source: 'checkin' | 'gemini';
};

const memoActions = [
  {
    pattern: /발표|피피티|ppt|슬라이드/i,
    firstStep: '발표에서 꼭 전달할 메시지 한 문장과 첫 슬라이드 제목을 적어보세요.',
    plan: '발표에서 꼭 전달할 메시지 한 문장을 쓴 다음, 슬라이드 제목을 세 개만 잡아보세요.',
  },
  {
    pattern: /해커톤|팀\s*프로젝트|팀\s*과제/,
    firstStep: '프로젝트에서 본인이 맡은 일 중 바로 시작할 수 있는 한 가지를 적어보세요.',
    plan: '팀 프로젝트에서 본인이 맡은 일 하나를 골라 초안을 만들고, 팀과 확인할 점 한 가지를 적어보세요.',
  },
  {
    pattern: /면접(?!\s*(?:발표|피피티|ppt|슬라이드))/i,
    firstStep: '예상 면접 질문 하나를 골라 답변에 넣을 키워드 두 개만 적어보세요.',
    plan: '예상 면접 질문 하나를 골라 1분 동안 소리 내어 답해 보고, 막힌 부분 한 군데를 적어보세요.',
  },
  {
    pattern: /채용\s*공고|공고\s*찾|구직|지원\s*기업/,
    firstStep: '관심 공고 한 개를 열어 마감일만 확인해 보세요.',
    plan: '관심 공고 한 개에서 마감일과 필수 조건을 확인하고, 지원 여부를 판단할 기준 하나를 적어보세요.',
  },
  {
    pattern: /교육|훈련|강의|수강|자격증|공부|학습/,
    firstStep: '오늘 볼 강의나 학습 자료 한 개를 열고, 확인할 항목 하나에 표시해 보세요.',
    plan: '공부할 주제 하나를 골라 자료의 첫 부분을 살펴보고, 기억할 내용을 한 줄로 적어보세요.',
  },
];

const moodActions: Record<MoodLabel, string> = {
  차분함: '이번 주에 하려던 일 하나를 골라 첫 단계를 시작하고, 다음에 할 행동을 한 줄로 남겨보세요.',
  괜찮음: '오늘 할 일 하나를 골라 어디까지 하면 끝인지 정한 뒤, 그 첫 단계에 집중해 보세요.',
  '의욕 있음': '오늘 가장 진행하고 싶은 일 하나를 골라 초안을 만들어 보세요. 끝날 때 다음 단계도 한 줄 적어두면 좋아요.',
  막막함: '지금 멈춰 있는 일 하나를 적고, 그 일을 시작하려면 준비물이나 정보 중 무엇이 필요한지 한 줄로 정리해 보세요.',
  지침: '잠깐 화면에서 눈을 떼고 물을 마시거나 몸을 가볍게 움직여 보세요. 이어서 할 일은 한 가지만 적어두세요.',
  불안함: '마음에 걸리는 일 하나를 적고, 그중 지금 확인할 수 있는 사실이나 일정 하나를 찾아보세요.',
};

export function buildCheckinSuggestion(input: CheckinAdviceInput): string {
  const availableMinutes = Number.isFinite(input.availableMinutes) ? Math.max(5, input.availableMinutes!) : 20;
  const lowEnergy = input.energyLevel <= 2 || input.moodScore <= 2 || input.moodLabel === '지침';
  const targetMinutes = lowEnergy ? 5
    : input.moodLabel === '막막함' || input.moodLabel === '불안함' || input.energyLevel <= 3 ? 10
    : input.moodLabel === '의욕 있음' ? 25
    : 15;
  const minutes = Math.min(availableMinutes, targetMinutes);

  const memo = input.reflection || '';
  const firstTopic = memoActions
    .map((entry) => ({ entry, index: memo.search(entry.pattern) }))
    .filter(({ index }) => index >= 0)
    .sort((a, b) => a.index - b.index)[0]?.entry;
  const action = firstTopic
    ? (minutes <= 5 ? firstTopic.firstStep : firstTopic.plan)
    : moodActions[input.moodLabel] ?? moodActions.괜찮음;
  return `지금은 ${minutes}분만 써보세요. ${action}`;
}
