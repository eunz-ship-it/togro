import type { CheckinAdviceInput, CheckinAdviceResult } from './checkinAdvice';
import type {
  AgentChatResponse,
  DailyGoalsResult,
  DailyRecommendationResult,
  GeneratedRoadmapPreview,
  GoalType,
  PublicProgram,
  WorryCategory,
  WorryChatResponse,
} from '../types/domain';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || '서버 요청 처리 중 오류가 발생했습니다.');
  }
  return data as T;
}

export function chatWithAgent(payload: {
  message: string;
  history: Array<{ role: string; content: string; supportType?: string; suggestedAction?: string }>;
  context: Record<string, unknown>;
}): Promise<AgentChatResponse> {
  return postJson<AgentChatResponse>('/api/agent/chat', payload);
}

export function fetchCheckinAdvice(payload: CheckinAdviceInput): Promise<CheckinAdviceResult> {
  return postJson<CheckinAdviceResult>('/api/checkin/advice', payload);
}

export function analyzeWorry(payload: {
  title: string;
  description: string;
  category: WorryCategory;
}): Promise<{ aiSummary: string; nextStep: string }> {
  return postJson<{ aiSummary: string; nextStep: string }>('/api/worry/analyze', payload);
}

export function generateRoadmap(payload: {
  goalType: GoalType;
  focusText: string;
  timeframe: string;
  energyLevel: number;
  todayDate?: string;
  latestCheckin?: {
    moodLabel: string;
    moodScore: number;
    energyLevel: number;
    availableMinutes?: number;
    reflection: string;
    checkinDate: string;
  } | null;
  recentTasks7Days?: Array<{
    title: string;
    status?: string;
    completed: boolean;
    durationMinutes: number;
    scheduledDate?: string;
    blockerNote?: string;
    roadmapTitle?: string;
  }>;
  activeRoadmaps?: Array<{
    title: string;
    goalType: string;
    progressPercent: number;
    status: string;
  }>;
  activeWorries?: Array<{
    title: string;
    category: string;
    status: string;
  }>;
}): Promise<GeneratedRoadmapPreview> {
  return postJson<GeneratedRoadmapPreview>('/api/roadmap/generate', payload);
}

export function fetchDailyRecommendations(payload: {
  todayDate?: string;
  latestCheckin?: {
    moodLabel: string;
    moodScore: number;
    energyLevel: number;
    availableMinutes?: number;
    reflection: string;
    checkinDate: string;
  } | null;
  recentTasks7Days?: Array<{
    id?: string;
    roadmapId?: string;
    roadmapTitle?: string;
    title: string;
    status?: string;
    completed: boolean;
    durationMinutes: number;
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
}): Promise<DailyRecommendationResult> {
  return postJson<DailyRecommendationResult>('/api/roadmap/daily-recommendations', payload);
}

export function fetchDailyGoals(payload: Pick<Parameters<typeof fetchDailyRecommendations>[0],
  'todayDate' | 'latestCheckin' | 'recentTasks7Days' | 'activeRoadmaps' | 'activeTasks' | 'activeWorries'> & { demo?: boolean }) {
  return postJson<DailyGoalsResult>('/api/roadmap/daily-goals', payload);
}

export function adjustRoadmapTask(payload: {
  roadmapTitle: string;
  taskTitle: string;
  blockerNote: string;
  latestCheckin?: {
    moodLabel: string;
    energyLevel: number;
    availableMinutes?: number;
  } | null;
  recentTasks7Days?: Array<{
    title: string;
    status?: string;
    completed: boolean;
  }>;
}): Promise<{
  adjustmentReason: string;
  adjustedTitle: string;
  adjustedDescription: string;
  durationMinutes: number;
  dayLabel: string;
}> {
  return postJson('/api/roadmap/adjust', payload);
}

export function fetchWorryRecommendedQuestions(payload: {
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
}): Promise<{ questions: string[] }> {
  return postJson<{ questions: string[] }>('/api/worry/recommended-questions', payload);
}

export function chatWorryWithRecommendations(payload: {
  message: string;
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
}): Promise<WorryChatResponse> {
  return postJson<WorryChatResponse>('/api/worry/chat', payload);
}

export async function fetchPrograms(params: {
  region?: string;
  category?: string;
  q?: string;
}): Promise<{
  programs: PublicProgram[];
  meta: { liveApiConnected: boolean; externalApiError?: string; apiStatusNote: string };
}> {
  const qs = new URLSearchParams();
  if (params.region) qs.set('region', params.region);
  if (params.category) qs.set('category', params.category);
  if (params.q) qs.set('q', params.q);
  const res = await fetch(`/api/programs?${qs.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || '지원 프로그램 목록을 불러오지 못했습니다.');
  }
  return data;
}
