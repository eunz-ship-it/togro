import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Clock, Sparkles } from 'lucide-react';
import { fetchDailyGoals } from '../lib/api';
import type { DailyGoalPlan } from '../lib/activityWorkspace';
import {
  computeProgressPercent,
  getEffectiveTaskStatus,
} from '../lib/firestoreService';
import type { WorkspaceActions } from '../lib/workspaceData';
import {
  buildActiveRoadmapsPayload,
  buildActiveWorriesPayload,
  buildLatestCheckinPayload,
  buildRecentTasks7Days,
  selectTodayRoadmapTasks,
} from '../lib/roadmapContext';
import {
  DAILY_GOAL_LIMIT,
  type DailyCheckin,
  type DailyGoal,
  type DailyGoalsResult,
  type GrowthRoadmap,
  type RoadmapTask,
  type RoadmapTaskInput,
  type UserProfile,
  type WorryItem,
} from '../types/domain';

interface DashboardViewProps {
  actions: WorkspaceActions;
  profile: UserProfile | null;
  checkins: DailyCheckin[];
  worries: WorryItem[];
  roadmaps: GrowthRoadmap[];
  tasksByRoadmap: Record<string, RoadmapTask[]>;
  today: string;
  demo: boolean;
  dailyGoalPlan?: DailyGoalPlan;
  onDailyGoals: (date: string, response: DailyGoalsResult) => void;
  onDailyGoalSaved: (date: string, index: number) => void;
  onCheckin: () => void;
  onChat: () => void;
  onProgress: (roadmapId?: string) => void;
  onRoadmap: () => void;
  onEditOnboarding: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  actions,
  profile,
  checkins,
  worries,
  roadmaps,
  tasksByRoadmap,
  today,
  demo,
  dailyGoalPlan,
  onDailyGoals,
  onDailyGoalSaved,
  onCheckin, onChat, onProgress, onRoadmap,
  onEditOnboarding,
}) => {
  const latestCheckin = checkins[0] ?? null;
  const activeWorryCount = worries.filter((w) => w.status !== '해결됨').length;
  const primaryRoadmap = roadmaps[0] ?? null;
  const primaryRoadmapTasks = primaryRoadmap ? tasksByRoadmap[primaryRoadmap.id] || [] : [];
  const primaryProgress =
    primaryRoadmap && primaryRoadmapTasks.length > 0
      ? computeProgressPercent(primaryRoadmapTasks)
      : primaryRoadmap?.progressPercent ?? 0;

  const todayRoadmapTasks = useMemo(
    () => selectTodayRoadmapTasks(roadmaps, tasksByRoadmap, today),
    [roadmaps, tasksByRoadmap, today]
  );

  const recentTasks7Days = useMemo(
    () => buildRecentTasks7Days(roadmaps, tasksByRoadmap, today),
    [roadmaps, tasksByRoadmap, today]
  );

  const recentIncompleteCount = useMemo(
    () =>
      recentTasks7Days.filter(
        (t) => t.status === '미완료' || (!t.completed && t.scheduledDate < today)
      ).length,
    [recentTasks7Days, today]
  );

  const [loadingRec, setLoadingRec] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState('');
  const activeRoadmaps = roadmaps.filter((roadmap) => roadmap.status !== 'completed');
  const destination = activeRoadmaps.find((roadmap) => roadmap.id === selectedDestination) ?? activeRoadmaps[0];

  const handleRequestDailyRecommendation = async () => {
    if (loadingRec || dailyGoalPlan) return;
    setLoadingRec(true);
    setRecError(null);
    try {
      const activeTasksPayload = activeRoadmaps.flatMap((rm) =>
        (tasksByRoadmap[rm.id] || [])
          .filter((t) => getEffectiveTaskStatus(t) !== '완료')
          .map((t) => ({
            id: t.id,
            roadmapId: rm.id,
            roadmapTitle: rm.title,
            title: t.title,
            description: t.description || '',
            status: getEffectiveTaskStatus(t),
            completed: t.completed,
            durationMinutes: t.durationMinutes,
            scheduledDate: t.scheduledDate || '',
            dayLabel: t.dayLabel,
            cadence: t.cadence,
          }))
      );

      const res = await fetchDailyGoals({
        todayDate: today,
        demo,
        latestCheckin: buildLatestCheckinPayload(latestCheckin),
        recentTasks7Days,
        activeRoadmaps: buildActiveRoadmapsPayload(roadmaps),
        activeTasks: activeTasksPayload,
        activeWorries: buildActiveWorriesPayload(worries),
      });
      onDailyGoals(today, res);
    } catch (err) {
      setRecError(err instanceof Error ? err.message : 'AI 맞춤 추천을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingRec(false);
    }
  };

  const handleSaveDailyGoal = async (goal: DailyGoal, index: number) => {
    if (!dailyGoalPlan || savingIndex !== null || dailyGoalPlan.savedIndexes.includes(index)) return;
    setSavingIndex(index);
    setRecError(null);
    try {
      const task: RoadmapTaskInput = { ...goal, cadence: 'daily', scheduledDate: today, dayLabel: '오늘' };
      const actor = dailyGoalPlan.source === 'gemini' ? 'AI 제안' : '사용자 수정';
      if (destination) {
        await actions.addRoadmapTask(destination.id, task, actor);
      } else {
        await actions.createRoadmapWithTasks({ title: goal.title, goalType: '사용자 직접 설정', timeframe: '오늘 하루', summary: goal.description }, [task], actor);
      }
      onDailyGoalSaved(today, index);
    } catch (err) {
      setRecError(err instanceof Error ? err.message : '목표를 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSavingIndex(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[var(--tg-text-muted)] mb-1">
            {profile?.region ? `${profile.region} · ` : ''}
            {profile?.jobPrepStatus ? `${profile.jobPrepStatus} · ` : ''}
            {profile?.nickname ? `${profile.nickname}님의 성장 기록` : '성장 기록'}
          </p>
          <h1 className="font-display text-2xl font-bold text-[var(--tg-text-strong)]">
            나의 현황
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onEditOnboarding}
            className="tg-btn-secondary px-4 py-2 text-xs whitespace-nowrap cursor-pointer"
          >
            내 정보·관심사 설정
          </button>
          <button
            type="button"
            onClick={onCheckin}
            className="tg-btn-primary px-4 py-2 text-xs whitespace-nowrap cursor-pointer"
          >
            오늘 컨디션 체크인
          </button>
        </div>
      </div>

      {/* Workspace summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={onCheckin}
          className="text-left tg-card p-5 hover:border-[var(--tg-primary)] transition-colors cursor-pointer"
        >
          <p className="text-xs font-medium text-[var(--tg-text-muted)] mb-1.5">오늘의 상태 점검</p>
          <p className="font-display text-lg font-bold text-[var(--tg-text-strong)]">
            {latestCheckin ? latestCheckin.moodLabel : '아직 기록 전'}
          </p>
          <p className="font-mono text-xs text-[var(--tg-text-muted)] mt-1.5 tabular-nums">
            {latestCheckin
              ? `${latestCheckin.checkinDate} · 에너지 ${latestCheckin.energyLevel}/5${
                  typeof latestCheckin.availableMinutes === 'number'
                    ? ` · ${latestCheckin.availableMinutes}분`
                    : ''
                }`
              : '오늘의 기분을 가볍게 기록해 보세요'}
          </p>
        </button>

        <button
          type="button"
          onClick={onChat}
          className="text-left tg-card p-5 hover:border-[var(--tg-primary)] transition-colors cursor-pointer"
        >
          <p className="text-xs font-medium text-[var(--tg-text-muted)] mb-1.5">정리 중인 고민</p>
          <p className="font-mono text-lg font-bold text-[var(--tg-text-strong)] tabular-nums">
            {activeWorryCount}건
          </p>
          <p className="text-xs text-[var(--tg-text-muted)] mt-1.5 truncate">
            {worries[0]?.title || '부담되는 고민을 꺼내 정리해 보세요'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onProgress(primaryRoadmap?.id)}
          className="text-left tg-card p-5 hover:border-[var(--tg-primary)] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-xs font-medium text-[var(--tg-text-muted)]">성장 로드맵 진행률</p>
            <span className="font-mono text-xs font-semibold text-[var(--tg-success)] tabular-nums">
              {primaryRoadmap ? `${primaryProgress}%` : '0%'}
            </span>
          </div>
          <p className="text-sm font-bold text-[var(--tg-text-strong)] truncate mb-2.5">
            {primaryRoadmap ? primaryRoadmap.title : '작은 목표를 만들어 보세요'}
          </p>
          <div className="w-full h-2 bg-[var(--tg-primary-soft)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--tg-secondary)] transition-all duration-200"
              style={{ width: `${primaryRoadmap ? primaryProgress : 0}%` }}
            />
          </div>
        </button>


      </div>

      {/* Small goals and saved concerns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 tg-card p-6 space-y-4">
          <section aria-labelledby="daily-goals-title" className="space-y-3 border-b border-[var(--tg-border)] pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="daily-goals-title" className="font-display text-base font-bold text-[var(--tg-text-strong)]">
                  오늘의 목표 제안
                </h2>
                <p className="mt-0.5 text-xs text-[var(--tg-text-muted)]">
                  체크인과 실천 기록을 바탕으로 하루 최대 {DAILY_GOAL_LIMIT}개를 제안해요.
                </p>
              </div>
              {!dailyGoalPlan && (
                <button type="button" disabled={loadingRec} onClick={handleRequestDailyRecommendation}
                  className="tg-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  {loadingRec ? '추천 분석 중...' : '오늘 목표 추천받기'}
                </button>
              )}
            </div>
            {recError && <p role="alert" className="text-xs font-medium text-[var(--tg-error)]">{recError}</p>}
            {dailyGoalPlan && (
              <>
                {dailyGoalPlan.source === 'checkin' && <p className="text-xs text-[var(--tg-text-muted)]">체크인과 기록을 참고한 기본 제안이에요.</p>}
                {activeRoadmaps.length > 0 && (
                  <label className="flex flex-wrap items-center gap-2 text-xs">
                    저장할 로드맵
                    <select value={destination?.id} onChange={(event) => setSelectedDestination(event.target.value)}
                      disabled={savingIndex !== null} className="tg-input min-w-0 max-w-full px-2.5 py-1.5">
                      {activeRoadmaps.map((roadmap) => <option key={roadmap.id} value={roadmap.id}>{roadmap.title}</option>)}
                    </select>
                  </label>
                )}
                <ul className="space-y-2" aria-label="오늘의 추천 목표">
                  {dailyGoalPlan.suggestions.map((goal, index) => {
                    const saved = dailyGoalPlan.savedIndexes.includes(index);
                    return (
                      <li key={goal.title} className="space-y-2 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-bg)] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-bold text-[var(--tg-text-strong)]">{goal.title}</p>
                          <span className="text-xs text-[var(--tg-text-muted)]">{goal.durationMinutes}분</span>
                        </div>
                        {goal.description && <p className="text-xs leading-relaxed">{goal.description}</p>}
                        {saved ? <p role="status" className="text-xs font-semibold text-[var(--tg-success)]">로드맵에 저장됨</p> : (
                          <button type="button" disabled={savingIndex !== null} onClick={() => handleSaveDailyGoal(goal, index)}
                            className="tg-btn-secondary min-h-9 cursor-pointer px-3 text-xs">
                            {savingIndex === index ? '저장 중...' : destination ? '로드맵에 추가' : '새 로드맵으로 저장'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[var(--tg-text-strong)]">오늘의 로드맵 실천</h2>
              <p className="mt-0.5 text-xs text-[var(--tg-text-muted)]">
                오늘 일정과 진행 중인 실천을 모았어요.
                {recentIncompleteCount > 0 && ` 최근 미완료 항목이 ${recentIncompleteCount}건 있어요.`}
              </p>
            </div>
            <button type="button" onClick={primaryRoadmap ? () => onProgress(primaryRoadmap.id) : onRoadmap}
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold underline underline-offset-4">
              {primaryRoadmap ? '전체 로드맵 실천 보기' : '로드맵 만들기'}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          {todayRoadmapTasks.length === 0 ? (
            <div className="py-6 px-4 text-center bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-xl">
              <p className="text-sm font-semibold text-[var(--tg-text)]">아직 연결된 오늘의 작은 목표가 없습니다.</p>
              <p className="text-xs text-[var(--tg-text-muted)] mt-1 mb-4">
                대화에서 작은 행동을 저장하거나 성장 로드맵에서 직접 만들어 보세요.
              </p>
              <button
                type="button"
                onClick={onRoadmap}
                className="tg-btn-primary px-4 py-2 text-xs cursor-pointer"
              >
                성장 로드맵 설계하기
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {todayRoadmapTasks.map(({ task, roadmap }) => {
                const status = getEffectiveTaskStatus(task);
                const isDone = status === '완료';
                const rmTasks = tasksByRoadmap[roadmap.id] || [];
                const reasonText =
                  roadmap.recommendationReason || roadmap.adjustmentReason || roadmap.summary;
                return (
                  <div
                    key={task.id}
                    className="p-4 bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-xl space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <button
                          type="button"
                          disabled={roadmap.status === 'completed'}
                          aria-label={`${task.title} 완료 전환`}
                          onClick={() =>
                            actions.toggleRoadmapTask(roadmap.id, task, rmTasks, roadmap.status)
                          }
                          className="cursor-pointer disabled:cursor-default mt-0.5 shrink-0"
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-[var(--tg-success)]" />
                          ) : (
                            <Circle className="w-5 h-5 text-[var(--tg-primary)] hover:text-[var(--tg-text)]" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--tg-text-muted)]">
                            <button
                              type="button"
                              onClick={() => onProgress(roadmap.id)}
                              className="font-semibold text-[var(--tg-text)] hover:text-[var(--tg-text-strong)] underline underline-offset-2 cursor-pointer"
                            >
                              {roadmap.title}
                            </button>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {task.durationMinutes}분
                            </span>
                            {task.scheduledDate && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">{task.scheduledDate}</span>
                              </>
                            )}
                          </div>
                          <p
                            className={`text-sm font-semibold ${
                              isDone ? 'line-through text-[var(--tg-placeholder)]' : 'text-[var(--tg-text-strong)]'
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-[var(--tg-text)] leading-relaxed">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[11px] px-2.5 py-1 rounded-lg border shrink-0 whitespace-nowrap ${
                          isDone
                            ? 'bg-[var(--tg-secondary-soft)] border-[var(--tg-secondary)] text-[var(--tg-success)] font-semibold'
                            : 'bg-[var(--tg-surface)] border-[var(--tg-border)] text-[var(--tg-text)] font-medium'
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    {reasonText && (
                      <p className="text-[11px] text-[var(--tg-text-muted)] pl-7 leading-relaxed">
                        <span className="font-semibold text-[var(--tg-text)]">추천 이유: </span>
                        {reasonText}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 tg-card space-y-3 p-6">
          <h2 className="font-display text-base font-bold text-[var(--tg-text-strong)]">저장한 고민</h2>
          {worries.length === 0 ? <p className="text-sm text-[var(--tg-text-muted)]">대화에서 정리한 고민을 여기에서 확인할 수 있어요.</p> : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {worries.map((worry) => (
                <li key={worry.id}>
                  <details className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-bg)] p-3 text-sm">
                    <summary className="cursor-pointer font-semibold text-[var(--tg-text-strong)]">{worry.title} · {worry.status}</summary>
                    {worry.aiSummary && <p className="mt-2 whitespace-pre-wrap leading-relaxed">{worry.aiSummary}</p>}
                    {worry.nextStep && <p className="mt-2 font-semibold text-[var(--tg-success)]">{worry.nextStep}</p>}
                  </details>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={onChat} className="tg-btn-secondary cursor-pointer px-3 text-sm">대화·체크인 열기</button>
        </div>
      </div>
    </div>
  );
};
