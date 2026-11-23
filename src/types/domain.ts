import type { GuidedTurn, SupportPreview } from '../lib/guidedConversation';
import type { JobSelection } from '../lib/jobDiscovery';

export const FIELD_LIMITS = {
  nicknameMax: 40,
  jobPrepStatusMax: 60,
  regionMax: 40,
  goalFocusMax: 120,
  interestsMaxCount: 8,
  availableMinutesMin: 5,
  availableMinutesMax: 480,
  reflectionMax: 1000,
  selfCareMax: 600,
  worryTitleMax: 140,
  worryDescMax: 1500,
  worrySummaryMax: 800,
  worryNextStepMax: 300,
  roadmapTitleMax: 140,
  roadmapTimeframeMax: 60,
  roadmapSummaryMax: 800,
  recommendationReasonMax: 600,
  energyFitMax: 500,
  adjustmentReasonMax: 500,
  taskTitleMax: 180,
  taskDescriptionMax: 600,
  dayLabelMax: 40,
  blockerNoteMax: 500,
  logFieldMax: 60,
  logValueMax: 300,
  logReasonMax: 500,
  messageContentMax: 4000,
  activitySummaryMax: 300,
} as const;

export type AgeGroup = '19-24세' | '25-29세' | '30-34세' | '미선택';
export type MoodLabel = '차분함' | '막막함' | '지침' | '괜찮음' | '의욕 있음' | '불안함';
export type WorryCategory = '진로 방향' | '생활 리듬' | '역량 부족' | '심리적 부담' | '경제·생활' | '정보 탐색';
export type WorryStatus = '아직 해결되지 않음' | '해결 방법 탐색 중' | '실천 중' | '해결됨' | '잠시 보류';
export type GoalType = '생활 습관' | '학업·학습' | '자기계발' | '진로 탐색' | '취업 준비' | '사용자 직접 설정';
export type RoadmapStatus = 'active' | 'adjusted' | 'completed' | 'paused';
export type TaskStatus = '진행 예정' | '실천 중' | '완료' | '미완료' | '건너뛰기';
export type GoalChangeActor = 'AI 제안' | '사용자 수정';
export type AdjustmentStrategy =
  | '기존 목표 유지'
  | '목표 난이도 낮추기'
  | '예상 소요시간 줄이기'
  | '다른 날짜로 조정'
  | '새로운 작은 목표 추천';

export type NavSection =
  | 'dashboard'
  | 'checkin'
  | 'worries'
  | 'roadmap'
  | 'progress'
  | 'programs';

export const JOB_PREP_STATUS_OPTIONS = [
  '진로·직무 탐색 중',
  '일상 회복·잠시 쉬는 중',
  '직무 역량·교육 학습 중',
  '채용 공고 탐색·지원 준비 중',
  '입사지원서·이력서 작성 중',
  '면접 준비 중',
] as const;

export function mapAgeToAgeGroup(age?: number): AgeGroup {
  if (!age || !Number.isFinite(age)) return '미선택';
  if (age <= 24) return '19-24세';
  if (age <= 29) return '25-29세';
  if (age <= 34) return '30-34세';
  return '미선택';
}

export interface UserProfile {
  ownerId: string;
  nickname: string;
  age?: number;
  ageGroup: AgeGroup;
  jobPrepStatus?: string;
  region: string;
  interests: string[];
  currentGoalFocus: string;
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DailyCheckin {
  id: string;
  ownerId: string;
  moodScore: number;
  moodLabel: MoodLabel;
  energyLevel: number;
  availableMinutes?: number;
  reflection: string;
  selfCareSuggestion: string;
  checkinDate: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WorryItem {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: WorryCategory;
  status: WorryStatus;
  aiSummary: string;
  nextStep: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GrowthRoadmap {
  id: string;
  ownerId: string;
  title: string;
  goalType: GoalType;
  timeframe: string;
  summary: string;
  energyLevel?: number;
  recommendationReason?: string;
  energyFitExplanation?: string;
  status: RoadmapStatus;
  progressPercent: number;
  adjustmentReason: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RoadmapTask {
  id: string;
  ownerId: string;
  roadmapId: string;
  title: string;
  description?: string;
  cadence: 'daily' | 'weekly';
  dayLabel: string;
  scheduledDate?: string;
  durationMinutes: number;
  status?: TaskStatus;
  completed: boolean;
  completedAt?: unknown;
  blockerNote: string;
  adjustedFrom: string;
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type RoadmapTaskInput = Pick<RoadmapTask, 'title' | 'description' | 'cadence' | 'dayLabel' | 'scheduledDate' | 'durationMinutes'>;

export interface GoalActivityLog {
  id: string;
  ownerId: string;
  roadmapId: string;
  taskId: string;
  actionType: string;
  changedField: string;
  previousValue: string;
  newValue: string;
  actor: GoalChangeActor;
  reason: string;
  createdAt?: unknown;
}

export interface GeneratedRoadmapTask {
  title: string;
  description: string;
  cadence: 'daily' | 'weekly';
  dayLabel: string;
  durationMinutes: number;
  dayOffset: number;
  scheduledDate: string;
}

export interface GeneratedRoadmapPreview {
  title: string;
  category: GoalType;
  duration: string;
  summary: string;
  recommendationReason: string;
  energyFitExplanation: string;
  tasks: GeneratedRoadmapTask[];
}

export interface DailyRecommendationResult {
  headline: string;
  strategy: AdjustmentStrategy;
  recommendationReason: string;
  energyFitExplanation: string;
  targetRoadmapId: string;
  targetTaskId: string;
  proposedTask: {
    title: string;
    description: string;
    cadence: 'daily' | 'weekly';
    dayLabel: string;
    durationMinutes: number;
    scheduledDate: string;
  };
}

export const DAILY_GOAL_LIMIT = 3;

export type DailyGoal = Pick<GeneratedRoadmapTask, 'title' | 'description' | 'durationMinutes'>;
export type DailyGoalsResult = { suggestions: DailyGoal[]; source: 'gemini' | 'checkin' };

export interface AgentMessage {
  id: string;
  ownerId: string;
  role: 'user' | 'assistant';
  content: string;
  supportType: string;
  suggestedAction: string;
  createdAt?: unknown;
}

export interface ActivityLog {
  id: string;
  ownerId: string;
  actionType: string;
  targetSection: string;
  summary: string;
  createdAt?: unknown;
}

export interface PublicProgram {
  programId: string;
  title: string;
  provider: string;
  region: string;
  category: '공공기관 채용' | '직업훈련·교육' | '취업지원·수당' | '청년공간·상담' | '채용박람회·행사';
  summary: string;
  eligibility: string;
  howToApply: string;
  deadline: string;
  applyUrl: string;
  sourceNote: string;
  linkType?: '공식 신청 페이지' | '공식 안내 페이지';
  recruitmentStatus?: string;
  worryThemes?: string[];
  isPublicRecruitment?: boolean;
}

export interface RecommendedProgramItem extends PublicProgram {
  recommendationReason: string;
  conditionNote: string;
  worrySummary?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavedProgram {
  id: string;
  ownerId: string;
  programId: string;
  title: string;
  provider: string;
  region: string;
  category: string;
  applyUrl: string;
  notifyRequested: boolean;
  deadline: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AgentChatResponse {
  jobSelection?: JobSelection;
  guidedTurn?: GuidedTurn;
  preview?: SupportPreview;
  recommendedPrograms?: RecommendedProgramItem[];
  counselingBooking?: boolean;
  reply: string;
  supportType: string;
  suggestedAction: string;
  extractedWorry?: {
    title: string;
    category: WorryCategory;
    nextStep: string;
  };
  suggestedTasks?: Array<{
    title: string;
    cadence: 'daily' | 'weekly';
    dayLabel: string;
    durationMinutes: number;
  }>;
}

export interface WorryChatResponse {
  responseMode?: 'guided';
  counselingBooking?: boolean;
  reply: string;
  problemType: string;
  smallAction: string;
  extractedWorry?: {
    title: string;
    category: WorryCategory;
    nextStep: string;
  };
  recommendedPrograms: RecommendedProgramItem[];
  noMatchGuidance?: string;
  apiMeta: {
    liveApiConnected: boolean;
    externalApiError?: string;
    apiStatusNote: string;
  };
}
