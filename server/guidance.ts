import type { WorryCategory } from '../src/types/domain';
import { FUTURE_WORK_EXPERIENCE_PROGRAM, ONTONG_COUNSELING_PROGRAM, workExperienceTopic } from '../src/lib/programLinks';
import { buildRoutineTask, planRoutine, planSmallGoal } from './routineGuidance';
import { asRecommendation, type Program, type ProgramProfile } from './programs';

const concernTopics = [
  {
    topic: '취업 준비 비용 부담', category: '경제·생활',
    matches: /비용|돈이|경제|수당|생활비|훈련비|지원금|부담금|금전|교통비|배움카드/,
    reply: '취업 준비에 드는 비용 때문에 계획을 세우기 어렵군요. 먼저 어떤 지출이 가장 부담인지 정리해 보세요.',
    action: '10분 동안 가장 부담되는 항목 하나를 적고, 관련 제도의 지원 조건을 확인해 보세요.',
    first: ['prog-national-employment', 'prog-gyeonggi-youth', 'prog-tomorrow-learning'],
    questions: ['취업 준비 비용이 부담되는데 어떤 제도를 알아볼 수 있을까요?', '교육비나 면접 준비 비용을 줄일 방법이 있을까요?', '구직 기간에 이용할 수 있는 지원 제도의 조건을 어떻게 확인할까요?'],
  },
  {
    topic: '취업 경험 부족', category: '정보 탐색',
    matches: new RegExp(`${workExperienceTopic.source}|인턴|경험.{0,5}(부족|없)|실무.{0,5}(부족|없)|체험형`),
    reply: '현업이나 관심 직무를 직접 경험해보고 싶다면 미래내일 일경험 포털에서 체험 프로그램을 찾아볼 수 있어요. 기업탐방, 프로젝트형, 인턴형 중 해보고 싶은 방식부터 살펴보세요.',
    action: '공식 포털에서 관심 직무나 지역을 선택하고, 모집 중인 프로그램 하나의 참여 조건과 신청 기간을 확인해 보세요.',
    first: [FUTURE_WORK_EXPERIENCE_PROGRAM, 'prog-alio-public-intern'],
    questions: ['실무 경험이 부족한데 어떤 일경험 프로그램부터 볼까요?', '짧게 직무를 체험하거나 현업을 알아볼 수 있을까요?', '관심 분야의 청년 인턴 공고를 어디에서 확인할까요?'],
  },
  {
    topic: '직무 역량 부족', category: '역량 부족',
    matches: /직업훈련|역량|교육|배우|학습|자격증|훈련|코딩|디지털|부트캠프|공부|수강|기술/,
    reply: '관심 직무에 필요한 기술이나 교육을 알아보고 계시군요. 지금 가장 먼저 배울 것 하나를 좁혀 보면 과정 비교가 쉬워져요.',
    action: '관심 과정 한 개만 골라 교육 시간과 수강 조건을 메모해 보세요.',
    first: ['prog-tomorrow-learning', 'prog-k-digital-training'],
    questions: ['직무에 필요한 역량을 배우려면 어떤 훈련부터 찾을까요?', '제 일정에 맞는 교육 시간과 수강 조건은 어떻게 비교할까요?', '관심 분야를 기초부터 배울 수 있는 공공 훈련이 있을까요?'],
  },
  {
    topic: '취업 준비 스트레스', category: '심리적 부담',
    matches: /불안|스트레스|불합격|자신감|지쳐|지쳤|지침|무기력|번아웃|잠시 쉬|포기|우울|마음.?건강|압박|부담|긴장/,
    reply: '취업 준비 중 어떤 순간이 가장 부담되는지부터 정리해 봐요. 공고를 보는 일, 결과를 기다리는 일, 면접을 준비하는 일 중 하나를 고르면 지금 필요한 도움도 구체적으로 생각해 볼 수 있어요.',
    action: '가장 부담되는 상황과 그 상황에서 받고 싶은 도움을 한 줄씩 적어보세요.',
    first: [ONTONG_COUNSELING_PROGRAM, 'prog-seoul-youth-center', 'prog-youth-challenge'],
    questions: ['반복된 불합격으로 자신감이 떨어질 때 뭘 할 수 있을까요?', '취업 준비가 벅찬 날에도 할 수 있는 작은 행동이 있을까요?', '취업 스트레스를 이야기할 수 있는 청년 상담이 있을까요?'],
  },
  {
    topic: '진로 고민', category: '진로 방향',
    matches: /진로|적성|직무|방향|뭘 해야|무엇부터|일자리|취업|구직|면접/,
    reply: '어떤 방향으로 취업을 준비할지 정리하고 계시군요. 관심이 가는 활동과 부담되는 활동을 각각 하나 적어 보면 시작점을 찾기 쉬워요.',
    action: '10분 동안 흥미가 생겼던 활동 한 가지를 적고, 연결되는 직무나 상담 정보를 하나 찾아보세요.',
    first: ['prog-work24-career-counseling', ONTONG_COUNSELING_PROGRAM, 'prog-seoul-youth-center', 'prog-national-employment'],
    questions: ['어떤 직무가 저에게 맞는지 어디서부터 알아볼까요?', '관심 직무 두 가지를 비교할 때 어떤 기준을 쓸까요?', '아직 목표가 막연할 때 진로 상담을 어떻게 시작할까요?'],
  },
] satisfies Array<{
  topic: string; category: WorryCategory; matches: RegExp; reply: string; action: string; first: string[]; questions: string[];
}>;

const noMatch = '지금 입력한 내용과 연결되는 프로그램을 확인하지 못했어요. 관심 직무나 지역, 어떤 도움이 필요한지 한 가지 더 알려주세요.';

const declinedCounseling = /(?:상담|예약|신청)(?:은|이|을|도)?\s*(?:원하지|싶지|싫|거절|필요\s*없|빼\s*주|안\s*(?:할|받|해|하))|(?:상담|예약)(?:은|이|을|도)?\s*(?:받고|하고)\s*싶지/;
const nonCareerCounseling = /의료|정신과|치료|약물|병원|심리\s*치료|진단|일반\s*심리\s*상담/;
const careerContext = /취업|구직|직무|진로|면접|불합격|지원.{0,12}(결과|탈락)|탈락/;
const careerStress = /불안|스트레스|압박|부담|긴장|지쳤|지쳐|막막|걱정|불합격|탈락|자신감/;
const bookingRequest = /(?:상담.{0,10}(?:예약|신청|링크|받고)|(?:예약|신청).{0,10}상담|어디.{0,8}상담|(?:온통청년|청년상담|심층상담)|상담하고\s*싶)/;
const requestingProgram = /지원금|취업지원제도|국민내일배움카드|구직촉진수당|훈련비|일경험\s*프로그램|청년도전지원|청년\s*인턴/;
const counselingPrivacy = /비밀|개인\s*정보|상담\s*기록|기록.{0,12}(?:남|공개)|누가.{0,10}(?:보|알)/;
const counselingOpening = /(?:뭐라고|무슨\s*말|어떤\s*말|말을.{0,8}꺼내|어떻게\s*(?:말|시작))/;
const firstCounselingVisit = /처음.{0,18}(?:어떻게.{0,8}(?:진행|해)|뭐\s*(?:하|물어)|뭘\s*(?:하|물어))|상담.{0,8}어떻게\s*진행/;
const fearOfJudgment = /(?:이상하게|이상한\s*사람|나약하게|한심하게).{0,12}(?:볼|보면|보지|생각)/;
const counselingFear = /무섭|무서|겁|두렵|떨|부담|긴장|망설|걱정/;
const lowEnergyWords = /무기력|기운.{0,6}(?:없|안\s*나)|아무것도.{0,8}(?:못|싫)/;
const listeningRequest = /그냥\s*(?:얘기|이야기)?\s*들어|들어만\s*줘|조언.{0,12}(?:말고|없이|됐|괜찮아|안 해)/;
const explicitBookingRequest = /(?:예약|신청|접수).{0,10}(?:링크|페이지|주소|어디|알려|해\s*(?:줘|주세))|(?:링크|주소|페이지).{0,8}(?:줘|주세요|알려)/;

function recentUserMessage(history: unknown): string {
  if (!Array.isArray(history)) return '';
  const previous = history.slice(-6).reverse().find((turn) => turn?.role === 'user' && typeof turn.content === 'string');
  return previous?.content.slice(0, 600) ?? '';
}

function counselingConcern(message: string) {
  return /상담/.test(message) && !/결혼|부부|투자|수강|치과/.test(message)
    && (counselingFear.test(message) || counselingPrivacy.test(message) || counselingOpening.test(message) || firstCounselingVisit.test(message) || fearOfJudgment.test(message));
}

function counselingFollowUp(message: string) {
  return counselingPrivacy.test(message) || counselingOpening.test(message) || firstCounselingVisit.test(message)
    || fearOfJudgment.test(message) || declinedCounseling.test(message) || listeningRequest.test(message)
    || /그게.{0,6}(?:무서|겁|걱정)|아직.{0,8}(?:준비|안\s*갈)/.test(message);
}

function recentCounselingMessage(history: unknown): string {
  if (!Array.isArray(history)) return '';
  const topic = history.slice(-6).reverse()
    .filter((turn) => turn?.role === 'user' && typeof turn.content === 'string')
    .map((turn) => turn.content.slice(0, 600))
    .find((content) => counselingConcern(content) || !counselingFollowUp(content));
  return topic && counselingConcern(topic) ? topic : '';
}

export function personalSupportContext(message: string, history?: unknown) {
  if (requestingProgram.test(message) || explicitBookingRequest.test(message)) return false;
  return listeningRequest.test(message) || declinedCounseling.test(message) || counselingConcern(message)
    || (counselingFollowUp(message) && Boolean(recentCounselingMessage(history)));
}

export function careerCounselingBooking(message: string, history?: unknown): boolean {
  if (declinedCounseling.test(message) || nonCareerCounseling.test(message) || personalSupportContext(message, history)) return false;
  if (workExperienceTopic.test(message) && !/상담/.test(message)) return false;
  const previous = recentUserMessage(history);
  const relevantHistory = careerContext.test(previous) && !declinedCounseling.test(previous);
  return (careerContext.test(message) && (/상담|예약/.test(message) || (!concernTopics[0].matches.test(message) && careerStress.test(message))))
    || (bookingRequest.test(message) && !/결혼|부부|투자|수강|치과/.test(message))
    || (relevantHistory && /예약|상담|링크/.test(message));
}

function careerStressGuidance(message: string) {
  if (/불합격|탈락|지원.{0,12}(떨어|결과)|떨어졌|떨어지/.test(message)) {
    return {
      reply: '불합격이 이어지면 다음에 무엇을 바꿔야 할지 알기 어려워요. 최근 지원 한 건에서 어느 전형까지 갔는지부터 확인해 보세요. 상담에서는 그 사례를 바탕으로 지원 직무와 다음 준비 방법을 함께 살펴볼 수 있어요.',
      action: '최근 지원한 직무, 결과를 받은 전형 단계, 상담에서 묻고 싶은 질문을 한 줄씩 적어보세요.',
    };
  }
  if (/면접/.test(message)) {
    return {
      reply: '면접에서 어떤 질문이 나올지 모르거나 말이 막힐까 걱정될 수 있어요. 가장 부담되는 질문 하나를 골라 어디서 막히는지 짚어보면, 상담에서 다룰 내용이 구체적이 돼요.',
      action: '걱정되는 면접 질문 하나와 답하기 어려운 이유를 적어보세요.',
    };
  }
  if (/시작|무엇부터|뭐부터|할 일|막막|방향/.test(message)) {
    return {
      reply: '해야 할 일이 한꺼번에 떠오르면 첫 단계부터 고르기 어려워요. 공고 찾기, 직무 선택, 면접 준비 중 지금 멈춰 있는 단계 하나를 골라보세요. 상담을 예약한다면 그 단계에서 무엇이 막히는지 이야기해 볼 수 있어요.',
      action: '지금 멈춰 있는 단계와 상담에서 물어보고 싶은 점을 한 줄씩 적어보세요.',
    };
  }
  return undefined;
}

function personalSupport(message: string, history: unknown) {
  const lowEnergy = lowEnergyWords.test(message + ' ' + recentCounselingMessage(history));
  if (listeningRequest.test(message)) {
    return {
      reply: lowEnergy
        ? '기운이 없다는 말만으로도 지금 얼마나 벅찬지 느껴져요. 뭘 해내야 한다는 얘기는 잠시 내려놓고, 여기에 하고 싶은 말만 편하게 남겨도 돼요.'
        : '응, 지금은 해결책을 찾는 얘기는 잠시 내려놔도 돼요. 말이 잘 정리되지 않아도 괜찮아요. 편한 만큼 들려주세요.',
      action: '',
    };
  }
  if (declinedCounseling.test(message) || /아직.{0,8}(?:준비|안\s*갈)/.test(message)) {
    return {
      reply: '상담을 받을지 지금 결정할 필요는 없어요. 이곳에서도 편한 만큼만 이야기해도 돼요. 오늘 하루 중 유난히 버겁게 느껴졌던 순간이 있다면 그 얘기부터 해볼까요?',
      action: '',
    };
  }
  if (counselingPrivacy.test(message)) {
    return {
      reply: '내 이야기가 어디까지 기록되고 누가 볼 수 있는지 모르면 상담을 망설일 수 있어요. 사정을 자세히 말하기 전에 궁금한 점만 먼저 물어봐도 돼요. 안내를 듣고 나서 이용할지 결정해도 괜찮아요.',
      action: '문의하고 싶다면 “상담에서 어떤 내용이 기록되고, 누가 그 기록을 볼 수 있나요?”라고 물어보세요.',
    };
  }
  if (fearOfJudgment.test(message)) {
    return {
      reply: '내 얘기를 꺼냈다가 상대가 이상하게 볼까 봐 걱정되는군요. 처음부터 전부 이야기해야 하는 건 아니에요. 말하고 싶지 않은 부분은 나중으로 미뤄도 돼요.',
      action: '말을 꺼내고 싶다면 “어떻게 보실지 걱정돼서 말하기가 어려워요”라는 한 문장으로 시작해 보세요.',
    };
  }
  if (counselingOpening.test(message)) {
    return {
      reply: lowEnergy
        ? '첫마디를 잘 정리해 갈 필요는 없어요. “요즘 기운이 없어요. 어디서부터 얘기해야 할지 모르겠고, 여기 오는 것도 긴장됐어요.” 이렇게 말하거나 메모로 보여줘도 돼요.'
        : '“어디서부터 얘기해야 할지 모르겠어요. 질문부터 해주실 수 있을까요?” 이 한마디로 시작해도 돼요. 말로 꺼내기 어렵다면 메모를 보여주는 방법도 있어요.',
      action: '이 문장에서 지금 내 상황에 맞는 한 문장만 골라 메모해 두세요.',
    };
  }
  if (firstCounselingVisit.test(message)) {
    return {
      reply: '처음에 어떤 일이 있을지 모르면 긴장되죠. 진행 방식은 기관마다 달라요. 만나게 되면 “처음이라 긴장돼요. 오늘 어떻게 진행되는지 먼저 설명해 주실 수 있을까요?”라고 물어보세요. 답하기 부담되는 질문이 나오면 그 부분은 다음에 이야기하고 싶다고 말해도 돼요.',
      action: '',
    };
  }
  return {
    reply: lowEnergy
      ? '기운이 없는 와중에 낯선 사람에게 내 이야기를 해야 한다고 생각하면 더 겁이 날 수 있어요. 오늘 당장 상담을 받을지 정할 필요는 없어요. 어떤 점이 무서운지 말하고 싶다면, 그 얘기부터 같이 해볼까요?'
      : '상담을 생각하면 어떤 말을 해야 할지, 상대가 어떻게 반응할지 걱정될 수 있어요. 지금 당장 예약을 결정할 필요는 없어요. 어디가 가장 겁나는지 이야기해도 괜찮아요.',
    action: '말로 꺼내기 어렵다면 상담에서 가장 걱정되는 점 한 가지를 메모해 보세요.',
  };
}

export function guidedConcern(message: string, programs: Program[], profile: ProgramProfile, energyLevel?: number, history?: unknown, availableMinutes?: number) {
  if (personalSupportContext(message, history)) {
    const support = personalSupport(message, history);
    return {
      responseMode: 'guided',
      counselingBooking: false,
      reply: support.reply,
      problemType: '심리적 부담',
      smallAction: support.action,
      extractedWorry: undefined,
      suggestedTasks: [],
      recommendedPrograms: [],
      noMatchGuidance: undefined,
    };
  }
  const booking = careerCounselingBooking(message, history);
  const explicitBooking = booking && /상담|예약|링크/.test(message);
  const experienceRequest = !explicitBooking && workExperienceTopic.test(message);
  const routine = explicitBooking || experienceRequest || requestingProgram.test(message) ? undefined
    : planRoutine(message, { history, energyLevel, availableMinutes, careerTopic: booking });
  if (routine) {
    return {
      responseMode: 'guided',
      counselingBooking: false,
      reply: routine.reply,
      problemType: routine.category,
      smallAction: routine.action,
      extractedWorry: { title: routine.title, category: routine.category, nextStep: routine.action },
      suggestedTasks: buildRoutineTask(routine),
      recommendedPrograms: [],
      noMatchGuidance: undefined,
    };
  }
  const previous = recentUserMessage(history);
  const shortBookingFollowUp = booking && /예약|상담|링크/.test(message) && message.length <= 36 && !careerStress.test(message);
  const concern = shortBookingFollowUp && careerContext.test(previous) ? previous : message;
  const topic = (experienceRequest ? concernTopics[1] : undefined)
    ?? (booking && careerStress.test(concern) ? concernTopics[3] : undefined)
    ?? concernTopics.find((item) => item.matches.test(concern) && (item !== concernTopics[3] || careerContext.test(concern)))
    ?? (booking ? concernTopics[4] : undefined);
  const specific = booking && topic?.category === '심리적 부담' ? careerStressGuidance(concern) : undefined;
  const personalGoal = topic ? undefined : planSmallGoal(message);
  const contextSummary = message.replace(/\s+/g, ' ').trim().slice(0, 95);
  const bookingDetails = shortBookingFollowUp ? {
    reply: '온통청년 심층상담 예약 페이지에서 진로상담이나 취업상담을 선택할 수 있어요. 신청할 때는 온통청년 계정이 필요해요.',
    action: '아래 예약 버튼을 눌러 상담 분야와 가능한 일정을 확인하세요.',
  } : undefined;
  const smallAction = bookingDetails?.action
    ?? (energyLevel && energyLevel <= 2 && topic && !booking
      ? '지금은 부담되는 점을 한 줄만 적고 잠시 쉬어가도 좋아요.'
      : specific?.action ?? topic?.action)
    ?? personalGoal?.action
    ?? '이 상황에서 지금 바꿀 수 있는 것 한 가지를 골라 5분 동안 첫 단계만 시도해 보세요.';
  const matching = !topic ? [] : programs.filter((program) =>
    ((booking && program.programId === ONTONG_COUNSELING_PROGRAM) || program.worryThemes.includes(topic.topic)) &&
    (program.programId !== 'prog-k-digital-training' || /코딩|디지털|데이터|개발|인공지능|첨단|반도체|\bAI\b/i.test(
      [message, ...(Array.isArray(profile.interests) ? profile.interests : [])].join(' ')
    )));
  const preferredIds = booking
    ? [ONTONG_COUNSELING_PROGRAM, ...(topic?.first ?? []).filter((id) => id !== ONTONG_COUNSELING_PROGRAM)]
    : (topic?.first ?? []).filter((id) => id !== ONTONG_COUNSELING_PROGRAM);
  const priority = new Map(preferredIds.map((id, index) => [id, index]));
  const ranked = matching
    .filter((program) => priority.has(program.programId) || program.programId.startsWith('live-allinone-'))
    .sort((a, b) => (priority.get(a.programId) ?? 9) - (priority.get(b.programId) ?? 9));
  const recommendedPrograms = ranked.slice(0, 3).map((program) =>
    asRecommendation(program, message, program.programId === ONTONG_COUNSELING_PROGRAM
      ? '준비 과정에서 막힌 지점이나 다음에 시도할 방향을 진로·취업 상담에서 함께 정리할 수 있어요.'
      : topic!.topic + '에 관해 ' + program.provider + '의 공식 안내를 확인할 수 있어요.'));
  return {
    responseMode: 'guided',
    counselingBooking: booking,
    reply: bookingDetails?.reply ?? specific?.reply ?? topic?.reply ?? personalGoal?.reply
      ?? (contextSummary.length >= 5
        ? `‘${contextSummary}’에서 어떤 점을 먼저 바꿀지 고민하고 계신 것 같아요. 바라는 결과가 있다면 오늘 안에 시작할 수 있는 한 단계부터 같이 좁혀봐요.`
        : '지금 이야기하고 싶은 일이나 궁금한 점이 있다면 편하게 말해 주세요.'),
    problemType: topic?.topic ?? '고민 정리',
    smallAction,
    extractedWorry: topic && !shortBookingFollowUp ? { title: message.slice(0, 140), category: topic.category, nextStep: smallAction } : undefined,
    suggestedTasks: undefined,
    recommendedPrograms,
    noMatchGuidance: recommendedPrograms.length ? undefined : noMatch,
  };
}

export function guidedQuestions(profile: ProgramProfile, recent: unknown, energy: unknown, exclude: unknown, seed: unknown) {
  const worries = Array.isArray(recent) ? recent.slice(0, 4).map((item) => item?.title ?? '').join(' ') : '';
  const stage = profile.jobPrepStatus ?? '';
  const interest = Array.isArray(profile.interests) ? profile.interests.join(' ') : '';
  const primary = concernTopics.find((topic) => topic.matches.test(worries))
    ?? (typeof energy === 'number' && energy <= 2 ? concernTopics[3] : undefined)
    ?? concernTopics.find((topic) => topic.matches.test(stage + ' ' + interest))
    ?? concernTopics[4];
  const others = concernTopics.filter((topic) => topic !== primary);
  const rotation = Math.abs(Math.trunc(Number(seed) || 0));
  const previous = new Set(Array.isArray(exclude) ? exclude : []);
  const order = [primary, ...others.slice(rotation % others.length), ...others.slice(0, rotation % others.length)];
  return order.flatMap((topic) => {
    const sorted = [...topic.questions.slice(rotation % 3), ...topic.questions.slice(0, rotation % 3)];
    return sorted.find((question) => !previous.has(question)) ?? [];
  }).slice(0, 3);
}

export function suggestedMinutes(checkin?: { energyLevel?: number; availableMinutes?: number } | null) {
  const energy = Number(checkin?.energyLevel ?? 3);
  return Math.max(5, Math.min(Number(checkin?.availableMinutes) || 20, energy <= 2 ? 5 : energy <= 3 ? 10 : 15));
}
