import { useEffect, useRef, useState } from 'react';
import { HeartPulse, ListChecks, PanelRight, Send, SquarePen } from 'lucide-react';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import { CounselingBookingLink } from './CounselingBookingLink';
import { WorkExperienceLink } from './WorkExperienceLink';
import { SupportPreviewPanel, type PreviewMission } from './SupportPreviewPanel';
import { chatWithAgent } from '../lib/api';
import { getConversationText } from '../lib/conversationText';
import { encodeGuidedTurn, encodeJobSelection, readGuidedTurn, readJobSelection, readSupportPreview, type SupportPreview } from '../lib/guidedConversation';
import { buildJobDiscovery, JOB_KEYWORDS, JOB_ROLES, type JobSelection } from '../lib/jobDiscovery';
import { offsetDate } from '../lib/koreaDate';
import type { WorkspaceActions } from '../lib/workspaceData';
import { FIELD_LIMITS, type AgentChatResponse, type AgentMessage, type DailyCheckin, type GrowthRoadmap, type RecommendedProgramItem, type RoadmapTask, type UserProfile, type WorryItem } from '../types/domain';

interface AgentCompanionPanelProps {
  visible: boolean;
  demo: boolean;
  today: string;
  threadId: string;
  threadTitle?: string;
  canStartNew: boolean;
  onNewConcern: () => void;
  onActionProposal: (threadId: string, id: string, title: string, description: string, durationMinutes: number) => void;
  onActionSaved: (threadId: string, id: string, roadmapId: string, title: string) => void;
  firstConcernRequired: boolean;
  actions: WorkspaceActions;
  profile: UserProfile | null;
  messages: AgentMessage[];
  latestCheckin: DailyCheckin | null;
  worries: WorryItem[];
  roadmaps: GrowthRoadmap[];
  tasksByRoadmap: Record<string, RoadmapTask[]>;
  recommendedPrograms: RecommendedProgramItem[];
  onCheckin: () => void;
  onRoadmap: (id?: string) => void;
}

const STARTER_PROMPTS = [
  '공공기관과 사기업 중 어디를 준비할지 고민이에요',
  '무기력해서 오늘 할 일을 시작하기가 어려워요',
  '관심 있는 직무를 직접 체험해 보고 싶어요',
];

const TURN_LABELS = ['고민 좁히기', '작은 행동 제안', '오늘 할 일 정리'];
type ConversationRequest = { text: string; history: AgentMessage[]; alreadySaved?: boolean };
type PanelData = { id: string; preview: SupportPreview; programs: RecommendedProgramItem[]; jobSelection?: JobSelection };

function TypingReply({ text, onTick }: { text: string; onTick: () => void }) {
  const reducedMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(0);
  const characters = Array.from(text);
  const length = characters.length;

  useEffect(() => {
    if (reducedMotion) return;
    let frame: number;
    const start = performance.now();
    const duration = Math.min(1150, Math.max(350, length * 10));
    const update = (now: number) => {
      const next = Math.min(length, Math.max(1, Math.floor((now - start) / duration * length)));
      setDisplayed(next);
      if (next < length) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [length, reducedMotion]);

  useEffect(onTick, [displayed, onTick]);

  if (reducedMotion) return <p className="whitespace-pre-wrap">{text}</p>;
  return (
    <p className="whitespace-pre-wrap">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{characters.slice(0, displayed).join('')}</span>
    </p>
  );
}

export function AgentCompanionPanel({
  visible, demo, today, threadId, threadTitle, canStartNew, onNewConcern, onActionProposal, onActionSaved, firstConcernRequired, actions, profile, messages, latestCheckin, worries, roadmaps,
  tasksByRoadmap, recommendedPrograms, onCheckin, onRoadmap,
}: AgentCompanionPanelProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<ConversationRequest | null>(null);
  const [error, setError] = useState('');
  const [latestProposal, setLatestProposal] = useState<{ id: string; answer: AgentChatResponse } | null>(null);
  const [panel, setPanel] = useState<PanelData | null>(null);
  const [activeSave, setActiveSave] = useState(false);
  const [savedRoadmaps, setSavedRoadmaps] = useState<Record<string, string>>({});
  const [missionError, setMissionError] = useState('');
  const [worryStatus, setWorryStatus] = useState('');
  const requestInProgress = useRef(false);
  const actionInProgress = useRef(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useRef(() => {
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }).current;

  useEffect(() => {
    if (visible) scrollToBottom();
  }, [visible, messages.length, sending, scrollToBottom]);

  useEffect(() => {
    if (!panel || !visible) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setPanel(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [panel, visible]);

  const handleSend = async (request: ConversationRequest) => {
    const content = request.text.trim();
    if (!content || requestInProgress.current) return;
    requestInProgress.current = true;
    setSending(true);
    setError('');
    setFailed(null);
    setWorryStatus('');
    setMissionError('');
    if (request.history.length && readGuidedTurn(request.history.at(-1)?.supportType)?.stage === 3) setPanel(null);
    let alreadySaved = request.alreadySaved === true;

    try {
      if (!alreadySaved) {
        await actions.appendAgentMessage({ role: 'user', content, threadId });
        alreadySaved = true;
        setInput('');
      }

      const answer = await chatWithAgent({
        message: content,
        history: request.history.slice(-6).map((message) => ({
          role: message.role, content: getConversationText(message), supportType: message.supportType,
          suggestedAction: message.suggestedAction,
        })),
        context: {
          demoMode: demo,
          nickname: profile?.nickname || '청년',
          age: profile?.age,
          region: profile?.region || '',
          jobPrepStatus: profile?.jobPrepStatus || '',
          interests: profile?.interests ?? [],
          energyLevel: latestCheckin?.energyLevel,
          availableMinutes: latestCheckin?.availableMinutes,
          latestMood: latestCheckin?.moodLabel,
        },
      });

      const id = await actions.appendAgentMessage({
        role: 'assistant',
        threadId,
        content: answer.reply,
        supportType: answer.jobSelection ? encodeJobSelection(answer.jobSelection)
          : answer.guidedTurn ? encodeGuidedTurn(answer.guidedTurn, answer.preview) : answer.supportType,
        suggestedAction: answer.suggestedAction,
      });
      setLatestProposal({ id, answer });
      const proposal = answer.suggestedTasks?.[0];
      if (proposal?.title && answer.suggestedAction) onActionProposal(threadId, id, proposal.title, answer.suggestedAction, proposal.durationMinutes);
      if (answer.preview && (answer.preview.kind !== 'job' || window.matchMedia('(min-width: 64rem)').matches || panel?.preview.kind === 'job')) {
        setPanel({ id, preview: answer.preview, programs: answer.recommendedPrograms ?? [], jobSelection: answer.jobSelection });
      } else if (answer.jobSelection || answer.guidedTurn?.stage === 1 || panel?.preview.kind === 'job') setPanel(null);
      if (answer.recommendedPrograms?.length) void actions.saveRecommendedPrograms(answer.recommendedPrograms).catch(() => {});
    } catch {
      setFailed({ ...request, alreadySaved });
      setError(alreadySaved ? '답변을 가져오지 못했어요. 입력한 고민으로 다시 요청할 수 있어요.' : '고민을 저장하지 못했어요. 입력을 확인하고 다시 전송해 주세요.');
    } finally {
      requestInProgress.current = false;
      setSending(false);
    }
  };

  const submit = (text: string) => void handleSend({ text, history: messages });

  const openSavedPanel = (message: AgentMessage, index: number, preview: SupportPreview) => {
    const job = readJobSelection(message.supportType);
    const detail = messages[index - 1]?.content ?? '';
    const first = messages[index - 3]?.role === 'user' ? messages[index - 3]?.content ?? '' : '';
    const combined = [first, detail].filter(Boolean).join('\n').slice(0, 120);
    const publicSearch = job?.publicSector && job.keyword ? `공공기관 ${job.role} ${JOB_KEYWORDS[job.keyword]}` : '';
    const programs = latestProposal?.id === message.id ? latestProposal.answer.recommendedPrograms ?? []
      : recommendedPrograms.filter((item) => job ? publicSearch && item.worrySummary === publicSearch
        : item.worrySummary === combined || item.worrySummary === detail.slice(0, 120));
    setMissionError('');
    setPanel({ id: message.id, preview, programs, jobSelection: job });
  };

  const saveSmallAction = async (messageId: string, mission: PreviewMission, duration = 10) => {
    if (savedRoadmaps[messageId] || actionInProgress.current) return;
    actionInProgress.current = true;
    setActiveSave(true);
    setMissionError('');
    try {
      const id = await actions.addProgramMissionToRoadmap(
        { programId: mission.id, provider: mission.provider, title: mission.title, howToApply: mission.description },
        roadmaps, tasksByRoadmap, { title: mission.title, description: mission.description, durationMinutes: duration },
      );
      setSavedRoadmaps((previous) => ({ ...previous, [messageId]: id }));
      onActionSaved(threadId, messageId, id, mission.title);
    } catch {
      setMissionError('로드맵에 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      actionInProgress.current = false;
      setActiveSave(false);
    }
  };

  const saveWorry = async () => {
    const proposal = latestProposal?.answer.extractedWorry;
    if (!proposal || actionInProgress.current) return;
    actionInProgress.current = true;
    setActiveSave(true);
    try {
      await actions.createWorry({
        title: proposal.title, description: '대화에서 정리한 고민', category: proposal.category,
        aiSummary: latestProposal.answer.reply, nextStep: proposal.nextStep,
      });
      setWorryStatus('고민을 기록했어요.');
    } catch {
      setWorryStatus('고민을 기록하지 못했어요. 다시 시도해 주세요.');
    } finally {
      actionInProgress.current = false;
      setActiveSave(false);
    }
  };

  const lastMessage = messages.at(-1);
  const jobSelection = lastMessage?.role === 'assistant' ? readJobSelection(lastMessage.supportType) : undefined;
  const jobDiscovery = jobSelection ? buildJobDiscovery(jobSelection) : undefined;
  const jobRoadmapSummary = jobDiscovery ? `${jobDiscovery.focus}에 초점을 둔 직무 탐색 학습 계획` : '';
  const existingJobRoadmap = jobDiscovery && roadmaps.find((roadmap) => roadmap.title === jobDiscovery.title && roadmap.summary === jobRoadmapSummary);

  const saveJobPlan = async () => {
    if (!jobDiscovery || !lastMessage || existingJobRoadmap || savedRoadmaps[lastMessage.id] || actionInProgress.current) return;
    actionInProgress.current = true;
    setActiveSave(true);
    setMissionError('');
    try {
      const id = await actions.createRoadmapWithTasks({
        title: jobDiscovery.title, goalType: '취업 준비', timeframe: '2주 계획', summary: jobRoadmapSummary,
      }, jobDiscovery.steps.map((step) => ({
        ...step, cadence: step.dayOffset ? 'weekly' : 'daily', scheduledDate: offsetDate(today, step.dayOffset),
        durationMinutes: step.dayOffset ? step.durationMinutes : Math.min(step.durationMinutes, latestCheckin?.availableMinutes ?? step.durationMinutes),
      })));
      setSavedRoadmaps((previous) => ({ ...previous, [lastMessage.id]: id }));
      onActionSaved(threadId, lastMessage.id, id, jobDiscovery.steps[0].title);
    } catch {
      setMissionError('학습 계획을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      actionInProgress.current = false;
      setActiveSave(false);
    }
  };

  const jobRoadmapId = existingJobRoadmap?.id ?? (lastMessage && savedRoadmaps[lastMessage.id]);
  const proposalTask = !latestProposal?.answer.jobSelection ? latestProposal?.answer.suggestedTasks?.[0] : undefined;
  const proposalSaved = latestProposal && savedRoadmaps[latestProposal.id];
  const lastTurn = readGuidedTurn(messages.at(-1)?.supportType);

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      <section aria-label="대화·체크인" className="mx-auto flex h-full min-h-0 w-full max-w-4xl min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--tg-border)] px-4 py-2.5 sm:px-8">
          <button type="button" onClick={onCheckin} disabled={firstConcernRequired} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] px-3 text-sm font-semibold disabled:cursor-default">
            <HeartPulse aria-hidden="true" className="size-4 shrink-0" />
            <span>{latestCheckin ? `오늘의 체크인 · ${latestCheckin.moodLabel} · ${latestCheckin.availableMinutes ?? 20}분` : '오늘의 체크인 기록하기'}</span>
          </button>
          {canStartNew && !firstConcernRequired && (
            <button type="button" onClick={onNewConcern} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-[var(--tg-primary-soft)]">
              <SquarePen aria-hidden="true" className="size-4" /> 새 고민
            </button>
          )}
        </div>
        {threadTitle && <h1 className="truncate border-b border-[var(--tg-border)] px-4 py-2 text-sm font-semibold text-[var(--tg-text-strong)] sm:px-8" title={threadTitle}>{threadTitle}</h1>}
        <div ref={historyRef} role="log" aria-label="대화 내용" aria-busy={sending} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-8">
          <div className="mx-auto flex min-h-full max-w-3xl flex-col py-5 sm:py-7">
            {!messages.length ? (
              <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center py-5 text-center">
                <img src="/assets/aistudio/to-grow___App_icon_f7f04fa0.png" alt="" className="mb-4 size-12 rounded-2xl object-cover" />
                {firstConcernRequired && <p className="mb-2 text-sm font-semibold text-[var(--tg-success)]">3 / 3 · 첫 고민</p>}
                <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--tg-text-strong)] sm:text-3xl">{firstConcernRequired ? '지금 가장 마음에 걸리는 건 무엇인가요?' : '오늘 어떤 이야기를 해볼까요?'}</h1>
                <p className="mb-5 mt-2 max-w-md text-sm leading-relaxed text-[var(--tg-text-muted)] sm:text-base">
                  {profile?.nickname ? `${profile.nickname}님, ` : ''}지금 고민을 한 문장으로 적거나 아래 예시를 골라 주세요.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS.map((prompt) => <button key={prompt} type="button" onClick={() => submit(prompt)} disabled={sending} className="min-h-10 cursor-pointer rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] px-3.5 py-2 text-sm hover:border-[var(--tg-primary)] hover:bg-[var(--tg-primary-soft)]">{prompt}</button>)}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const assistant = message.role === 'assistant';
                  const turn = assistant ? readGuidedTurn(message.supportType) : undefined;
                  const job = assistant ? readJobSelection(message.supportType) : undefined;
                  const savedPreview: SupportPreview | undefined = job?.role && job.keyword ? { kind: 'job', region: job.region }
                    : turn && readSupportPreview(message.supportType);
                  return (
                    <div key={message.id} className={`flex flex-col ${assistant ? 'items-start' : 'items-end'}`}>
                      <span className="mb-1 px-1 text-xs font-medium text-[var(--tg-text-muted)]">{assistant ? 'TOGRO' : profile?.nickname || '나'}</span>
                      <div className={`max-w-[92%] rounded-2xl border px-4 py-3 text-sm leading-relaxed break-words sm:text-base ${assistant ? 'rounded-tl-sm border-[var(--tg-border)] bg-[var(--tg-surface)]' : 'rounded-tr-sm border-[var(--tg-primary-border)] bg-[var(--tg-primary)] font-medium text-[var(--tg-text-strong)]'}`}>
                        {assistant && latestProposal?.id === message.id ? <TypingReply text={getConversationText(message)} onTick={scrollToBottom} /> : <p className="whitespace-pre-wrap">{getConversationText(message)}</p>}
                        {assistant && message.suggestedAction && <p className="mt-2 border-t border-[var(--tg-border-subtle)] pt-2 text-sm font-semibold text-[var(--tg-success)]">오늘의 한 걸음 · {message.suggestedAction}</p>}
                        {assistant && !turn && !job && <>
                          <CounselingBookingLink message={message} region={profile?.region} previous={messages[index - 1]} />
                          <WorkExperienceLink message={message} previous={messages[index - 1]} />
                        </>}
                        {savedPreview && (
                          <button type="button" aria-expanded={panel?.id === message.id} aria-controls={panel?.id === message.id ? 'support-preview' : undefined} onClick={() => panel?.id === message.id ? setPanel(null) : openSavedPanel(message, index, savedPreview)} className="tg-btn-secondary mt-3 inline-flex cursor-pointer items-center gap-2 px-3 text-sm">
                            <PanelRight aria-hidden="true" className="size-4" />{panel?.id === message.id ? '지원 정보 접기' : '지원 정보 보기'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {jobDiscovery && !sending && (
                  <section aria-label="직무 학습 계획" className="space-y-3 rounded-2xl border border-[var(--tg-secondary)] bg-[var(--tg-secondary-soft)] p-4">
                    <h2 className="font-bold text-[var(--tg-text-strong)]">{jobDiscovery.title} · 2주 학습 계획</h2>
                    <ol className="space-y-2 text-sm">
                      {jobDiscovery.steps.map((step) => <li key={step.dayLabel}>
                        <p className="font-semibold">{step.dayLabel} · {step.title}</p>
                        <p className="mt-0.5 leading-relaxed">{step.description}</p>
                      </li>)}
                    </ol>
                    {jobRoadmapId ? (
                      <button type="button" onClick={() => onRoadmap(jobRoadmapId)} className="tg-btn-secondary cursor-pointer px-3 text-sm">저장한 학습 로드맵 보기</button>
                    ) : (
                      <button type="button" disabled={activeSave} onClick={saveJobPlan} className="tg-btn-mint inline-flex cursor-pointer items-center gap-2 px-3 text-sm font-semibold">
                        <ListChecks aria-hidden="true" className="size-4" /> 작은 행동 로드맵에 저장
                      </button>
                    )}
                    {missionError && <p role="alert" className="text-sm text-[var(--tg-error)]">{missionError}</p>}
                  </section>
                )}
              </div>
            )}
            {sending && <div role="status" className="mt-4 flex items-center gap-2 text-sm text-[var(--tg-text-muted)]"><span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-[var(--tg-primary)] motion-reduce:animate-none" />답변을 준비하고 있어요…</div>}
          </div>
        </div>

        {latestProposal && (proposalTask || latestProposal.answer.extractedWorry) && (
          <div className="mx-3 max-h-[22dvh] shrink-0 overflow-y-auto rounded-2xl border border-[var(--tg-secondary)] bg-[var(--tg-secondary-soft)] px-3 py-2 sm:mx-8">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {proposalTask && (proposalSaved ? (
                <button type="button" onClick={() => onRoadmap(proposalSaved)} className="cursor-pointer font-semibold underline underline-offset-4">로드맵에 저장됨 · 보기</button>
              ) : (
                <button type="button" disabled={activeSave} onClick={() => saveSmallAction(latestProposal.id, { id: 'chat-action', provider: 'TOGRO', title: proposalTask.title, description: latestProposal.answer.suggestedAction }, proposalTask.durationMinutes)} className="tg-btn-mint inline-flex cursor-pointer items-center gap-2 px-3 text-sm font-semibold"><ListChecks aria-hidden="true" className="size-4" /> 작은 행동 로드맵에 저장</button>
              ))}
              {latestProposal.answer.extractedWorry && worryStatus !== '고민을 기록했어요.' && <button type="button" disabled={activeSave} onClick={saveWorry} className="tg-btn-secondary cursor-pointer px-3 text-sm">고민 기록하기</button>}
              {worryStatus && <span role="status">{worryStatus}</span>}
              {missionError && !panel && <span role="alert" className="text-[var(--tg-error)]">{missionError}</span>}
            </div>
          </div>
        )}

        {error && <div role="alert" className="mx-3 flex flex-wrap items-center gap-2 px-1 py-2 text-sm text-[var(--tg-error)] sm:mx-8">
          {error}
          {failed?.alreadySaved && <button type="button" onClick={() => handleSend(failed)} className="cursor-pointer font-semibold underline">답변 다시 요청</button>}
        </div>}

        <form onSubmit={(event) => { event.preventDefault(); submit(input); }} className="mx-3 mb-3 mt-2 flex shrink-0 flex-col gap-2 sm:mx-8 sm:mb-5">
          {jobSelection && <div className="max-h-[24dvh] space-y-2 overflow-y-auto px-1">
            <div role="group" aria-label="관심 직무" className="flex flex-wrap items-center gap-1.5">
              {JOB_ROLES.map((role) => (
                <button key={role} type="button" aria-pressed={jobSelection.role === role} disabled={sending || jobSelection.role === role}
                  onClick={() => submit(role)} className={`min-h-8 rounded-lg border px-2 text-xs font-semibold ${jobSelection.role === role ? 'border-[var(--tg-primary)] bg-[var(--tg-primary-soft)]' : 'cursor-pointer border-[var(--tg-border)] hover:bg-[var(--tg-primary-soft)]'}`}>
                  {role}
                </button>
              ))}
            </div>
            {jobSelection.role && <div role="group" aria-label="탐색 키워드" className="flex flex-wrap items-center gap-1.5">
              {Object.entries(JOB_KEYWORDS).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={jobSelection.keyword === key} disabled={sending || jobSelection.keyword === key}
                  onClick={() => submit(label)} className={`min-h-8 rounded-lg border px-2 text-xs font-semibold ${jobSelection.keyword === key ? 'border-[var(--tg-primary)] bg-[var(--tg-primary-soft)]' : 'cursor-pointer border-[var(--tg-border)] hover:bg-[var(--tg-primary-soft)]'}`}>
                  {label}
                </button>
              ))}
            </div>}
          </div>}
          {lastTurn && <p className="px-1 text-xs font-medium text-[var(--tg-text-muted)]">{lastTurn.stage}턴 · {TURN_LABELS[lastTurn.stage - 1]}</p>}
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-2 shadow-sm">
            <input ref={composerRef} type="text" aria-label="메시지 입력" value={input} maxLength={FIELD_LIMITS.messageContentMax} onChange={(event) => setInput(event.target.value)} placeholder={lastTurn?.stage === 1 ? '질문에 답해 주세요' : lastTurn?.stage === 3 ? '이어서 다른 고민을 이야기해 보세요' : 'TOGRO에게 이야기해 보세요'} className="tg-input min-h-11 min-w-0 flex-1 px-3 py-2 text-base" />
            <button type="submit" disabled={sending || !input.trim()} aria-label="전송" className="tg-btn-primary inline-flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-2.5 text-sm sm:px-4"><Send aria-hidden="true" className="size-4" /><span className="hidden sm:inline">전송</span></button>
          </div>
        </form>
      </section>
      <AnimatePresence>
        {panel && visible && <SupportPreviewPanel key={panel.id} preview={panel.preview} programs={panel.programs} jobSelection={panel.jobSelection}
          saving={activeSave} saved={Boolean(savedRoadmaps[`preview-${panel.id}`])} error={missionError}
          onSave={(mission) => saveSmallAction(`preview-${panel.id}`, mission)}
          onClose={() => setPanel(null)} onRoadmap={() => onRoadmap(savedRoadmaps[`preview-${panel.id}`])} />}
      </AnimatePresence>
    </div>
  );
}
