import { readGuidedTurn, readJobSelection, type GuidedTopic, type GuidedTurn, type SupportPreview } from '../src/lib/guidedConversation';
import { detectJobKeyword, detectJobRole, type JobSelection } from '../src/lib/jobDiscovery';
import { FUTURE_WORK_EXPERIENCE_PROGRAM, workExperienceTopic } from '../src/lib/programLinks';
import { personalSupportContext } from './guidance';
import { asRecommendation, programsForProfile, type Program, type ProgramProfile } from './programs';

type Turn = { role: string; content: string; supportType?: string };
const PUBLIC = /공공기관|공기업|공무원|공공\s*부문/;
const PRIVATE = /사기업|민간|일반\s*기업|중소기업|대기업|외국계/;
const REGIONS = /(?:^|[^가-힣])(서울|경기|인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)(?:시|도|광역시|특별시|특별자치[시도])?(?=에서|으로|에|로|쪽|지역|[^가-힣]|$)/g;
const JOB = /(?:행정[·ㆍ/\s-]*사무|기획[·ㆍ/\s-]*사무|경영[·ㆍ/\s-]*지원|기획|행정|사무|회계|재무|인사|마케팅|디자인|데이터|개발|품질|생산|간호|연구|전기|전자|기계|영업|(?<![a-z])IT(?![a-z]))/i;
const WANT_NEW_TOPIC = /^(?:다른\s*고민|새로운?\s*(?:고민|주제)|그건 됐고|다른 건|이번엔|그런데 요즘)/;
const AGREEMENT = /^(?:네|응|좋아요|알겠어요|해볼게요|해볼래요|좋습니다|고마워요|감사해요)[.!\s]*$/;
const WELLBEING = /무기력|심리|마음\s*건강|정신\s*건강|우울|아무것도 하기 싫|번아웃|상담.{0,9}(?:무서|두렵|겁)|기운.{0,6}(?:없|안\s*나)/;
const AVOID_LINKS = /(?:링크|정보|상담|신청|추천)(?:는|은|이|을|도)?\s*(?:빼|안\s*볼|안\s*받|원하지|괜찮아|필요\s*없|말아)|그냥\s*(?:얘기|이야기)?\s*들어|들어만\s*줘/;
const WELLBEING_REQUEST = /(?:상담|기관|센터|서비스).{0,12}(?:알려|받고|찾|보고|추천|예약|보여)|(?:어디|지역|링크).{0,12}상담/;

export function planJobSelection(message: string, history: Turn[], profileRegion: unknown): JobSelection | undefined {
  const afterCorrection = message.split(/말고|대신|아니고/).at(-1)?.trim() || message;
  const previousTurn = history.at(-1);
  const oldTopic = readGuidedTurn(previousTurn?.supportType)?.topic;
  const currentTopic = classify(message);
  if (currentTopic === 'career-choice' || AVOID_LINKS.test(message) || personalSupportContext(message, history)) return;
  const role = detectJobRole(afterCorrection);
  const keyword = detectJobKeyword(afterCorrection);
  const restart = WANT_NEW_TOPIC.test(message) && !role && !keyword;
  const previous = restart ? undefined : readJobSelection(previousTurn?.supportType);
  const region = Array.from(message.matchAll(REGIONS)).at(-1)?.[1];
  const hasCareerRequest = /직무|취업|체험|현업|공고|일경험|준비하고 싶|관심 있/.test(message);
  const hasPriorCareerRequest = oldTopic === 'experience' || oldTopic === 'training' || oldTopic === 'career';
  const changesSelection = previous && (role || keyword || (region && /^(?:[가-힣]+)(?:\s*지역)?(?:에서|으로|에|로)?(?:\s*(?:찾아|보고|볼래|만|바꿔|보여|보고 싶|좋아))[가-힣\s.!?]*$/.test(message)));
  if (!changesSelection && !(role && (keyword || hasCareerRequest || hasPriorCareerRequest || message.replace(/\s/g, '') === role.replace(/\s/g, ''))) && !keyword && !(workExperienceTopic.test(message) && currentTopic === 'experience')) return;
  if (!keyword && !role && ['wellbeing', 'overload', 'routine'].includes(currentTopic)) return;
  const lastUser = history.at(-2)?.role === 'user' ? history.at(-2)?.content ?? '' : '';
  const roleFromPreviousTurn = hasPriorCareerRequest ? detectJobRole(lastUser) : undefined;
  return {
    role: role ?? previous?.role ?? roleFromPreviousTurn ?? '',
    keyword: keyword ?? previous?.keyword,
    region: region ?? previous?.region ?? (typeof profileRegion === 'string' ? Array.from(profileRegion.matchAll(REGIONS))[0]?.[1] ?? '' : ''),
    publicSector: PUBLIC.test(afterCorrection) || (!PRIVATE.test(afterCorrection) && previous?.publicSector) ? true : undefined,
  };
}

function classify(message: string): GuidedTopic {
  if (PUBLIC.test(message) && PRIVATE.test(message)) return 'career-choice';
  if (WELLBEING.test(message)) return 'wellbeing';
  if (workExperienceTopic.test(message) || /직무\s*체험|인턴|실무\s*경험|(?:공공기관|공기업)\s*채용/.test(message)) return 'experience';
  if (/구직\s*촉진|수당|지원금|취업.{0,9}비용|생활비|국민취업지원/.test(message)) return 'employment';
  if (/교육|훈련|자격증|배움카드|배울|수강/.test(message)) return 'training';
  if (/일정|마감|할\s*일|프로젝트|피피티|\bPPT\b/.test(message)) return 'overload';
  if (/루틴|수면|일찍\s*자|잠드는|생활\s*(?:패턴|리듬)/.test(message)) return 'routine';
  if (/진로|직무|취업|직장|면접|구직|상담|공공기관|공기업|불합격/.test(message)) return 'career';
  return 'general';
}

export function planGuidedTurn(message: string, history: Turn[], region: unknown) {
  const historyTurn = readGuidedTurn(history.at(-1)?.supportType);
  const currentTopic = classify(message);
  const lastUser = history.at(-2)?.role === 'user' ? history.at(-2)?.content ?? '' : '';
  const continuing = historyTurn && (historyTurn.stage === 1 || historyTurn.stage === 2)
    && !WANT_NEW_TOPIC.test(message) && (currentTopic === 'general'
      || currentTopic === historyTurn.topic
      || (historyTurn.topic === 'career-choice' && currentTopic === 'career')
      || currentTopic === 'career' && (historyTurn.topic === 'wellbeing' || historyTurn.topic === 'experience')
      || historyTurn.stage === 1 && historyTurn.topic === 'general');
  const stage = continuing ? historyTurn.stage === 1 ? 2 : 3 : 1;
  const topic = continuing && historyTurn.topic !== 'general' ? historyTurn.topic : currentTopic;
  const text = continuing && lastUser ? `${lastUser}\n${message}` : message;
  const requestedRegion = Array.from(text.matchAll(REGIONS)).at(-1)?.[1]
    ?? (typeof region === 'string' ? Array.from(region.matchAll(REGIONS))[0]?.[1] : '');
  const job = message.match(JOB)?.[0] || (continuing ? lastUser.match(JOB)?.[0] : '');
  const turn: GuidedTurn = { stage, topic };
  const optedOut = AVOID_LINKS.test(message) || personalSupportContext(message, history) ||
    (continuing && personalSupportContext(lastUser, history) && !WELLBEING_REQUEST.test(message));
  const preview: SupportPreview | undefined = stage === 2 && !optedOut && !AGREEMENT.test(message)
    ? topic === 'career' || topic === 'career-choice' ? { kind: 'career', region: requestedRegion || '' }
      : topic === 'wellbeing' ? { kind: 'wellbeing', region: requestedRegion || '' }
        : ['experience', 'training', 'employment'].includes(topic) ? { kind: 'programs', region: requestedRegion || '' }
          : undefined
    : undefined;

  return { turn, preview, text, job, optedOut };
}

const QUESTIONS: Record<GuidedTopic, string> = {
  'career-choice': '공공기관과 사기업을 함께 준비하면 어디에 시간을 써야 할지 막막할 수 있어요. 먼저 눈여겨보고 있는 직무가 있나요? 기획·사무, 행정, IT처럼 분야 하나면 충분해요.',
  career: '지금 막힌 지점에 따라 다음 행동이 달라져요. 관심 직무를 고르는 일과 지원 준비 중에서 어느 쪽이 더 고민인가요?',
  wellbeing: '지금 느끼는 부담을 먼저 살펴봐도 괜찮아요. 기운이 가장 떨어지거나 마음이 힘들어지는 때가 언제인가요?',
  experience: '관심 직무를 직접 경험해 보면 준비 방향을 잡기 쉬워요. 기업탐방처럼 짧게 둘러보기와 프로젝트·인턴처럼 직접 참여하기 중 어느 쪽을 원하세요?',
  training: '먼저 배우고 싶은 내용을 좁히면 교육을 비교하기 쉬워요. 더 익히고 싶은 직무나 기술 한 가지가 있나요?',
  employment: '취업을 준비하며 비용도 챙기려니 부담이 클 수 있어요. 지금 가장 줄이고 싶은 비용은 생활비, 교육비, 면접·이동비 중 무엇인가요?',
  overload: '일이 여러 개 겹치면 어디부터 손대야 할지 막힐 수 있어요. 가장 먼저 마감되는 일이 무엇인가요?',
  routine: '습관은 지금 생활 패턴에서 작은 부분부터 바꾸면 덜 부담돼요. 오늘 가장 먼저 바꾸고 싶은 행동이나 시간이 언제인가요?',
  general: '지금 말해준 상황에서 손댈 수 있는 것부터 같이 좁혀봐요. 오늘 하루 중 이 고민이 가장 크게 느껴지는 순간이 언제인가요?',
};

export function fallbackClarification(plan: ReturnType<typeof planGuidedTurn>) {
  if (plan.turn.topic === 'career-choice' && plan.job) {
    return `${plan.job} 분야를 중심으로 비교하면 기준을 잡기 쉬워요. 근무 안정성, 업무의 내용, 준비에 쓸 수 있는 시간 중 무엇을 가장 중요하게 보고 있나요?`;
  }
  if (plan.optedOut) {
    return '편하게 이야기해도 괜찮아요. 요즘 어떤 순간에 이 마음이 가장 크게 느껴졌나요?';
  }
  return QUESTIONS[plan.turn.topic];
}

export function previewPrograms(plan: ReturnType<typeof planGuidedTurn>, catalog: Program[], profile: ProgramProfile) {
  if (plan.preview?.kind !== 'programs') return [];
  const { topic } = plan.turn;
  const eligible = programsForProfile(catalog, { ...profile, region: plan.preview.region });
  const wantsPublicRecruitment = topic === 'experience' && /공공기관|공기업/.test(plan.text);
  const jobTerms = (plan.job ?? '').toLowerCase().split(/[^가-힣a-z]+/).filter(Boolean);
  const liveRecruitment = wantsPublicRecruitment
    ? (plan.preview.region ? eligible : catalog).find((item) => {
        const details = `${item.title} ${item.summary}`.toLowerCase();
        return item.programId.startsWith('live-allinone-') && item.applyUrl
          && (!/인턴/.test(plan.text) || details.includes('인턴'))
          && (!jobTerms.length || jobTerms.every((term) => details.includes(term)));
      })
    : undefined;
  const ids = topic === 'experience'
    ? [FUTURE_WORK_EXPERIENCE_PROGRAM, ...(wantsPublicRecruitment ? [liveRecruitment?.programId ?? 'prog-alio-public-intern'] : [])]
    : topic === 'training' ? ['prog-tomorrow-learning', ...(/디지털|데이터|개발|코딩|IT/i.test(plan.text) ? ['prog-k-digital-training'] : [])]
      : ['prog-national-employment'];
  return ids.flatMap((id) => {
    const program = id === liveRecruitment?.programId ? liveRecruitment : eligible.find((item) => item.programId === id);
    if (!program?.applyUrl) return [];
    const reason = program === liveRecruitment ? '공공기관 공식 채용 공고에서 모집 직무와 지원 조건을 확인할 수 있어요.'
      : topic === 'experience' ? '현재 관심 직무와 지역을 기준으로 실제 체험 기회를 찾아볼 수 있어요.'
      : topic === 'training' ? '관심 분야에 필요한 직업훈련 과정과 참여 조건을 비교할 수 있어요.'
        : '준비 비용이 부담될 때 받을 수 있는 취업지원과 신청 조건을 확인할 수 있어요.';
    return [asRecommendation(program, plan.text, reason)];
  });
}

export function fallbackNextStep(plan: ReturnType<typeof planGuidedTurn>, previousAction?: string) {
  if (plan.optedOut) return;
  if (plan.turn.stage === 3 && AGREEMENT.test(plan.text.split('\n').at(-1) ?? '') && previousAction) {
    return { reply: '좋아요. 오늘은 아래 한 가지만 해봐도 충분해요.', action: previousAction };
  }
  const { region } = plan.preview ?? {};
  const job = plan.job || '관심 직무';
  if (plan.turn.topic === 'career-choice') {
    return {
      reply: `${job} 기준으로 공공기관과 사기업의 공고를 한 개씩 비교해 보세요. 공공기관 공고에서는 직무기술서와 전형을, 사기업 공고에서는 맡는 업무와 필요한 경험을 먼저 보면 선택 기준을 잡기 쉬워요.`,
      action: plan.turn.stage === 3
        ? '오늘 본 공고에서 더 궁금한 업무 하나를 적어보세요.'
        : `${region ? region + '에서 ' : ''}공고를 한 개씩 찾아 채용 조건 하나씩 비교해 보세요.`,
    };
  }
  if (plan.turn.topic === 'wellbeing' && plan.preview) {
    return {
      reply: '마음이 무거운 때가 반복된다면, 연락하기 편한 상담 방식부터 살펴봐도 괜찮아요. 안내를 보면서 온라인 문의와 직접 방문 중 어떤 방식이 덜 부담스러운지 확인해 보세요.',
      action: '상담기관에 물어보고 싶은 것 하나만 적어보세요.',
    };
  }
  if (plan.turn.topic === 'overload') {
    return {
      reply: '먼저 마감이 가까운 일의 완료 기준을 작게 잡아봐요. 그 일에서 맨 처음 할 작업 하나를 정한 뒤, 다음 일정은 잠시 미뤄도 괜찮아요.',
      action: '가장 가까운 마감의 첫 작업을 10분 동안 시작해 보세요.',
    };
  }
}
