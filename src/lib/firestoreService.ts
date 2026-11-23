import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  FIELD_LIMITS,
  type ActivityLog,
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
import { db, handleFirestoreError, OperationType } from './firebase';
import { koreaDate } from './koreaDate';
import { messageRecordId } from './activityWorkspace';

function clip(value: string | undefined | null, maxLen: number): string {
  const s = (value ?? '').trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`;
}

export const getTodayIsoDate = koreaDate;

export function getEffectiveTaskStatus(task: RoadmapTask): TaskStatus {
  if (task.status) return task.status;
  return task.completed ? '완료' : '진행 예정';
}

export function computeProgressPercent(tasks: RoadmapTask[]): number {
  if (!tasks.length) return 0;
  const doneCount = tasks.filter((t) => getEffectiveTaskStatus(t) === '완료').length;
  return Math.round((doneCount / tasks.length) * 100);
}

export async function logActivity(
  uid: string,
  actionType: string,
  targetSection: string,
  summary: string
): Promise<void> {
  const actId = makeId('act');
  const path = `users/${uid}/activities/${actId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'activities', actId), {
      ownerId: uid,
      actionType: clip(actionType, 60) || '활동',
      targetSection: clip(targetSection, 60) || '대시보드',
      summary: clip(summary, FIELD_LIMITS.activitySummaryMax) || '기록 저장',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

type GoalLogEntry = Omit<GoalActivityLog, 'id' | 'ownerId' | 'createdAt' | 'taskId' | 'reason'> & {
  taskId?: string;
  reason?: string;
};

function goalActivityData(uid: string, entry: GoalLogEntry) {
  return {
    ownerId: uid,
    roadmapId: entry.roadmapId,
    taskId: clip(entry.taskId, 128),
    actionType: clip(entry.actionType, 60) || '목표 변경',
    changedField: clip(entry.changedField, FIELD_LIMITS.logFieldMax) || '항목',
    previousValue: clip(entry.previousValue, FIELD_LIMITS.logValueMax),
    newValue: clip(entry.newValue, FIELD_LIMITS.logValueMax),
    actor: entry.actor === 'AI 제안' ? 'AI 제안' : '사용자 수정',
    reason: clip(entry.reason, FIELD_LIMITS.logReasonMax),
    createdAt: serverTimestamp(),
  };
}

export async function logGoalActivity(uid: string, entry: GoalLogEntry): Promise<void> {
  const logId = makeId('glog');
  const path = `users/${uid}/goalActivityLogs/${logId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'goalActivityLogs', logId), goalActivityData(uid, entry));
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeGoalActivityLogs(
  uid: string,
  onData: (items: GoalActivityLog[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/goalActivityLogs`;
  const q = query(
    collection(db, 'users', uid, 'goalActivityLogs'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GoalActivityLog, 'id'>) })));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

// --- User Profile ---
export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveUserProfile(
  uid: string,
  input: {
    nickname: string;
    age?: number;
    ageGroup: AgeGroup;
    jobPrepStatus?: string;
    region: string;
    interests: string[];
    currentGoalFocus: string;
    onboardingCompleted: boolean;
    onboardingSkipped: boolean;
  }
): Promise<void> {
  const path = `users/${uid}`;
  const docRef = doc(db, 'users', uid);
  try {
    const existing = await getDoc(docRef);
    const basePayload: Record<string, unknown> = {
      nickname: clip(input.nickname, FIELD_LIMITS.nicknameMax) || '청년',
      ageGroup: input.ageGroup,
      jobPrepStatus: clip(input.jobPrepStatus, FIELD_LIMITS.jobPrepStatusMax),
      region: clip(input.region, FIELD_LIMITS.regionMax),
      interests: input.interests.slice(0, FIELD_LIMITS.interestsMaxCount).map((i) => clip(i, 30)).filter(Boolean),
      currentGoalFocus: clip(input.currentGoalFocus, FIELD_LIMITS.goalFocusMax),
      onboardingCompleted: input.onboardingCompleted,
      onboardingSkipped: input.onboardingSkipped,
      updatedAt: serverTimestamp(),
    };
    if (typeof input.age === 'number' && Number.isInteger(input.age) && input.age >= 15 && input.age <= 99) {
      basePayload.age = input.age;
    }
    if (existing.exists()) {
      await updateDoc(docRef, basePayload);
      await logActivity(uid, '프로필 수정', '온보딩·설정', '개인 맞춤 설정을 업데이트했습니다.');
    } else {
      await setDoc(docRef, {
        ownerId: uid,
        ...basePayload,
        createdAt: serverTimestamp(),
      });
      await logActivity(
        uid,
        input.onboardingSkipped ? '온보딩 건너뛰기' : '온보딩 완료',
        '온보딩·설정',
        input.onboardingSkipped ? '부담 없이 둘러보기로 시작했습니다.' : '초기 관심사와 목표를 설정했습니다.'
      );
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// --- Check-ins ---
export function subscribeCheckins(
  uid: string,
  onData: (items: DailyCheckin[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/checkins`;
  const q = query(
    collection(db, 'users', uid, 'checkins'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DailyCheckin, 'id'>) })));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createCheckin(
  uid: string,
  input: {
    moodScore: number;
    moodLabel: MoodLabel;
    energyLevel: number;
    availableMinutes: number;
    reflection: string;
    selfCareSuggestion: string;
    checkinDate: string;
  }
): Promise<string> {
  const id = makeId('chk');
  const path = `users/${uid}/checkins/${id}`;
  const mins = Math.min(
    FIELD_LIMITS.availableMinutesMax,
    Math.max(FIELD_LIMITS.availableMinutesMin, Math.round(input.availableMinutes || 20))
  );
  try {
    await setDoc(doc(db, 'users', uid, 'checkins', id), {
      ownerId: uid,
      moodScore: Math.min(5, Math.max(1, Math.round(input.moodScore))),
      moodLabel: input.moodLabel,
      energyLevel: Math.min(5, Math.max(1, Math.round(input.energyLevel))),
      availableMinutes: mins,
      reflection: clip(input.reflection, FIELD_LIMITS.reflectionMax),
      selfCareSuggestion: clip(input.selfCareSuggestion, FIELD_LIMITS.selfCareMax),
      checkinDate: input.checkinDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
  void logActivity(
    uid, '일일 체크인', '오늘의 체크인',
    `${input.moodLabel} 상태(에너지 ${input.energyLevel}/5 · 가용 시간 ${mins}분)를 기록했습니다.`
  ).catch(() => console.warn('Could not log check-in activity'));
  return id;
}

export async function updateCheckinAdvice(uid: string, id: string, suggestion: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'checkins', id), {
    selfCareSuggestion: clip(suggestion, FIELD_LIMITS.selfCareMax),
    updatedAt: serverTimestamp(),
  });
}

// --- Worries ---
export function subscribeWorries(
  uid: string,
  onData: (items: WorryItem[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/worries`;
  const q = query(
    collection(db, 'users', uid, 'worries'),
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorryItem, 'id'>) })));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createWorry(
  uid: string,
  input: {
    title: string;
    description: string;
    category: WorryCategory;
    aiSummary: string;
    nextStep: string;
  }
): Promise<string> {
  const id = makeId('wry');
  const path = `users/${uid}/worries/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'worries', id), {
      ownerId: uid,
      title: clip(input.title, FIELD_LIMITS.worryTitleMax) || '새로운 고민',
      description: clip(input.description, FIELD_LIMITS.worryDescMax),
      category: input.category,
      status: '해결 방법 탐색 중' as WorryStatus,
      aiSummary: clip(input.aiSummary, FIELD_LIMITS.worrySummaryMax),
      nextStep: clip(input.nextStep, FIELD_LIMITS.worryNextStepMax),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logActivity(uid, '고민 등록', '나의 고민', `"${clip(input.title, 40)}" 고민을 등록했습니다.`);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateWorryStatus(
  uid: string,
  worryId: string,
  title: string,
  status: WorryStatus
): Promise<void> {
  const path = `users/${uid}/worries/${worryId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'worries', worryId), {
      status,
      updatedAt: serverTimestamp(),
    });
    await logActivity(uid, '고민 상태 변경', '나의 고민', `"${clip(title, 40)}" 상태를 [${status}]로 변경했습니다.`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteWorry(uid: string, worryId: string): Promise<void> {
  const path = `users/${uid}/worries/${worryId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'worries', worryId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Roadmaps & Tasks ---
export function subscribeRoadmaps(
  uid: string,
  onData: (items: GrowthRoadmap[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/roadmaps`;
  const q = query(
    collection(db, 'users', uid, 'roadmaps'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GrowthRoadmap, 'id'>) })));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeRoadmapTasks(
  uid: string,
  roadmapId: string,
  onData: (items: RoadmapTask[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/roadmaps/${roadmapId}/tasks`;
  const q = query(
    collection(db, 'users', uid, 'roadmaps', roadmapId, 'tasks'),
    where('ownerId', '==', uid),
    where('roadmapId', '==', roadmapId),
    orderBy('sortOrder', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RoadmapTask, 'id'>) })));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeTasksByRoadmaps(
  uid: string,
  roadmapIds: string[],
  onData: (tasksMap: Record<string, RoadmapTask[]>) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (roadmapIds.length === 0) {
    onData({});
    return () => {};
  }
  const map: Record<string, RoadmapTask[]> = {};
  const unsubs = roadmapIds.map((rid) =>
    subscribeRoadmapTasks(
      uid,
      rid,
      (tasks) => {
        map[rid] = tasks;
        onData({ ...map });
      },
      onError
    )
  );
  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function createRoadmapWithTasks(
  uid: string,
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
): Promise<string> {
  const roadmapId = makeId('rm');
  const path = `users/${uid}/roadmaps/${roadmapId}`;
  const today = getTodayIsoDate();
  try {
    // First create parent roadmap so Master Gate exists() succeeds for task creations
    await setDoc(doc(db, 'users', uid, 'roadmaps', roadmapId), {
      ownerId: uid,
      title: clip(roadmapInput.title, FIELD_LIMITS.roadmapTitleMax) || '나의 작은 성장 로드맵',
      goalType: roadmapInput.goalType,
      timeframe: clip(roadmapInput.timeframe, FIELD_LIMITS.roadmapTimeframeMax) || '이번 주 (7일)',
      summary: clip(roadmapInput.summary, FIELD_LIMITS.roadmapSummaryMax),
      energyLevel: Math.min(5, Math.max(1, Math.round(roadmapInput.energyLevel ?? 3))),
      recommendationReason: clip(roadmapInput.recommendationReason, FIELD_LIMITS.recommendationReasonMax),
      energyFitExplanation: clip(roadmapInput.energyFitExplanation, FIELD_LIMITS.energyFitMax),
      status: 'active' as RoadmapStatus,
      progressPercent: 0,
      adjustmentReason: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const batch = writeBatch(db);
    tasksInput.slice(0, 12).forEach((task, idx) => {
      const taskId = makeId(`tsk${idx}`);
      const validScheduledDate =
        task.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(task.scheduledDate) ? task.scheduledDate : today;
      batch.set(doc(db, 'users', uid, 'roadmaps', roadmapId, 'tasks', taskId), {
        ownerId: uid,
        roadmapId,
        title: clip(task.title, FIELD_LIMITS.taskTitleMax) || '작은 실천 항목',
        description: clip(task.description, FIELD_LIMITS.taskDescriptionMax),
        cadence: task.cadence === 'weekly' ? 'weekly' : 'daily',
        dayLabel: clip(task.dayLabel, FIELD_LIMITS.dayLabelMax) || `Day ${idx + 1}`,
        scheduledDate: validScheduledDate,
        durationMinutes: Math.min(480, Math.max(5, Math.round(task.durationMinutes || 15))),
        status: '진행 예정' as TaskStatus,
        completed: false,
        completedAt: null,
        blockerNote: '',
        adjustedFrom: '',
        sortOrder: idx,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();

    await logGoalActivity(uid, {
      roadmapId,
      taskId: '',
      actionType: '로드맵 생성',
      changedField: '새 로드맵 저장',
      previousValue: '없음',
      newValue: `${clip(roadmapInput.title, 80)} (${tasksInput.length}개 실천 항목)`,
      actor,
      reason: clip(roadmapInput.recommendationReason || '사용자 승인 후 로드맵 저장', FIELD_LIMITS.logReasonMax),
    });

    await logActivity(
      uid,
      '로드맵 생성',
      '성장 로드맵',
      `"${clip(roadmapInput.title, 40)}" 로드맵(${tasksInput.length}개 실천 항목)을 저장했습니다.`
    );
    return roadmapId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateTaskStatus(
  uid: string,
  roadmapId: string,
  task: RoadmapTask,
  nextStatus: TaskStatus,
  allTasks: RoadmapTask[],
  blockerNote?: string,
  roadmapStatus?: RoadmapStatus
): Promise<void> {
  const prevStatus = getEffectiveTaskStatus(task);
  const nextCompleted = nextStatus === '완료';
  const taskPath = `users/${uid}/roadmaps/${roadmapId}/tasks/${task.id}`;
  const cleanedNote = blockerNote !== undefined ? clip(blockerNote, FIELD_LIMITS.blockerNoteMax) : task.blockerNote;

  try {
    await updateDoc(doc(db, 'users', uid, 'roadmaps', roadmapId, 'tasks', task.id), {
      status: nextStatus,
      completed: nextCompleted,
      completedAt: nextCompleted ? serverTimestamp() : null,
      blockerNote: cleanedNote,
      updatedAt: serverTimestamp(),
    });

    const updatedList = allTasks.map((t) =>
      t.id === task.id ? { ...t, status: nextStatus, completed: nextCompleted } : t
    );
    const progressPercent = computeProgressPercent(updatedList);

    if (roadmapStatus !== 'completed') {
      await updateDoc(doc(db, 'users', uid, 'roadmaps', roadmapId), {
        progressPercent,
        updatedAt: serverTimestamp(),
      });
    }

    await logGoalActivity(uid, {
      roadmapId,
      taskId: task.id,
      actionType: '실천 상태 변경',
      changedField: clip(task.title, 50),
      previousValue: prevStatus,
      newValue: nextStatus,
      actor: '사용자 수정',
      reason: cleanedNote || `달성률 ${progressPercent}%`,
    });

    await logActivity(
      uid,
      nextCompleted ? '목표 실천 완료' : '실천 상태 변경',
      '목표 달성 현황',
      `"${clip(task.title, 45)}" 상태를 [${nextStatus}]로 변경했습니다. (${progressPercent}%)`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, taskPath);
  }
}

export async function toggleRoadmapTask(
  uid: string,
  roadmapId: string,
  task: RoadmapTask,
  allTasks: RoadmapTask[],
  roadmapStatus?: RoadmapStatus
): Promise<void> {
  const currentStatus = getEffectiveTaskStatus(task);
  const nextStatus: TaskStatus = currentStatus === '완료' ? '진행 예정' : '완료';
  await updateTaskStatus(uid, roadmapId, task, nextStatus, allTasks, undefined, roadmapStatus);
}

export async function updateRoadmapDetails(
  uid: string,
  roadmap: GrowthRoadmap,
  updates: {
    title: string;
    summary: string;
    timeframe: string;
  },
  actor: GoalChangeActor = '사용자 수정'
): Promise<void> {
  const path = `users/${uid}/roadmaps/${roadmap.id}`;
  const nextTitle = clip(updates.title, FIELD_LIMITS.roadmapTitleMax) || roadmap.title;
  const nextSummary = clip(updates.summary, FIELD_LIMITS.roadmapSummaryMax);
  const nextTimeframe = clip(updates.timeframe, FIELD_LIMITS.roadmapTimeframeMax) || roadmap.timeframe;

  try {
    await updateDoc(doc(db, 'users', uid, 'roadmaps', roadmap.id), {
      title: nextTitle,
      summary: nextSummary,
      timeframe: nextTimeframe,
      updatedAt: serverTimestamp(),
    });

    if (nextTitle !== roadmap.title) {
      await logGoalActivity(uid, {
        roadmapId: roadmap.id,
        actionType: '로드맵 수정',
        changedField: '로드맵 제목',
        previousValue: roadmap.title,
        newValue: nextTitle,
        actor,
      });
    }
    if (nextTimeframe !== roadmap.timeframe) {
      await logGoalActivity(uid, {
        roadmapId: roadmap.id,
        actionType: '로드맵 수정',
        changedField: '실천 기간',
        previousValue: roadmap.timeframe,
        newValue: nextTimeframe,
        actor,
      });
    }
    if (nextSummary !== roadmap.summary) {
      await logGoalActivity(uid, {
        roadmapId: roadmap.id,
        actionType: '로드맵 수정',
        changedField: '로드맵 설명',
        previousValue: roadmap.summary || '(비어 있음)',
        newValue: nextSummary || '(비어 있음)',
        actor,
      });
    }

    await logActivity(uid, '로드맵 수정', '목표 달성 현황', `"${clip(nextTitle, 40)}" 로드맵 정보를 수정했습니다.`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateTaskDetails(
  uid: string,
  roadmap: GrowthRoadmap,
  task: RoadmapTask,
  updates: {
    title: string;
    description: string;
    durationMinutes: number;
    scheduledDate: string;
    dayLabel: string;
  },
  actor: GoalChangeActor = '사용자 수정'
): Promise<void> {
  const taskPath = `users/${uid}/roadmaps/${roadmap.id}/tasks/${task.id}`;
  const nextTitle = clip(updates.title, FIELD_LIMITS.taskTitleMax) || task.title;
  const nextDesc = clip(updates.description, FIELD_LIMITS.taskDescriptionMax);
  const nextMins = Math.min(480, Math.max(5, Math.round(updates.durationMinutes || task.durationMinutes)));
  const nextDate = /^\d{4}-\d{2}-\d{2}$/.test(updates.scheduledDate)
    ? updates.scheduledDate
    : task.scheduledDate || '';
  const nextDayLabel = clip(updates.dayLabel, FIELD_LIMITS.dayLabelMax) || task.dayLabel;

  try {
    await updateDoc(doc(db, 'users', uid, 'roadmaps', roadmap.id, 'tasks', task.id), {
      title: nextTitle,
      description: nextDesc,
      durationMinutes: nextMins,
      scheduledDate: nextDate,
      dayLabel: nextDayLabel,
      updatedAt: serverTimestamp(),
    });

    if (nextTitle !== task.title) {
      await logGoalActivity(uid, {
        roadmapId: roadmap.id,
        taskId: task.id,
        actionType: '항목 수정',
        changedField: '목표 제목',
        previousValue: task.title,
        newValue: nextTitle,
        actor,
      });
    }
    if (nextDesc !== (task.description || '')) {
      await logGoalActivity(uid, {
        roadmapId: roadmap.id,
        taskId: task.id,
        actionType: '항목 수정',
        changedField: '실행 방법 설명',
        previousValue: task.description || '(없음)',
        newValue: nextDesc || '(없음)',
        actor,
      });
    }
    if (nextMins !== task.durationMinutes) {
      await logGoalActivity(uid, {
        roadmapId: roadmap.id,
        taskId: task.id,
        actionType: '항목 수정',
        changedField: '예상 소요시간',
        previousValue: `${task.durationMinutes}분`,
        newValue: `${nextMins}분`,
        actor,
      });
    }
    if (nextDate !== (task.scheduledDate || '')) {
      await logGoalActivity(uid, {
        roadmapId: roadmap.id,
        taskId: task.id,
        actionType: '항목 수정',
        changedField: '실천 예정일',
        previousValue: task.scheduledDate || task.dayLabel,
        newValue: nextDate || nextDayLabel,
        actor,
      });
    }

    await logActivity(uid, '실천 항목 수정', '목표 달성 현황', `"${clip(nextTitle, 40)}" 세부 내용을 수정했습니다.`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, taskPath);
  }
}

export async function completeRoadmap(uid: string, roadmap: GrowthRoadmap): Promise<void> {
  const path = `users/${uid}/roadmaps/${roadmap.id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'roadmaps', roadmap.id), {
      status: 'completed' as RoadmapStatus,
      progressPercent: 100,
      updatedAt: serverTimestamp(),
    });
    await logGoalActivity(uid, {
      roadmapId: roadmap.id,
      actionType: '로드맵 완주',
      changedField: '로드맵 상태',
      previousValue: roadmap.status,
      newValue: 'completed',
      actor: '사용자 수정',
      reason: '모든 항목을 마치고 최종 완료를 확정했습니다.',
    });
    await logActivity(uid, '로드맵 완주', '목표 달성 현황', `"${clip(roadmap.title, 40)}" 로드맵을 최종 완료했습니다.`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export type RoadmapTaskChange = { input: RoadmapTaskInput; actor: GoalChangeActor } | { taskId: string };

export function applyRoadmapTaskChange(
  tasks: RoadmapTask[], ownerId: string, roadmapId: string, taskId: string, change: RoadmapTaskChange,
) {
  const adding = 'input' in change;
  const title = adding ? clip(change.input.title, FIELD_LIMITS.taskTitleMax) : tasks.find((task) => task.id === taskId)?.title;
  if (!title) return;

  const task: RoadmapTask | undefined = adding ? {
    id: taskId, ownerId, roadmapId, title,
    description: clip(change.input.description, FIELD_LIMITS.taskDescriptionMax),
    cadence: change.input.cadence,
    dayLabel: clip(change.input.dayLabel, FIELD_LIMITS.dayLabelMax) || '직접 추가',
    scheduledDate: change.input.scheduledDate || '',
    durationMinutes: Math.min(480, Math.max(5, Math.round(change.input.durationMinutes || 15))),
    status: '진행 예정', completed: false, completedAt: null, blockerNote: '', adjustedFrom: '',
    sortOrder: Math.min(500, tasks.reduce((highest, item) => Math.max(highest, item.sortOrder), -1) + 1),
  } : undefined;

  const next = task ? [...tasks, task] : tasks.filter((item) => item.id !== taskId);
  return {
    task, next, progressPercent: computeProgressPercent(next),
    log: {
      roadmapId, taskId, actionType: adding ? '실천 항목 추가' : '실천 항목 삭제',
      changedField: title, previousValue: adding ? '' : title, newValue: adding ? title : '',
      actor: adding ? change.actor : '사용자 수정' as const, reason: '',
    },
  };
}

export async function changeRoadmapTasks(uid: string, roadmapId: string, change: RoadmapTaskChange): Promise<void> {
  const roadmap = doc(db, 'users', uid, 'roadmaps', roadmapId);
  const taskId = 'input' in change ? makeId('tsk_manual') : change.taskId;
  const taskRef = doc(roadmap, 'tasks', taskId);
  const logRef = doc(db, 'users', uid, 'goalActivityLogs', makeId('glog'));
  const taskQuery = query(collection(roadmap, 'tasks'), where('ownerId', '==', uid), where('roadmapId', '==', roadmapId));
  await runTransaction(db, async (transaction) => {
    const parent = await transaction.get(roadmap);
    if (!parent.exists() || parent.data().status === 'completed') throw new Error('진행 중인 로드맵을 선택해 주세요.');
    const snapshot = await getDocsFromServer(taskQuery);
    const tasks = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as RoadmapTask));
    const result = applyRoadmapTaskChange(tasks, uid, roadmapId, taskId, change);
    if (!result) return;
    if (result.task) {
      const { id, ...data } = result.task;
      transaction.set(taskRef, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    } else {
      transaction.delete(taskRef);
    }
    transaction.update(roadmap, { progressPercent: result.progressPercent, updatedAt: serverTimestamp() });
    transaction.set(logRef, goalActivityData(uid, result.log));
  });
}

export async function applyTaskAdjustment(
  uid: string,
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
): Promise<void> {
  const taskPath = `users/${uid}/roadmaps/${roadmap.id}/tasks/${task.id}`;
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

  try {
    await updateDoc(doc(db, 'users', uid, 'roadmaps', roadmap.id, 'tasks', task.id), {
      adjustedFrom: clip(task.title, FIELD_LIMITS.taskTitleMax),
      title: nextTitle,
      description: nextDesc,
      durationMinutes: nextMins,
      dayLabel: clip(adjustment.dayLabel, FIELD_LIMITS.dayLabelMax) || task.dayLabel,
      scheduledDate: nextDate,
      blockerNote: clip(adjustment.blockerNote, FIELD_LIMITS.blockerNoteMax),
      status: '진행 예정' as TaskStatus,
      completed: false,
      completedAt: null,
      updatedAt: serverTimestamp(),
    });

    const updatedTasks = allTasks.map((t) =>
      t.id === task.id ? { ...t, status: '진행 예정' as TaskStatus, completed: false } : t
    );
    const nextProgress = computeProgressPercent(updatedTasks);

    if (roadmap.status !== 'completed') {
      await updateDoc(doc(db, 'users', uid, 'roadmaps', roadmap.id), {
        status: 'adjusted' as RoadmapStatus,
        progressPercent: nextProgress,
        adjustmentReason: clip(adjustment.adjustmentReason, FIELD_LIMITS.adjustmentReasonMax),
        updatedAt: serverTimestamp(),
      });
    }

    await logGoalActivity(uid, {
      roadmapId: roadmap.id,
      taskId: task.id,
      actionType: 'AI 유연 조정',
      changedField: '실천 항목 난이도·시간',
      previousValue: `${task.title} (${task.durationMinutes}분)`,
      newValue: `${nextTitle} (${nextMins}분)`,
      actor: 'AI 제안',
      reason: adjustment.adjustmentReason,
    });

    await logActivity(
      uid,
      '목표 유연 조정',
      '목표 달성 현황',
      `"${clip(task.title, 30)}"을(를) "${clip(nextTitle, 35)}"로 부담을 낮춰 재조정했습니다.`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, taskPath);
  }
}

export async function applyDailyRecommendation(
  uid: string,
  recommendation: DailyRecommendationResult,
  roadmaps: GrowthRoadmap[],
  tasksByRoadmap: Record<string, RoadmapTask[]>
): Promise<string> {
  const activeRoadmaps = roadmaps.filter((r) => r.status !== 'completed');
  const targetRoadmap =
    activeRoadmaps.find((r) => r.id === recommendation.targetRoadmapId) || activeRoadmaps[0] || null;
  const targetTasks = targetRoadmap ? tasksByRoadmap[targetRoadmap.id] || [] : [];
  const targetTask =
    targetTasks.find((t) => t.id === recommendation.targetTaskId) || null;

  // Case 1: Adjust or reschedule an existing task (never without user calling this explicit approval handler)
  if (targetRoadmap && targetTask && recommendation.strategy !== '새로운 작은 목표 추천') {
    if (recommendation.strategy === '기존 목표 유지') {
      const taskPath = `users/${uid}/roadmaps/${targetRoadmap.id}/tasks/${targetTask.id}`;
      try {
        await updateDoc(doc(db, 'users', uid, 'roadmaps', targetRoadmap.id, 'tasks', targetTask.id), {
          status: '실천 중' as TaskStatus,
          scheduledDate: recommendation.proposedTask.scheduledDate || getTodayIsoDate(),
          updatedAt: serverTimestamp(),
        });
        await logGoalActivity(uid, {
          roadmapId: targetRoadmap.id,
          taskId: targetTask.id,
          actionType: 'AI 추천 적용 (기존 목표 유지)',
          changedField: '실천 상태·예정일',
          previousValue: getEffectiveTaskStatus(targetTask),
          newValue: `실천 중 (${recommendation.proposedTask.scheduledDate})`,
          actor: 'AI 제안',
          reason: recommendation.recommendationReason,
        });
        return targetRoadmap.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, taskPath);
      }
    }

    await applyTaskAdjustment(uid, targetRoadmap, targetTask, targetTasks, {
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

  // Case 2: Add new small goal into existing active roadmap or create a tiny roadmap
  if (targetRoadmap) {
    const newTaskId = makeId(`tsk_rec`);
    const taskPath = `users/${uid}/roadmaps/${targetRoadmap.id}/tasks/${newTaskId}`;
    try {
      await setDoc(doc(db, 'users', uid, 'roadmaps', targetRoadmap.id, 'tasks', newTaskId), {
        ownerId: uid,
        roadmapId: targetRoadmap.id,
        title: clip(recommendation.proposedTask.title, FIELD_LIMITS.taskTitleMax),
        description: clip(recommendation.proposedTask.description, FIELD_LIMITS.taskDescriptionMax),
        cadence: recommendation.proposedTask.cadence === 'weekly' ? 'weekly' : 'daily',
        dayLabel: clip(recommendation.proposedTask.dayLabel, FIELD_LIMITS.dayLabelMax) || '오늘',
        scheduledDate: recommendation.proposedTask.scheduledDate || getTodayIsoDate(),
        durationMinutes: Math.min(180, Math.max(5, Math.round(recommendation.proposedTask.durationMinutes || 10))),
        status: '진행 예정' as TaskStatus,
        completed: false,
        completedAt: null,
        blockerNote: '',
        adjustedFrom: '',
        sortOrder: targetTasks.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const nextProgress = computeProgressPercent([
        ...targetTasks,
        {
          id: newTaskId,
          ownerId: uid,
          roadmapId: targetRoadmap.id,
          title: recommendation.proposedTask.title,
          cadence: 'daily',
          dayLabel: recommendation.proposedTask.dayLabel,
          durationMinutes: recommendation.proposedTask.durationMinutes,
          completed: false,
          status: '진행 예정',
          blockerNote: '',
          adjustedFrom: '',
          sortOrder: targetTasks.length,
        },
      ]);

      await updateDoc(doc(db, 'users', uid, 'roadmaps', targetRoadmap.id), {
        status: 'adjusted' as RoadmapStatus,
        progressPercent: nextProgress,
        adjustmentReason: clip(recommendation.recommendationReason, FIELD_LIMITS.adjustmentReasonMax),
        updatedAt: serverTimestamp(),
      });

      await logGoalActivity(uid, {
        roadmapId: targetRoadmap.id,
        taskId: newTaskId,
        actionType: `AI 추천 적용 (${recommendation.strategy})`,
        changedField: '새 작은 목표 추가',
        previousValue: '없음',
        newValue: `${recommendation.proposedTask.title} (${recommendation.proposedTask.durationMinutes}분)`,
        actor: 'AI 제안',
        reason: recommendation.recommendationReason,
      });

      await logActivity(
        uid,
        'AI 작은 목표 추가',
        '나의 대시보드',
        `"${clip(recommendation.proposedTask.title, 40)}" 목표를 승인하여 추가했습니다.`
      );
      return targetRoadmap.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, taskPath);
    }
  }

  // Case 3: No active roadmap yet -> create a new lightweight roadmap from approved AI recommendation
  return await createRoadmapWithTasks(
    uid,
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
}

export async function addProgramMissionToRoadmap(
  uid: string,
  program: Pick<PublicProgram, 'programId' | 'title' | 'provider' | 'howToApply'>,
  roadmaps: GrowthRoadmap[],
  tasksByRoadmap: Record<string, RoadmapTask[]>,
  mission?: { title: string; description: string; durationMinutes: number },
): Promise<string> {
  const activeRoadmap = roadmaps.find((r) => r.status !== 'completed') || null;
  const missionTitle = mission?.title ?? `[지원 준비] ${clip(program.title, 120)} 자격·신청 조건 확인하기`;
  const missionDesc = mission?.description ?? `${clip(program.provider, 60)} 공식 안내 페이지에서 자격 요건과 신청 일정을 확인해 보세요. (${clip(program.howToApply, 220)})`;
  const today = getTodayIsoDate();

  if (activeRoadmap) {
    const existingTasks = tasksByRoadmap[activeRoadmap.id] || [];
    if (mission && existingTasks.some((task) => task.title === missionTitle && task.description === missionDesc)) return activeRoadmap.id;
    const taskId = makeId('tsk_prog');
    const path = `users/${uid}/roadmaps/${activeRoadmap.id}/tasks/${taskId}`;
    try {
      await setDoc(doc(db, 'users', uid, 'roadmaps', activeRoadmap.id, 'tasks', taskId), {
        ownerId: uid,
        roadmapId: activeRoadmap.id,
        title: clip(missionTitle, FIELD_LIMITS.taskTitleMax),
        description: clip(missionDesc, FIELD_LIMITS.taskDescriptionMax),
        cadence: 'daily',
        dayLabel: '지원 준비',
        scheduledDate: today,
        durationMinutes: mission?.durationMinutes ?? 20,
        status: '진행 예정' as TaskStatus,
        completed: false,
        completedAt: null,
        blockerNote: '',
        adjustedFrom: '',
        sortOrder: existingTasks.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const nextProgress = computeProgressPercent([
        ...existingTasks,
        {
          id: taskId,
          ownerId: uid,
          roadmapId: activeRoadmap.id,
          title: missionTitle,
          cadence: 'daily',
          dayLabel: '지원 준비',
          durationMinutes: mission?.durationMinutes ?? 20,
          completed: false,
          status: '진행 예정',
          blockerNote: '',
          adjustedFrom: '',
          sortOrder: existingTasks.length,
        },
      ]);

      await updateDoc(doc(db, 'users', uid, 'roadmaps', activeRoadmap.id), {
        progressPercent: nextProgress,
        status: activeRoadmap.status,
        updatedAt: serverTimestamp(),
      });

      await logGoalActivity(uid, {
        roadmapId: activeRoadmap.id,
        taskId,
        actionType: '지원 프로그램 미션 추가',
        changedField: '새 신청 준비 미션',
        previousValue: '없음',
        newValue: clip(missionTitle, 120),
        actor: '사용자 수정',
        reason: `지원 프로그램 [${clip(program.title, 60)}] 연계`,
      });

      await logActivity(
        uid,
        '지원 준비 미션 추가',
        '성장 로드맵',
        `"${clip(program.title, 40)}" 신청 준비 미션을 로드맵에 추가했습니다.`
      );
      return activeRoadmap.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  return await createRoadmapWithTasks(
    uid,
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
}

// --- AI Conversations ---
export function subscribeConversations(
  uid: string,
  onData: (items: AgentMessage[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/conversations`;
  const q = query(
    collection(db, 'users', uid, 'conversations'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgentMessage, 'id'>) })));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function appendAgentMessage(
  uid: string,
  msg: {
    role: 'user' | 'assistant';
    content: string;
    supportType?: string;
    suggestedAction?: string;
    threadId?: string;
  }
): Promise<string> {
  const id = messageRecordId(makeId('msg'), msg.threadId);
  const path = `users/${uid}/conversations/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'conversations', id), {
      ownerId: uid,
      role: msg.role,
      content: clip(msg.content, FIELD_LIMITS.messageContentMax) || '...',
      supportType: clip(msg.supportType, 80),
      suggestedAction: clip(msg.suggestedAction, 200),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
  return id;
}

// --- Activity History ---
export function subscribeActivities(
  uid: string,
  onData: (items: ActivityLog[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/activities`;
  const q = query(
    collection(db, 'users', uid, 'activities'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) })));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

// --- Saved Programs ---
export function subscribeSavedPrograms(
  uid: string,
  onData: (items: SavedProgram[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/savedPrograms`;
  const q = query(
    collection(db, 'users', uid, 'savedPrograms'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavedProgram, 'id'>) })));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveProgramBookmark(
  uid: string,
  program: PublicProgram,
  notifyRequested: boolean
): Promise<void> {
  const safeId = program.programId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `users/${uid}/savedPrograms/${safeId}`;
  try {
    const ref = doc(db, 'users', uid, 'savedPrograms', safeId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        notifyRequested,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId: uid,
        programId: safeId,
        title: clip(program.title, 160),
        provider: clip(program.provider, 100),
        region: clip(program.region, 40),
        category: clip(program.category, 60),
        applyUrl: clip(program.applyUrl, 500),
        notifyRequested,
        deadline: clip(program.deadline, 40),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await logActivity(
      uid,
      '지원정보 저장',
      '지원 프로그램',
      `"${clip(program.title, 40)}" 프로그램을 관심 목록에 저장했습니다.`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function removeSavedProgram(uid: string, programId: string): Promise<void> {
  const path = `users/${uid}/savedPrograms/${programId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'savedPrograms', programId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Recommended Programs (from Worry Analysis) ---
export function subscribeRecommendedPrograms(
  uid: string,
  onData: (items: RecommendedProgramItem[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/recommendedPrograms`;
  const q = query(
    collection(db, 'users', uid, 'recommendedPrograms'),
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as RecommendedProgramItem));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveRecommendedPrograms(
  uid: string,
  items: RecommendedProgramItem[]
): Promise<void> {
  if (!items.length) return;
  for (const item of items.slice(0, 3)) {
    const safeId = item.programId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || makeId('rec');
    const path = `users/${uid}/recommendedPrograms/${safeId}`;
    try {
      const ref = doc(db, 'users', uid, 'recommendedPrograms', safeId);
      const existing = await getDoc(ref);
      const updatable = {
        title: clip(item.title, 160) || '청년 지원 프로그램',
        provider: clip(item.provider, 100) || '공공기관',
        region: clip(item.region, 40) || '전국',
        category: clip(item.category, 60) || '취업지원·수당',
        summary: clip(item.summary, 600),
        eligibility: clip(item.eligibility, 400),
        howToApply: clip(item.howToApply, 400),
        deadline: clip(item.deadline, 80),
        applyUrl: clip(item.applyUrl, 500),
        sourceNote: clip(item.sourceNote, 200),
        linkType: clip(item.linkType || '공식 안내 페이지', 40),
        recruitmentStatus: clip(item.recruitmentStatus || '모집 상태 확인 필요', 60),
        recommendationReason: clip(item.recommendationReason, 500),
        conditionNote: clip(item.conditionNote, 400),
        worrySummary: clip(item.worrySummary, 200),
        updatedAt: serverTimestamp(),
      };
      if (existing.exists()) {
        await updateDoc(ref, updatable);
      } else {
        await setDoc(ref, {
          ownerId: uid,
          programId: safeId,
          ...updatable,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }
}
