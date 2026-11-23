import { buildCheckinSuggestion } from '../src/lib/checkinAdvice';
import type { AgentChatResponse, WorryCategory } from '../src/types/domain';

type RoutineGuidance = {
  title: string;
  category: WorryCategory;
  reply: string;
  action: string;
  taskTitle: string;
  minutes: number;
};

type RoutineContext = {
  history?: unknown;
  energyLevel?: number;
  availableMinutes?: number;
  careerTopic?: boolean;
};

const sleepTopic = /수면|취침|잠들|잠을\s*(?:자|못\s*자)|잠이\s*(?:안|오)|일찍\s*(?:자|잠|눕)|늦게\s*(?:자|잠)|자기\s*전|잠자리|잠자는|자는\s*(?:시각|시간|습관|루틴)|눕는\s*(?:시각|시간|습관|루틴)/;
const phoneProblem = /핸드폰|휴대폰|스마트폰|폰을|폰만|폰\s*보|유튜브|쇼츠|릴스|넷플릭스|스크롤/;
const workloadProblem = /야근|퇴근|숙제|일이\s*늦|밤에\s*일/;
const thoughtsProblem = /생각이\s*많|생각이\s*안\s*멈|걱정이|내일\s*생각|머릿속|머리가\s*복잡/;
const setback = /못\s*(?:지켰|했|잤|해|자)|실패|어제도|다시\s*늦/;
const routineIntent = /루틴|습관|꾸준히|시작하|만들|하고\s*싶|하려고|계획|실천|준비|하고\s*싶은/;

function userTurns(history: unknown): string[] {
  if (!Array.isArray(history)) return [];
  return history.slice(-12)
    .filter(turn => turn?.role === 'user' && typeof turn.content === 'string')
    .map(turn => String(turn.content).slice(0, 600));
}

function sleepTimes(message: string): { current?: number; target?: number; wake?: number } {
  const text = message.replace(/자정/g, '밤 12시');
  const matches = [...text.matchAll(
    /\b([01]?\d|2[0-3]):([0-5]\d)\b|(?:(오전|오후|밤|저녁|새벽|아침)\s*)?(2[0-3]|[01]?\d)\s*시(?:\s*([0-5]?\d)\s*분)?/g,
  )];
  const times: ReturnType<typeof sleepTimes> = {};
  for (const [index, part] of matches.entries()) {
    const before = text.slice(index === 0 ? 0 : matches[index - 1].index! + matches[index - 1][0].length, part.index);
    const after = text.slice(part.index! + part[0].length, matches[index + 1]?.index);
    if (/^(?:에|쯤|쯤에)?\s*(?:퇴근|일이\s*끝|집에\s*도착)/.test(after)) continue;
    const waking = /(?:에|쯤)?\s*(?:일어나|깨야|깨고|기상)/.test(after.slice(0, 12))
      || /(?:기상|일어나는 시간)(?:은|이|을)?\s*$/.test(before);
    const wanted = /(?:자고|눕고|잠들고)\s*싶|목표|맞추고\s*싶|정하고\s*싶/.test(after.slice(0, 16))
      || /목표(?:는|로)?\s*$/.test(before);
    const usual = /(?:보통|평소|요즘|지금|최근|현재)(?:에는|은)?[^,.;]{0,6}$/.test(before)
      || /^(?:에|쯤|쯤에)?\s*(?:자요|자는데|자고\s*있|자는\s*편|자곤|잤|잠들어요|잠드는데)/.test(after);
    const [clockHour, clockMinute, period, koreanHour, koreanMinute] = part.slice(1);
    let hour = Number(clockHour ?? koreanHour);
    if (period === '밤' && hour === 12) hour = 0;
    else if (['오후', '밤', '저녁'].includes(period) && hour < 12) hour += 12;
    else if (['오전', '새벽', '아침'].includes(period) && hour === 12) hour = 0;
    else if (!waking && clockHour === undefined && !period && hour >= 7 && hour <= 11) hour += 12;
    const time = hour * 60 + Number(clockMinute ?? koreanMinute ?? 0);
    if (waking) times.wake = time;
    else if (wanted || !usual) times.target = time;
    else times.current = time;
  }
  return times;
}

function hasSleepGoal(message: string): boolean {
  return sleepTopic.test(message)
    || (/(?:자고|눕고)\s*싶|자는데|잠들려/.test(message) && Object.keys(sleepTimes(message)).length > 0);
}

function clock(minutes: number): string {
  const time = (minutes + 1440) % 1440;
  return [Math.floor(time / 60), time % 60].map(value => String(value).padStart(2, '0')).join(':');
}

function sleepGuidance(message: string, relatedTurns: string[]): RoutineGuidance {
  const times = [...relatedTurns, message].reduce(
    (merged, turn) => ({ ...merged, ...sleepTimes(turn) }), {} as ReturnType<typeof sleepTimes>,
  );
  const difference = times.current !== undefined && times.target !== undefined
    ? (times.current - times.target + 1440) % 1440 : 0;
  const gradual = difference > 30 && difference < 720;
  const tonight = gradual ? times.current! - 15 : times.target ?? (times.current === undefined ? undefined : times.current - 15);
  const startingPoint = tonight === undefined
    ? '오늘은 평소보다 15분 일찍 잠잘 준비를 시작해요.'
    : gradual
      ? `목표는 ${clock(times.target!)}로 두고, 오늘은 평소보다 15분 빠른 ${clock(tonight)}에 눕는 것부터 해요.`
      : `오늘은 ${clock(tonight)}에 눕는 걸 목표로, ${clock(tonight - 20)}부터 잠잘 준비를 해요.`;

  const barriers = [workloadProblem, phoneProblem, thoughtsProblem];
  const changingTime = Object.keys(sleepTimes(message)).length > 0;
  const barrier = barriers.find(pattern => pattern.test(message))
    ?? (changingTime ? [...relatedTurns].reverse().flatMap(turn => barriers.filter(pattern => pattern.test(turn)))[0] : undefined);
  const phone = barrier === phoneProblem;
  const work = barrier === workloadProblem;
  const thoughts = barrier === thoughtsProblem;
  const recovering = setback.test(message);
  const action = phone
    ? '알람을 먼저 맞추고, 잠들기 전에 휴대폰을 침대에서 손이 닿지 않는 곳에 충전해 보세요.'
    : work
      ? '일을 끝내고 나면 세수하고 조명을 낮추는 5분짜리 준비만 먼저 해보세요.'
      : thoughts
        ? '내일 해도 되는 일과 내일 첫 번째로 할 일을 한 줄씩 적고 메모를 덮어두세요.'
        : recovering
          ? '오늘은 준비 알람이 울리면 조명을 한 단계 낮추는 것까지만 해보세요.'
          : tonight === undefined
            ? '평소보다 15분 이른 시각에 알람을 맞추고, 알람이 울리면 휴대폰을 침대 밖에 두고 조명을 낮춰보세요.'
            : `${clock(tonight - 20)}에 준비 알람을 맞추고, 울리면 휴대폰을 충전기에 두고 조명을 낮춰보세요.`;
  const why = phone ? '휴대폰을 내려놓는 시점을 정해두면, 침대에서 계속 볼지 다시 결정할 일이 줄어요.'
    : work ? '늦게 끝난 날에도 할 수 있는 짧은 순서를 정해두면 다시 이어가기 쉬워요.'
    : thoughts ? '내일 할 일을 적어두면 누운 뒤에 처리할 일을 계속 떠올릴 필요가 줄어요.'
    : recovering ? '어제 놓쳤다면 오늘은 제일 쉬운 한 단계부터 다시 해도 괜찮아요.'
    : '오늘은 정한 시각에 잠잘 준비를 시작하는 것만으로 충분해요.';
  const invitation = tonight === undefined && !phone && !work && !thoughts && !recovering
    ? '평소 자는 시간과 원하는 시간을 알려주면 오늘 시작할 시각까지 정해볼 수 있어요.'
    : '';
  const opening = work
    ? (times.target === undefined
      ? '늦게 일이 끝나는 날에는 준비 단계를 한두 가지로 줄여봐요.'
      : `목표는 ${clock(times.target)}로 두고, 일이 늦게 끝나는 날에는 집에 도착한 직후부터 5분짜리 준비만 해봐요.`)
    : startingPoint;
  const wake = times.wake === undefined || work ? '' : `내일 기상 알람은 ${clock(times.wake)}로 먼저 맞춰두세요.`;
  return {
    title: '일찍 자는 루틴 만들기',
    category: '생활 리듬',
    reply: [opening, why, wake, invitation].filter(Boolean).join(' '),
    action,
    taskTitle: thoughts ? '잠들기 전 내일 할 일 두 줄 적기'
      : work ? '일을 마치고 5분 취침 준비하기'
      : phone ? '휴대폰을 침대에서 떨어진 곳에 두기'
      : tonight === undefined ? '취침 준비 알람 맞추고 조명 낮추기'
        : `${clock(tonight - 20)}에 취침 준비 시작하기`,
    minutes: 5,
  };
}

const everydayRoutines = [
  {
    pattern: /일찍\s*일어나|아침\s*루틴|기상\s*(?:시간|습관)/,
    title: '아침 루틴 만들기',
    reply: '일어나자마자 할 행동 하나를 정해두면 아침에 뭘 할지 고민하는 시간이 줄어요. 전날 밤 물컵이나 내일 입을 옷을 미리 꺼내두세요.',
    action: '알람을 끈 뒤 커튼을 열고 준비해 둔 물 한 잔을 마셔보세요.',
  },
  {
    pattern: /운동|산책|헬스|걷기|달리기/,
    title: '운동 루틴 만들기',
    reply: '운동할 요일을 한꺼번에 늘리기보다, 이미 매일 하는 일 바로 뒤에 짧게 붙여보세요. 저녁 식사나 퇴근 직후처럼 시점을 정하면 시작하기 쉬워요.',
    action: '오늘 움직이기 편한 시간 하나를 정하고 신발을 꺼내 두세요. 그 시간이 되면 집 근처를 짧게 걸어보세요.',
  },
  {
    pattern: /독서|책\s*읽/,
    title: '독서 루틴 만들기',
    reply: '읽을 분량을 크게 정하기보다, 책을 펼칠 장소와 시점을 먼저 정해보세요. 책을 자주 앉는 자리에 펴 두면 시작하는 일이 줄어들어요.',
    action: '저녁에 자주 앉는 자리에 책을 두고, 앉으면 두 페이지만 읽어보세요.',
  },
  {
    pattern: /집중.{0,8}(?:안|어렵|못)|공부\s*(?:루틴|습관)|시간\s*관리|공부\s*시작/,
    title: '집중하는 시간 만들기',
    reply: '집중할 때는 시간이 끝났을 때 무엇이 남아 있으면 되는지 먼저 정해보세요. 예를 들어 문제 한 개나 핵심 문장 한 줄처럼 눈에 보이는 결과가 좋아요.',
    action: '한 과제만 화면에 열고 가장 작은 분량을 끝낼 때까지 다른 탭이나 알림은 닫아보세요.',
  },
];

function sleepFollowUp(message: string): boolean {
  if (/상담|예약|채용|지원금|자격증|발표|PPT|면접|운동|독서/i.test(message)) return false;
  return Object.keys(sleepTimes(message)).length > 0 || phoneProblem.test(message) || workloadProblem.test(message)
    || thoughtsProblem.test(message) || setback.test(message);
}

export function planRoutine(message: string, context: RoutineContext): RoutineGuidance | undefined {
  const previous = userTurns(context.history);
  const sleepIndex = previous.map(hasSleepGoal).lastIndexOf(true);
  const recentSleepTurns = sleepIndex >= 0 && previous.slice(sleepIndex + 1).every(sleepFollowUp)
    ? previous.slice(sleepIndex) : [];
  if (hasSleepGoal(message) || (recentSleepTurns.length > 0 && sleepFollowUp(message))) {
    return sleepGuidance(message, recentSleepTurns);
  }

  if (context.careerTopic) return undefined;
  const other = everydayRoutines.find(entry => entry.pattern.test(message));
  const plannedMinutes = context.energyLevel !== undefined && context.energyLevel <= 2 ? 5 : 10;
  const minutes = Math.max(5, Math.min(context.availableMinutes || plannedMinutes, plannedMinutes));
  if (other) return { ...other, category: '생활 리듬', taskTitle: other.title + ' 첫 단계 시도하기', minutes };
  if (/발표|피피티|ppt|슬라이드|해커톤|팀\s*프로젝트/i.test(message)) {
    const presentation = /발표|피피티|ppt|슬라이드/i.test(message);
    const title = presentation ? '발표 준비' : '팀 프로젝트 준비';
    const action = buildCheckinSuggestion({
      moodLabel: '괜찮음', moodScore: 3, energyLevel: context.energyLevel ?? 3,
      availableMinutes: minutes, reflection: message,
    });
    return {
      title,
      category: '정보 탐색',
      reply: presentation
        ? '슬라이드를 만들기 전에 듣는 사람이 기억했으면 하는 내용을 한 문장으로 정해봐요. 그 문장을 기준으로 발표 순서를 잡으면 준비할 범위가 훨씬 선명해져요.'
        : '먼저 팀이 다음 회의에서 결정해야 할 것 한 가지를 정리해 봐요. 그 결정에 필요한 자료나 초안만 준비하면 바로 논의를 시작할 수 있어요.',
      action,
      taskTitle: presentation ? '핵심 메시지 한 문장과 슬라이드 제목 정하기' : '팀에서 확인할 질문 한 가지 적기',
      minutes,
    };
  }
  return undefined;
}

export function buildRoutineTask(plan: RoutineGuidance): NonNullable<AgentChatResponse['suggestedTasks']> {
  return [{ title: plan.taskTitle, cadence: 'daily', dayLabel: '오늘', durationMinutes: plan.minutes }];
}

export function planSmallGoal(message: string) {
  const goal = message
    .replace(/^\s*(?:오늘\s*)?(?:가장\s*)?(?:해결하고\s*싶은|하고\s*싶은|해결하고픈)\s*(?:것|일|문제)\s*(?:은|는|이|가)?\s*/, '')
    .replace(/\s*(?:하고\s*싶어요|하고\s*싶어|하려고\s*해요|했으면\s*좋겠어요)[.!?]?\s*$/, '')
    .replace(/[.!?]+$/, '').trim();
  if (!routineIntent.test(message) || goal.length < 3 || goal.length > 90) return undefined;

  return {
    title: goal,
    reply: `‘${goal}’의 첫 단계부터 정해봐요. 오늘 할 수 있는 가장 작은 결과 하나를 적고, 언제 어디서 시작할지 정해두면 실천할 때 덜 망설일 수 있어요.`,
    action: '지금 필요한 준비물이나 정보 하나를 실제로 꺼내고, 5분 동안 첫 동작만 해보세요.',
  };
}
