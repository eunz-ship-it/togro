import { buildCheckinSuggestion, type CheckinAdviceInput } from '../lib/checkinAdvice';
import { getConversationText } from '../lib/conversationText';
import { CounselingBookingLink, displaySupportType, saveCounselingBooking } from './CounselingBookingLink';
import { WorkExperienceLink } from './WorkExperienceLink';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  History,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  analyzeWorry,
  chatWorryWithRecommendations,
  fetchCheckinAdvice,
  fetchDailyRecommendations,
  fetchWorryRecommendedQuestions,
} from '../lib/api';
import { getEffectiveTaskStatus, getTodayIsoDate } from '../lib/firestoreService';
import type { WorkspaceActions } from '../lib/workspaceData';
import {
  buildActiveRoadmapsPayload,
  buildActiveWorriesPayload,
  buildLatestCheckinPayload,
  buildRecentTasks7Days,
} from '../lib/roadmapContext';
import {
  FIELD_LIMITS,
  type AgentMessage,
  type DailyCheckin,
  type DailyRecommendationResult,
  type GrowthRoadmap,
  type PublicProgram,
  type RecommendedProgramItem,
  type RoadmapTask,
  type SavedProgram,
  type UserProfile,
  type WorryCategory,
  type WorryChatResponse,
  type WorryItem,
  type WorryStatus,
} from '../types/domain';
import { CheckinTrend } from './CheckinTrend';
import { CheckinFields, INITIAL_CHECKIN, type CheckinDraft } from './CheckinFields';
import { RecommendedProgramCard } from './RecommendedProgramCard';

const WORRY_CATEGORIES: WorryCategory[] = [
  '진로 방향',
  '생활 리듬',
  '역량 부족',
  '심리적 부담',
  '경제·생활',
  '정보 탐색',
];
const WORRY_STATUSES: WorryStatus[] = [
  '아직 해결되지 않음',
  '해결 방법 탐색 중',
  '실천 중',
  '해결됨',
  '잠시 보류',
];

export const CheckinView: React.FC<{
  actions: WorkspaceActions;
  checkinDate?: string;
  required?: boolean;
  demo?: boolean;
  onSaved?: (id: string, suggestion: string) => void;
  checkins: DailyCheckin[];
  roadmaps?: GrowthRoadmap[];
  tasksByRoadmap?: Record<string, RoadmapTask[]>;
  worries?: WorryItem[];
  onGoProgress?: (roadmapId?: string) => void;
}> = ({
  actions,
  checkinDate,
  required = false,
  demo = false,
  onSaved,
  checkins,
  roadmaps = [],
  tasksByRoadmap = {},
  worries = [],
  onGoProgress,
}) => {
  const [draft, setDraft] = useState<CheckinDraft>(() => ({ ...INITIAL_CHECKIN, moodLabel: required ? '' : '막막함' }));
  const { moodScore, energyLevel, availableMinutes, reflection } = draft;
  const moodLabel = draft.moodLabel || '막막함';
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCheckin, setSavedCheckin] = useState<{ id: string; suggestion: string } | null>(null);
  const savingCheckin = useRef(false);

  const [adjustPreview, setAdjustPreview] = useState<DailyRecommendationResult | null>(null);
  const [loadingAdjust, setLoadingAdjust] = useState(false);
  const [applyingAdjust, setApplyingAdjust] = useState(false);
  const [adjustAppliedMsg, setAdjustAppliedMsg] = useState<string | null>(null);

  const todayStr = checkinDate ?? getTodayIsoDate();
  const activeRoadmaps = useMemo(
    () => roadmaps.filter((r) => r.status !== 'completed'),
    [roadmaps]
  );

  const enrichCheckinSuggestion = async (id: string, input: CheckinAdviceInput) => {
    try {
      const advice = await fetchCheckinAdvice(input);
      const suggestion = advice.selfCareSuggestion?.trim();
      if (advice.source !== 'gemini' || !suggestion) return;
      await actions.updateCheckinAdvice(id, suggestion);
      setSavedCheckin((current) => current?.id === id ? { id, suggestion } : current);
    } catch {
      // The check-in already contains a suggestion that can be read offline.
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingCheckin.current || (required && !draft.moodLabel)) return;
    savingCheckin.current = true;
    setSubmitting(true);
    setError(null);
    setAdjustAppliedMsg(null);

    const input = {
      moodLabel, moodScore, energyLevel, reflection: reflection.trim(),
      availableMinutes: Math.min(
        FIELD_LIMITS.availableMinutesMax,
        Math.max(FIELD_LIMITS.availableMinutesMin, Math.round(availableMinutes || 20))
      ),
    };
    const suggestion = buildCheckinSuggestion(input);
    try {
      const id = await actions.createCheckin({
        ...input,
        selfCareSuggestion: suggestion,
        checkinDate: todayStr,
      });
      setSavedCheckin({ id, suggestion });
      setDraft((current) => current.reflection.trim() === input.reflection ? { ...current, reflection: '' } : current);
      if (!demo) void enrichCheckinSuggestion(id, input);
      onSaved?.(id, suggestion);
    } catch {
      setError('체크인 저장에 실패했습니다. 입력은 그대로 있으니 잠시 뒤 다시 저장해 주세요.');
    } finally {
      savingCheckin.current = false;
      setSubmitting(false);
    }
  };

  const handleRequestGoalAdjustment = async () => {
    if (loadingAdjust) return;
    setLoadingAdjust(true);
    setError(null);
    setAdjustAppliedMsg(null);
    try {
      const latest = checkins[0]
        ? buildLatestCheckinPayload(checkins[0])
        : {
            moodLabel,
            moodScore,
            energyLevel,
            availableMinutes,
            reflection: reflection.trim(),
            checkinDate: todayStr,
          };

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

      const rec = await fetchDailyRecommendations({
        todayDate: todayStr,
        latestCheckin: latest,
        recentTasks7Days: buildRecentTasks7Days(roadmaps, tasksByRoadmap),
        activeRoadmaps: buildActiveRoadmapsPayload(roadmaps),
        activeTasks: activeTasksPayload,
        activeWorries: buildActiveWorriesPayload(worries),
      });
      setAdjustPreview(rec);
    } catch (err) {
      setError(err instanceof Error ? err.message : '목표 조정안을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingAdjust(false);
    }
  };

  const handleApproveAdjustment = async () => {
    if (!adjustPreview || applyingAdjust) return;
    setApplyingAdjust(true);
    setError(null);
    try {
      const targetId = await actions.applyDailyRecommendation(
        adjustPreview,
        roadmaps,
        tasksByRoadmap
      );
      setAdjustPreview(null);
      setAdjustAppliedMsg('오늘 상태에 맞춘 목표 조정안이 반영되었습니다.');
      if (onGoProgress) {
        onGoProgress(targetId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '목표 조정안 저장 중 오류가 발생했습니다.');
    } finally {
      setApplyingAdjust(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--tg-text-strong)]">오늘의 체크인</h1>
        <p className="text-sm text-[var(--tg-text-muted)] mt-1">
          {required ? `${todayStr} · 오늘 기분과 할 수 있는 시간을 선택하면 새 대화를 시작할 수 있어요.` : '오늘 기분과 컨디션을 기록하고 할 수 있는 행동을 확인해요.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form */}
        <form onSubmit={handleSave} className="lg:col-span-5 tg-card p-6 space-y-5">
          <CheckinFields draft={draft} onChange={setDraft} />

          {error && (
            <p role="alert" className="text-xs font-medium text-[var(--tg-error)] bg-[var(--tg-error-soft)] border border-[var(--tg-error-border)] rounded-xl p-3">
              {error}
            </p>
          )}

          {savedCheckin && (
            <div role="status" className="space-y-2 rounded-xl border border-[var(--tg-secondary)] bg-[var(--tg-secondary-soft)] p-4 text-sm">
              <p className="font-semibold text-[var(--tg-success)]">체크인을 저장했어요.</p>
              <p className="font-bold text-[var(--tg-text-strong)]">오늘의 맞춤 제안</p>
              <p className="leading-relaxed text-[var(--tg-text-strong)]">{savedCheckin.suggestion}</p>
            </div>
          )}

          {adjustAppliedMsg && (
            <div className="p-3.5 bg-[var(--tg-secondary-soft)] border border-[var(--tg-secondary)] rounded-xl text-xs font-semibold text-[var(--tg-success)]">
              {adjustAppliedMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || (required && !draft.moodLabel)}
            className="tg-btn-primary w-full py-2.5 px-4 text-sm cursor-pointer"
          >
            {submitting ? '체크인 기록 중...' : '오늘의 체크인 저장하기'}
          </button>

          {activeRoadmaps.length > 0 && (
            <button
              type="button"
              disabled={loadingAdjust}
              onClick={handleRequestGoalAdjustment}
              className="tg-btn-secondary w-full py-2.5 px-4 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {loadingAdjust ? '오늘 상태에 맞는 조정안을 살피는 중...' : '오늘 상태에 맞게 목표 다시 조정하기'}
              </span>
            </button>
          )}

          {adjustPreview && (
            <div className="p-4 bg-[var(--tg-bg)] border-2 border-[var(--tg-primary)] rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--tg-text-strong)]">AI 목표 조정 제안 (승인 전)</span>
                <span className="text-xs font-semibold text-[var(--tg-success)] bg-[var(--tg-secondary-soft)] border border-[var(--tg-secondary)] px-2.5 py-0.5 rounded-lg">
                  {adjustPreview.strategy}
                </span>
              </div>
              <p className="text-sm font-bold text-[var(--tg-text-strong)]">{adjustPreview.proposedTask.title}</p>
              {adjustPreview.proposedTask.description && (
                <p className="text-xs text-[var(--tg-text)] leading-relaxed">{adjustPreview.proposedTask.description}</p>
              )}
              <p className="text-xs text-[var(--tg-text-muted)] font-mono tabular-nums">
                {adjustPreview.proposedTask.scheduledDate} · {adjustPreview.proposedTask.dayLabel} · {adjustPreview.proposedTask.durationMinutes}분
              </p>
              <div className="p-3 bg-[var(--tg-surface)] border border-[var(--tg-border)] rounded-xl space-y-1 text-xs">
                <p className="text-[var(--tg-text)]">
                  <span className="font-semibold text-[var(--tg-text-strong)]">추천 이유: </span>
                  {adjustPreview.recommendationReason}
                </p>
                {adjustPreview.energyFitExplanation && (
                  <p className="text-[var(--tg-text-muted)]">
                    <span className="font-semibold text-[var(--tg-text)]">컨디션·시간 적합성: </span>
                    {adjustPreview.energyFitExplanation}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAdjustPreview(null)}
                  className="tg-btn-secondary px-3 py-1.5 text-xs min-h-[34px] cursor-pointer"
                >
                  기존 목표 유지
                </button>
                <button
                  type="button"
                  disabled={applyingAdjust}
                  onClick={handleApproveAdjustment}
                  className="tg-btn-mint inline-flex items-center gap-1 px-3.5 py-1.5 text-xs min-h-[34px] cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{applyingAdjust ? '적용 중...' : '이 조정안 적용하기'}</span>
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="space-y-4 lg:col-span-7">
          <CheckinTrend checkins={checkins} today={todayStr} />
          <div className="tg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--tg-border)] flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[var(--tg-text-strong)]">최근 체크인 기록</h2>
            <span className="font-mono text-xs font-semibold text-[var(--tg-text-muted)] tabular-nums">
              누적 {checkins.length}회
            </span>
          </div>

          {checkins.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-[var(--tg-text)]">아직 기록된 체크인이 없습니다.</p>
              <p className="text-xs text-[var(--tg-text-muted)] mt-1">
                왼쪽에서 오늘의 상태를 선택해 첫 체크인을 남겨 보세요.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--tg-border-subtle)]">
              {checkins.map((c) => (
                <div key={c.id} className="p-5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--tg-text-muted)]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[var(--tg-text-strong)] tabular-nums">
                        {c.checkinDate}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[var(--tg-success)]">{c.moodLabel}</span>
                    </div>
                    <div className="font-mono tabular-nums">
                      기분 {c.moodScore}/5 · 에너지 {c.energyLevel}/5
                      {typeof c.availableMinutes === 'number' ? ` · 가용 시간 ${c.availableMinutes}분` : ''}
                    </div>
                  </div>
                  {c.reflection && (
                    <p className="text-sm text-[var(--tg-text)] leading-relaxed">{c.reflection}</p>
                  )}
                  <p className="text-xs text-[var(--tg-text-strong)] bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-xl px-3.5 py-2.5 leading-relaxed">
                    <span className="font-semibold">오늘의 제안 </span>
                    {c.selfCareSuggestion?.trim() || buildCheckinSuggestion(c)}
                  </p>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface WorryChatExtra {
  responseMode?: WorryChatResponse['responseMode'];
  recommendedPrograms: RecommendedProgramItem[];
  noMatchGuidance?: string;
  extractedWorry?: { title: string; category: WorryCategory; nextStep: string };
  externalApiError?: string;
}

export const WorriesView: React.FC<{
  actions: WorkspaceActions;
  profile: UserProfile | null;
  latestCheckin: DailyCheckin | null;
  worries: WorryItem[];
  messages: AgentMessage[];
  roadmaps: GrowthRoadmap[];
  tasksByRoadmap: Record<string, RoadmapTask[]>;
  savedPrograms: SavedProgram[];
  recommendedPrograms: RecommendedProgramItem[];
  onNavigatePrograms: () => void;
  onNavigateRoadmap: (roadmapId?: string) => void;
}> = ({
  actions,
  profile,
  latestCheckin,
  worries,
  messages,
  roadmaps,
  tasksByRoadmap,
  savedPrograms,
  recommendedPrograms,
  onNavigatePrograms,
  onNavigateRoadmap,
}) => {
  // Structured Worry List state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<WorryCategory>('진로 방향');
  const [description, setDescription] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('전체');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Worry AI Consultation Chat + Grounded Program Recommendation state
  const worryMessages = useMemo(
    () => messages.filter((m) => m.supportType.startsWith('고민상담')),
    [messages]
  );
  const [threadAnchor, setThreadAnchor] = useState<number>(0);
  const [showPreviousHistory, setShowPreviousHistory] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [latestResponse, setLatestResponse] = useState<WorryChatResponse | null>(null);
  const [turnExtrasByMsgKey, setTurnExtrasByMsgKey] = useState<Record<string, WorryChatExtra>>({});

  // Recommended Questions (3 contextual questions)
  const [recommendedQuestions, setRecommendedQuestions] = useState<string[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const refreshCountRef = useRef(0);
  const lastQuestionsRef = useRef<string[]>([]);

  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const loadRecommendedQuestions = useCallback(
    async (excludeList: string[] = []) => {
      setLoadingQuestions(true);
      setQuestionsError(null);
      refreshCountRef.current += 1;
      try {
        const res = await fetchWorryRecommendedQuestions({
          userProfile: {
            nickname: profile?.nickname,
            age: profile?.age,
            ageGroup: profile?.ageGroup,
            jobPrepStatus: profile?.jobPrepStatus,
            region: profile?.region,
            interests: profile?.interests,
          },
          latestCheckin: latestCheckin
            ? {
                moodLabel: latestCheckin.moodLabel,
                energyLevel: latestCheckin.energyLevel,
                availableMinutes: latestCheckin.availableMinutes,
              }
            : null,
          recentWorries: worries.slice(0, 5).map((w) => ({ title: w.title, category: w.category })),
          excludeQuestions: excludeList,
          refreshSeed: refreshCountRef.current,
        });
        setRecommendedQuestions(res.questions);
        lastQuestionsRef.current = res.questions;
      } catch (err) {
        setQuestionsError(
          err instanceof Error
            ? err.message
            : '추천 질문을 불러오지 못했습니다. 직접 고민을 입력하시거나 다시 시도해 주세요.'
        );
      } finally {
        setLoadingQuestions(false);
      }
    },
    [
      profile?.nickname,
      profile?.age,
      profile?.ageGroup,
      profile?.jobPrepStatus,
      profile?.region,
      profile?.interests,
      latestCheckin,
      worries,
    ]
  );

  // Refresh 3 recommended questions automatically when entering '나의 고민'
  useEffect(() => {
    void loadRecommendedQuestions([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartNewConversation = () => {
    setThreadAnchor(worryMessages.length);
    setShowPreviousHistory(false);
    setLatestResponse(null);
    setChatError(null);
    setActionBanner(null);
    void loadRecommendedQuestions(lastQuestionsRef.current);
  };

  const handleRefreshQuestions = () => {
    void loadRecommendedQuestions(lastQuestionsRef.current);
  };

  const handleSelectRecommendedQuestion = (q: string) => {
    setChatInput(q);
    chatInputRef.current?.focus();
  };

  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = chatInput.trim();
    if (!content || sendingChat) return;

    setChatInput('');
    setChatError(null);
    setActionBanner(null);
    setSendingChat(true);

    try {
      await actions.appendAgentMessage({
        role: 'user',
        content,
        supportType: '고민상담',
        suggestedAction: '',
      });

      const aiRes = await chatWorryWithRecommendations({
        message: content,
        history: worryMessages.slice(threadAnchor).slice(-6).map((m) => ({ role: m.role, content: getConversationText(m) })),
        userProfile: {
          nickname: profile?.nickname,
          age: profile?.age,
          ageGroup: profile?.ageGroup,
          jobPrepStatus: profile?.jobPrepStatus,
          region: profile?.region,
          interests: profile?.interests,
        },
        latestCheckin: latestCheckin
          ? {
              moodLabel: latestCheckin.moodLabel,
              energyLevel: latestCheckin.energyLevel,
              availableMinutes: latestCheckin.availableMinutes,
            }
          : null,
      });

      const messageId = await actions.appendAgentMessage({
        role: 'assistant',
        content: aiRes.reply,
        supportType: saveCounselingBooking(
          `고민상담:${aiRes.problemType}${aiRes.responseMode === 'guided' ? ' · 기본 안내' : ''}`,
          aiRes.counselingBooking,
        ),
        suggestedAction: aiRes.smallAction,
      });

      setLatestResponse(aiRes);
      setTurnExtrasByMsgKey((prev) => ({
        ...prev,
        [messageId]: {
          responseMode: aiRes.responseMode,
          recommendedPrograms: aiRes.recommendedPrograms,
          noMatchGuidance: aiRes.noMatchGuidance,
          extractedWorry: aiRes.extractedWorry,
          externalApiError: aiRes.apiMeta?.externalApiError,
        },
      }));

      if (aiRes.recommendedPrograms.length > 0) {
        await actions.saveRecommendedPrograms(aiRes.recommendedPrograms);
      }
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : '고민 상담 응답을 생성하는 중 오류가 발생했습니다.'
      );
    } finally {
      setSendingChat(false);
    }
  };

  const savedMap = new Map(savedPrograms.map((s) => [s.programId, s]));

  const handleToggleSaveProgram = async (prog: PublicProgram, isCurrentlySaved: boolean) => {
    const safeId = prog.programId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    if (isCurrentlySaved) {
      await actions.removeSavedProgram(safeId);
    } else {
      await actions.saveProgramBookmark(prog, false);
    }
  };

  const handleAddProgramMission = async (prog: PublicProgram) => {
    await actions.addProgramMissionToRoadmap(prog, roadmaps, tasksByRoadmap);
    setActionBanner(`"${prog.title}" 신청 준비 미션을 [성장 로드맵]에 추가했습니다.`);
  };

  const handleSaveExtractedWorry = async (ew: {
    title: string;
    category: WorryCategory;
    nextStep: string;
  }, aiSummary: string) => {
    await actions.createWorry({
      title: ew.title,
      description: '나의 고민 AI 상담에서 정리한 항목입니다.',
      category: ew.category,
      aiSummary,
      nextStep: ew.nextStep,
    });
    setActionBanner(`"${ew.title}" 고민이 아래 고민 관리 목록에 저장되었습니다.`);
  };

  const previousMessages = worryMessages.slice(0, threadAnchor);
  const currentThreadMessages = worryMessages.slice(threadAnchor);

  const filtered = useMemo(() => {
    if (statusFilter === '전체') return worries;
    return worries.filter((w) => w.status === statusFilter);
  }, [worries, statusFilter]);

  const handleAddWorry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const analysis = await analyzeWorry({
        title: title.trim(),
        description: description.trim(),
        category,
      });
      await actions.createWorry({
        title: title.trim(),
        description: description.trim(),
        category,
        aiSummary: analysis.aiSummary,
        nextStep: analysis.nextStep,
      });
      setTitle('');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '고민 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--tg-text-strong)]">
            나의 고민 · 맞춤 지원 프로그램 추천
          </h1>
          <p className="text-sm text-[var(--tg-text-muted)] mt-1">
            고민을 편하게 입력하면 AI가 해결 방향과 오늘 가능한 작은 행동을 정리하고, 실제 도움이 되는 검증된 청년 지원 프로그램과 공식 신청 사이트를 바로 연결해 드립니다.
          </p>
        </div>
        <span className="font-mono text-xs font-semibold text-[var(--tg-text-muted)] tabular-nums shrink-0">
          등록 고민 {worries.length}건 · 해결 {worries.filter((w) => w.status === '해결됨').length}건
        </span>
      </div>

      {/* Section 1: AI Worry Consultation & Verified Program Recommendations */}
      <section className="tg-card overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-[var(--tg-border)] bg-[var(--tg-surface)] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--tg-text)]" />
              <h2 className="font-display text-base font-bold text-[var(--tg-text-strong)]">
                AI 고민 상담 & 지원 프로그램 맞춤 추천
              </h2>
            </div>
            <p className="text-xs text-[var(--tg-text-muted)] mt-0.5">
              {profile?.nickname || '청년'}님
              {profile?.age ? ` (만 ${profile.age}세)` : ''}
              {profile?.jobPrepStatus ? ` · ${profile.jobPrepStatus}` : ''} 기준 맞춤 추천 질문
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {previousMessages.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPreviousHistory((v) => !v)}
                className="tg-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs min-h-[34px] cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>
                  {showPreviousHistory
                    ? '이전 대화 기록 접기'
                    : `이전 대화 기록 보기 (${previousMessages.length})`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleStartNewConversation}
              className="tg-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs min-h-[34px] cursor-pointer"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>새 대화 시작</span>
            </button>
          </div>
        </div>

        {/* Personalized 3 Recommended Questions Bar */}
        <div className="px-5 sm:px-6 py-4 bg-[var(--tg-bg)] border-b border-[var(--tg-border)] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--tg-text-strong)]">
              상황에 맞춘 추천 고민 질문 3가지 (누르면 입력창에 채워져요)
            </span>
            <button
              type="button"
              disabled={loadingQuestions}
              onClick={handleRefreshQuestions}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--tg-text)] hover:text-[var(--tg-text-strong)] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingQuestions ? 'animate-spin' : ''}`} />
              <span>{loadingQuestions ? '새 질문 생성 중...' : '다른 질문 추천받기'}</span>
            </button>
          </div>

          {questionsError ? (
            <p className="text-xs text-[var(--tg-error)] bg-[var(--tg-error-soft)] border border-[var(--tg-error-border)] rounded-xl p-2.5">
              {questionsError}
            </p>
          ) : loadingQuestions && recommendedQuestions.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-12 bg-[var(--tg-surface)] border border-[var(--tg-border)] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {recommendedQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSelectRecommendedQuestion(q)}
                  className="text-left px-3.5 py-2.5 text-xs sm:text-sm bg-[var(--tg-surface)] border border-[var(--tg-border)] rounded-xl text-[var(--tg-text)] hover:border-[var(--tg-primary)] hover:bg-[var(--tg-primary-soft)] transition-colors cursor-pointer leading-snug"
                >
                  “{q}”
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preserved Previous Conversation History (when toggled) */}
        {showPreviousHistory && previousMessages.length > 0 && (
          <div className="px-5 sm:px-6 py-4 bg-[var(--tg-primary-soft)]/50 border-b border-[var(--tg-border)] space-y-3 max-h-[280px] overflow-y-auto">
            <p className="text-xs font-semibold text-[var(--tg-text-muted)]">이전 대화 기록 (보존됨)</p>
            {previousMessages.map((m, index) => (
              <div
                key={m.id}
                className={`p-3 rounded-xl text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[var(--tg-primary)]/25 text-[var(--tg-text-strong)] ml-8'
                    : 'bg-[var(--tg-surface)] border border-[var(--tg-border)] text-[var(--tg-text)] mr-8'
                }`}
              >
                <span className="font-semibold block mb-0.5">
                  {m.role === 'user' ? profile?.nickname || '나' : 'TOGRO'}
                </span>
                <p className="whitespace-pre-wrap">{getConversationText(m)}</p>
                {m.suggestedAction && (
                  <p className="mt-1 text-[var(--tg-success)] font-semibold">작은 행동 제안: {m.suggestedAction}</p>
                )}
                <CounselingBookingLink message={m} region={profile?.region} previous={previousMessages[index - 1]} />
                <WorkExperienceLink message={m} previous={previousMessages[index - 1]} />
              </div>
            ))}
          </div>
        )}

        {/* Active Conversation Thread */}
        <div className="p-4 sm:p-6 space-y-5 bg-[var(--tg-bg)] max-h-[560px] overflow-y-auto">
          {currentThreadMessages.length === 0 ? (
            <div className="bg-[var(--tg-surface)] border border-[var(--tg-border)] rounded-2xl p-5 text-sm text-[var(--tg-text)] leading-relaxed">
              지금 가장 마음이 쓰이는 고민을 위 추천 질문에서 골라보거나 아래에 자유롭게 적어 주세요.
              고민을 정리한 뒤, 실제로 신청하거나 참고할 수 있는 공식 지원 프로그램도 함께 연결해 드립니다.
            </div>
          ) : (
            currentThreadMessages.map((m, index) => {
              const extra = m.role === 'assistant' ? turnExtrasByMsgKey[m.id] : undefined;
              const problemLabel = m.supportType.startsWith('고민상담:')
                ? displaySupportType(m.supportType).replace('고민상담:', '')
                : '';

              return (
                <div key={m.id} className="space-y-3">
                  <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <span className="text-[11px] font-medium text-[var(--tg-text-muted)] mb-1 px-1">
                      {m.role === 'user' ? profile?.nickname || '나' : extra?.responseMode === 'guided' ? 'TOGRO 기본 안내' : 'TOGRO'}
                    </span>
                    <div
                      className={`max-w-[92%] sm:max-w-3xl px-4 py-3.5 text-sm leading-relaxed break-words ${
                        m.role === 'user'
                          ? 'bg-[var(--tg-primary)] text-[var(--tg-text-strong)] font-medium rounded-2xl rounded-tr-sm border border-[var(--tg-primary-border)]'
                          : 'bg-[var(--tg-surface)] border border-[var(--tg-border)] text-[var(--tg-text)] rounded-2xl rounded-tl-sm shadow-[0_1px_6px_rgba(40,90,120,0.04)]'
                      }`}
                    >
                      {problemLabel && (
                        <span className="inline-block mb-2 text-[11px] font-semibold text-[var(--tg-success)] bg-[var(--tg-secondary-soft)] border border-[var(--tg-secondary)] px-2 py-0.5 rounded-md">
                          분석 유형: {problemLabel}
                        </span>
                      )}
                      <p className="whitespace-pre-wrap">{getConversationText(m)}</p>
                      {m.role === 'assistant' && m.suggestedAction && (
                        <div className="mt-3 p-3 bg-[var(--tg-secondary-soft)] border border-[var(--tg-secondary)] rounded-xl text-xs text-[var(--tg-success)]">
                          <span className="font-bold">오늘의 작은 행동 제안: </span>
                          {m.suggestedAction}
                        </div>
                      )}
                      <CounselingBookingLink message={m} region={profile?.region} previous={currentThreadMessages[index - 1]} />
                      <WorkExperienceLink message={m} previous={currentThreadMessages[index - 1]} />
                      {extra?.extractedWorry && (
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--tg-border-subtle)]">
                          <span className="text-xs text-[var(--tg-text-muted)]">
                            정리된 고민: {extra.extractedWorry.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSaveExtractedWorry(extra.extractedWorry!, getConversationText(m))}
                            className="text-xs font-semibold text-[var(--tg-text)] hover:text-[var(--tg-text-strong)] underline cursor-pointer"
                          >
                            아래 고민 목록에 저장하기
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grounded Recommended Programs attached to this AI reply */}
                  {extra?.externalApiError && (
                    <div className="p-3 bg-[var(--tg-warning-soft)] border border-[var(--tg-warning-border)] rounded-xl text-xs text-[var(--tg-warning)]">
                      {extra.externalApiError}
                    </div>
                  )}

                  {extra && extra.recommendedPrograms.length > 0 && (
                    <div className="pl-0 sm:pl-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-[var(--tg-text-strong)]">
                          이 고민과 연결된 검증된 지원 프로그램 ({extra.recommendedPrograms.length}개)
                        </p>
                        <button
                          type="button"
                          onClick={onNavigatePrograms}
                          className="text-xs font-semibold text-[var(--tg-text)] hover:text-[var(--tg-text-strong)] underline cursor-pointer"
                        >
                          지원 프로그램 탭에서 전체 보기
                        </button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                        {extra.recommendedPrograms.map((prog) => {
                          const safeId = prog.programId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
                          return (
                            <RecommendedProgramCard
                              key={`${m.id}-${prog.programId}`}
                              program={prog}
                              saved={savedMap.get(safeId)}
                              onToggleSave={handleToggleSaveProgram}
                              onAddMissionToRoadmap={handleAddProgramMission}
                              highlightRecommended
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {extra && extra.recommendedPrograms.length === 0 && extra.noMatchGuidance && (
                    <div className="p-4 bg-[var(--tg-surface)] border border-[var(--tg-border)] rounded-xl text-xs text-[var(--tg-text)] space-y-2">
                      <p className="font-bold text-[var(--tg-text-strong)]">맞춤 프로그램 조회 안내</p>
                      <p>{extra.noMatchGuidance}</p>
                      <button
                        type="button"
                        onClick={onNavigatePrograms}
                        className="text-xs font-semibold text-[var(--tg-text)] underline cursor-pointer"
                      >
                        지원 프로그램 전체 목록 살펴보기 →
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {sendingChat && (
            <div className="bg-[var(--tg-surface)] border border-[var(--tg-border)] rounded-2xl px-4 py-3 text-sm text-[var(--tg-text-muted)]">
              고민을 정리하고 실제로 도움 되는 공식 지원 프로그램을 찾고 있습니다...
            </div>
          )}

          {/* Keep latest synced recommended programs visible on re-entry even before new chat turn */}
          {!latestResponse && recommendedPrograms.length > 0 && currentThreadMessages.length > 0 && (
            <div className="pt-2 border-t border-[var(--tg-border)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-[var(--tg-text-strong)]">
                  최근 고민 상담에서 추천된 지원 프로그램 ({recommendedPrograms.length}건)
                </p>
                <button
                  type="button"
                  onClick={onNavigatePrograms}
                  className="text-xs font-semibold text-[var(--tg-text)] underline cursor-pointer"
                >
                  지원 프로그램에서 모아보기
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {recommendedPrograms.slice(0, 3).map((prog) => {
                  const safeId = prog.programId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
                  return (
                    <RecommendedProgramCard
                      key={`persisted-${prog.programId}`}
                      program={prog}
                      saved={savedMap.get(safeId)}
                      onToggleSave={handleToggleSaveProgram}
                      onAddMissionToRoadmap={handleAddProgramMission}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {actionBanner && (
          <div className="px-5 sm:px-6 py-3 bg-[var(--tg-secondary-soft)] border-t border-[var(--tg-secondary)] flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[var(--tg-success)]">
            <span>{actionBanner}</span>
            <button
              type="button"
              onClick={() => onNavigateRoadmap()}
              className="underline hover:text-[var(--tg-text-strong)] cursor-pointer"
            >
              성장 로드맵에서 확인하기
            </button>
          </div>
        )}

        {chatError && (
          <div
            role="alert"
            className="px-5 sm:px-6 py-3 bg-[var(--tg-error-soft)] border-t border-[var(--tg-error-border)] text-xs font-medium text-[var(--tg-error)]"
          >
            {chatError}
          </div>
        )}

        {/* Chat Input Composer */}
        <form
          onSubmit={handleSendChat}
          className="p-4 border-t border-[var(--tg-border)] bg-[var(--tg-surface)] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <input
            ref={chatInputRef}
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="고민이나 현재 상황을 입력하면 AI 해결 방법과 지원 프로그램을 함께 추천해 드려요..."
            className="tg-input flex-1 px-4 py-2.5 text-sm min-h-[42px]"
          />
          <button
            type="submit"
            disabled={sendingChat || !chatInput.trim()}
            className="tg-btn-primary inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>고민 상담하기</span>
          </button>
        </form>
      </section>

      {/* Section 2: Structured Worry List & Status Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleAddWorry} className="lg:col-span-4 tg-card p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-[var(--tg-text-strong)]">고민 카드로 직접 기록하기</h2>

          <div>
            <label htmlFor="worry-title" className="block text-xs font-semibold text-[var(--tg-text)] mb-1.5">
              지금 가장 신경 쓰이는 고민
            </label>
            <input
              id="worry-title"
              type="text"
              required
              maxLength={FIELD_LIMITS.worryTitleMax}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 어떤 직무로 지원해야 할지 정하지 못했어요"
              className="tg-input w-full px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="worry-cat" className="block text-xs font-semibold text-[var(--tg-text)] mb-1.5">
              고민 영역
            </label>
            <select
              id="worry-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as WorryCategory)}
              className="tg-input w-full px-3.5 py-2.5 text-sm"
            >
              {WORRY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="worry-desc" className="block text-xs font-semibold text-[var(--tg-text)] mb-1.5">
              조금 더 들려주고 싶은 이야기 (선택)
            </label>
            <textarea
              id="worry-desc"
              rows={3}
              maxLength={FIELD_LIMITS.worryDescMax}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="상황이나 막막한 지점을 편하게 적어 주세요."
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
            disabled={submitting || !title.trim()}
            className="tg-btn-primary w-full py-2.5 px-4 text-sm cursor-pointer"
          >
            {submitting ? 'AI가 고민을 정리하는 중...' : '등록하고 첫 행동 제안받기'}
          </button>
        </form>

        <div className="lg:col-span-8 space-y-4">
          <div className="tg-card p-3 flex flex-wrap gap-1.5">
            {['전체', ...WORRY_STATUSES].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[var(--tg-primary)] text-[var(--tg-text-strong)] border-[var(--tg-primary-border)] font-semibold'
                    : 'bg-[var(--tg-bg)] text-[var(--tg-text-muted)] border-[var(--tg-border)] hover:text-[var(--tg-text)] hover:bg-[var(--tg-primary-soft)]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="tg-card p-10 text-center">
              <p className="text-sm font-semibold text-[var(--tg-text)]">해당 상태의 고민이 없습니다.</p>
              <p className="text-xs text-[var(--tg-text-muted)] mt-1">
                위 AI 상담에서 고민을 나누거나 왼쪽 카드에서 고민을 등록해 보세요.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((w) => (
                <article key={w.id} className="tg-card p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--tg-text-muted)] mb-1">
                        <span>{w.category}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            w.status === '해결됨'
                              ? 'text-[var(--tg-success)] font-semibold'
                              : w.status === '실천 중'
                              ? 'text-[var(--tg-text)] font-semibold'
                              : 'text-[var(--tg-warning)] font-semibold'
                          }
                        >
                          {w.status}
                        </span>
                      </div>
                      <h3 className="font-display text-base font-bold text-[var(--tg-text-strong)] break-words">
                        {w.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        aria-label="고민 해결 상태 변경"
                        value={w.status}
                        onChange={(e) =>
                          actions.updateWorryStatus(w.id, w.title, e.target.value as WorryStatus)
                        }
                        className="tg-input px-2.5 py-1.5 text-xs font-medium"
                      >
                        {WORRY_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => actions.deleteWorry(w.id)}
                        title="고민 삭제"
                        aria-label="고민 삭제"
                        className="p-2 text-[var(--tg-placeholder)] hover:text-[var(--tg-error)] rounded-xl hover:bg-[var(--tg-error-soft)] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {w.description && (
                    <p className="text-sm text-[var(--tg-text-muted)] leading-relaxed">{w.description}</p>
                  )}

                  {(w.aiSummary || w.nextStep) && (
                    <div className="p-4 bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-xl space-y-1.5 text-xs">
                      {w.aiSummary && (
                        <p className="text-[var(--tg-text)] leading-relaxed">
                          <span className="font-bold text-[var(--tg-text-strong)]">정리 요약: </span>
                          {w.aiSummary}
                        </p>
                      )}
                      {w.nextStep && (
                        <p className="text-[var(--tg-success)] font-semibold">
                          <span>작은 첫 행동: </span>
                          {w.nextStep}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
