import { messageRecordId } from './activityWorkspace';
import {
  addProgramMissionToRoadmap as fsAddProgramMissionToRoadmap,
  applyRoadmapTaskChange,
  appendAgentMessage as fsAppendAgentMessage,
  applyDailyRecommendation as fsApplyDailyRecommendation,
  applyTaskAdjustment as fsApplyTaskAdjustment,
  completeRoadmap as fsCompleteRoadmap,
  changeRoadmapTasks as fsChangeRoadmapTasks,
  computeProgressPercent,
  createCheckin as fsCreateCheckin,
  updateCheckinAdvice as fsUpdateCheckinAdvice,
  createRoadmapWithTasks as fsCreateRoadmapWithTasks,
  createWorry as fsCreateWorry,
  deleteWorry as fsDeleteWorry,
  getEffectiveTaskStatus,
  getTodayIsoDate,
  removeSavedProgram as fsRemoveSavedProgram,
  saveProgramBookmark as fsSaveProgramBookmark,
  saveRecommendedPrograms as fsSaveRecommendedPrograms,
  saveUserProfile as fsSaveUserProfile,
  toggleRoadmapTask as fsToggleRoadmapTask,
  updateRoadmapDetails as fsUpdateRoadmapDetails,
  updateTaskDetails as fsUpdateTaskDetails,
  updateTaskStatus as fsUpdateTaskStatus,
  updateWorryStatus as fsUpdateWorryStatus,
} from './firestoreService';
import {
  FIELD_LIMITS,
  type AgentMessage,
  type AgeGroup,
  type DailyCheckin,
  type DailyRecommendationResult,
  type GoalActivityLog,
  type GoalChangeActor,
  type GoalType,
  type GrowthRoadmap,
  type MoodLabel,
  type PublicProgram,
  type RecommendedProgramItem,
  type RoadmapStatus,
  type RoadmapTask,
  type RoadmapTaskInput,
  type SavedProgram,
  type TaskStatus,
  type UserProfile,
  type WorryCategory,
  type WorryItem,
  type WorryStatus,
} from '../types/domain';

export const GUEST_STORAGE_KEY = 'togrow_guest_workspace_v1';
export const GUEST_UID = 'guest-local-user';

export interface GuestWorkspaceSnapshot {
  pendingFirstConcern?: boolean;
  profile: UserProfile | null;
  checkins: DailyCheckin[];
  worries: WorryItem[];
  roadmaps: GrowthRoadmap[];
  tasksByRoadmap: Record<string, RoadmapTask[]>;
  goalLogs: GoalActivityLog[];
  messages: AgentMessage[];
  savedPrograms: SavedProgram[];
  recommendedPrograms: RecommendedProgramItem[];
}

export const EMPTY_GUEST_WORKSPACE: GuestWorkspaceSnapshot = {
  profile: null,
  checkins: [],
  worries: [],
  roadmaps: [],
  tasksByRoadmap: {},
  goalLogs: [],
  messages: [],
  savedPrograms: [],
  recommendedPrograms: [],
};

function makeLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clip(value: string | undefined | null, maxLen: number): string {
  const s = (value ?? '').trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function loadGuestWorkspace(key = GUEST_STORAGE_KEY): GuestWorkspaceSnapshot {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { ...EMPTY_GUEST_WORKSPACE };
    const parsed = JSON.parse(raw) as Partial<GuestWorkspaceSnapshot>;
    return {
      profile: parsed.profile ?? null,
      checkins: Array.isArray(parsed.checkins) ? parsed.checkins : [],
      worries: Array.isArray(parsed.worries) ? parsed.worries : [],
      roadmaps: Array.isArray(parsed.roadmaps) ? parsed.roadmaps : [],
      tasksByRoadmap:
        parsed.tasksByRoadmap && typeof parsed.tasksByRoadmap === 'object'
          ? parsed.tasksByRoadmap
          : {},
      goalLogs: Array.isArray(parsed.goalLogs) ? parsed.goalLogs : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      pendingFirstConcern: parsed.pendingFirstConcern === true,
      savedPrograms: Array.isArray(parsed.savedPrograms) ? parsed.savedPrograms : [],
      recommendedPrograms: Array.isArray(parsed.recommendedPrograms)
        ? parsed.recommendedPrograms
        : [],
    };
  } catch {
    return { ...EMPTY_GUEST_WORKSPACE };
  }
}

export function saveGuestWorkspace(snapshot: GuestWorkspaceSnapshot, key = GUEST_STORAGE_KEY): void {
  window.localStorage.setItem(key, JSON.stringify(snapshot));
}

export type ProgramMission = { title: string; description: string; durationMinutes: number };

export interface WorkspaceActions {
  saveProfile: (input: {
    nickname: string;
    age?: number;
    ageGroup: AgeGroup;
    jobPrepStatus?: string;
    region: string;
    interests: string[];
    currentGoalFocus: string;
    onboardingCompleted: boolean;
    onboardingSkipped: boolean;
  }) => Promise<void>;

  createCheckin: (input: {
    moodScore: number;
    moodLabel: MoodLabel;
    energyLevel: number;
    availableMinutes: number;
    reflection: string;
    selfCareSuggestion: string;
    checkinDate: string;
  }) => Promise<string>;
  updateCheckinAdvice: (checkinId: string, suggestion: string) => Promise<void>;

  createWorry: (input: {
    title: string;
    description: string;
    category: WorryCategory;
    aiSummary: string;
    nextStep: string;
  }) => Promise<string>;

  updateWorryStatus: (worryId: string, title: string, status: WorryStatus) => Promise<void>;
  deleteWorry: (worryId: string) => Promise<void>;

  createRoadmapWithTasks: (
    roadmapInput: {
      title: string;
      goalType: GoalType;
      timeframe: string;
      summary: string;
      energyLevel?: number;
      recommendationReason?: string;
      energyFitExplanation?: string;
    },
    tasksInput: Array<{
      title: string;
      description?: string;
      cadence: 'daily' | 'weekly';
      dayLabel: string;
      scheduledDate?: string;
      durationMinutes: number;
    }>,
    actor?: GoalChangeActor
  ) => Promise<string>;

  addRoadmapTask: (roadmapId: string, input: RoadmapTaskInput, actor?: GoalChangeActor) => Promise<void>;
  removeRoadmapTask: (roadmapId: string, taskId: string) => Promise<void>;

  toggleRoadmapTask: (
    roadmapId: string,
    task: RoadmapTask,
    allTasks: RoadmapTask[],
    roadmapStatus?: RoadmapStatus
  ) => Promise<void>;

  updateTaskStatus: (
    roadmapId: string,
    task: RoadmapTask,
    nextStatus: TaskStatus,
    allTasks: RoadmapTask[],
    blockerNote?: string,
    roadmapStatus?: RoadmapStatus
  ) => Promise<void>;

  updateRoadmapDetails: (
    roadmap: GrowthRoadmap,
    updates: { title: string; summary: string; timeframe: string },
    actor?: GoalChangeActor
  ) => Promise<void>;

  updateTaskDetails: (
    roadmap: GrowthRoadmap,
    task: RoadmapTask,
    updates: {
      title: string;
      description: string;
      durationMinutes: number;
      scheduledDate: string;
      dayLabel: string;
    },
    actor?: GoalChangeActor
  ) => Promise<void>;

  completeRoadmap: (roadmap: GrowthRoadmap) => Promise<void>;

  applyTaskAdjustment: (
    roadmap: GrowthRoadmap,
    task: RoadmapTask,
    allTasks: RoadmapTask[],
    adjustment: {
      adjustmentReason: string;
      adjustedTitle: string;
      adjustedDescription?: string;
      durationMinutes: number;
      dayLabel: string;
      blockerNote: string;
      scheduledDate?: string;
    }
  ) => Promise<void>;

  applyDailyRecommendation: (
    recommendation: DailyRecommendationResult,
    roadmaps: GrowthRoadmap[],
    tasksByRoadmap: Record<string, RoadmapTask[]>
  ) => Promise<string>;

  addProgramMissionToRoadmap: (
    program: Pick<PublicProgram, 'programId' | 'title' | 'provider' | 'howToApply'>,
    roadmaps: GrowthRoadmap[],
    tasksByRoadmap: Record<string, RoadmapTask[]>,
    mission?: ProgramMission,
  ) => Promise<string>;

  appendAgentMessage: (msg: {
    role: 'user' | 'assistant';
    content: string;
    supportType?: string;
    suggestedAction?: string;
    threadId?: string;
  }) => Promise<string>;

  saveProgramBookmark: (program: PublicProgram, notifyRequested: boolean) => Promise<void>;
  removeSavedProgram: (programId: string) => Promise<void>;
  saveRecommendedPrograms: (items: RecommendedProgramItem[]) => Promise<void>;
}

export function createFirestoreActions(uid: string): WorkspaceActions {
  return {
    saveProfile: (input) => fsSaveUserProfile(uid, input),
    createCheckin: (input) => fsCreateCheckin(uid, input),
    updateCheckinAdvice: (id, suggestion) => fsUpdateCheckinAdvice(uid, id, suggestion),
    createWorry: (input) => fsCreateWorry(uid, input),
    updateWorryStatus: (worryId, title, status) => fsUpdateWorryStatus(uid, worryId, title, status),
    deleteWorry: (worryId) => fsDeleteWorry(uid, worryId),
    createRoadmapWithTasks: (rm, tasks, actor) => fsCreateRoadmapWithTasks(uid, rm, tasks, actor),
    addRoadmapTask: (id, input, actor = '사용자 수정') => fsChangeRoadmapTasks(uid, id, { input, actor }),
    removeRoadmapTask: (id, taskId) => fsChangeRoadmapTasks(uid, id, { taskId }),
    toggleRoadmapTask: (rmId, task, all, status) => fsToggleRoadmapTask(uid, rmId, task, all, status),
    updateTaskStatus: (rmId, task, nextStatus, all, blockerNote, status) =>
      fsUpdateTaskStatus(uid, rmId, task, nextStatus, all, blockerNote, status),
    updateRoadmapDetails: (rm, updates, actor) => fsUpdateRoadmapDetails(uid, rm, updates, actor),
    updateTaskDetails: (rm, task, updates, actor) => fsUpdateTaskDetails(uid, rm, task, updates, actor),
    completeRoadmap: (rm) => fsCompleteRoadmap(uid, rm),
    applyTaskAdjustment: (rm, task, all, adj) => fsApplyTaskAdjustment(uid, rm, task, all, adj),
    applyDailyRecommendation: (rec, roadmaps, tasksByRoadmap) =>
      fsApplyDailyRecommendation(uid, rec, roadmaps, tasksByRoadmap),
    addProgramMissionToRoadmap: (prog, roadmaps, tasksByRoadmap, mission) =>
      fsAddProgramMissionToRoadmap(uid, prog, roadmaps, tasksByRoadmap, mission),
    appendAgentMessage: (msg) => fsAppendAgentMessage(uid, msg),
    saveProgramBookmark: (prog, notify) => fsSaveProgramBookmark(uid, prog, notify),
    removeSavedProgram: (programId) => fsRemoveSavedProgram(uid, programId),
    saveRecommendedPrograms: (items) => fsSaveRecommendedPrograms(uid, items),
  };
}

export function createGuestActions(
  updateGuest: (updater: (prev: GuestWorkspaceSnapshot) => GuestWorkspaceSnapshot) => void
) {
  const makeGoalLog = (
    entry: Omit<GoalActivityLog, 'id' | 'ownerId' | 'createdAt'>
  ): GoalActivityLog => ({
    id: makeLocalId('glog'),
    ownerId: GUEST_UID,
    createdAt: new Date().toISOString(),
    ...entry,
  });

  const changeGuestRoadmapTasks = (roadmapId: string, change: Parameters<typeof applyRoadmapTaskChange>[4]) => {
    const taskId = 'input' in change ? makeLocalId('tsk_manual') : change.taskId;
    updateGuest((prev) => {
      const roadmap = prev.roadmaps.find((item) => item.id === roadmapId);
      if (!roadmap || roadmap.status === 'completed') throw new Error('진행 중인 로드맵을 선택해 주세요.');
      const result = applyRoadmapTaskChange(prev.tasksByRoadmap[roadmapId] || [], GUEST_UID, roadmapId, taskId, change);
      if (!result) return prev;
      const updatedAt = new Date().toISOString();
      if (result.task) Object.assign(result.task, { createdAt: updatedAt, updatedAt });
      return {
        ...prev,
        roadmaps: prev.roadmaps.map((item) => item.id === roadmapId ? { ...item, progressPercent: result.progressPercent, updatedAt } : item),
        tasksByRoadmap: { ...prev.tasksByRoadmap, [roadmapId]: result.next },
        goalLogs: [makeGoalLog(result.log), ...prev.goalLogs],
      };
    });
  };

  const createGuestRoadmapInternal = (
    prev: GuestWorkspaceSnapshot,
    roadmapInput: {
      title: string;
      goalType: GoalType;
      timeframe: string;
      summary: string;
      energyLevel?: number;
      recommendationReason?: string;
      energyFitExplanation?: string;
    },
    tasksInput: Array<{
      title: string;
      description?: string;
      cadence: 'daily' | 'weekly';
      dayLabel: string;
      scheduledDate?: string;
      durationMinutes: number;
    }>,
    actor: GoalChangeActor = 'AI 제안'
  ): { next: GuestWorkspaceSnapshot; roadmapId: string } => {
    const roadmapId = makeLocalId('rm');
    const today = getTodayIsoDate();
    const nowIso = new Date().toISOString();

    const newRoadmap: GrowthRoadmap = {
      id: roadmapId,
      ownerId: GUEST_UID,
      title: clip(roadmapInput.title, FIELD_LIMITS.roadmapTitleMax) || '나의 작은 성장 로드맵',
      goalType: roadmapInput.goalType,
      timeframe: clip(roadmapInput.timeframe, FIELD_LIMITS.roadmapTimeframeMax) || '이번 주 (7일)',
      summary: clip(roadmapInput.summary, FIELD_LIMITS.roadmapSummaryMax),
      energyLevel: Math.min(5, Math.max(1, Math.round(roadmapInput.energyLevel ?? 3))),
      recommendationReason: clip(roadmapInput.recommendationReason, FIELD_LIMITS.recommendationReasonMax),
      energyFitExplanation: clip(roadmapInput.energyFitExplanation, FIELD_LIMITS.energyFitMax),
      status: 'active',
      progressPercent: 0,
      adjustmentReason: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const newTasks: RoadmapTask[] = tasksInput.slice(0, 12).map((t, idx) => ({
      id: makeLocalId(`tsk${idx}`),
      ownerId: GUEST_UID,
      roadmapId,
      title: clip(t.title, FIELD_LIMITS.taskTitleMax) || '작은 실천 항목',
      description: clip(t.description, FIELD_LIMITS.taskDescriptionMax),
      cadence: t.cadence === 'weekly' ? 'weekly' : 'daily',
      dayLabel: clip(t.dayLabel, FIELD_LIMITS.dayLabelMax) || `Day ${idx + 1}`,
      scheduledDate:
        t.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(t.scheduledDate) ? t.scheduledDate : today,
      durationMinutes: Math.min(480, Math.max(5, Math.round(t.durationMinutes || 15))),
      status: '진행 예정',
      completed: false,
      completedAt: null,
      blockerNote: '',
      adjustedFrom: '',
      sortOrder: idx,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));

    const log = makeGoalLog({
      roadmapId,
      taskId: '',
      actionType: '로드맵 생성',
      changedField: '새 로드맵 저장',
      previousValue: '없음',
      newValue: `${clip(roadmapInput.title, 80)} (${newTasks.length}개 실천 항목)`,
      actor,
      reason: clip(roadmapInput.recommendationReason || '사용자 승인 후 로드맵 저장', FIELD_LIMITS.logReasonMax),
    });

    return {
      roadmapId,
      next: {
        ...prev,
        roadmaps: [newRoadmap, ...prev.roadmaps],
        tasksByRoadmap: { ...prev.tasksByRoadmap, [roadmapId]: newTasks },
        goalLogs: [log, ...prev.goalLogs],
      },
    };
  };

  const makeGuestProfile = (prev: GuestWorkspaceSnapshot, input: Parameters<WorkspaceActions['saveProfile']>[0]): UserProfile => {
    const nowIso = new Date().toISOString();
    return {
      ownerId: GUEST_UID,
      nickname: clip(input.nickname, FIELD_LIMITS.nicknameMax) || '청년',
      age: typeof input.age === 'number' && Number.isInteger(input.age) && input.age >= 15 && input.age <= 99
        ? input.age : prev.profile?.age,
      ageGroup: input.ageGroup,
      jobPrepStatus: clip(input.jobPrepStatus, FIELD_LIMITS.jobPrepStatusMax),
      region: clip(input.region, FIELD_LIMITS.regionMax),
      interests: input.interests.slice(0, FIELD_LIMITS.interestsMaxCount),
      currentGoalFocus: clip(input.currentGoalFocus, FIELD_LIMITS.goalFocusMax),
      onboardingCompleted: input.onboardingCompleted,
      onboardingSkipped: input.onboardingSkipped,
      createdAt: prev.profile?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
  };

  const makeGuestCheckin = (input: Parameters<WorkspaceActions['createCheckin']>[0]): DailyCheckin => {
    const nowIso = new Date().toISOString();
    return {
      id: makeLocalId('chk'),
      ownerId: GUEST_UID,
      moodScore: Math.min(5, Math.max(1, Math.round(input.moodScore))),
      moodLabel: input.moodLabel,
      energyLevel: Math.min(5, Math.max(1, Math.round(input.energyLevel))),
      availableMinutes: Math.min(
        FIELD_LIMITS.availableMinutesMax,
        Math.max(FIELD_LIMITS.availableMinutesMin, Math.round(input.availableMinutes || 20))
      ),
      reflection: clip(input.reflection, FIELD_LIMITS.reflectionMax),
      selfCareSuggestion: clip(input.selfCareSuggestion, FIELD_LIMITS.selfCareMax),
      checkinDate: input.checkinDate,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  };

  const actions: WorkspaceActions & {
    completeFirstEntry: (profile: Parameters<WorkspaceActions['saveProfile']>[0],
      checkin: Parameters<WorkspaceActions['createCheckin']>[0]) => Promise<void>;
  } = {
    async saveProfile(input) {
      updateGuest((prev) => ({ ...prev, profile: makeGuestProfile(prev, input) }));
    },

    async createCheckin(input) {
      const item = makeGuestCheckin(input);
      updateGuest((prev) => ({ ...prev, checkins: [item, ...prev.checkins] }));
      return item.id;
    },

    async completeFirstEntry(profile, checkin) {
      const item = makeGuestCheckin(checkin);
      updateGuest((prev) => ({
        ...prev,
        profile: makeGuestProfile(prev, profile),
        checkins: [item, ...prev.checkins],
        pendingFirstConcern: true,
      }));
    },

    async updateCheckinAdvice(id, suggestion) {
      updateGuest((prev) => ({
        ...prev,
        checkins: prev.checkins.map((item) => item.id === id
          ? { ...item, selfCareSuggestion: clip(suggestion, FIELD_LIMITS.selfCareMax), updatedAt: new Date().toISOString() }
          : item),
      }));
    },

    async createWorry(input) {
      const id = makeLocalId('wry');
      updateGuest((prev) => {
        const nowIso = new Date().toISOString();
        const item: WorryItem = {
          id,
          ownerId: GUEST_UID,
          title: clip(input.title, FIELD_LIMITS.worryTitleMax) || '새로운 고민',
          description: clip(input.description, FIELD_LIMITS.worryDescMax),
          category: input.category,
          status: '해결 방법 탐색 중',
          aiSummary: clip(input.aiSummary, FIELD_LIMITS.worrySummaryMax),
          nextStep: clip(input.nextStep, FIELD_LIMITS.worryNextStepMax),
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        return { ...prev, worries: [item, ...prev.worries] };
      });
      return id;
    },

    async updateWorryStatus(worryId, _title, status) {
      updateGuest((prev) => ({
        ...prev,
        worries: prev.worries.map((w) =>
          w.id === worryId ? { ...w, status, updatedAt: new Date().toISOString() } : w
        ),
      }));
    },

    async deleteWorry(worryId) {
      updateGuest((prev) => ({
        ...prev,
        worries: prev.worries.filter((w) => w.id !== worryId),
      }));
    },

    async createRoadmapWithTasks(roadmapInput, tasksInput, actor = 'AI 제안') {
      let createdId = '';
      updateGuest((prev) => {
        const result = createGuestRoadmapInternal(prev, roadmapInput, tasksInput, actor);
        createdId = result.roadmapId;
        return result.next;
      });
      return createdId;
    },

    async updateTaskStatus(roadmapId, task, nextStatus, allTasks, blockerNote, roadmapStatus) {
      const prevStatus = getEffectiveTaskStatus(task);
      const nextCompleted = nextStatus === '완료';
      const cleanedNote =
        blockerNote !== undefined ? clip(blockerNote, FIELD_LIMITS.blockerNoteMax) : task.blockerNote;

      updateGuest((prev) => {
        const tasks = (prev.tasksByRoadmap[roadmapId] || allTasks).map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: nextStatus,
                completed: nextCompleted,
                blockerNote: cleanedNote,
                updatedAt: new Date().toISOString(),
              }
            : t
        );
        const progressPercent = computeProgressPercent(tasks);
        const roadmaps = prev.roadmaps.map((r) =>
          r.id === roadmapId && roadmapStatus !== 'completed'
            ? { ...r, progressPercent, updatedAt: new Date().toISOString() }
            : r
        );
        const log = makeGoalLog({
          roadmapId,
          taskId: task.id,
          actionType: '실천 상태 변경',
          changedField: clip(task.title, 50),
          previousValue: prevStatus,
          newValue: nextStatus,
          actor: '사용자 수정',
          reason: cleanedNote || `달성률 ${progressPercent}%`,
        });
        return {
          ...prev,
          roadmaps,
          tasksByRoadmap: { ...prev.tasksByRoadmap, [roadmapId]: tasks },
          goalLogs: [log, ...prev.goalLogs],
        };
      });
    },

    async toggleRoadmapTask(roadmapId, task, allTasks, roadmapStatus) {
      const currentStatus = getEffectiveTaskStatus(task);
      const nextStatus: TaskStatus = currentStatus === '완료' ? '진행 예정' : '완료';
      await this.updateTaskStatus(roadmapId, task, nextStatus, allTasks, undefined, roadmapStatus);
    },

    async updateRoadmapDetails(roadmap, updates, actor = '사용자 수정') {
      const nextTitle = clip(updates.title, FIELD_LIMITS.roadmapTitleMax) || roadmap.title;
      const nextSummary = clip(updates.summary, FIELD_LIMITS.roadmapSummaryMax);
      const nextTimeframe = clip(updates.timeframe, FIELD_LIMITS.roadmapTimeframeMax) || roadmap.timeframe;

      updateGuest((prev) => {
        const logs: GoalActivityLog[] = [];
        if (nextTitle !== roadmap.title) {
          logs.push(
            makeGoalLog({
              roadmapId: roadmap.id,
              taskId: '',
              actionType: '로드맵 수정',
              changedField: '로드맵 제목',
              previousValue: roadmap.title,
              newValue: nextTitle,
              actor,
              reason: '',
            })
          );
        }
        return {
          ...prev,
          roadmaps: prev.roadmaps.map((r) =>
            r.id === roadmap.id
              ? {
                  ...r,
                  title: nextTitle,
                  summary: nextSummary,
                  timeframe: nextTimeframe,
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
          goalLogs: [...logs, ...prev.goalLogs],
        };
      });
    },

    async addRoadmapTask(roadmapId, input, actor = '사용자 수정') {
      changeGuestRoadmapTasks(roadmapId, { input, actor });
    },

    async removeRoadmapTask(roadmapId, taskId) {
      changeGuestRoadmapTasks(roadmapId, { taskId });
    },

    async updateTaskDetails(roadmap, task, updates, actor = '사용자 수정') {
      const nextTitle = clip(updates.title, FIELD_LIMITS.taskTitleMax) || task.title;
      const nextDesc = clip(updates.description, FIELD_LIMITS.taskDescriptionMax);
      const nextMins = Math.min(480, Math.max(5, Math.round(updates.durationMinutes || task.durationMinutes)));
      const nextDate = /^\d{4}-\d{2}-\d{2}$/.test(updates.scheduledDate)
        ? updates.scheduledDate
        : task.scheduledDate || '';
      const nextDayLabel = clip(updates.dayLabel, FIELD_LIMITS.dayLabelMax) || task.dayLabel;

      updateGuest((prev) => {
        const list = prev.tasksByRoadmap[roadmap.id] || [];
        const updatedList = list.map((t) =>
          t.id === task.id
            ? {
                ...t,
                title: nextTitle,
                description: nextDesc,
                durationMinutes: nextMins,
                scheduledDate: nextDate,
                dayLabel: nextDayLabel,
                updatedAt: new Date().toISOString(),
              }
            : t
        );
        const log = makeGoalLog({
          roadmapId: roadmap.id,
          taskId: task.id,
          actionType: '항목 수정',
          changedField: '목표 세부 내용',
          previousValue: task.title,
          newValue: nextTitle,
          actor,
          reason: '',
        });
        return {
          ...prev,
          tasksByRoadmap: { ...prev.tasksByRoadmap, [roadmap.id]: updatedList },
          goalLogs: [log, ...prev.goalLogs],
        };
      });
    },

    async completeRoadmap(roadmap) {
      updateGuest((prev) => ({
        ...prev,
        roadmaps: prev.roadmaps.map((r) =>
          r.id === roadmap.id
            ? { ...r, status: 'completed', progressPercent: 100, updatedAt: new Date().toISOString() }
            : r
        ),
        goalLogs: [
          makeGoalLog({
            roadmapId: roadmap.id,
            taskId: '',
            actionType: '로드맵 완주',
            changedField: '로드맵 상태',
            previousValue: roadmap.status,
            newValue: 'completed',
            actor: '사용자 수정',
            reason: '모든 항목을 마치고 최종 완료를 확정했습니다.',
          }),
          ...prev.goalLogs,
        ],
      }));
    },

    async applyTaskAdjustment(roadmap, task, allTasks, adjustment) {
      const nextTitle = clip(adjustment.adjustedTitle, FIELD_LIMITS.taskTitleMax) || task.title;
      const nextMins = Math.min(480, Math.max(5, Math.round(adjustment.durationMinutes || 10)));
      const nextDesc =
        adjustment.adjustedDescription !== undefined
          ? clip(adjustment.adjustedDescription, FIELD_LIMITS.taskDescriptionMax)
          : task.description || '';
      const nextDate =
        adjustment.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(adjustment.scheduledDate)
          ? adjustment.scheduledDate
          : task.scheduledDate || getTodayIsoDate();

      updateGuest((prev) => {
        const list = (prev.tasksByRoadmap[roadmap.id] || allTasks).map((t) =>
          t.id === task.id
            ? {
                ...t,
                adjustedFrom: clip(task.title, FIELD_LIMITS.taskTitleMax),
                title: nextTitle,
                description: nextDesc,
                durationMinutes: nextMins,
                dayLabel: clip(adjustment.dayLabel, FIELD_LIMITS.dayLabelMax) || task.dayLabel,
                scheduledDate: nextDate,
                blockerNote: clip(adjustment.blockerNote, FIELD_LIMITS.blockerNoteMax),
                status: '진행 예정' as TaskStatus,
                completed: false,
                updatedAt: new Date().toISOString(),
              }
            : t
        );
        const nextProgress = computeProgressPercent(list);
        const roadmaps = prev.roadmaps.map((r) =>
          r.id === roadmap.id && r.status !== 'completed'
            ? {
                ...r,
                status: 'adjusted' as RoadmapStatus,
                progressPercent: nextProgress,
                adjustmentReason: clip(adjustment.adjustmentReason, FIELD_LIMITS.adjustmentReasonMax),
                updatedAt: new Date().toISOString(),
              }
            : r
        );
        const log = makeGoalLog({
          roadmapId: roadmap.id,
          taskId: task.id,
          actionType: 'AI 유연 조정',
          changedField: '실천 항목 난이도·시간',
          previousValue: `${task.title} (${task.durationMinutes}분)`,
          newValue: `${nextTitle} (${nextMins}분)`,
          actor: 'AI 제안',
          reason: adjustment.adjustmentReason,
        });
        return {
          ...prev,
          roadmaps,
          tasksByRoadmap: { ...prev.tasksByRoadmap, [roadmap.id]: list },
          goalLogs: [log, ...prev.goalLogs],
        };
      });
    },

    async applyDailyRecommendation(recommendation, roadmaps, tasksByRoadmap) {
      const activeRoadmaps = roadmaps.filter((r) => r.status !== 'completed');
      const targetRoadmap =
        activeRoadmaps.find((r) => r.id === recommendation.targetRoadmapId) || activeRoadmaps[0] || null;
      const targetTasks = targetRoadmap ? tasksByRoadmap[targetRoadmap.id] || [] : [];
      const targetTask = targetTasks.find((t) => t.id === recommendation.targetTaskId) || null;

      if (targetRoadmap && targetTask && recommendation.strategy !== '새로운 작은 목표 추천') {
        if (recommendation.strategy === '기존 목표 유지') {
          await this.updateTaskStatus(
            targetRoadmap.id,
            targetTask,
            '실천 중',
            targetTasks,
            undefined,
            targetRoadmap.status
          );
          return targetRoadmap.id;
        }
        await this.applyTaskAdjustment(targetRoadmap, targetTask, targetTasks, {
          adjustmentReason: recommendation.recommendationReason,
          adjustedTitle: recommendation.proposedTask.title,
          adjustedDescription: recommendation.proposedTask.description,
          durationMinutes: recommendation.proposedTask.durationMinutes,
          dayLabel: recommendation.proposedTask.dayLabel,
          blockerNote: recommendation.strategy,
          scheduledDate: recommendation.proposedTask.scheduledDate,
        });
        return targetRoadmap.id;
      }

      if (targetRoadmap) {
        const newTaskId = makeLocalId('tsk_rec');
        updateGuest((prev) => {
          const existingList = prev.tasksByRoadmap[targetRoadmap.id] || [];
          const newTask: RoadmapTask = {
            id: newTaskId,
            ownerId: GUEST_UID,
            roadmapId: targetRoadmap.id,
            title: clip(recommendation.proposedTask.title, FIELD_LIMITS.taskTitleMax),
            description: clip(recommendation.proposedTask.description, FIELD_LIMITS.taskDescriptionMax),
            cadence: recommendation.proposedTask.cadence === 'weekly' ? 'weekly' : 'daily',
            dayLabel: clip(recommendation.proposedTask.dayLabel, FIELD_LIMITS.dayLabelMax) || '오늘',
            scheduledDate: recommendation.proposedTask.scheduledDate || getTodayIsoDate(),
            durationMinutes: Math.min(
              180,
              Math.max(5, Math.round(recommendation.proposedTask.durationMinutes || 10))
            ),
            status: '진행 예정',
            completed: false,
            blockerNote: '',
            adjustedFrom: '',
            sortOrder: existingList.length,
          };
          const updatedList = [...existingList, newTask];
          const nextProgress = computeProgressPercent(updatedList);
          return {
            ...prev,
            roadmaps: prev.roadmaps.map((r) =>
              r.id === targetRoadmap.id
                ? {
                    ...r,
                    status: 'adjusted',
                    progressPercent: nextProgress,
                    adjustmentReason: clip(
                      recommendation.recommendationReason,
                      FIELD_LIMITS.adjustmentReasonMax
                    ),
                  }
                : r
            ),
            tasksByRoadmap: { ...prev.tasksByRoadmap, [targetRoadmap.id]: updatedList },
            goalLogs: [
              makeGoalLog({
                roadmapId: targetRoadmap.id,
                taskId: newTaskId,
                actionType: `AI 추천 적용 (${recommendation.strategy})`,
                changedField: '새 작은 목표 추가',
                previousValue: '없음',
                newValue: recommendation.proposedTask.title,
                actor: 'AI 제안',
                reason: recommendation.recommendationReason,
              }),
              ...prev.goalLogs,
            ],
          };
        });
        return targetRoadmap.id;
      }

      return await this.createRoadmapWithTasks(
        {
          title: recommendation.headline || '오늘 컨디션 맞춤 작은 실천',
          goalType: '생활 습관',
          timeframe: '오늘 하루',
          summary: recommendation.recommendationReason,
          recommendationReason: recommendation.recommendationReason,
          energyFitExplanation: recommendation.energyFitExplanation,
        },
        [recommendation.proposedTask],
        'AI 제안'
      );
    },

    async addProgramMissionToRoadmap(program, roadmaps, tasksByRoadmap, mission) {
      const activeRoadmap = roadmaps.find((r) => r.status !== 'completed') || null;
      const missionTitle = mission?.title ?? `[지원 준비] ${clip(program.title, 120)} 자격·신청 조건 확인하기`;
      const missionDesc = mission?.description ?? `${clip(program.provider, 60)} 공식 안내 페이지에서 자격 요건과 신청 일정을 확인해 보세요. (${clip(program.howToApply, 220)})`;
      const today = getTodayIsoDate();

      if (activeRoadmap) {
        const existingList = tasksByRoadmap[activeRoadmap.id] || [];
        const newTaskId = makeLocalId('tsk_prog');
        updateGuest((prev) => {
          const prevTasks = prev.tasksByRoadmap[activeRoadmap.id] || existingList;
          if (mission && prevTasks.some((task) => task.title === missionTitle && task.description === missionDesc)) return prev;
          const newTask: RoadmapTask = {
            id: newTaskId,
            ownerId: GUEST_UID,
            roadmapId: activeRoadmap.id,
            title: clip(missionTitle, FIELD_LIMITS.taskTitleMax),
            description: clip(missionDesc, FIELD_LIMITS.taskDescriptionMax),
            cadence: 'daily',
            dayLabel: '지원 준비',
            scheduledDate: today,
            durationMinutes: mission?.durationMinutes ?? 20,
            status: '진행 예정',
            completed: false,
            blockerNote: '',
            adjustedFrom: '',
            sortOrder: prevTasks.length,
          };
          const updatedList = [...prevTasks, newTask];
          const nextProgress = computeProgressPercent(updatedList);
          return {
            ...prev,
            roadmaps: prev.roadmaps.map((r) =>
              r.id === activeRoadmap.id ? { ...r, progressPercent: nextProgress } : r
            ),
            tasksByRoadmap: { ...prev.tasksByRoadmap, [activeRoadmap.id]: updatedList },
            goalLogs: [
              makeGoalLog({
                roadmapId: activeRoadmap.id,
                taskId: newTaskId,
                actionType: '지원 프로그램 미션 추가',
                changedField: '새 신청 준비 미션',
                previousValue: '없음',
                newValue: clip(missionTitle, 120),
                actor: '사용자 수정',
                reason: `지원 프로그램 [${clip(program.title, 60)}] 연계`,
              }),
              ...prev.goalLogs,
            ],
          };
        });
        return activeRoadmap.id;
      }

      return await this.createRoadmapWithTasks(
        {
          title: mission ? '대화에서 시작한 작은 실천' : '추천 지원 프로그램 신청 준비',
          goalType: '취업 준비',
          timeframe: '이번 주 (7일)',
          summary: mission?.description ?? '고민 상담과 지원 프로그램에서 찾은 제도의 자격 조건과 신청 일정을 하나씩 확인해 봅니다.',
        },
        [
          {
            title: clip(missionTitle, FIELD_LIMITS.taskTitleMax),
            description: clip(missionDesc, FIELD_LIMITS.taskDescriptionMax),
            cadence: 'daily',
            dayLabel: 'Day 1 (오늘)',
            scheduledDate: today,
            durationMinutes: mission?.durationMinutes ?? 20,
          },
        ],
        '사용자 수정'
      );
    },

    async appendAgentMessage(msg) {
      const id = messageRecordId(makeLocalId('msg'), msg.threadId);
      updateGuest((prev) => ({
        ...prev,
        pendingFirstConcern: msg.role === 'user' ? false : prev.pendingFirstConcern,
        messages: [
          ...prev.messages,
          {
            id,
            ownerId: GUEST_UID,
            role: msg.role,
            content: clip(msg.content, FIELD_LIMITS.messageContentMax) || '...',
            supportType: clip(msg.supportType, 80),
            suggestedAction: clip(msg.suggestedAction, 200),
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      return id;
    },

    async saveProgramBookmark(program, notifyRequested) {
      const safeId = program.programId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
      updateGuest((prev) => {
        const exists = prev.savedPrograms.some((s) => s.programId === safeId);
        if (exists) {
          return {
            ...prev,
            savedPrograms: prev.savedPrograms.map((s) =>
              s.programId === safeId ? { ...s, notifyRequested, updatedAt: new Date().toISOString() } : s
            ),
          };
        }
        const entry: SavedProgram = {
          id: safeId,
          ownerId: GUEST_UID,
          programId: safeId,
          title: clip(program.title, 160),
          provider: clip(program.provider, 100),
          region: clip(program.region, 40),
          category: clip(program.category, 60),
          applyUrl: clip(program.applyUrl, 500),
          notifyRequested,
          deadline: clip(program.deadline, 40),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return { ...prev, savedPrograms: [entry, ...prev.savedPrograms] };
      });
    },

    async removeSavedProgram(programId) {
      updateGuest((prev) => ({
        ...prev,
        savedPrograms: prev.savedPrograms.filter((s) => s.programId !== programId),
      }));
    },

    async saveRecommendedPrograms(items) {
      if (!items.length) return;
      updateGuest((prev) => {
        const map = new Map(prev.recommendedPrograms.map((p) => [p.programId, p]));
        for (const item of items.slice(0, 3)) {
          const safeId = item.programId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
          map.set(safeId, { ...item, programId: safeId, updatedAt: new Date().toISOString() });
        }
        return { ...prev, recommendedPrograms: Array.from(map.values()) };
      });
    },
  };
  return actions;
}
