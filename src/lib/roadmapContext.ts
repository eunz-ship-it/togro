import { getEffectiveTaskStatus, getTodayIsoDate } from './firestoreService';
import { koreaDate, recordTime } from './koreaDate';
import type { DailyCheckin, GrowthRoadmap, RoadmapTask, WorryItem } from '../types/domain';

function toDateIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    const d = (value as { toDate: () => Date }).toDate();
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export function buildRecentTasks7Days(
  roadmaps: GrowthRoadmap[],
  tasksByRoadmap: Record<string, RoadmapTask[]>,
  today = getTodayIsoDate()
) {
  const sevenDaysAgo = new Date(new Date(`${today}T00:00:00Z`).getTime() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  const roadmapTitleMap = new Map(roadmaps.map((r) => [r.id, r.title]));
  const result: Array<{
    id: string;
    roadmapId: string;
    roadmapTitle: string;
    title: string;
    status: string;
    completed: boolean;
    durationMinutes: number;
    scheduledDate: string;
    blockerNote: string;
  }> = [];

  for (const [roadmapId, tasks] of Object.entries(tasksByRoadmap)) {
    for (const t of tasks) {
      const dateStr = t.scheduledDate || toDateIso(t.updatedAt) || toDateIso(t.createdAt) || today;
      if (dateStr >= sevenDaysAgo && dateStr <= today) {
        result.push({
          id: t.id,
          roadmapId,
          roadmapTitle: roadmapTitleMap.get(roadmapId) || '성장 로드맵',
          title: t.title,
          status: getEffectiveTaskStatus(t),
          completed: t.completed || getEffectiveTaskStatus(t) === '완료',
          durationMinutes: t.durationMinutes,
          scheduledDate: dateStr,
          blockerNote: t.blockerNote || '',
        });
      }
    }
  }

  return result;
}

export function buildLatestCheckinPayload(latestCheckin: DailyCheckin | null) {
  if (!latestCheckin) return null;
  return {
    moodLabel: latestCheckin.moodLabel,
    moodScore: latestCheckin.moodScore,
    energyLevel: latestCheckin.energyLevel,
    availableMinutes: latestCheckin.availableMinutes,
    reflection: latestCheckin.reflection,
    checkinDate: latestCheckin.checkinDate,
  };
}

export function buildActiveRoadmapsPayload(roadmaps: GrowthRoadmap[]) {
  return roadmaps
    .filter((r) => r.status !== 'completed')
    .map((r) => ({
      id: r.id,
      title: r.title,
      goalType: r.goalType,
      timeframe: r.timeframe,
      progressPercent: r.progressPercent,
      status: r.status,
    }));
}

export function buildActiveWorriesPayload(worries: WorryItem[]) {
  return worries
    .filter((w) => w.status !== '해결됨')
    .map((w) => ({
      title: w.title,
      category: w.category,
      status: w.status,
    }));
}

export function selectTodayRoadmapTasks(
  roadmaps: GrowthRoadmap[],
  tasksByRoadmap: Record<string, RoadmapTask[]>,
  today = getTodayIsoDate()
): Array<{ task: RoadmapTask; roadmap: GrowthRoadmap }> {
  const activeRoadmaps = roadmaps.filter((r) => r.status !== 'completed');
  const candidates: Array<{ task: RoadmapTask; roadmap: GrowthRoadmap; priority: number }> = [];

  for (const rm of activeRoadmaps) {
    const list = tasksByRoadmap[rm.id] || [];
    for (const task of list) {
      const status = getEffectiveTaskStatus(task);
      const completedAt = recordTime(task.completedAt);
      const isCompletedToday = status === '완료' && completedAt > 0 && koreaDate(completedAt) === today;
      if (task.scheduledDate !== today && status !== '실천 중' && !isCompletedToday) continue;
      const priority = status === '실천 중' ? 0 : status === '진행 예정' ? 1 : status === '미완료' ? 2 : 3;
      candidates.push({ task, roadmap: rm, priority });
    }
  }

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.task.sortOrder - b.task.sortOrder;
  });

  return candidates.map(({ task, roadmap }) => ({ task, roadmap }));
}
