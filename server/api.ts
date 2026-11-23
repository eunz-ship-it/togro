import { buildCheckinSuggestion, type CheckinAdviceInput, type CheckinAdviceResult } from '../src/lib/checkinAdvice';
import { buildJobDiscovery, JOB_KEYWORDS } from '../src/lib/jobDiscovery';
import { DAILY_GOAL_LIMIT, FIELD_LIMITS, type AgentChatResponse, type DailyGoal, type DailyGoalsResult, type GoalType } from '../src/types/domain';
import { ApiError, GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { asRecommendation, loadPrograms, programsForProfile } from './programs';
import { fallbackClarification, fallbackNextStep, planGuidedTurn, planJobSelection, previewPrograms } from './guidedConversation';
import { getRoadmapPlan, roadmapPeriods, roadmapPreview, scheduleRoadmapSteps } from './roadmapPlan';
import { careerCounselingBooking, guidedConcern, guidedQuestions, personalSupportContext, suggestedMinutes } from './guidance';

export type RuntimeEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  YOUTH_JOB_API_KEY?: string;
};

type ApiRequest = {
  body: Record<string, any>;
  query: Record<string, string>;
  env: RuntimeEnv;
};
type ApiResponse = {
  status(code: number): ApiResponse;
  json(body: unknown): Response;
};

const routes = new Map<string, (request: ApiRequest, response: ApiResponse) => Promise<unknown>>();
const app = {
  get(path: string, handler: (request: ApiRequest, response: ApiResponse) => Promise<unknown>) {
    routes.set('GET ' + path, handler);
  },
  post(path: string, handler: (request: ApiRequest, response: ApiResponse) => Promise<unknown>) {
    routes.set('POST ' + path, handler);
  },
};

function safeDate(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    ? value : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
}

export async function runApi(
  method: string, url: URL, body: unknown, env: RuntimeEnv,
): Promise<Response> {
  const handler = routes.get(method + ' ' + url.pathname);
  if (!handler) return Response.json({ error: '요청한 경로를 찾을 수 없어요.' }, { status: 404 });
  if (method === 'POST' && (!body || typeof body !== 'object' || Array.isArray(body))) {
    return Response.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 });
  }
  let result: Response | undefined;
  let statusCode = 200;
  const response: ApiResponse = {
    status(code) { statusCode = code; return this; },
    json(payload) {
      result = Response.json(payload, { status: statusCode, headers: { 'Cache-Control': 'no-store' } });
      return result;
    },
  };
  try {
    await handler({ body: (body ?? {}) as Record<string, unknown>, query: Object.fromEntries(url.searchParams), env }, response);
    if (result) return result;
  } catch {
    console.warn('TOGRO API handler failed:', url.pathname);
  }
  return Response.json({ error: '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
}

const MODEL_NAME = 'gemini-3.8-flash';
const CONVERSATION_GUIDANCE = `최근 메시지에서 실제로 말한 고민과 질문을 먼저 다루세요. 사용자가 직접 연결한 경우에만 이전 맥락이나 취업 준비 상태를 참고하세요. 이미 알려준 내용을 다시 묻지 마세요. 상담을 망설이면 구체적으로 어떤 점이 겁나는지 먼저 다루고, 예약을 권하거나 취업 문제로 돌리지 마세요. 개인정보가 걱정된다고 하면 비밀 보장을 단정하지 말고 기관에 확인할 질문을 제안하세요. 조언 없이 들어달라고 하면 제안은 빈 문자열로 두세요.`;

function getAiClient(env: RuntimeEnv): GoogleGenAI {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    console.error('TOGRO Gemini request failed: key_missing');
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. Settings > Secrets 패널에서 API 키를 확인해 주세요.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function logGeminiFailure(error: unknown, message: string) {
  const status = error instanceof ApiError && Number.isInteger(error.status) ? error.status : 'unknown';
  const code = message.match(/\b(?:API_KEY_[A-Z_]+|BILLING_DISABLED|SERVICE_DISABLED|UNAUTHENTICATED|PERMISSION_DENIED|RESOURCE_EXHAUSTED|FAILED_PRECONDITION|INVALID_ARGUMENT|NOT_FOUND|UNAVAILABLE)\b/)?.[0];
  const reason = code ?? (/not supported in your (?:country|location)|location is not supported/i.test(message)
    ? 'location_unsupported' : /fetch failed|failed to fetch|network|connection|timed?\s*out/i.test(message) ? 'network' : 'unknown');
  console.error(`TOGRO Gemini request failed: status=${status} reason=${reason}`);
}

async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!/\b503\b|UNAVAILABLE/.test(msg) || i === retries) {
        logGeminiFailure(err, msg);
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** i + Math.random() * 200));
    }
  }
  throw lastError;
}

function sendGeminiError(res: ApiResponse, err: unknown) {
  const raw = err instanceof Error ? err.message : String(err);
  if (/API_KEY_INVALID|PERMISSION_DENIED/.test(raw)) {
    return res.status(403).json({ error: 'Gemini 사용 권한을 확인해 주세요.' });
  }
  if (/RESOURCE_EXHAUSTED|\b429\b/.test(raw)) {
    return res.status(429).json({ error: '요청 한도를 잠시 초과했습니다. 잠시 후 다시 시도해 주세요.' });
  }
  if (/GEMINI_API_KEY|UNAVAILABLE|\b503\b/.test(raw)) {
    return res.status(503).json({ error: '지금은 AI 응답을 불러올 수 없어요. 잠시 후 다시 시도해 주세요.' });
  }
  return res.status(502).json({ error: 'AI 응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' });
}

// 1. Burden-Free AI Companion Chat
app.post('/api/agent/chat', async (req, res) => {
  const { message, history, context } = req.body;
  if (typeof message !== 'string' || !message.trim() || message.length > FIELD_LIMITS.messageContentMax) {
    return res.status(400).json({ error: '대화 내용을 4,000자 이내로 입력해 주세요.' });
  }

  const content = message.trim();
  const profile = context && typeof context === 'object' ? context : {};
  const turns: Array<{ role: string; content: string; supportType?: string; suggestedAction?: string }> = Array.isArray(history)
    ? history.slice(-6).filter((entry) => (entry?.role === 'user' || entry?.role === 'assistant') && typeof entry.content === 'string')
      .map((entry) => ({
        role: entry.role,
        content: entry.content.slice(0, FIELD_LIMITS.messageContentMax),
        supportType: typeof entry.supportType === 'string' && entry.role === 'assistant' ? entry.supportType : undefined,
        suggestedAction: typeof entry.suggestedAction === 'string' && entry.role === 'assistant' ? entry.suggestedAction.slice(0, 200) : undefined,
      }))
    : [];
  const selection = planJobSelection(content, turns, profile.region);
  if (selection) {
    const discovery = buildJobDiscovery(selection);
    if (!discovery || !selection.keyword) {
      return res.json({
        reply: selection.role
          ? `${selection.role}에서 무엇을 먼저 알아볼까요? 아래 탐색 항목을 고르면 확인할 정보와 학습 계획을 함께 보여드릴게요.`
          : '어떤 직무를 알아보고 있나요? 아래에서 선택하거나 관심 직무를 직접 적어 주세요.',
        supportType: '직무 탐색', suggestedAction: '', jobSelection: selection,
      } satisfies AgentChatResponse);
    }

    const keyword = JOB_KEYWORDS[selection.keyword];
    const [today] = discovery.steps;
    const confirmedContext = `${selection.role}에서는 ${discovery.focus}에 주목해 보세요. ${keyword}을 알아볼 때는 ${discovery.check}`;
    let coaching = '';
    if (profile.demoMode !== true && req.env.GEMINI_API_KEY?.trim()) {
      try {
        const ai = getAiClient(req.env);
        const response = await withRetry(() => ai.models.generateContent({
          model: req.env.GEMINI_MODEL || MODEL_NAME,
          contents: JSON.stringify({
            occupation: selection.role, keyword, region: selection.region,
            timeBudget: profile.availableMinutes,
            workFocus: discovery.focus, searchChecks: discovery.check, steps: discovery.steps,
            recentTurns: turns.map(({ role, content }) => ({ role, content })), message: content,
          }),
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction: `당신은 TOGRO의 직무 탐색 코치입니다. 서버가 확정한 occupation과 keyword를 최신 선택으로 사용하세요. 오래된 직무나 유형으로 돌아가지 마세요. 제공된 실제 업무와 오늘 실습의 연결을 한두 문장으로 설명하세요. 직무마다 업무, 도구, 산출물을 구체적으로 구분하고 같은 문구를 반복하지 마세요. 이미 말한 직무나 유형을 다시 묻지 마세요. 링크·공고·모집 상태·기관·시험 일정이나 지원 조건을 생성하지 마세요. 링크와 로드맵은 서비스가 제공합니다. 사용자가 제공한 사례나 제약이 있을 때만 반영하세요.`,
            responseMimeType: 'application/json',
            responseSchema: { type: Type.OBJECT, properties: { coaching: { type: Type.STRING } }, required: ['coaching'] },
          },
        }));
        const answer = JSON.parse(response.text ?? '{}');
        const candidate = typeof answer.coaching === 'string' ? answer.coaching.trim() : '';
        if (candidate && candidate.length <= 240 && !/https?:\/\/|www\.|\?|모집 중|마감일은/.test(candidate)
          && !turns.some((item) => item.role === 'assistant' && item.content.includes(candidate))) coaching = candidate;
      } catch {
        // The job-specific plan and source links are available without Gemini.
      }
    }
    const durationMinutes = Number(profile.availableMinutes) > 0
      ? Math.max(5, Math.min(today.durationMinutes, Math.floor(Number(profile.availableMinutes)))) : today.durationMinutes;
    const livePrograms = selection.publicSector && (selection.keyword === 'intern' || selection.keyword === 'hiring')
      && profile.demoMode !== true && req.env.YOUTH_JOB_API_KEY?.trim()
      ? previewPrograms({
          turn: { stage: 2, topic: 'experience' }, preview: { kind: 'programs', region: selection.region },
          text: `공공기관 ${selection.role} ${keyword}`, job: selection.role, optedOut: false,
        }, (await loadPrograms(req.env.YOUTH_JOB_API_KEY)).programs, profile).filter((item) => item.programId.startsWith('live-allinone-'))
      : [];
    return res.json({
      reply: [confirmedContext, coaching, today.description].filter(Boolean).join('\n\n'),
      supportType: '직무 탐색', suggestedAction: today.title, jobSelection: selection,
      preview: { kind: 'job', region: selection.region },
      recommendedPrograms: livePrograms,
      suggestedTasks: [{ title: today.title, cadence: 'daily', dayLabel: '오늘', durationMinutes }],
    } satisfies AgentChatResponse);
  }
  const plan = planGuidedTurn(content, turns, profile.region);

  const formatResponse = async (modelAnswer?: { reply: string; supportType: string; suggestedAction: string; extractedWorry?: unknown; suggestedTasks?: Array<{ title?: string; durationMinutes?: number }> }) => {
    const { turn, optedOut } = plan;
    const removeLinks = (text: string) => text.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s)]+/g, '$1').trim();
    if (turn.stage === 1) {
      const modelQuestion = modelAnswer && removeLinks(modelAnswer.reply);
      const usableQuestion = modelQuestion?.includes('?') && !/예약|링크|패널|바로가기/.test(modelQuestion);
      return {
        reply: usableQuestion && turn.topic !== 'career-choice' ? modelQuestion : fallbackClarification(plan),
        supportType: '고민 정리', suggestedAction: '', guidedTurn: turn,
      };
    }

    const guide = guidedConcern(plan.text, [], profile, profile.energyLevel, turns, profile.availableMinutes);
    const fallback = fallbackNextStep(plan, turns.at(-1)?.suggestedAction);
    const modelReply = removeLinks(modelAnswer?.reply ?? '');
    const closing = turn.stage === 3 && !optedOut && !fallback
      ? '오늘은 아래 행동 하나부터 해봐요. 해본 뒤 어떤 점이 쉬웠거나 어려웠는지 돌아보면 다음 단계에 도움이 돼요.' : '';
    const responseText = (turn.stage !== 3 || !modelReply.includes('?') ? modelReply : '') || fallback?.reply || closing || guide.reply;
    const refinedAction = removeLinks(modelAnswer?.suggestedAction ?? '') || fallback?.action || guide.smallAction;
    const maxMinutes = Math.max(5, Math.min(20, Number(profile.availableMinutes) || 20));
    const suggestedAction = optedOut || /예약 버튼|아래 링크/.test(refinedAction) ? '' : refinedAction;
    const proposedTask = modelAnswer?.suggestedTasks?.[0];
    const task = suggestedAction ? [{
      title: removeLinks(proposedTask?.title || suggestedAction),
      cadence: 'daily',
      dayLabel: '오늘',
      durationMinutes: Math.max(5, Math.min(maxMinutes, Number(proposedTask?.durationMinutes) || (Number(profile.energyLevel) <= 2 ? 5 : 10))),
    }] : [];

    const { preview } = plan;
    const programs = preview?.kind === 'programs'
      ? previewPrograms(plan, (await loadPrograms(profile.demoMode === true ? undefined : req.env.YOUTH_JOB_API_KEY)).programs, profile)
      : [];
    const hasPreview = preview && (preview.kind !== 'programs' || programs.length > 0);
    const previewHint = hasPreview
      ? preview.kind === 'career' ? ` ${preview.region ? preview.region + ' ' : ''}청년 지원 정보와 온통청년 진로 상담 안내를 오른쪽에 열어둘게요.`
        : preview.kind === 'wellbeing' ? ' 지역별 마음건강 상담기관 정보를 오른쪽에 열어둘게요.'
          : ' 확인한 공식 프로그램 정보는 오른쪽에서 살펴볼 수 있어요.'
      : preview?.kind === 'programs' ? ' 지금 조건과 연결되는 프로그램을 확인하지 못했어요. 관심 분야나 참여 조건을 다시 확인해 보세요.' : '';

    return {
      reply: responseText + previewHint,
      supportType: modelAnswer?.supportType || '기본 안내',
      suggestedAction,
      guidedTurn: turn,
      preview: hasPreview ? preview : undefined,
      recommendedPrograms: programs,
      extractedWorry: optedOut ? undefined : modelAnswer?.extractedWorry ?? guide.extractedWorry,
      suggestedTasks: task,
    };
  };

  if (profile.demoMode === true) return res.json(await formatResponse());

  try {
    const ai = getAiClient(req.env);
    const recentTurns = turns
      .slice(-6)
      .map((m) => `${m.role === 'user' ? '청년' : 'TOGRO'}: ${m.content}`)
      .join('\n');

    const prompt = `
[사용자 현재 컨텍스트]
${JSON.stringify(profile, null, 2)}

[대화 단계]
${plan.turn.stage}턴 · ${plan.turn.topic}

[최근 대화]
${recentTurns || '없음'}

[방금 입력한 메시지]
${message.trim()}
`.trim();

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: req.env.GEMINI_MODEL || MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `당신은 청년의 일상 회복과 진로 성장을 돕는 AI 성장 동반 에이전트 'TOGRO'입니다.
${CONVERSATION_GUIDANCE}
대화는 고민별로 최대 세 번의 응답으로 진행합니다. 1턴에는 사용자가 이미 말한 상황을 반영해 짧게 공감한 다음 아직 모르는 핵심을 좁히는 질문을 딱 하나 던지세요. 이때 suggestedAction은 빈 문자열로 두고, 프로그램, 예약, 링크, 패널을 안내하지 마세요. 2턴에는 방금 받은 답을 근거로 바로 할 수 있는 행동 하나를 제안하세요. 3턴에는 사용자의 선택을 반영해 행동 하나로 간단히 정리하고 추가 질문 없이 마무리하세요. 운영기관, 지원 자격, 신청 정보와 외부 링크는 서비스가 공식 출처에서 가져오므로 모델은 만들거나 반복하지 않습니다. 참여나 가입을 유도하지 마세요.
핵심 원칙:
1. 처음부터 거창한 취업 목표나 이력서·자기소개서·포트폴리오 작성을 강요하거나 제안하지 마세요. 청년이 느끼는 막막함·지침·부담을 있는 그대로 존중하고 따뜻하지만 담백하게 공감하세요.
2. 이력서 작성/첨삭, 자기소개서 작성/첨삭, 포트폴리오 생성, 역량 카드 기능은 제공하지 않으므로 해당 기능을 안내하지 마세요.
3. 의학적·심리학적 진단을 내리지 마세요. 대신 일상에서 오늘 당장 10~20분 안에 시도할 수 있는 현실적이고 작은 행동을 함께 제안하세요.
4. 사용자의 상태를 파악해 가장 알맞은 지원 유형(supportType)을 분류하고, 대화 속에서 새로운 고민이 보이면 extractedWorry를, 바로 실행해 볼 수 있는 작은 목표가 도출되면 suggestedTasks(최대 3개)를 함께 제안하세요.
5. 한국어로 자연스럽고 존중하는 해요체를 사용하세요. 막연한 휴식 권유만 반복하지 말고 사용자가 막힌 구체적인 단계와 그 단계에서 확인할 질문이나 행동을 제안하세요. 진로·취업 상담이 관련되면 실제 상담에서 함께 정리할 주제를 말하고 URL은 작성하지 마세요. 사용자가 해결하고 싶은 일을 분명히 말했다면 그 내용을 먼저 해결하는 계획을 제시하고 이미 준 정보를 다시 묻지 마세요. 바로 앞 대화와 이어지는 시간이나 방해 요인은 계획에 반영하세요.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: '사용자에게 건네는 공감과 현실적인 안내 메시지 (3~5문장)',
              },
              supportType: {
                type: Type.STRING,
                description: '일상 회복 지원, 고민 정리, 작은 목표 설계, 공공지원 연결 중 하나',
              },
              suggestedAction: {
                type: Type.STRING,
                description: '지금 바로 시도해 볼 수 있는 한 줄 제안',
              },
              extractedWorry: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    description: '진로 방향, 생활 리듬, 역량 부족, 심리적 부담, 경제·생활, 정보 탐색 중 하나',
                  },
                  nextStep: { type: Type.STRING },
                },
                required: ['title', 'category', 'nextStep'],
              },
              suggestedTasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    cadence: { type: Type.STRING, description: 'daily 또는 weekly' },
                    dayLabel: { type: Type.STRING },
                    durationMinutes: { type: Type.INTEGER },
                  },
                  required: ['title', 'cadence', 'dayLabel', 'durationMinutes'],
                },
              },
            },
            required: ['reply', 'supportType', 'suggestedAction'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim());
    if (typeof parsed?.reply !== 'string' || !parsed.reply.trim()
      || typeof parsed.suggestedAction !== 'string') {
      throw new Error('Empty companion answer');
    }
    return res.json(await formatResponse(parsed));
  } catch {
    return res.json(await formatResponse());
  }
});

// 2. Daily Check-in Non-Medical Self-Care Suggestion
app.post('/api/checkin/advice', async (req, res) => {
  const input = req.body as CheckinAdviceInput;
  const { moodLabel, moodScore, energyLevel, availableMinutes, reflection } = input;
  if (!Number.isFinite(energyLevel) || !Number.isFinite(moodScore) || typeof moodLabel !== 'string' || !moodLabel.trim()) {
    return res.status(400).json({ error: '체크인 기분과 에너지 점수를 입력해 주세요.' });
  }
  if (reflection != null && typeof reflection !== 'string') {
    return res.status(400).json({ error: '체크인 메모의 형식이 올바르지 않아요.' });
  }
  const defaultAdvice: CheckinAdviceResult = { selfCareSuggestion: buildCheckinSuggestion(input), source: 'checkin' };
  if (!req.env.GEMINI_API_KEY?.trim() || req.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
    return res.json(defaultAdvice);
  }

  try {
    const ai = getAiClient(req.env);
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: req.env.GEMINI_MODEL || MODEL_NAME,
        contents: `감정 상태: ${moodLabel} (점수 ${moodScore}/5), 에너지 수준: ${energyLevel}/5, 오늘 사용 가능한 시간: ${
          typeof availableMinutes === 'number' ? `${availableMinutes}분` : '미입력'
        }, 오늘의 메모: ${reflection || '별도 메모 없음'}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `당신은 청년의 일상을 살피는 'TOGRO'입니다.
사용자가 직접 기록한 감정, 에너지, 오늘 사용 가능한 시간과 메모에 적힌 할 일을 바탕으로 의학적·임상적 진단이나 처방 없이, 오늘 하루 무리하지 않고 실천할 수 있는 따뜻한 자기관리 행동 1~2가지를 2~3문장으로 제안해 주세요.
사용 가능한 시간이 짧거나(예: 10~20분) 에너지가 낮다면 쉬어가거나 아주 작은 루틴(물 마시기, 10분 환기, 짧은 메모 등)을 권하고, 의욕이 있다면 메모에 적힌 일을 시작할 첫 단계를 주세요. 메모에 구체적인 일이 있다면 그중 한 가지에 대해 오늘 바로 시작할 행동과 끝내는 기준을 제안하세요.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              selfCareSuggestion: { type: Type.STRING },
            },
            required: ['selfCareSuggestion'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as { selfCareSuggestion?: unknown } | null;
    const suggestion = typeof parsed?.selfCareSuggestion === 'string'
      ? parsed.selfCareSuggestion.trim().slice(0, FIELD_LIMITS.selfCareMax)
      : '';
    return res.json(suggestion ? { selfCareSuggestion: suggestion, source: 'gemini' } satisfies CheckinAdviceResult : defaultAdvice);
  } catch {
    return res.json(defaultAdvice);
  }
});

// 3. Worry Analysis & Next Tiny Step
app.post('/api/worry/analyze', async (req, res) => {
  try {
    const { title, description, category } = req.body as {
      title: string;
      description?: string;
      category: string;
    };

    if (!title || !title.trim()) {
      return res.status(400).json({ error: '고민 제목을 입력해 주세요.' });
    }

    const ai = getAiClient(req.env);
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: req.env.GEMINI_MODEL || MODEL_NAME,
        contents: `분류: ${category}\n제목: ${title}\n세부 내용: ${description || '없음'}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `사용자가 등록한 고민을 담백하게 구조화해 정리(aiSummary, 2~3문장)하고, 오늘이나 내일 15분 내에 해볼 수 있는 부담 없는 첫 행동(nextStep, 1문장)을 제안하세요. 과장하거나 의학적 진단을 내리지 마세요.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              aiSummary: { type: Type.STRING },
              nextStep: { type: Type.STRING },
            },
            required: ['aiSummary', 'nextStep'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return res.json(parsed);
  } catch {
    const guide = guidedConcern([req.body.title, req.body.description, req.body.category].filter(Boolean).join(' '), [], {});
    return res.json({ aiSummary: '기본 안내 · ' + guide.reply, nextStep: guide.smallAction });
  }
});

// 4. Context-Aware Personalized Small Growth Roadmap Generation
app.post('/api/roadmap/generate', async (req, res) => {
  const { goalType, focusText, latestCheckin, recentTasks7Days, activeRoadmaps, activeWorries } = req.body;
  if (typeof focusText !== 'string' || !focusText.trim()) {
    return res.status(400).json({ error: '원하는 목표나 상황을 입력해 주세요.' });
  }
  const category = (goalType ?? '사용자 직접 설정') as GoalType;
  const plan = getRoadmapPlan(category);
  if (!plan) return res.status(400).json({ error: '목표 유형을 다시 선택해 주세요.' });

  const focus = focusText.trim().slice(0, 400).replace(/\s+/g, ' ');
  const period = String(req.body.timeframe);
  const timeframe = Object.hasOwn(roadmapPeriods, period) ? period as keyof typeof roadmapPeriods : '이번 주 (7일)';
  const todayDate = safeDate(req.body.todayDate);
  const energyLevel = Math.min(5, Math.max(1, Math.round(Number(req.body.energyLevel) || 3)));
  const todayCheckin = !latestCheckin?.checkinDate || latestCheckin.checkinDate === todayDate ? latestCheckin : null;
  const availableMinutes = Math.min(480, Math.max(5, Math.floor(Number(todayCheckin?.availableMinutes) || 20)));
  const preview = roadmapPreview(category, timeframe, focus, todayDate, energyLevel, availableMinutes, plan);

  if (req.env.GEMINI_API_KEY?.trim() && req.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = getAiClient(req.env);
      const response = await withRetry(() => ai.models.generateContent({
        model: req.env.GEMINI_MODEL || MODEL_NAME,
        contents: JSON.stringify({
          category, focus, timeframe, todayDate, energyLevel, latestCheckin, availableMinutes,
          recentTasks7Days: Array.isArray(recentTasks7Days) ? recentTasks7Days.slice(0, 20) : [],
          activeRoadmaps: Array.isArray(activeRoadmaps) ? activeRoadmaps.slice(0, 8) : [],
          activeWorries: Array.isArray(activeWorries) ? activeWorries.slice(0, 8) : [],
        }),
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `TOGRO의 성장 로드맵을 설계하세요. 선택한 목표 유형과 입력한 목표를 함께 반영하세요.
이 유형의 실천 방향은 다음과 같습니다. ${plan.summary}
참고할 단계는 ${preview.tasks.map(task => task.title).join(' → ')}입니다. 예시 문구를 그대로 반복하지 말고 입력 목표에 맞는 구체적인 행동과 완료 기준을 한국어 해요체로 작성하세요.
선택 기간과 현재 여력을 고려해 ${timeframe === '오늘 하루' ? preview.tasks.length + '개' : '3~5개'}의 순서 있는 실천 항목을 작성하세요. 날짜는 서버에서 배정합니다.
추천 이유에는 실제 입력된 정보만 사용하세요. 이력서, 자기소개서, 포트폴리오 작성이나 첨삭은 제안하지 마세요.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              recommendationReason: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY, minItems: preview.tasks.length, maxItems: timeframe === '오늘 하루' ? preview.tasks.length : 5,
                items: {
                  type: Type.OBJECT,
                  properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                  required: ['title', 'description'],
                },
              },
            },
            required: ['summary', 'recommendationReason', 'tasks'],
          },
        },
      }));
      const parsed: { summary?: unknown; recommendationReason?: unknown; tasks?: unknown } | null = JSON.parse(response.text ?? 'null');
      const summary = typeof parsed?.summary === 'string' ? parsed.summary.trim() : '';
      const reason = typeof parsed?.recommendationReason === 'string' ? parsed.recommendationReason.trim() : '';
      if (parsed && summary && reason && Array.isArray(parsed.tasks) && parsed.tasks.length >= preview.tasks.length && parsed.tasks.length <= 5) {
        const steps = parsed.tasks.flatMap((step: unknown) => {
          const item = step as { title?: unknown; description?: unknown } | null;
          const title = typeof item?.title === 'string' ? item.title.trim().slice(0, FIELD_LIMITS.taskTitleMax) : '';
          const description = typeof item?.description === 'string' ? item.description.trim().slice(0, FIELD_LIMITS.taskDescriptionMax) : '';
          return title && description ? [{ title, description }] : [];
        });
        if (steps.length === parsed.tasks.length && new Set(steps.map(step => step.title)).size === steps.length) {
          return res.json({
            ...preview,
            summary: summary.slice(0, FIELD_LIMITS.roadmapSummaryMax),
            recommendationReason: reason,
            tasks: scheduleRoadmapSteps(steps, todayDate, roadmapPeriods[timeframe], energyLevel, availableMinutes),
          });
        }
      }
    } catch {
      // Keep goal-specific plans available when the model is unavailable.
    }
  }
  return res.json(preview);
});

// 4-b. Context & 7-Day Record-Based Daily Recommendation / Adjustment Preview
app.post('/api/roadmap/daily-goals', async (req, res) => {
  const { todayDate, latestCheckin, activeTasks, activeRoadmaps, recentTasks7Days, activeWorries, demo } = req.body;
  const date = safeDate(todayDate);
  const minutes = Math.min(480, Math.max(5, Math.floor(Number(latestCheckin?.availableMinutes) || 20)));
  const lowEnergy = Number(latestCheckin?.energyLevel) <= 2;
  const limit = Math.min(DAILY_GOAL_LIMIT, Math.floor(minutes / 5), lowEnergy ? 1 : DAILY_GOAL_LIMIT);
  const tasks = Array.isArray(activeTasks) ? activeTasks.filter((item) =>
    typeof item?.title === 'string' && item.title.trim() && !item.completed && item.status !== '완료' && item.status !== '건너뛰기',
  ).slice(0, 20) : [];
  const roadmaps = Array.isArray(activeRoadmaps) ? activeRoadmaps.slice(0, 8) : [];
  const worries = Array.isArray(activeWorries) ? activeWorries.slice(0, 6) : [];
  const recent = Array.isArray(recentTasks7Days) ? recentTasks7Days.slice(0, 20) : [];

  const fitToday = (items: unknown[]): DailyGoal[] => {
    const goals: DailyGoal[] = [];
    const seen = new Set<string>();
    let remaining = minutes;
    for (const item of items) {
      if (goals.length >= limit || remaining < 5) break;
      const candidate = item as Partial<DailyGoal> | null;
      if (typeof candidate?.title !== 'string') continue;
      const title = candidate.title.trim().slice(0, FIELD_LIMITS.taskTitleMax);
      const key = title.toLowerCase().replace(/\s+/g, ' ');
      if (!key || seen.has(key)) continue;
      const description = typeof candidate.description === 'string' ? candidate.description.trim().slice(0, FIELD_LIMITS.taskDescriptionMax) : '';
      const durationMinutes = Math.min(40, remaining, Math.max(5, Math.round(Number(candidate.durationMinutes) || 5)));
      goals.push({ title, description, durationMinutes });
      seen.add(key);
      remaining -= durationMinutes;
    }
    return goals;
  };

  if (demo !== true && req.env.GEMINI_API_KEY?.trim() && req.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = getAiClient(req.env);
      const response = await withRetry(() => ai.models.generateContent({
        model: req.env.GEMINI_MODEL || MODEL_NAME,
        contents: JSON.stringify({ date, latestCheckin, tasks, roadmaps, recent, worries }),
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `당신은 TOGRO 에이전트입니다. 체크인, 현재 실천과 최근 기록으로 오늘 해볼 서로 다른 목표를 1~${limit}개 추천하세요. 총 시간은 ${minutes}분 이내, 각 행동은 5~40분입니다. 내용이 부족하거나 여력이 낮으면 한 가지면 충분합니다. 구체적인 행동과 끝내는 기준을 제시하세요. 입력에 없는 사실을 단정하거나 로드맵 변경을 지시하지 마세요.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY, minItems: 1, maxItems: limit,
            items: {
              type: Type.OBJECT,
              properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, durationMinutes: { type: Type.INTEGER } },
              required: ['title', 'description', 'durationMinutes'],
            },
          },
        },
      }));
      const parsed: unknown = JSON.parse(response.text ?? 'null');
      const suggestions = Array.isArray(parsed) ? fitToday(parsed) : [];
      if (suggestions.length) return res.json({ suggestions, source: 'gemini' } satisfies DailyGoalsResult);
    } catch {
      // Keep daily goals available when the model is unavailable.
    }
  }

  const durationMinutes = Math.min(10, Math.floor(minutes / limit));
  const focus = roadmaps[0]?.title ?? worries[0]?.title;
  const suggestions = fitToday([
    ...tasks.map((task) => ({
      title: `${task.title.trim().slice(0, 145)}: 첫 단계 시작하기`,
      description: '첫 행동 하나를 시작하고, 어디까지 했는지 한 줄로 남겨 보세요.',
      durationMinutes,
    })),
    ...(typeof focus === 'string' && focus.trim() ? [{
      title: `${focus.trim().slice(0, 145)}: 가능한 행동 한 가지 적기`,
      description: '지금 가진 시간으로 시작할 수 있는 첫 행동을 한 문장으로 적어 보세요.',
      durationMinutes,
    }] : []),
    { title: '오늘 일정에서 한 가지 우선순위 정하기', description: '오늘 할 일 중 하나에 표시하고 시작할 시간을 정해 보세요.', durationMinutes },
    { title: '짧게 쉬고 컨디션 다시 살피기', description: '잠깐 자리를 옮겨 쉬고 지금 에너지가 어떤지 확인해 보세요.', durationMinutes },
    { title: '오늘 해낸 일 한 줄 남기기', description: '작더라도 실제로 해낸 일을 한 줄 적어 보세요.', durationMinutes },
  ]);
  return res.json({ suggestions, source: 'checkin' } satisfies DailyGoalsResult);
});

app.post('/api/roadmap/daily-recommendations', async (req, res) => {
  try {
    const {
      todayDate = new Date().toISOString().slice(0, 10),
      latestCheckin = null,
      recentTasks7Days = [],
      activeRoadmaps = [],
      activeTasks = [],
      activeWorries = [],
    } = req.body as {
      todayDate?: string;
      latestCheckin?: {
        moodLabel?: string;
        moodScore?: number;
        energyLevel?: number;
        availableMinutes?: number;
        reflection?: string;
        checkinDate?: string;
      } | null;
      recentTasks7Days?: Array<{
        id?: string;
        roadmapId?: string;
        roadmapTitle?: string;
        title: string;
        status?: string;
        completed?: boolean;
        durationMinutes?: number;
        scheduledDate?: string;
        blockerNote?: string;
      }>;
      activeRoadmaps?: Array<{
        id: string;
        title: string;
        goalType: string;
        timeframe: string;
        progressPercent: number;
        status: string;
      }>;
      activeTasks?: Array<{
        id: string;
        roadmapId: string;
        roadmapTitle: string;
        title: string;
        description?: string;
        status?: string;
        completed: boolean;
        durationMinutes: number;
        scheduledDate?: string;
        dayLabel: string;
        cadence: string;
      }>;
      activeWorries?: Array<{
        title: string;
        category: string;
        status: string;
      }>;
    };

    const ai = getAiClient(req.env);
    const prompt = `
[오늘 날짜]
${todayDate}

[오늘 또는 최근 체크인 상태]
${latestCheckin ? JSON.stringify(latestCheckin, null, 2) : '체크인 기록 없음'}

[최근 7일 목표 수행 기록]
${recentTasks7Days.length ? JSON.stringify(recentTasks7Days.slice(0, 25), null, 2) : '최근 7일 수행 기록 없음'}

[현재 활성 로드맵]
${activeRoadmaps.length ? JSON.stringify(activeRoadmaps.slice(0, 8), null, 2) : '활성 로드맵 없음'}

[현재 미완료/진행 중 실천 항목]
${activeTasks.length ? JSON.stringify(activeTasks.slice(0, 20), null, 2) : '없음'}

[관련 고민]
${activeWorries.length ? JSON.stringify(activeWorries.slice(0, 6), null, 2) : '없음'}
`.trim();

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: req.env.GEMINI_MODEL || MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `당신은 청년의 일상 회복과 꾸준한 실행을 돕는 'TOGRO' 에이전트입니다.
사용자의 최근 체크인(감정, 에너지, 사용 가능 시간)과 최근 7일간의 목표 수행 기록(완료·미완료·건너뛰기 여부 및 중단 사유)을 분석하여 오늘을 위한 가장 적절한 전략 1가지를 제안하세요.

전략(strategy)은 반드시 다음 5가지 중 정확히 하나만 선택하세요:
- "기존 목표 유지"
- "목표 난이도 낮추기"
- "예상 소요시간 줄이기"
- "다른 날짜로 조정"
- "새로운 작은 목표 추천"

설계 지침:
1. 미완료가 연속되었거나 에너지가 낮고 가용 시간이 짧다면(예: 10~15분), 사용자를 절대 비난하거나 실패로 평가하지 말고 "목표 난이도 낮추기" 또는 "예상 소요시간 줄이기"로 오늘 가용 시간 내에 해낼 수 있는 아주 작은 행동을 제안하세요.
2. 기존 항목을 조정·유지·날짜 변경하는 경우 targetRoadmapId와 targetTaskId에 해당 기존 항목의 id를 정확히 넣고, 완전히 새로운 목표를 추천하거나 기존 로드맵에 추가하는 경우 targetTaskId는 빈 문자열("")로 두세요(대상 로드맵이 없으면 targetRoadmapId도 "").
3. proposedTask에는 오늘(또는 조정된 날짜) 실천할 구체적인 제목, 실행 설명(description), 예상 소요시간(durationMinutes), scheduledDate(YYYY-MM-DD), dayLabel, cadence('daily'|'weekly')를 명확히 채우세요.
4. recommendationReason에는 체크인·7일 기록에서 확인된 실제 맥락을 바탕으로 왜 이 전략을 추천하는지 따뜻하고 설득력 있게 2문장으로 설명하세요.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              strategy: { type: Type.STRING },
              recommendationReason: { type: Type.STRING },
              energyFitExplanation: { type: Type.STRING },
              targetRoadmapId: { type: Type.STRING },
              targetTaskId: { type: Type.STRING },
              proposedTask: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  cadence: { type: Type.STRING },
                  dayLabel: { type: Type.STRING },
                  durationMinutes: { type: Type.INTEGER },
                  scheduledDate: { type: Type.STRING },
                },
                required: ['title', 'description', 'cadence', 'dayLabel', 'durationMinutes', 'scheduledDate'],
              },
            },
            required: [
              'headline',
              'strategy',
              'recommendationReason',
              'energyFitExplanation',
              'targetRoadmapId',
              'targetTaskId',
              'proposedTask',
            ],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      headline?: string;
      strategy?: string;
      recommendationReason?: string;
      energyFitExplanation?: string;
      targetRoadmapId?: string;
      targetTaskId?: string;
      proposedTask?: {
        title?: string;
        description?: string;
        cadence?: string;
        dayLabel?: string;
        durationMinutes?: number;
        scheduledDate?: string;
      };
    };

    const allowedStrategies = [
      '기존 목표 유지',
      '목표 난이도 낮추기',
      '예상 소요시간 줄이기',
      '다른 날짜로 조정',
      '새로운 작은 목표 추천',
    ];
    const strategy = allowedStrategies.includes(parsed.strategy || '')
      ? parsed.strategy!
      : '목표 난이도 낮추기';

    if (!parsed.proposedTask?.title) {
      return res.status(502).json({
        error: 'AI 맞춤 추천 응답을 해석하지 못했습니다. 다시 시도해 주세요.',
      });
    }

    const scheduledDate =
      parsed.proposedTask.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.proposedTask.scheduledDate)
        ? parsed.proposedTask.scheduledDate
        : todayDate;

    return res.json({
      headline: String(parsed.headline || '오늘 컨디션에 맞춘 작은 실행 제안').trim(),
      strategy,
      recommendationReason: String(parsed.recommendationReason || '').trim(),
      energyFitExplanation: String(parsed.energyFitExplanation || '').trim(),
      targetRoadmapId: String(parsed.targetRoadmapId || '').trim(),
      targetTaskId: String(parsed.targetTaskId || '').trim(),
      proposedTask: {
        title: String(parsed.proposedTask.title).trim(),
        description: String(parsed.proposedTask.description || '').trim(),
        cadence: parsed.proposedTask.cadence === 'weekly' ? 'weekly' : 'daily',
        dayLabel: String(parsed.proposedTask.dayLabel || '오늘').trim(),
        durationMinutes: Math.min(
          180,
          Math.max(5, Math.round(Number(parsed.proposedTask.durationMinutes) || 10))
        ),
        scheduledDate,
      },
    });
  } catch {
    const { todayDate, latestCheckin, activeTasks, activeRoadmaps } = req.body;
    const pending = Array.isArray(activeTasks) ? activeTasks.find((task) => !task.completed && task.status !== '완료') : undefined;
    const current = pending ? suggestedMinutes({
      ...latestCheckin, availableMinutes: Math.min(Number(latestCheckin?.availableMinutes) || 20, Number(pending.durationMinutes) || 20),
    }) : suggestedMinutes(latestCheckin);
    return res.json({
      headline: '지금 할 수 있는 작은 행동',
      strategy: pending ? '목표 난이도 낮추기' : '새로운 작은 목표 추천',
      recommendationReason: '체크인과 실천 기록을 참고한 기본 제안이에요.',
      energyFitExplanation: '오늘은 부담을 줄여 ' + current + '분 동안 첫 단계만 해봐요.',
      targetRoadmapId: pending?.roadmapId ?? activeRoadmaps?.[0]?.id ?? '',
      targetTaskId: pending?.id ?? '',
      proposedTask: {
        title: pending ? String(pending.title).slice(0, 145) + '의 첫 단계 해보기' : '오늘 할 가장 작은 행동 하나 정하기',
        description: '준비하거나 시작하는 데 필요한 행동 한 가지를 골라보세요.',
        cadence: 'daily', dayLabel: '오늘', durationMinutes: current, scheduledDate: safeDate(todayDate),
      },
    });
  }
});

// 5. Flexible Roadmap Re-adjustment When a Task Feels Heavy
app.post('/api/roadmap/adjust', async (req, res) => {
  try {
    const {
      roadmapTitle,
      taskTitle,
      blockerNote,
      latestCheckin = null,
      recentTasks7Days = [],
    } = req.body as {
      roadmapTitle: string;
      taskTitle: string;
      blockerNote: string;
      latestCheckin?: {
        moodLabel?: string;
        energyLevel?: number;
        availableMinutes?: number;
      } | null;
      recentTasks7Days?: Array<{
        title: string;
        status?: string;
        completed?: boolean;
      }>;
    };

    if (!taskTitle || !blockerNote?.trim()) {
      return res.status(400).json({ error: '실천이 어려웠던 이유를 간단히 적어 주세요.' });
    }

    const ai = getAiClient(req.env);
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: req.env.GEMINI_MODEL || MODEL_NAME,
        contents: `
로드맵: ${roadmapTitle}
원래 목표 항목: ${taskTitle}
실천이 어려웠던 이유: ${blockerNote}
최근 체크인: ${latestCheckin ? JSON.stringify(latestCheckin) : '없음'}
최근 7일 수행 요약: ${recentTasks7Days.length ? JSON.stringify(recentTasks7Days.slice(0, 12)) : '없음'}
`.trim(),
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `청년이 목표를 완료하지 못했더라도 실패로 평가하지 마세요.
원인과 최근 컨디션·가용 시간을 함께 짚어주고(adjustmentReason, 2문장), 현재 상태에서도 부담 없이 해볼 수 있도록 난이도와 소요 시간을 낮춘 대안 목표(adjustedTitle, adjustedDescription, durationMinutes, dayLabel)를 1개 제안하세요.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              adjustmentReason: { type: Type.STRING },
              adjustedTitle: { type: Type.STRING },
              adjustedDescription: { type: Type.STRING },
              durationMinutes: { type: Type.INTEGER },
              dayLabel: { type: Type.STRING },
            },
            required: ['adjustmentReason', 'adjustedTitle', 'adjustedDescription', 'durationMinutes', 'dayLabel'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return res.json(parsed);
  } catch {
    const { taskTitle, latestCheckin } = req.body;
    return res.json({
      adjustmentReason: '한 번에 해야 할 양을 줄인 기본 제안이에요.',
      adjustedTitle: String(taskTitle).slice(0, 145) + '의 첫 단계 시도하기',
      adjustedDescription: '어려웠던 부분을 건너뛰고, 지금 할 수 있는 가장 작은 단계부터 해보세요.',
      durationMinutes: suggestedMinutes(latestCheckin), dayLabel: '오늘',
    });
  }
});

// 6. Verified Public Employment & Youth Support Programs Directory + Worry Recommendation Engine
// 7. Worry Personalized Recommended Questions (3 contextual questions)
app.post('/api/worry/recommended-questions', async (req, res) => {
  try {
    const {
      userProfile = {},
      latestCheckin = null,
      recentWorries = [],
      excludeQuestions = [],
      refreshSeed = 0,
    } = req.body as {
      userProfile?: {
        nickname?: string;
        age?: number;
        ageGroup?: string;
        jobPrepStatus?: string;
        region?: string;
        interests?: string[];
      };
      latestCheckin?: {
        moodLabel?: string;
        energyLevel?: number;
        availableMinutes?: number;
      } | null;
      recentWorries?: Array<{ title?: string; category?: string }>;
      excludeQuestions?: string[];
      refreshSeed?: number;
    };

    const ai = getAiClient(req.env);
    const prompt = `
[사용자 정보]
- 별명: ${userProfile.nickname || '청년'}
- 나이/연령대: ${userProfile.age ? `만 ${userProfile.age}세` : userProfile.ageGroup || '미입력'}
- 현재 취업 준비 상황: ${userProfile.jobPrepStatus || '탐색 중'}
- 거주·활동 지역: ${userProfile.region || '전국'}
- 관심 분야: ${Array.isArray(userProfile.interests) && userProfile.interests.length ? userProfile.interests.join(', ') : '미입력'}
- 최근 컨디션 체크인: ${latestCheckin ? `${latestCheckin.moodLabel} (에너지 ${latestCheckin.energyLevel}/5, 가용시간 ${latestCheckin.availableMinutes ?? 20}분)` : '기록 없음'}
- 기존 등록 고민 요약: ${recentWorries.length ? recentWorries.slice(0, 5).map((w) => w.title).join(' / ') : '없음'}
- 이번에 제외할 이전 질문: ${excludeQuestions.length ? excludeQuestions.join(' | ') : '없음'}
- 다양성 시드: ${refreshSeed}
`.trim();

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: req.env.GEMINI_MODEL || MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `당신은 청년 성장 지원 에이전트 'TOGRO'입니다.
사용자의 나이, 현재 취업 준비 상황, 컨디션 체크인을 고려하여 '나의 고민' 채팅에서 사용자가 부담 없이 바로 눌러 물어볼 수 있는 현실적인 고민 질문 3개를 생성하세요.

절대 준수 원칙:
1. 정확히 3개의 서로 다른 주제(예: 진로 방향/직무 선택, 직무 역량·경험·지원사업 찾기, 취업 준비 비용 부담·심리적 스트레스 등)의 질문을 만드세요.
2. 이력서 첨삭, 자기소개서 작성, 포트폴리오 생성을 요청하거나 암시하는 질문은 절대 만들지 마세요. (사용자가 '입사지원서·이력서 작성 중' 상태이더라도, 서류 작성 도구가 아니라 막막함·경험 정리 방향·일경험/훈련/수당 지원 프로그램·컨디션 관리 관점의 질문을 만드세요.)
3. excludeQuestions에 포함된 질문과 중복되지 않도록 새로운 각도로 자연스러운 1인칭 한국어 문장(20~55자 이내)으로 작성하세요.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['questions'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as { questions?: string[] };
    const forbiddenRe = /이력서|자기소개서|자소서|포트폴리오|역량\s*카드/;
    const cleaned = (Array.isArray(parsed.questions) ? parsed.questions : [])
      .map((q) => String(q || '').trim())
      .filter((q) => q.length >= 6 && !forbiddenRe.test(q) && !excludeQuestions.includes(q))
      .slice(0, 3);

    if (cleaned.length < 3) {
      return res.status(502).json({
        error: '맞춤형 추천 질문을 충분히 생성하지 못했습니다. 다시 추천받기를 눌러 주세요.',
      });
    }

    return res.json({ questions: cleaned });
  } catch {
    const { userProfile = {}, recentWorries, latestCheckin, excludeQuestions, refreshSeed } = req.body;
    return res.json({ questions: guidedQuestions(userProfile ?? {}, recentWorries, latestCheckin?.energyLevel, excludeQuestions, refreshSeed) });
  }
});

// 8. Worry Analysis + Grounded Support Program Recommendation Chat
app.post('/api/worry/chat', async (req, res) => {
  const catalog = await loadPrograms(req.env.YOUTH_JOB_API_KEY);
  const { programs, ...apiMeta } = catalog;
  try {
    const {
      message,
      history = [],
      userProfile = {},
      latestCheckin = null,
    } = req.body as {
      message?: string;
      history?: Array<{ role: string; content: string }>;
      userProfile?: {
        nickname?: string;
        age?: number;
        ageGroup?: string;
        jobPrepStatus?: string;
        region?: string;
        interests?: string[];
      };
      latestCheckin?: {
        moodLabel?: string;
        energyLevel?: number;
        availableMinutes?: number;
      } | null;
    };

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: '고민 내용을 입력해 주세요.' });
    }

    const userRegion = typeof userProfile.region === 'string' ? userProfile.region.trim() : '';
    const personalSupport = personalSupportContext(message, history);
    const candidates = personalSupport ? [] : programsForProfile(programs, userProfile);
    const counselingBooking = careerCounselingBooking(message, history);
    const candidateCatalog = candidates.map((p) => ({
      programId: p.programId,
      title: p.title,
      provider: p.provider,
      region: p.region,
      category: p.category,
      summary: p.summary,
      eligibility: p.eligibility,
      recruitmentStatus: p.recruitmentStatus,
      worryThemes: p.worryThemes,
    }));

    const recentTurns = history
      .slice(-6)
      .map((m) => `${m.role === 'user' ? '청년' : 'TOGRO'}: ${m.content}`)
      .join('\n');

    const ai = getAiClient(req.env);
    const prompt = `
[사용자 프로필]
- 별명: ${userProfile.nickname || '청년'}
- 나이: ${userProfile.age ? `만 ${userProfile.age}세` : userProfile.ageGroup || '미입력'}
- 현재 취업 준비 상황: ${userProfile.jobPrepStatus || '미입력'}
- 거주·활동 지역: ${userRegion || '미입력'}
- 관심 분야: ${Array.isArray(userProfile.interests) && userProfile.interests.length ? userProfile.interests.join(', ') : '미입력'}
- 최근 컨디션 체크인: ${latestCheckin ? `${latestCheckin.moodLabel} (에너지 ${latestCheckin.energyLevel}/5, 가용시간 ${latestCheckin.availableMinutes ?? 20}분)` : '미기록'}

[이전 대화]
${recentTurns || '없음'}

[청년의 현재 고민 입력]
${message.trim()}

[검증된 공공·청년 지원 프로그램 목록 (이 목록 외의 프로그램은 절대 생성 금지)]
${JSON.stringify(candidateCatalog, null, 2)}
`.trim();

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: req.env.GEMINI_MODEL || MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `당신은 청년의 고민을 정리하고 현실적인 작은 행동과 검증된 공공 지원 프로그램을 연결해 주는 AI 성장 에이전트 'TOGRO'입니다.
${CONVERSATION_GUIDANCE}

핵심 처리 흐름:
1. 사용자의 고민을 공감하되 과장 없이 분석하고, 지금 상황·여력에 맞춰 오늘 10~20분 안에 시도할 수 있는 현실적인 작은 행동(smallAction)을 제안하세요. 막연한 휴식 권유 대신 사용자가 막힌 단계와 그 단계에서 확인할 질문이나 행동을 구체화하세요.
2. 이력서·자기소개서·포트폴리오·역량 카드 기능은 제공하지 않으므로 해당 기능을 권하거나 생성하지 마세요. 의학적·심리학적 진단을 내리지 마세요.
3. 지원 프로그램 추천 원칙 (사실성 및 환각 방지 최우선):
   - 반드시 [검증된 공공·청년 지원 프로그램 목록] 안에 실제로 존재하는 programId 중에서만 최대 3개를 선택하세요. 목록에 없는 프로그램 이름, 기관명, 지원금액, 마감일, URL을 절대 만들어내지 마세요.
   - 지역 필터(예: 서울이 아닌 지역 거주자에게 서울 전용 사업을 무리하게 추천하지 않음; 전국 사업은 누구에게나 가능)와 연령·고민 주제(진로 고민 / 취업 준비 비용 부담 / 직무 역량 부족 / 취업 경험 부족 / 취업 준비 스트레스 등)에 맞는지 점검하세요.
   - 소득·졸업 여부·미취업 기간 등 입력 정보만으로 확인 불가능한 자격 요건이 있으면 conditionNote에 반드시 '추가 확인 필요 조건(예: 소득·재산 또는 최근 미취업 기간 확인 필요) — 신청 가능 여부 확인 필요'를 명시하세요.
   - 조건에 맞는 프로그램이 하나도 없다고 판단되면 selectedPrograms를 빈 배열([])로 두고 noMatchGuidance에 검색·지역·조건을 어떻게 넓히면 좋을지 안내하세요.
4. 대화 속에서 구체적인 고민이 드러나면 extractedWorry(title, category, nextStep)도 함께 정리해 주세요. 지원 프로그램을 찾는 대화가 아니면 selectedPrograms를 빈 배열로 두고 noMatchGuidance를 생략하세요.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: '청년의 고민에 대한 공감, 핵심 원인 정리, 현실적 조언 (3~5문장, 해요체)',
              },
              problemType: {
                type: Type.STRING,
                description: '진로 고민, 취업 준비 비용 부담, 직무 역량 부족, 취업 경험 부족, 취업 준비 스트레스, 생활 리듬 중 가장 가까운 1~2개 분류',
              },
              smallAction: {
                type: Type.STRING,
                description: '오늘 바로 부담 없이 실행할 수 있는 10~20분 작은 행동 1문장',
              },
              extractedWorry: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    description: '진로 방향, 생활 리듬, 역량 부족, 심리적 부담, 경제·생활, 정보 탐색 중 하나',
                  },
                  nextStep: { type: Type.STRING },
                },
                required: ['title', 'category', 'nextStep'],
              },
              selectedPrograms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    programId: { type: Type.STRING },
                    recommendationReason: {
                      type: Type.STRING,
                      description: '이 고민과 현재 상황에 왜 맞는지 1~2문장 설명',
                    },
                    conditionNote: {
                      type: Type.STRING,
                      description: '모집 상태 또는 추가 확인 필요 조건(소득/거주지/미취업기간 등) 명시',
                    },
                  },
                  required: ['programId', 'recommendationReason', 'conditionNote'],
                },
              },
              noMatchGuidance: {
                type: Type.STRING,
                description: 'selectedPrograms가 비어 있을 때 검색 조건 조정 안내 메시지',
              },
            },
            required: ['reply', 'problemType', 'smallAction', 'selectedPrograms'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      reply?: string;
      problemType?: string;
      smallAction?: string;
      extractedWorry?: { title?: string; category?: string; nextStep?: string };
      selectedPrograms?: Array<{
        programId?: string;
        recommendationReason?: string;
        conditionNote?: string;
      }>;
      noMatchGuidance?: string;
    };

    if (typeof parsed.reply !== 'string' || !parsed.reply.trim() || typeof parsed.smallAction !== 'string') throw new Error('Invalid model output');

    const verifiedMap = new Map(candidates.map((p) => [p.programId, p]));
    const seenIds = new Set<string>();
    const recommendedPrograms = (Array.isArray(parsed.selectedPrograms) ? parsed.selectedPrograms : [])
      .map((sel) => {
        const pid = String(sel.programId || '').trim();
        const verified = verifiedMap.get(pid);
        if (!verified || seenIds.has(pid)) return null;
        seenIds.add(pid);
        return asRecommendation(verified, message,
          sel.recommendationReason || '고민 정리에 참고할 수 있는 공식 프로그램이에요.');
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 3);

    const allowedWorryCategories = [
      '진로 방향',
      '생활 리듬',
      '역량 부족',
      '심리적 부담',
      '경제·생활',
      '정보 탐색',
    ];
    const extractedWorry =
      parsed.extractedWorry?.title && parsed.extractedWorry.nextStep
        ? {
            title: String(parsed.extractedWorry.title).trim().slice(0, 140),
            category: allowedWorryCategories.includes(parsed.extractedWorry.category || '')
              ? parsed.extractedWorry.category!
              : '정보 탐색',
            nextStep: String(parsed.extractedWorry.nextStep).trim().slice(0, 300),
          }
        : undefined;

    return res.json({
      reply: String(parsed.reply || '고민을 편하게 들려주셔서 고맙습니다.').trim(),
      problemType: String(parsed.problemType || '진로·취업 고민').trim(),
      smallAction: parsed.smallAction.trim(),
      extractedWorry,
      recommendedPrograms,
      noMatchGuidance:
        !personalSupport && recommendedPrograms.length === 0
          ? String(parsed.noMatchGuidance || '').trim() || undefined
          : undefined,
      counselingBooking,
      apiMeta,
    });
  } catch {
    const { message, history, userProfile = {}, latestCheckin } = req.body;
    const profile = userProfile ?? {};
    const guide = guidedConcern(String(message ?? '').trim(), programsForProfile(programs, profile), profile, latestCheckin?.energyLevel, history, latestCheckin?.availableMinutes);
    return res.json({ ...guide, apiMeta });
  }
});

// 9. Public Employment & Youth Support Programs Directory
app.get('/api/programs', async (req, res) => {
  const regionFilter = typeof req.query.region === 'string' ? req.query.region.trim() : '';
  const categoryFilter = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const queryFilter = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  const { programs, liveApiConnected, externalApiError, apiStatusNote } =
    await loadPrograms(req.env.YOUTH_JOB_API_KEY);

  const filtered = programs.filter((p) => {
    if (regionFilter && regionFilter !== '전체' && !p.region.startsWith('전국') && !p.region.includes(regionFilter)) {
      return false;
    }
    if (categoryFilter && categoryFilter !== '전체' && p.category !== categoryFilter) {
      return false;
    }
    if (queryFilter) {
      const hay = `${p.title} ${p.provider} ${p.summary} ${p.region} ${p.category} ${p.worryThemes.join(' ')}`.toLowerCase();
      if (!hay.includes(queryFilter)) return false;
    }
    return true;
  });

  res.json({
    programs: filtered,
    meta: {
      liveApiConnected,
      externalApiError,
      apiStatusNote,
    },
  });
});

