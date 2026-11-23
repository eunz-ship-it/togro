import { offsetDate } from '../src/lib/koreaDate';
import { FIELD_LIMITS, type GeneratedRoadmapPreview, type GeneratedRoadmapTask, type GoalType } from '../src/types/domain';
import { suggestedMinutes } from './guidance';

type Step = Pick<GeneratedRoadmapTask, 'title' | 'description'>;
type RoadmapPlan = {
  summary: string;
  steps: (goal: string) => Step[];
};

export const roadmapPeriods = {
  '오늘 하루': 1,
  '이번 주 (7일)': 7,
  '2주 계획': 14,
  '한 달 호흡': 30,
};

const plans: Record<GoalType, RoadmapPlan> = {
  '생활 습관': {
    summary: '지금의 생활 패턴을 살피고, 이미 하는 행동에 새 습관을 붙여 시도해요.',
    steps: (goal) => [
      { title: '습관을 시작할 시간과 장소 정하기', description: `‘${goal}’ 목표를 실천할 시간과 장소를 하나 정해 보세요. 양치 후처럼 이미 매일 하는 행동에 연결해 두세요.` },
      { title: '정해 둔 신호에 습관 실천하기', description: '정해 둔 시간이나 신호가 오면 준비해 둔 행동을 한 번 해보세요. 끝나면 실천 여부와 방해 요인을 한 줄로 남겨 보세요.' },
      { title: '내 생활에 맞게 습관 조정하기', description: '실천하기 어려웠던 날을 돌아보고 시작 시간, 장소, 행동의 크기 중 한 가지만 바꿔 보세요.' },
    ],
  },
  '학업·학습': {
    summary: '공부할 범위를 정하고, 직접 풀어 본 뒤 헷갈린 내용을 복습해요.',
    steps: (goal) => [
      { title: '첫 학습 범위 한 단원 고르기', description: `‘${goal}’ 목표에 맞는 교재나 강의를 열고 오늘 볼 소단원 하나를 고르세요. 핵심 개념을 자기 말로 한 문장으로 적어 보세요.` },
      { title: '책을 덮고 예제 풀기', description: '공부한 개념이 나오는 예제 한 문제를 풀이 없이 풀어 보세요. 막힌 부분에 표시한 뒤 교재에서 근거를 찾아 보세요.' },
      { title: '헷갈린 개념 다시 설명하기', description: '표시한 개념을 자료를 보지 않고 한 줄로 설명해 보세요. 설명이 막힌 부분은 다음에 복습할 항목으로 남겨 보세요.' },
    ],
  },
  '자기계발': {
    summary: '지금 할 수 있는 수준을 확인하고, 작은 결과물을 만든 뒤 한 가지를 개선해요.',
    steps: (goal) => [
      { title: '현재 수준을 보여줄 샘플 만들기', description: `‘${goal}’ 목표에 맞춰 지금 혼자 해볼 수 있는 부분 하나를 골라 짧게 만들어 보세요. 결과를 저장해 출발점으로 삼으세요.` },
      { title: '개선할 기술 하나 집중 연습하기', description: '첫 결과에서 가장 아쉬운 부분 하나를 골라 예시를 살펴보고, 같은 부분을 다시 만들어 보세요.' },
      { title: '두 결과를 비교해 다음 연습 정하기', description: '처음 만든 것과 다시 만든 것을 나란히 비교해 보세요. 달라진 점 하나와 다음에 연습할 기술 하나를 적어 보세요.' },
    ],
  },
  '진로 탐색': {
    summary: '관심 직무에서 실제로 하는 일을 살피고, 비교와 작은 체험으로 판단 근거를 쌓아요.',
    steps: (goal) => [
      { title: '관심 직무의 실제 업무 찾아보기', description: `‘${goal}’ 목표에 맞는 직무 소개나 채용공고를 열어 평소 하는 업무 세 가지를 적어 보세요. 끌리는 업무에는 표시하세요.` },
      { title: '관심 직무와 비슷한 직무 비교하기', description: '관심 직무와 비슷한 직무 하나를 골라 업무, 일하는 환경, 필요한 역량을 비교해 보세요. 더 끌리는 쪽의 이유를 한 줄로 적으세요.' },
      { title: '관심 업무를 작게 체험해 보기', description: '가장 끌린 업무 하나를 간단한 예시로 직접 해보거나 현직자 인터뷰에서 그 업무의 실제 사례를 확인해 보세요. 새로 알게 된 점을 적으세요.' },
    ],
  },
  '취업 준비': {
    summary: '목표 직무 공고를 기준으로 준비할 역량을 고르고, 지원 전 점검할 항목을 정리해요.',
    steps: (goal) => [
      { title: '지원할 공고의 필수 조건 확인하기', description: `‘${goal}’ 목표에 맞는 공고 하나를 열고 필수 자격, 주요 업무, 접수 마감일을 적어 보세요.` },
      { title: '필수 역량 하나를 실전처럼 연습하기', description: '공고에 나온 업무 중 연습할 수 있는 것 하나를 골라 예제나 모의 질문으로 연습해 보세요. 막힌 부분을 한 줄로 남기세요.' },
      { title: '공고 마감일과 제출 조건 최종 점검하기', description: '공식 공고에서 접수 방법과 제출 조건을 다시 확인해 보세요. 빠진 준비가 하나라도 있다면 다음 행동과 날짜를 정해 두세요.' },
    ],
  },
  '사용자 직접 설정': {
    summary: '입력한 목표를 기준으로 완료 조건을 정하고, 작게 실행한 뒤 다음 단계를 결정해요.',
    steps: (goal) => [
      { title: '내 목표의 완료 조건 정하기', description: `‘${goal}’ 목표를 해냈다고 판단할 수 있는 결과를 한 문장으로 적어 보세요. 바로 할 수 있는 행동 하나와 필요한 도구를 정하세요.` },
      { title: '내가 정한 첫 행동 실행하기', description: `‘${goal}’ 목표를 위해 첫 번째로 정한 행동을 실제로 해보세요. 끝낸 분량이나 남긴 결과가 무엇인지 한 줄로 기록하세요.` },
      { title: '결과를 확인하고 다음 단계 정하기', description: '처음 정한 완료 조건과 실제 결과를 비교해 보세요. 더 필요한 행동이 있다면 한 가지를 골라 실행할 날짜를 잡으세요.' },
    ],
  },
};

export function getRoadmapPlan(goalType: unknown): RoadmapPlan | undefined {
  return typeof goalType === 'string' && Object.hasOwn(plans, goalType) ? plans[goalType as GoalType] : undefined;
}

function getRoadmapSteps(goalType: GoalType, focus: string, plan: RoadmapPlan): Step[] {
  if (goalType === '생활 습관' && /기상|일어나|일찍 자|일찍 잠|취침|수면/.test(focus)) {
    return [
      { title: '현재 수면 시간과 원하는 시간 적기', description: `‘${focus}’ 목표를 위해 최근 자거나 일어난 시간과 원하는 시간을 한 줄씩 적어 보세요. 오늘 바꿀 시간은 15분 단위로 정해 보세요.` },
      { title: '정한 시간에 맞춰 수면 환경 준비하기', description: '정한 시간에 맞춰 알람을 설정해 보세요. 알람 소리를 듣고 할 행동 하나를 정하고, 실행 후 실제 시각을 적으세요.' },
      { title: '실제로 지킨 시간 확인하기', description: '기록한 시각과 목표 시각을 비교해 보세요. 지키기 어려웠다면 준비 동작이나 알람 시간 중 하나를 바꿔 보세요.' },
    ];
  }
  if (goalType === '학업·학습' && /자격증|자격시험|기사 필기|기출/.test(focus)) {
    return [
      { title: '시험 범위와 준비할 과목 고르기', description: `‘${focus}’ 목표와 관련된 주관 기관의 시험 안내를 확인하고, 가장 먼저 공부할 과목 하나를 골라 보세요.` },
      { title: '첫 과목 기출문제 풀기', description: '고른 과목의 기출문제를 찾아 한 문제를 풀어 보세요. 틀린 부분은 어떤 개념을 놓쳤는지 한 줄로 기록하세요.' },
      { title: '오답 다시 풀고 다음 범위 정하기', description: '기록한 오답을 풀이 없이 다시 풀어 보세요. 다시 막힌 개념 하나를 다음 복습 범위로 잡으세요.' },
    ];
  }
  if (goalType === '자기계발' && /엑셀|스프레드시트|구글 시트/.test(focus)) {
    return [
      { title: '엑셀에서 표의 열 만들기', description: `‘${focus}’ 목표에 필요한 열 세 개에 이름을 붙이고 예시 데이터를 세 줄 입력해 보세요.` },
      { title: '함수 하나로 표의 숫자 계산하기', description: '입력한 표에서 합계나 개수를 계산하는 함수 하나를 써 보세요. 샘플 숫자를 바꿨을 때 계산 결과가 달라지는지 확인하세요.' },
      { title: '새 데이터를 넣어 표 다시 써보기', description: '예시 대신 실제로 쓰고 싶은 데이터 한 줄을 추가하세요. 불편했던 점을 고쳐서 다시 사용할 수 있는 파일로 저장해 보세요.' },
    ];
  }
  if (goalType === '취업 준비' && /면접/.test(focus)) {
    return [
      { title: '지원 직무 기준으로 면접 질문 뽑기', description: `‘${focus}’에 맞춰 지원 공고의 주요 업무를 읽고, 해당 업무를 수행한 경험을 묻는 질문 하나를 적어 보세요.` },
      { title: '면접 답변을 1분 동안 말해 보기', description: '고른 질문에 대해 상황, 내가 한 일, 결과를 순서대로 말하고 녹음하세요. 답변은 1분 정도로 맞춰 보세요.' },
      { title: '녹음에서 빠진 근거 보완하기', description: '녹음을 들어보고 행동이나 결과가 모호한 문장을 하나 고르세요. 구체적인 근거를 보태 다시 말해 보세요.' },
    ];
  }
  return plan.steps(focus);
}

export function scheduleRoadmapSteps(steps: Step[], date: string, days: number, energyLevel: number, availableMinutes: number) {
  const count = days === 1 ? Math.min(steps.length, Math.floor(availableMinutes / 5)) : steps.length;
  const minutes = suggestedMinutes({ energyLevel });
  return steps.slice(0, count).map<GeneratedRoadmapTask>((step, index) => {
    const dayOffset = Math.round(index * (days - 1) / Math.max(1, count - 1));
    const durationMinutes = dayOffset === 0
      ? Math.min(minutes, Math.floor(availableMinutes / (days === 1 ? count : 1)))
      : minutes;
    return {
      ...step,
      durationMinutes,
      dayOffset,
      scheduledDate: offsetDate(date, dayOffset),
      dayLabel: dayOffset === 0 ? '오늘' : dayOffset === 1 ? '내일' : `${dayOffset + 1}일차`,
      cadence: days >= 7 && index === count - 1 ? 'weekly' : 'daily',
    };
  });
}

export function roadmapPreview(
  category: GoalType, timeframe: keyof typeof roadmapPeriods, focus: string, date: string, energyLevel: number,
  availableMinutes: number, plan: RoadmapPlan,
): GeneratedRoadmapPreview {
  const days = roadmapPeriods[timeframe];
  const tasks = scheduleRoadmapSteps(getRoadmapSteps(category, focus, plan), date, days, energyLevel, availableMinutes);
  const first = tasks[0].durationMinutes;
  const later = tasks.at(-1)?.durationMinutes;
  return {
    title: focus.slice(0, FIELD_LIMITS.roadmapTitleMax),
    category,
    duration: timeframe,
    summary: plan.summary,
    recommendationReason: category === '사용자 직접 설정'
      ? '직접 입력한 목표를 기준으로 첫 행동과 완료 기준을 정할 수 있게 구성했어요.'
      : `입력한 목표를 ‘${category}’에 맞는 실천 순서로 나눴어요.`,
    energyFitExplanation: first === later
      ? `한 항목에 ${first}분씩 쓸 수 있게 나눴어요.`
      : `오늘 실천은 ${first}분, 이후 실천은 한 항목에 ${later}분으로 잡았어요.`,
    tasks,
  };
}
