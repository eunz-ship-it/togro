import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Edit3,
  History,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { adjustRoadmapTask, generateRoadmap } from '../lib/api';
import {
  computeProgressPercent,
  getEffectiveTaskStatus,
  getTodayIsoDate,
} from '../lib/firestoreService';
import type { WorkspaceActions } from '../lib/workspaceData';
import {
  buildActiveRoadmapsPayload,
  buildActiveWorriesPayload,
  buildLatestCheckinPayload,
  buildRecentTasks7Days,
} from '../lib/roadmapContext';
import {
  FIELD_LIMITS,
  type DailyCheckin,
  type GeneratedRoadmapPreview,
  type GoalActivityLog,
  type GoalType,
  type GrowthRoadmap,
  type RecommendedProgramItem,
  type RoadmapTask,
  type TaskStatus,
  type WorryItem,
} from '../types/domain';

const GOAL_EXAMPLES: Record<GoalType, string> = {
  '생활 습관': '예: 아침 7시에 일어나는 습관 만들기',
  '학업·학습': '예: 정보처리기사 필기 기출문제 공부하기',
  '자기계발': '예: 엑셀로 일주일 지출표 만들기',
  '진로 탐색': '예: 생산 관리와 품질 관리의 실제 업무 비교하기',
  '취업 준비': '예: 공공기관 행정직 면접 준비하기',
  '사용자 직접 설정': '예: 동아리 행사 운영 맡을 사람과 일정 정하기',
};

const GOAL_TYPES = Object.keys(GOAL_EXAMPLES) as GoalType[];

const TIMEFRAMES = ['오늘 하루', '이번 주 (7일)', '2주 계획', '한 달 호흡'];

const TASK_STATUSES: TaskStatus[] = ['진행 예정', '실천 중', '완료', '미완료', '건너뛰기'];

const BLOCKER_QUICK_REASONS = ['시간 부족', '컨디션 저하', '일정 변경', '방법이 막막함'];

function formatLogTime(createdAt: unknown): string {
  if (!createdAt) return '방금 전';
  if (
    typeof createdAt === 'object' &&
    createdAt !== null &&
    'toDate' in createdAt &&
    typeof (createdAt as { toDate: () => Date }).toDate === 'function'
  ) {
    const d = (createdAt as { toDate: () => Date }).toDate();
    return d.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return '기록됨';
}

function getStatusBadgeClass(status: TaskStatus): string {
  switch (status) {
    case '완료':
      return 'bg-[var(--tg-secondary-soft)] border-[var(--tg-secondary)] text-[var(--tg-success)] font-semibold';
    case '실천 중':
      return 'bg-[var(--tg-primary-soft)] border-[var(--tg-primary)] text-[var(--tg-text-strong)] font-semibold';
    case '미완료':
      return 'bg-[var(--tg-warning-soft)] border-[var(--tg-warning-border)] text-[var(--tg-warning)] font-semibold';
    case '건너뛰기':
      return 'bg-[var(--tg-bg)] border-[var(--tg-border)] text-[var(--tg-text-muted)]';
    default:
      return 'bg-[var(--tg-surface)] border-[var(--tg-border)] text-[var(--tg-text)]';
  }
}

export const RoadmapView: React.FC<{
  actions: WorkspaceActions;
  focusedRoadmapId?: string;
  roadmaps: GrowthRoadmap[];
  tasksByRoadmap?: Record<string, RoadmapTask[]>;
  latestCheckin?: DailyCheckin | null;
  worries?: WorryItem[];
  recommendedPrograms?: RecommendedProgramItem[];
  onGoProgress: (roadmapId?: string) => void;
}> = ({
  actions,
  focusedRoadmapId,
  roadmaps,
  tasksByRoadmap = {},
  latestCheckin = null,
  worries = [],
  recommendedPrograms = [],
  onGoProgress,
}) => {
  const [goalType, setGoalType] = useState<GoalType>('생활 습관');
  const [timeframe, setTimeframe] = useState('이번 주 (7일)');
  const [energyLevel, setEnergyLevel] = useState(3);
  const [focusText, setFocusText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<GeneratedRoadmapPreview | null>(null);
  const [draftEnergyLevel, setDraftEnergyLevel] = useState(3);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [draftEditedByUser, setDraftEditedByUser] = useState(false);
  const [addingProgId, setAddingProgId] = useState<string | null>(null);

  const focusedRoadmap = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusedRoadmapId) focusedRoadmap.current?.scrollIntoView({ block: 'center' });
  }, [focusedRoadmapId, roadmaps.length]);

  const requestDraft = async (requestedType = goalType) => {
    if (!focusText.trim() || generating || saving) return;
    setGenerating(true);
    setError(null);
    try {
      const todayDate = getTodayIsoDate();
      const res = await generateRoadmap({
        goalType: requestedType,
        focusText: focusText.trim(),
        timeframe,
        energyLevel,
        todayDate,
        latestCheckin: buildLatestCheckinPayload(latestCheckin),
        recentTasks7Days: buildRecentTasks7Days(roadmaps, tasksByRoadmap),
        activeRoadmaps: buildActiveRoadmapsPayload(roadmaps),
        activeWorries: buildActiveWorriesPayload(worries),
      });
      setDraft(res);
      setDraftEnergyLevel(energyLevel);
      setIsEditingDraft(false);
      setDraftEditedByUser(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로드맵 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGoalTypeChange = (nextType: GoalType) => {
    if (nextType === goalType) return;
    setGoalType(nextType);
    if (!draftEditedByUser && !isEditingDraft) void requestDraft(nextType);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestDraft();
  };

  const saveManualRoadmap = async () => {
    const goal = focusText.trim();
    if (!goal || saving || generating) return;
    setSaving(true);
    setError(null);
    try {
      const title = goal.split('\n')[0].slice(0, FIELD_LIMITS.roadmapTitleMax);
      const roadmapId = await actions.createRoadmapWithTasks({
        title, goalType, timeframe, summary: title === goal ? '' : goal, energyLevel,
      }, [], '사용자 수정');
      setFocusText('');
      onGoProgress(roadmapId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로드맵을 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveAndSave = async () => {
    if (!draft || saving || generating) return;
    setSaving(true);
    setError(null);
    try {
      const createdId = await actions.createRoadmapWithTasks(
        {
          title: draft.title,
          goalType: draft.category,
          timeframe: draft.duration || timeframe,
          summary: draft.summary,
          energyLevel: draftEnergyLevel,
          recommendationReason: draft.recommendationReason,
          energyFitExplanation: draft.energyFitExplanation,
        },
        draft.tasks.map((t) => ({
          title: t.title,
          description: t.description,
          cadence: t.cadence,
          dayLabel: t.dayLabel,
          scheduledDate: t.scheduledDate,
          durationMinutes: t.durationMinutes,
        })),
        draftEditedByUser ? '사용자 수정' : 'AI 제안'
      );
      setDraft(null);
      setIsEditingDraft(false);
      setDraftEditedByUser(false);
      setFocusText('');
      onGoProgress(createdId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로드맵 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRecommendedMission = async (prog: RecommendedProgramItem) => {
    if (addingProgId) return;
    setAddingProgId(prog.programId);
    setError(null);
    try {
      const roadmapId = await actions.addProgramMissionToRoadmap(prog, roadmaps, tasksByRoadmap);
      onGoProgress(roadmapId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '지원 프로그램 미션 추가 중 오류가 발생했습니다.');
    } finally {
      setAddingProgId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--tg-text-strong)]">맞춤형 성장 로드맵 설계</h1>
        <p className="text-sm text-[var(--tg-text-muted)] mt-1">
          목표를 직접 저장하거나 실천 계획을 제안받을 수 있어요. 저장한 로드맵에 실천 항목을 자유롭게 추가하고 수정해 보세요.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleGenerate}
          className="lg:col-span-5 tg-card p-6 space-y-5"
        >
          <div>
            <span className="block text-sm font-semibold text-[var(--tg-text-strong)] mb-2.5">목표 유형 선택</span>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_TYPES.map((gt) => (
                <button
                  key={gt}
                  type="button"
                  aria-pressed={goalType === gt}
                  disabled={generating || saving}
                  onClick={() => handleGoalTypeChange(gt)}
                  className={`py-2.5 px-3 text-xs sm:text-sm rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
                    goalType === gt
                      ? 'bg-[var(--tg-primary)] text-[var(--tg-text-strong)] border-[var(--tg-primary-border)] font-semibold'
                      : 'bg-[var(--tg-bg)] text-[var(--tg-text)] border-[var(--tg-border)] hover:bg-[var(--tg-primary-soft)]'
                  }`}
                >
                  {gt}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="rm-time" className="block text-xs font-semibold text-[var(--tg-text)] mb-1.5">
                실천 호흡
              </label>
              <select
                id="rm-time"
                disabled={generating || saving}
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="tg-input w-full px-3 py-2.5 text-sm"
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rm-energy" className="block text-xs font-semibold text-[var(--tg-text)] mb-1.5">
                현재 여력 (<span className="font-mono text-[var(--tg-text-strong)] tabular-nums">{energyLevel}/5</span>)
              </label>
              <input
                id="rm-energy"
                disabled={generating || saving}
                type="range"
                min={1}
                max={5}
                value={energyLevel}
                onChange={(e) => setEnergyLevel(Number(e.target.value))}
                className="w-full accent-[var(--tg-text)] mt-2.5"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rm-focus" className="block text-sm font-semibold text-[var(--tg-text-strong)] mb-1.5">
              해내고 싶은 작은 변화나 목표
            </label>
            <textarea
              id="rm-focus"
              disabled={generating || saving}
              rows={3}
              required
              maxLength={400}
              value={focusText}
              onChange={(e) => setFocusText(e.target.value)}
              placeholder={GOAL_EXAMPLES[goalType]}
              className="tg-input w-full px-3.5 py-2.5 text-sm"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-[var(--tg-error)] bg-[var(--tg-error-soft)] border border-[var(--tg-error-border)] rounded-xl p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={generating || saving || !focusText.trim()}
            className="tg-btn-primary w-full py-2.5 px-4 text-sm cursor-pointer"
          >
            {generating ? '맞춤 로드맵을 설계하는 중...' : '작은 목표 로드맵 제안받기'}
          </button>
          <button type="button" onClick={saveManualRoadmap} disabled={saving || generating || !focusText.trim()}
            className="tg-btn-secondary w-full cursor-pointer px-4 py-2.5 text-sm">
            직접 로드맵 만들기
          </button>
        </form>

        <div className="lg:col-span-7 space-y-4">
          {generating ? (
            <div role="status" className="tg-card p-6 text-sm text-[var(--tg-text)]">
              {goalType}에 맞는 실천 항목을 정리하고 있어요.
            </div>
          ) : draft ? (
            <div className="bg-[var(--tg-surface)] border-2 border-[var(--tg-primary)] rounded-2xl p-6 space-y-5 shadow-[0_4px_16px_rgba(40,90,120,0.06)]">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--tg-border)] pb-4">
                <div className="w-full space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[var(--tg-text-muted)]">
                      추천 로드맵 미리보기 · {draft.category} · {draft.duration}
                    </p>
                    <span className="text-[11px] font-semibold text-[var(--tg-success)] bg-[var(--tg-secondary-soft)] border border-[var(--tg-secondary)] px-2.5 py-0.5 rounded-lg">
                      승인 전 미리보기 (아직 저장되지 않음)
                    </span>
                  </div>
                  {isEditingDraft ? (
                    <div className="space-y-2.5 pt-1">
                      <input
                        type="text"
                        maxLength={FIELD_LIMITS.roadmapTitleMax}
                        value={draft.title}
                        onChange={(e) => {
                          setDraftEditedByUser(true);
                          setDraft({ ...draft, title: e.target.value });
                        }}
                        className="tg-input w-full px-3 py-2 font-display text-base font-bold text-[var(--tg-text-strong)]"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          maxLength={FIELD_LIMITS.roadmapTimeframeMax}
                          value={draft.duration}
                          onChange={(e) => {
                            setDraftEditedByUser(true);
                            setDraft({ ...draft, duration: e.target.value });
                          }}
                          placeholder="실천 기간"
                          className="tg-input w-full px-3 py-1.5 text-xs"
                        />
                      </div>
                      <textarea
                        rows={2}
                        maxLength={FIELD_LIMITS.roadmapSummaryMax}
                        value={draft.summary}
                        onChange={(e) => {
                          setDraftEditedByUser(true);
                          setDraft({ ...draft, summary: e.target.value });
                        }}
                        className="tg-input w-full px-3 py-2 text-sm"
                      />
                    </div>
                  ) : (
                    <>
                      <h2 className="font-display text-lg font-bold text-[var(--tg-text-strong)]">
                        {draft.title}
                      </h2>
                      <p className="text-sm text-[var(--tg-text)] leading-relaxed">{draft.summary}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Recommendation Reason & Energy Fit Explanation */}
              {(draft.recommendationReason || draft.energyFitExplanation) && (
                <div className="p-4 bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-xl space-y-2 text-xs">
                  {draft.recommendationReason && (
                    <p className="text-[var(--tg-text)] leading-relaxed">
                      <span className="font-bold text-[var(--tg-text-strong)]">추천 이유: </span>
                      {draft.recommendationReason}
                    </p>
                  )}
                  {draft.energyFitExplanation && (
                    <p className="text-[var(--tg-success)] leading-relaxed">
                      <span className="font-bold">현재 여력({draftEnergyLevel}/5) 적합성: </span>
                      {draft.energyFitExplanation}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-[var(--tg-text)]">
                  단계·날짜별 실천 항목 ({draft.tasks.length}개)
                </p>
                {draft.tasks.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-xl space-y-2"
                  >
                    {isEditingDraft ? (
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            maxLength={FIELD_LIMITS.taskTitleMax}
                            value={t.title}
                            onChange={(e) => {
                              setDraftEditedByUser(true);
                              const next = [...draft.tasks];
                              next[idx] = { ...t, title: e.target.value };
                              setDraft({ ...draft, tasks: next });
                            }}
                            className="tg-input flex-1 px-3 py-1.5 text-sm font-medium text-[var(--tg-text-strong)] bg-[var(--tg-surface)]"
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="text"
                              maxLength={FIELD_LIMITS.dayLabelMax}
                              value={t.dayLabel}
                              onChange={(e) => {
                                setDraftEditedByUser(true);
                                const next = [...draft.tasks];
                                next[idx] = { ...t, dayLabel: e.target.value };
                                setDraft({ ...draft, tasks: next });
                              }}
                              className="tg-input w-24 px-2.5 py-1.5 text-xs bg-[var(--tg-surface)]"
                            />
                            <input
                              type="number"
                              min={5}
                              max={180}
                              value={t.durationMinutes}
                              onChange={(e) => {
                                setDraftEditedByUser(true);
                                const next = [...draft.tasks];
                                next[idx] = { ...t, durationMinutes: Number(e.target.value) || 15 };
                                setDraft({ ...draft, tasks: next });
                              }}
                              className="tg-input w-16 px-2 py-1.5 text-xs font-mono tabular-nums bg-[var(--tg-surface)]"
                            />
                            <span className="text-xs text-[var(--tg-text-muted)]">분</span>
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          maxLength={FIELD_LIMITS.taskDescriptionMax}
                          value={t.description}
                          onChange={(e) => {
                            setDraftEditedByUser(true);
                            const next = [...draft.tasks];
                            next[idx] = { ...t, description: e.target.value };
                            setDraft({ ...draft, tasks: next });
                          }}
                          placeholder="구체적인 실행 방법 설명"
                          className="tg-input w-full px-3 py-1.5 text-xs bg-[var(--tg-surface)]"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--tg-text-strong)]">{t.title}</p>
                          <div className="flex items-center gap-2 text-xs text-[var(--tg-text-muted)] font-mono tabular-nums shrink-0">
                            <span>{t.cadence === 'daily' ? '일일' : '주간'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{t.dayLabel}</span>
                            {t.scheduledDate && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{t.scheduledDate}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[var(--tg-success)]">{t.durationMinutes}분</span>
                          </div>
                        </div>
                        {t.description && (
                          <p className="text-xs text-[var(--tg-text)] leading-relaxed">{t.description}</p>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[var(--tg-border-subtle)]">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingDraft((prev) => !prev)}
                    className="tg-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditingDraft ? '수정 완료' : '내용 수정하기'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void requestDraft()}
                    disabled={saving || !focusText.trim()}
                    className="tg-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{draft.category === goalType ? '다시 제안받기' : '새 목표 유형으로 제안받기'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(null);
                      setIsEditingDraft(false);
                      setDraftEditedByUser(false);
                    }}
                    className="tg-btn-secondary inline-flex items-center gap-1 px-3.5 py-2 text-xs cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>취소하기</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveAndSave}
                    disabled={saving}
                    className="tg-btn-mint inline-flex items-center gap-1.5 px-4 py-2 text-sm cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{saving ? '저장 중...' : '이 로드맵 저장하기'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="tg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-base font-bold text-[var(--tg-text-strong)]">
                    현재 저장된 로드맵 ({roadmaps.length})
                  </h2>
                  {roadmaps.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onGoProgress(roadmaps[0]?.id)}
                      className="text-xs font-semibold text-[var(--tg-text)] hover:text-[var(--tg-text-strong)] underline underline-offset-4 cursor-pointer"
                    >
                      로드맵 관리하기
                    </button>
                  )}
                </div>
                {roadmaps.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm font-semibold text-[var(--tg-text)]">아직 생성된 로드맵이 없습니다.</p>
                    <p className="text-xs text-[var(--tg-text-muted)] mt-1">
                      왼쪽에서 지금 해보고 싶은 작은 목표를 입력하면 맞춤형 일정을 만들어 드립니다.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--tg-border-subtle)]">
                    {roadmaps.map((rm) => {
                      const rmTasks = tasksByRoadmap[rm.id];
                      const livePercent = rmTasks && rmTasks.length > 0 ? computeProgressPercent(rmTasks) : rm.progressPercent;
                      return (
                        <button
                          key={rm.id}
                          ref={rm.id === focusedRoadmapId ? focusedRoadmap : undefined}
                          type="button"
                          onClick={() => onGoProgress(rm.id)}
                          className={`w-full cursor-pointer rounded-xl px-2 py-3.5 text-left transition-colors hover:bg-[var(--tg-bg)] ${rm.id === focusedRoadmapId ? 'bg-[var(--tg-primary-soft)]' : ''} flex items-center justify-between gap-4`}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--tg-text-muted)] mb-0.5">
                              <span>{rm.goalType}</span>
                              <span aria-hidden="true">·</span>
                              <span>{rm.timeframe}</span>
                              <span aria-hidden="true">·</span>
                              <span className="text-[var(--tg-success)] font-semibold">
                                {rm.status === 'completed'
                                  ? '완료됨'
                                  : rm.status === 'adjusted'
                                  ? '유연 조정됨'
                                  : '실천 중'}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-[var(--tg-text-strong)] truncate">{rm.title}</p>
                            {Boolean(rmTasks?.length) && (
                              <ul className="mt-1.5 space-y-1 text-sm leading-snug">
                                {rmTasks.map((task) => (
                                  <li key={task.id}>{task.title} · {getEffectiveTaskStatus(task)}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <span className="font-mono text-sm font-bold text-[var(--tg-success)] tabular-nums shrink-0">
                            {livePercent}%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {recommendedPrograms.length > 0 && (
                <div className="tg-card p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-bold text-[var(--tg-text-strong)]">
                      추천 지원 프로그램 신청 준비 미션 추가
                    </h3>
                    <span className="text-[11px] text-[var(--tg-text-muted)]">
                      고민 상담에서 추천된 제도
                    </span>
                  </div>
                  <div className="space-y-2">
                    {recommendedPrograms.slice(0, 3).map((prog) => (
                      <div
                        key={prog.programId}
                        className="p-3 bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--tg-text-strong)] truncate">{prog.title}</p>
                          <p className="text-[11px] text-[var(--tg-text-muted)] truncate">
                            {prog.provider} · {prog.recruitmentStatus || prog.deadline}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={addingProgId === prog.programId}
                          onClick={() => handleAddRecommendedMission(prog)}
                          className="tg-btn-secondary px-3 py-1.5 text-xs min-h-[32px] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {addingProgId === prog.programId ? '추가 중...' : '+ 신청 준비 미션 추가'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ProgressView: React.FC<{
  actions: WorkspaceActions;
  roadmaps: GrowthRoadmap[];
  selectedRoadmapId: string | null;
  onSelectRoadmap: (id: string) => void;
  tasks: RoadmapTask[];
  tasksByRoadmap?: Record<string, RoadmapTask[]>;
  latestCheckin?: DailyCheckin | null;
  goalLogs?: GoalActivityLog[];
  today?: string;
  onGoCreateRoadmap: () => void;
}> = ({
  actions,
  roadmaps,
  selectedRoadmapId,
  onSelectRoadmap,
  tasks,
  tasksByRoadmap = {},
  latestCheckin = null,
  goalLogs = [],
  today = getTodayIsoDate(),
  onGoCreateRoadmap,
}) => {
  const activeRoadmap = roadmaps.find((r) => r.id === selectedRoadmapId) || roadmaps[0] || null;

  // Task flexible AI adjustment preview state
  const [adjustingTaskId, setAdjustingTaskId] = useState<string | null>(null);
  const [blockerNote, setBlockerNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [applyingAdjustment, setApplyingAdjustment] = useState(false);
  const [pendingAdjustment, setPendingAdjustment] = useState<{
    taskId: string;
    adjustmentReason: string;
    adjustedTitle: string;
    adjustedDescription: string;
    durationMinutes: number;
    dayLabel: string;
    blockerNote: string;
  } | null>(null);

  // Status reason prompt (optional reason for 미완료 / 건너뛰기)
  const [statusReasonTaskId, setStatusReasonTaskId] = useState<string | null>(null);
  const [pendingStatusValue, setPendingStatusValue] = useState<TaskStatus>('미완료');
  const [statusReasonNote, setStatusReasonNote] = useState('');

  // Roadmap inline edit state
  const [editingRoadmap, setEditingRoadmap] = useState(false);
  const [editRmTitle, setEditRmTitle] = useState('');
  const [editRmTimeframe, setEditRmTimeframe] = useState('');
  const [editRmSummary, setEditRmSummary] = useState('');
  const [savingRmEdit, setSavingRmEdit] = useState(false);

  // Task inline edit state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDesc, setEditTaskDesc] = useState('');
  const [editTaskMinutes, setEditTaskMinutes] = useState(15);
  const [editTaskDate, setEditTaskDate] = useState('');
  const [editTaskDayLabel, setEditTaskDayLabel] = useState('');
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);
  const [newTask, setNewTask] = useState<{ roadmapId: string; title: string; scheduledDate: string; durationMinutes: number } | null>(null);
  const [removingTask, setRemovingTask] = useState<{ roadmapId: string; task: RoadmapTask } | null>(null);
  const [savingTaskChange, setSavingTaskChange] = useState(false);

  // History filter toggle
  const [showAllRoadmapLogs, setShowAllRoadmapLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computedProgress = useMemo(() => {
    if (tasks.length === 0) return activeRoadmap?.progressPercent ?? 0;
    return computeProgressPercent(tasks);
  }, [tasks, activeRoadmap?.progressPercent]);

  const filteredLogs = useMemo(() => {
    if (showAllRoadmapLogs || !activeRoadmap) return goalLogs;
    return goalLogs.filter((l) => l.roadmapId === activeRoadmap.id);
  }, [goalLogs, activeRoadmap, showAllRoadmapLogs]);

  const roadmapTitleMap = useMemo(
    () => new Map(roadmaps.map((r) => [r.id, r.title])),
    [roadmaps]
  );

  const handleRequestAdjust = async (task: RoadmapTask, reasonOverride?: string) => {
    const note = (reasonOverride ?? blockerNote).trim();
    if (!activeRoadmap || !note) return;
    setAdjusting(true);
    setError(null);
    try {
      const res = await adjustRoadmapTask({
        roadmapTitle: activeRoadmap.title,
        taskTitle: task.title,
        blockerNote: note,
        latestCheckin: latestCheckin
          ? {
              moodLabel: latestCheckin.moodLabel,
              energyLevel: latestCheckin.energyLevel,
              availableMinutes: latestCheckin.availableMinutes,
            }
          : null,
        recentTasks7Days: buildRecentTasks7Days(roadmaps, tasksByRoadmap).map((t) => ({
          title: t.title,
          status: t.status,
          completed: t.completed,
        })),
      });
      setPendingAdjustment({
        taskId: task.id,
        ...res,
        blockerNote: note,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '계획 조정안을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setAdjusting(false);
    }
  };

  const handleApplyAdjust = async (task: RoadmapTask) => {
    if (!activeRoadmap || !pendingAdjustment || pendingAdjustment.taskId !== task.id) return;
    setApplyingAdjustment(true);
    setError(null);
    try {
      await actions.applyTaskAdjustment(activeRoadmap, task, tasks, pendingAdjustment);
      setAdjustingTaskId(null);
      setPendingAdjustment(null);
      setBlockerNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '계획 조정 저장 중 오류가 발생했습니다.');
    } finally {
      setApplyingAdjustment(false);
    }
  };

  const handleStatusSelect = async (task: RoadmapTask, nextStatus: TaskStatus) => {
    if (!activeRoadmap || activeRoadmap.status === 'completed') return;
    setError(null);
    if (nextStatus === '미완료' || nextStatus === '건너뛰기') {
      setStatusReasonTaskId(task.id);
      setPendingStatusValue(nextStatus);
      setStatusReasonNote(task.blockerNote || '');
      return;
    }
    setStatusReasonTaskId(null);
    try {
      await actions.updateTaskStatus(
        activeRoadmap.id,
        task,
        nextStatus,
        tasks,
        undefined,
        activeRoadmap.status
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleConfirmReasonStatus = async (task: RoadmapTask, skipNote = false) => {
    if (!activeRoadmap) return;
    setError(null);
    const savedNote = skipNote ? '' : statusReasonNote.trim();
    try {
      await actions.updateTaskStatus(
        activeRoadmap.id,
        task,
        pendingStatusValue,
        tasks,
        savedNote,
        activeRoadmap.status
      );
      setStatusReasonTaskId(null);
      setStatusReasonNote('');
      // Automatically provide AI feedback when marked 미완료
      if (pendingStatusValue === '미완료') {
        const feedbackReason = savedNote || '오늘 일정이나 여력이 부족해 완료하지 못했어요';
        setAdjustingTaskId(task.id);
        setBlockerNote(feedbackReason);
        await handleRequestAdjust(task, feedbackReason);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 저장 중 오류가 발생했습니다.');
    }
  };

  const startEditRoadmap = () => {
    if (!activeRoadmap) return;
    setEditRmTitle(activeRoadmap.title);
    setEditRmTimeframe(activeRoadmap.timeframe);
    setEditRmSummary(activeRoadmap.summary);
    setEditingRoadmap(true);
  };

  const saveEditRoadmap = async () => {
    if (!activeRoadmap || !editRmTitle.trim()) return;
    setSavingRmEdit(true);
    setError(null);
    try {
      await actions.updateRoadmapDetails(activeRoadmap, {
        title: editRmTitle,
        timeframe: editRmTimeframe,
        summary: editRmSummary,
      });
      setEditingRoadmap(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로드맵 수정 중 오류가 발생했습니다.');
    } finally {
      setSavingRmEdit(false);
    }
  };

  const startEditTask = (task: RoadmapTask) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskDesc(task.description || '');
    setEditTaskMinutes(task.durationMinutes);
    setEditTaskDate(task.scheduledDate || getTodayIsoDate());
    setEditTaskDayLabel(task.dayLabel);
  };

  const saveEditTask = async (task: RoadmapTask) => {
    if (!activeRoadmap || !editTaskTitle.trim()) return;
    setSavingTaskEdit(true);
    setError(null);
    try {
      await actions.updateTaskDetails(activeRoadmap, task, {
        title: editTaskTitle,
        description: editTaskDesc,
        durationMinutes: editTaskMinutes,
        scheduledDate: editTaskDate,
        dayLabel: editTaskDayLabel,
      });
      setEditingTaskId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '항목 수정 중 오류가 발생했습니다.');
    } finally {
      setSavingTaskEdit(false);
    }
  };

  const addTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTask?.title.trim() || newTask.roadmapId !== activeRoadmap?.id || savingTaskChange) return;
    setSavingTaskChange(true);
    setError(null);
    try {
      await actions.addRoadmapTask(newTask.roadmapId, {
        title: newTask.title, cadence: 'daily', dayLabel: newTask.scheduledDate === today ? '오늘' : '직접 추가',
        scheduledDate: newTask.scheduledDate, durationMinutes: newTask.durationMinutes,
      });
      setNewTask(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '실천 항목을 추가하지 못했어요.');
    } finally {
      setSavingTaskChange(false);
    }
  };

  const removeTask = async () => {
    if (!removingTask || removingTask.roadmapId !== activeRoadmap?.id || savingTaskChange) return;
    setSavingTaskChange(true);
    setError(null);
    try {
      await actions.removeRoadmapTask(removingTask.roadmapId, removingTask.task.id);
      setRemovingTask(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '실천 항목을 삭제하지 못했어요.');
    } finally {
      setSavingTaskChange(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--tg-text-strong)]">목표 달성 현황 및 유연 조정</h1>
          <p className="text-sm text-[var(--tg-text-muted)] mt-1">
            실천 상태를 직접 기록하고, 필요할 때 내용과 일정을 수정하거나 컨디션에 맞게 부담을 낮춰 조정할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoCreateRoadmap}
          className="tg-btn-secondary px-4 py-2 text-xs whitespace-nowrap cursor-pointer"
        >
          새 로드맵 추가
        </button>
      </div>

      {roadmaps.length === 0 ? (
        <div className="tg-card p-12 text-center">
          <p className="text-base font-bold text-[var(--tg-text-strong)] mb-1">진행 중인 로드맵이 없습니다</p>
          <p className="text-sm text-[var(--tg-text-muted)] mb-5">
            작은 목표를 하나 설정하고 일상에서 체크인을 시작해 보세요.
          </p>
          <button
            type="button"
            onClick={onGoCreateRoadmap}
            className="tg-btn-primary px-5 py-2.5 text-sm cursor-pointer"
          >
            첫 성장 로드맵 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Roadmap Selector Tabs */}
          <div className="flex flex-wrap gap-2">
            {roadmaps.map((rm) => {
              const rmTasks = tasksByRoadmap[rm.id];
              const pct =
                rm.id === activeRoadmap?.id && tasks.length > 0
                  ? computedProgress
                  : rmTasks && rmTasks.length > 0
                  ? computeProgressPercent(rmTasks)
                  : rm.progressPercent;
              return (
                <button
                  key={rm.id}
                  type="button"
                  onClick={() => {
                    setEditingRoadmap(false);
                    setEditingTaskId(null);
                    setNewTask(null);
                    setRemovingTask(null);
                    onSelectRoadmap(rm.id);
                  }}
                  className={`px-3.5 py-2 text-xs sm:text-sm rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
                    activeRoadmap?.id === rm.id
                      ? 'bg-[var(--tg-primary)] text-[var(--tg-text-strong)] border-[var(--tg-primary-border)] font-semibold'
                      : 'bg-[var(--tg-surface)] text-[var(--tg-text)] border-[var(--tg-border)] hover:bg-[var(--tg-primary-soft)]'
                  }`}
                >
                  {rm.title} ({pct}%)
                </button>
              );
            })}
          </div>

          {activeRoadmap && (
            <div className="tg-card p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[var(--tg-border)] pb-4">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--tg-text-muted)]">
                    <span>{activeRoadmap.goalType}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeRoadmap.timeframe}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-[var(--tg-success)]">
                      {activeRoadmap.status === 'completed'
                        ? '완료됨'
                        : activeRoadmap.status === 'adjusted'
                        ? '유연 조정됨'
                        : '실천 중'}
                    </span>
                  </div>

                  {editingRoadmap ? (
                    <div className="space-y-2.5 pt-2">
                      <input
                        type="text"
                        maxLength={FIELD_LIMITS.roadmapTitleMax}
                        value={editRmTitle}
                        onChange={(e) => setEditRmTitle(e.target.value)}
                        className="tg-input w-full px-3 py-2 font-display text-base font-bold text-[var(--tg-text-strong)]"
                      />
                      <input
                        type="text"
                        maxLength={FIELD_LIMITS.roadmapTimeframeMax}
                        value={editRmTimeframe}
                        onChange={(e) => setEditRmTimeframe(e.target.value)}
                        placeholder="실천 기간"
                        className="tg-input w-full sm:w-64 px-3 py-1.5 text-xs"
                      />
                      <textarea
                        rows={2}
                        maxLength={FIELD_LIMITS.roadmapSummaryMax}
                        value={editRmSummary}
                        onChange={(e) => setEditRmSummary(e.target.value)}
                        className="tg-input w-full px-3 py-2 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingRoadmap(false)}
                          className="tg-btn-secondary px-3 py-1.5 text-xs min-h-[34px] cursor-pointer"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          disabled={savingRmEdit || !editRmTitle.trim()}
                          onClick={saveEditRoadmap}
                          className="tg-btn-primary px-4 py-1.5 text-xs min-h-[34px] cursor-pointer"
                        >
                          {savingRmEdit ? '저장 중...' : '수정 저장'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="font-display text-lg font-bold text-[var(--tg-text-strong)]">
                        {activeRoadmap.title}
                      </h2>
                      {activeRoadmap.summary && (
                        <p className="text-xs sm:text-sm text-[var(--tg-text-muted)] leading-relaxed">
                          {activeRoadmap.summary}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {activeRoadmap.status !== 'completed' && !editingRoadmap && (
                    <button
                      type="button"
                      onClick={startEditRoadmap}
                      className="tg-btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs min-h-[36px] cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>로드맵 수정</span>
                    </button>
                  )}
                  <div className="text-right">
                    <span className="block text-xs text-[var(--tg-text-muted)]">실제 달성률</span>
                    <span className="font-mono text-xl font-bold text-[var(--tg-success)] tabular-nums">
                      {computedProgress}%
                    </span>
                  </div>
                  {activeRoadmap.status !== 'completed' && computedProgress === 100 && (
                    <button
                      type="button"
                      onClick={() => actions.completeRoadmap(activeRoadmap)}
                      className="tg-btn-mint px-4 py-2 text-xs whitespace-nowrap cursor-pointer"
                    >
                      로드맵 완료 확정
                    </button>
                  )}
                </div>
              </div>

              <div className="w-full h-2.5 bg-[var(--tg-primary-soft)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--tg-secondary)] transition-all duration-200"
                  style={{ width: `${computedProgress}%` }}
                />
              </div>

              {(activeRoadmap.recommendationReason || activeRoadmap.energyFitExplanation) && (
                <div className="p-3.5 bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-xl space-y-1 text-xs">
                  {activeRoadmap.recommendationReason && (
                    <p className="text-[var(--tg-text)]">
                      <span className="font-bold text-[var(--tg-text-strong)]">설계 배경: </span>
                      {activeRoadmap.recommendationReason}
                    </p>
                  )}
                  {activeRoadmap.energyFitExplanation && (
                    <p className="text-[var(--tg-success)]">
                      <span className="font-bold">여력 적합성: </span>
                      {activeRoadmap.energyFitExplanation}
                    </p>
                  )}
                </div>
              )}

              {activeRoadmap.adjustmentReason && (
                <div className="p-3.5 bg-[var(--tg-warning-soft)] border border-[var(--tg-warning-border)] rounded-xl text-xs text-[var(--tg-warning)]">
                  <span className="font-bold">최근 재설계 안내: </span>
                  {activeRoadmap.adjustmentReason}
                </div>
              )}

              {error && (
                <p role="alert" className="text-xs font-medium text-[var(--tg-error)] bg-[var(--tg-error-soft)] border border-[var(--tg-error-border)] rounded-xl p-3">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[var(--tg-text-strong)]">실천 항목 ({tasks.length}개)</h3>
                {activeRoadmap.status !== 'completed' && newTask?.roadmapId !== activeRoadmap.id && (
                  <button type="button" onClick={() => setNewTask({ roadmapId: activeRoadmap.id, title: '', scheduledDate: today, durationMinutes: 15 })}
                    className="tg-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1 px-3 text-xs">
                    <Plus className="size-4" aria-hidden="true" /> 실천 항목 추가
                  </button>
                )}
              </div>
              {newTask?.roadmapId === activeRoadmap.id && (
                <form onSubmit={addTask} className="space-y-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-bg)] p-4" aria-label="실천 항목 추가">
                  <label className="block space-y-1 text-sm">
                    실천 제목
                    <input autoFocus required value={newTask.title} maxLength={FIELD_LIMITS.taskTitleMax}
                      onChange={(event) => setNewTask({ ...newTask, title: event.target.value })} className="tg-input block w-full px-3 py-2" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1 text-sm">
                      예정일
                      <input type="date" value={newTask.scheduledDate} onChange={(event) => setNewTask({ ...newTask, scheduledDate: event.target.value })}
                        className="tg-input block w-full px-3 py-2" />
                    </label>
                    <label className="block space-y-1 text-sm">
                      소요 시간 (분)
                      <input type="number" required min={5} max={480} value={newTask.durationMinutes}
                        onChange={(event) => setNewTask({ ...newTask, durationMinutes: Number(event.target.value) })} className="tg-input block w-full px-3 py-2" />
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" disabled={savingTaskChange} onClick={() => setNewTask(null)} className="tg-btn-secondary min-h-9 px-3 text-xs">취소</button>
                    <button type="submit" disabled={savingTaskChange || !newTask.title.trim()} className="tg-btn-primary min-h-9 px-3 text-xs">항목 저장</button>
                  </div>
                </form>
              )}
              {!tasks.length && !newTask && <p className="text-sm text-[var(--tg-text-muted)]">첫 실천 항목을 추가해 보세요.</p>}
              <div className="divide-y divide-[var(--tg-border-subtle)]">
                {tasks.map((task) => {
                  const currentStatus = getEffectiveTaskStatus(task);
                  const isCompleted = currentStatus === '완료';
                  const isEditingThisTask = editingTaskId === task.id;
                  return (
                    <div key={task.id} className="py-4 space-y-3">
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            disabled={activeRoadmap.status === 'completed'}
                            aria-label={`${task.title} 완료 토글`}
                            onClick={() =>
                              actions.toggleRoadmapTask(
                                activeRoadmap.id,
                                task,
                                tasks,
                                activeRoadmap.status
                              )
                            }
                            className="cursor-pointer disabled:cursor-default mt-0.5 shrink-0"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-[var(--tg-success)]" />
                            ) : (
                              <Circle className="w-5 h-5 text-[var(--tg-primary)] hover:text-[var(--tg-text)]" />
                            )}
                          </button>

                          {isEditingThisTask ? (
                            <div className="flex-1 space-y-2.5 bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-xl p-3.5">
                              <input
                                type="text"
                                maxLength={FIELD_LIMITS.taskTitleMax}
                                value={editTaskTitle}
                                onChange={(e) => setEditTaskTitle(e.target.value)}
                                className="tg-input w-full px-3 py-1.5 text-sm font-medium bg-[var(--tg-surface)]"
                              />
                              <textarea
                                rows={2}
                                maxLength={FIELD_LIMITS.taskDescriptionMax}
                                value={editTaskDesc}
                                onChange={(e) => setEditTaskDesc(e.target.value)}
                                placeholder="실천 방법 설명"
                                className="tg-input w-full px-3 py-1.5 text-xs bg-[var(--tg-surface)]"
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="date"
                                  value={editTaskDate}
                                  onChange={(e) => setEditTaskDate(e.target.value)}
                                  className="tg-input px-2.5 py-1.5 text-xs font-mono bg-[var(--tg-surface)]"
                                />
                                <input
                                  type="text"
                                  maxLength={FIELD_LIMITS.dayLabelMax}
                                  value={editTaskDayLabel}
                                  onChange={(e) => setEditTaskDayLabel(e.target.value)}
                                  placeholder="일차/요일"
                                  className="tg-input w-28 px-2.5 py-1.5 text-xs bg-[var(--tg-surface)]"
                                />
                                <input
                                  type="number"
                                  min={5}
                                  max={480}
                                  value={editTaskMinutes}
                                  onChange={(e) => setEditTaskMinutes(Number(e.target.value) || 15)}
                                  className="tg-input w-20 px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[var(--tg-surface)]"
                                />
                                <span className="text-xs text-[var(--tg-text-muted)]">분</span>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingTaskId(null)}
                                  className="tg-btn-secondary px-3 py-1 text-xs min-h-[32px] cursor-pointer"
                                >
                                  취소
                                </button>
                                <button
                                  type="button"
                                  disabled={savingTaskEdit || !editTaskTitle.trim()}
                                  onClick={() => saveEditTask(task)}
                                  className="tg-btn-primary px-3.5 py-1 text-xs min-h-[32px] cursor-pointer"
                                >
                                  {savingTaskEdit ? '저장 중...' : '변경 저장'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="min-w-0 flex-1 space-y-1">
                              <p
                                className={`text-sm font-semibold ${
                                  isCompleted ? 'line-through text-[var(--tg-placeholder)]' : 'text-[var(--tg-text-strong)]'
                                }`}
                              >
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-xs text-[var(--tg-text)] leading-relaxed">{task.description}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--tg-text-muted)] font-mono tabular-nums">
                                <span>{task.cadence === 'daily' ? '일일' : '주간'}</span>
                                <span aria-hidden="true">·</span>
                                <span>{task.dayLabel}</span>
                                {task.scheduledDate && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>{task.scheduledDate}</span>
                                  </>
                                )}
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {task.durationMinutes}분
                                </span>
                                {task.adjustedFrom && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-sans text-[var(--tg-warning)] font-medium">
                                      조정 전: {task.adjustedFrom}
                                    </span>
                                  </>
                                )}
                              </div>
                              {task.blockerNote && (
                                <p className="text-xs text-[var(--tg-text-muted)] bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-lg px-2.5 py-1 inline-block mt-1">
                                  사유 메모: {task.blockerNote}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Status Selector + Edit + AI Flex Adjust */}
                        <div className="flex flex-wrap items-center gap-2 sm:pl-8 lg:pl-0 shrink-0">
                          <select
                            aria-label={`${task.title} 실천 상태`}
                            disabled={activeRoadmap.status === 'completed'}
                            value={currentStatus}
                            onChange={(e) => handleStatusSelect(task, e.target.value as TaskStatus)}
                            className={`px-2.5 py-1.5 text-xs rounded-xl border transition-colors cursor-pointer ${getStatusBadgeClass(
                              currentStatus
                            )}`}
                          >
                            {TASK_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>

                          {activeRoadmap.status !== 'completed' && !isEditingThisTask && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditTask(task)}
                                className="tg-btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs min-h-[34px] cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>수정</span>
                              </button>
                              <button type="button" aria-label={`${task.title} 삭제`} onClick={() => setRemovingTask({ roadmapId: activeRoadmap.id, task })}
                                disabled={savingTaskChange} className="tg-btn-secondary grid size-9 cursor-pointer place-items-center text-[var(--tg-error)]">
                                <Trash2 className="size-4" aria-hidden="true" />
                              </button>
                            </>
                          )}

                          {!isCompleted && activeRoadmap.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustingTaskId(adjustingTaskId === task.id ? null : task.id);
                                setPendingAdjustment(null);
                                setBlockerNote(
                                  currentStatus === '미완료'
                                    ? task.blockerNote || '완료하지 못해 부담을 줄여 다시 이어가고 싶어요'
                                    : ''
                                );
                              }}
                              className="tg-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs min-h-[34px] whitespace-nowrap cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>
                                {currentStatus === '미완료' ? '미완료 AI 피드백 받기' : '부담돼요 · 계획 조정'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {removingTask?.roadmapId === activeRoadmap.id && removingTask.task.id === task.id && (
                        <div role="group" aria-label="실천 항목 삭제 확인" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--tg-error-border)] bg-[var(--tg-error-soft)] p-3">
                          <p className="text-sm">‘{task.title}’을 삭제할까요?</p>
                          <div className="flex gap-2">
                            <button type="button" disabled={savingTaskChange} onClick={() => setRemovingTask(null)} className="tg-btn-secondary min-h-9 px-3 text-xs">취소</button>
                            <button type="button" disabled={savingTaskChange} onClick={removeTask} className="tg-btn-secondary min-h-9 px-3 text-xs text-[var(--tg-error)]">항목 삭제</button>
                          </div>
                        </div>
                      )}

                      {/* Optional non-judgmental blocker note when setting 미완료 / 건너뛰기 */}
                      {statusReasonTaskId === task.id && (
                        <div className="sm:ml-8 p-3.5 bg-[var(--tg-bg)] border border-[var(--tg-primary)] rounded-xl space-y-2.5">
                          <p className="text-xs font-semibold text-[var(--tg-text-strong)]">
                            [{pendingStatusValue}] 상태로 기록합니다. 이유를 간단히 남겨 두시겠어요? (선택)
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {BLOCKER_QUICK_REASONS.map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => setStatusReasonNote(r)}
                                className={`px-2.5 py-1 text-xs rounded-lg border cursor-pointer ${
                                  statusReasonNote === r
                                    ? 'bg-[var(--tg-primary)] text-[var(--tg-text-strong)] border-[var(--tg-primary-border)] font-semibold'
                                    : 'bg-[var(--tg-surface)] text-[var(--tg-text)] border-[var(--tg-border)]'
                                }`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            maxLength={FIELD_LIMITS.blockerNoteMax}
                            value={statusReasonNote}
                            onChange={(e) => setStatusReasonNote(e.target.value)}
                            placeholder="예: 오늘은 일정이 길어져서 내일 10분으로 나눠 하려고 해요"
                            className="tg-input w-full px-3 py-1.5 text-xs bg-[var(--tg-surface)]"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setStatusReasonTaskId(null)}
                              className="tg-btn-secondary px-3 py-1 text-xs min-h-[32px] cursor-pointer"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmReasonStatus(task, true)}
                              className="tg-btn-secondary px-3 py-1 text-xs min-h-[32px] cursor-pointer"
                            >
                              사유 없이 저장
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmReasonStatus(task, false)}
                              className="tg-btn-primary px-3.5 py-1 text-xs min-h-[32px] cursor-pointer"
                            >
                              상태 저장
                            </button>
                          </div>
                        </div>
                      )}

                      {/* AI Flexible Re-adjustment Panel (Preview + User Approval) */}
                      {adjustingTaskId === task.id && (
                        <div className="sm:ml-8 p-4 bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-xl space-y-3">
                          <p className="text-xs text-[var(--tg-text)]">
                            지키기 어려웠던 이유를 편하게 알려주시면, AI가 최근 컨디션과 기록에 맞춰 더 작은 단계를 먼저 제안해 드립니다. (승인 전에는 바뀌지 않습니다.)
                          </p>
                          <input
                            type="text"
                            maxLength={FIELD_LIMITS.blockerNoteMax}
                            value={blockerNote}
                            onChange={(e) => setBlockerNote(e.target.value)}
                            placeholder="예: 막상 시작하려니 시간이 너무 길고 무엇부터 쓸지 막막했어요"
                            className="tg-input w-full px-3.5 py-2 text-sm bg-[var(--tg-surface)]"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustingTaskId(null);
                                setPendingAdjustment(null);
                              }}
                              className="tg-btn-secondary px-3 py-1.5 text-xs min-h-[34px] cursor-pointer"
                            >
                              닫기
                            </button>
                            <button
                              type="button"
                              disabled={adjusting || !blockerNote.trim()}
                              onClick={() => handleRequestAdjust(task)}
                              className="tg-btn-primary px-4 py-1.5 text-xs min-h-[34px] cursor-pointer"
                            >
                              {adjusting ? 'AI가 대안을 찾는 중...' : '부담 낮춘 대안 제안받기'}
                            </button>
                          </div>

                          {pendingAdjustment && pendingAdjustment.taskId === task.id && (
                            <div className="p-3.5 bg-[var(--tg-surface)] border-2 border-[var(--tg-primary)] rounded-xl space-y-2.5">
                              <p className="text-xs font-bold text-[var(--tg-text-strong)]">AI 대안 제안 미리보기</p>
                              <p className="text-sm font-bold text-[var(--tg-text-strong)]">
                                {pendingAdjustment.adjustedTitle}
                              </p>
                              {pendingAdjustment.adjustedDescription && (
                                <p className="text-xs text-[var(--tg-text)] leading-relaxed">
                                  {pendingAdjustment.adjustedDescription}
                                </p>
                              )}
                              <p className="text-xs text-[var(--tg-text-muted)] font-mono tabular-nums">
                                {pendingAdjustment.dayLabel} · {pendingAdjustment.durationMinutes}분
                              </p>
                              <p className="text-xs text-[var(--tg-success)] bg-[var(--tg-secondary-soft)] border border-[var(--tg-secondary)] rounded-lg p-2.5">
                                <span className="font-semibold">조정 이유: </span>
                                {pendingAdjustment.adjustmentReason}
                              </p>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPendingAdjustment(null)}
                                  className="tg-btn-secondary px-3 py-1.5 text-xs min-h-[34px] cursor-pointer"
                                >
                                  기존 목표 유지
                                </button>
                                <button
                                  type="button"
                                  disabled={applyingAdjustment}
                                  onClick={() => handleApplyAdjust(task)}
                                  className="tg-btn-mint inline-flex items-center gap-1 px-3.5 py-1.5 text-xs min-h-[34px] cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{applyingAdjustment ? '적용 중...' : '이 대안 적용하기'}</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Integrated Goal Change & Execution History inside ProgressView */}
          <section className="tg-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--tg-border)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[var(--tg-text)]" />
                <h2 className="font-display text-base font-bold text-[var(--tg-text-strong)]">
                  목표 변경 및 실천 히스토리 ({filteredLogs.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAllRoadmapLogs((v) => !v)}
                className="text-xs font-semibold text-[var(--tg-text)] hover:text-[var(--tg-text-strong)] underline underline-offset-4 cursor-pointer"
              >
                {showAllRoadmapLogs ? '선택한 로드맵 기록만 보기' : '전체 로드맵 기록 보기'}
              </button>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-[var(--tg-text)]">아직 기록된 목표 변경 이력이 없습니다.</p>
                <p className="text-xs text-[var(--tg-text-muted)] mt-1">
                  실천 상태를 바꾸거나 목표 내용·일정을 수정하면 변경 주체(AI 제안 / 사용자 수정)와 함께 이곳에 차곡차곡 기록됩니다.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--tg-border-subtle)]">
                {filteredLogs.slice(0, 30).map((log) => (
                  <div key={log.id} className="px-6 py-4 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                            log.actor === 'AI 제안'
                              ? 'bg-[var(--tg-primary-soft)] border-[var(--tg-primary)] text-[var(--tg-text-strong)]'
                              : 'bg-[var(--tg-secondary-soft)] border-[var(--tg-secondary)] text-[var(--tg-success)]'
                          }`}
                        >
                          {log.actor}
                        </span>
                        <span className="font-semibold text-[var(--tg-text-strong)]">{log.actionType}</span>
                        {showAllRoadmapLogs && (
                          <span className="text-[var(--tg-text-muted)]">
                            ({roadmapTitleMap.get(log.roadmapId) || '로드맵'})
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[var(--tg-text-muted)] tabular-nums">
                        {formatLogTime(log.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-[var(--tg-text)]">
                      <span className="font-semibold text-[var(--tg-text-strong)]">{log.changedField}</span>:{' '}
                      <span className="text-[var(--tg-placeholder)]">{log.previousValue || '없음'}</span>
                      <span className="mx-1.5" aria-hidden="true">→</span>
                      <span className="font-semibold text-[var(--tg-success)]">{log.newValue}</span>
                    </p>

                    {log.reason && (
                      <p className="text-xs text-[var(--tg-text-muted)]">사유: {log.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
