/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Compass,
  History,
  House,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings,
  X,
} from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { ActionReminderBanner, WorkspaceHistory, WorkspaceSettings, type Theme } from './components/ActivityViews';
import { CheckinTrend } from './components/CheckinTrend';
import { ConversationList } from './components/ConversationList';
import { AgentCompanionPanel } from './components/AgentCompanionPanel';
import { BrandIntro, useBrandIntro } from './components/BrandIntro';
import { CheckinView } from './components/CheckinAndWorriesViews';
import { DashboardView } from './components/DashboardView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingScreen } from './components/LandingScreen';
import { OnboardingModal } from './components/OnboardingModal';
import { ProgressView, RoadmapView } from './components/RoadmapAndProgressViews';
import { buildCheckinSuggestion, type CheckinAdviceInput } from './lib/checkinAdvice';
import { auth, googleProvider } from './lib/firebase';
import {
  getEffectiveTaskStatus,
  subscribeActivities,
  subscribeCheckins,
  subscribeConversations,
  subscribeGoalActivityLogs,
  subscribeRecommendedPrograms,
  subscribeRoadmaps,
  subscribeSavedPrograms,
  subscribeTasksByRoadmaps,
  subscribeUserProfile,
  subscribeWorries,
} from './lib/firestoreService';
import {
  createFirestoreActions,
  createGuestActions,
  GUEST_STORAGE_KEY,
  loadGuestWorkspace,
  saveGuestWorkspace,
  type GuestWorkspaceSnapshot,
} from './lib/workspaceData';
import {
  DAILY_GOAL_LIMIT,
  FIELD_LIMITS,
  mapAgeToAgeGroup,
  type ActivityLog,
  type AgentMessage,
  type DailyCheckin,
  type GoalActivityLog,
  type GrowthRoadmap,
  type RecommendedProgramItem,
  type RoadmapTask,
  type SavedProgram,
  type UserProfile,
  type WorryItem,
} from './types/domain';

import { dueReminder, emptyActivity, groupConversations, moveToToday, newThreadId, trackReminder, type ActionReminder, type ThreadDetails } from './lib/activityWorkspace';
import { DEMO_KEY, demoActivity, makeDemo } from './lib/demoWorkspace';
import { koreaDate, offsetDate } from './lib/koreaDate';
import { useActivityWorkspace, useKoreaClock } from './lib/useActivityWorkspace';

type WorkspaceSection = 'chat' | 'roadmap' | 'status' | 'history';

const DESKTOP_QUERY = '(min-width: 64rem)';

const NAV_ITEMS: Array<{
  id: WorkspaceSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'roadmap', label: '성장 로드맵', icon: Compass },
  { id: 'status', label: '나의 현황', icon: LayoutDashboard },
];

function WorkspaceApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [demo] = useState(() => new URLSearchParams(window.location.search).get('demo') === '1');
  const [demoStartedAt] = useState(Date.now);
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reminderError, setReminderError] = useState('');
  const [reminderBusy, setReminderBusy] = useState(false);
  const savingReminder = useRef(false);
  const seedActivity = useCallback(() => demo ? demoActivity(demoStartedAt) : emptyActivity(), [demo, demoStartedAt]);
  const { activity, updateActivity, storageError } = useActivityWorkspace(demo ? 'demo' : user ? `account.${user.uid}` : 'guest', seedActivity);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('togro.theme', theme); } catch {}
  }, [theme]);

  const nextReminderAt = activity.notifications ? activity.reminders.reduce((earliest, reminder) =>
    reminder.status === 'pending' && !activity.threadDetails[reminder.threadId]?.deleted ? Math.min(earliest, reminder.dueAt) : earliest,
  Infinity) : undefined;
  const clock = useKoreaClock(nextReminderAt);
  const now = Math.max(clock, Date.now());
  const today = offsetDate(koreaDate(now), demo ? activity.demoDayAdvance ?? 0 : 0);

  const [section, setSection] = useState<WorkspaceSection>('chat');
  const [showCheckin, setShowCheckin] = useState(false);
  const [focusedRoadmapId, setFocusedRoadmapId] = useState<string>();
  const [jumpToProgress, setJumpToProgress] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLDialogElement>(null);
  const [editingOnboarding, setEditingOnboarding] = useState(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const syncLayout = () => {
      if (media.matches) {
        sidebarRef.current?.close();
        setMenuOpen(false);
      }
      setIsDesktop(media.matches);
    };
    syncLayout();
    media.addEventListener('change', syncLayout);
    return () => media.removeEventListener('change', syncLayout);
  }, []);

  // Non-member (Guest) workspace persisted in localStorage
  const workspaceStorageKey = demo ? DEMO_KEY : GUEST_STORAGE_KEY;
  const initialGuest = useMemo(() => {
    const stored = loadGuestWorkspace(workspaceStorageKey);
    return demo && !stored.profile ? makeDemo(demoStartedAt) : stored;
  }, [demo, demoStartedAt, workspaceStorageKey]);
  const guestRef = useRef<GuestWorkspaceSnapshot>(initialGuest);
  const [guestWorkspace, setGuestWorkspace] = useState<GuestWorkspaceSnapshot>(initialGuest);
  const [showGuestLanding, setShowGuestLanding] = useState(false);

  const updateGuestWorkspace = useCallback(
    (updater: (prev: GuestWorkspaceSnapshot) => GuestWorkspaceSnapshot) => {
      const next = updater(guestRef.current);
      saveGuestWorkspace(next, workspaceStorageKey);
      guestRef.current = next;
      setGuestWorkspace(next);
    },
    [workspaceStorageKey]
  );

  // Authenticated Firestore states
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [checkinsLoaded, setCheckinsLoaded] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [worries, setWorries] = useState<WorryItem[]>([]);
  const [roadmaps, setRoadmaps] = useState<GrowthRoadmap[]>([]);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null);
  const [tasksByRoadmap, setTasksByRoadmap] = useState<Record<string, RoadmapTask[]>>({});
  const [goalLogs, setGoalLogs] = useState<GoalActivityLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<ActivityLog[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [recommendedPrograms, setRecommendedPrograms] = useState<RecommendedProgramItem[]>([]);
  const [savedPrograms, setSavedPrograms] = useState<SavedProgram[]>([]);

  useEffect(() => {
    if (demo) { setAuthReady(true); return; }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setProfile(null);
        setProfileLoaded(false);
        setCheckins([]);
        setCheckinsLoaded(false);
        setMessagesLoaded(false);
        setWorries([]);
        setRoadmaps([]);
        setTasksByRoadmap({});
        setGoalLogs([]);
        setAuditLogs([]);
        setMessages([]);
        setRecommendedPrograms([]);
        setSavedPrograms([]);
      }
    });
    return () => unsub();
  }, [demo]);

  // Subscribe to primary user collections only when authenticated
  useEffect(() => {
    if (!authReady || !user) return;

    const onErr = (err: Error) => {
      console.error('Firestore subscription error:', err.message);
      setFirestoreError('데이터 동기화 중 권한 또는 네트워크 문제가 발생했습니다.');
    };

    const unsubs = [
      subscribeUserProfile(
        user.uid,
        (p) => {
          setProfile(p);
          setProfileLoaded(true);
        },
        onErr
      ),
      subscribeCheckins(user.uid, (items) => { setCheckins(items); setCheckinsLoaded(true); }, (err) => { onErr(err); setCheckinsLoaded(true); }),
      subscribeWorries(user.uid, setWorries, onErr),
      subscribeRoadmaps(
        user.uid,
        (items) => {
          setRoadmaps(items);
          if (items.length > 0) {
            setSelectedRoadmapId((prev) =>
              prev && items.some((r) => r.id === prev) ? prev : items[0].id
            );
          } else {
            setSelectedRoadmapId(null);
            setTasksByRoadmap({});
          }
        },
        onErr
      ),
      subscribeGoalActivityLogs(user.uid, setGoalLogs, onErr),
      subscribeActivities(user.uid, setAuditLogs, onErr),
      subscribeConversations(user.uid, (items) => { setMessages(items); setMessagesLoaded(true); }, (err) => { onErr(err); setMessagesLoaded(true); }),
      subscribeSavedPrograms(user.uid, setSavedPrograms, onErr),
      subscribeRecommendedPrograms(user.uid, setRecommendedPrograms, onErr),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [authReady, user]);

  // Subscribe to tasks across all user roadmaps when authenticated
  const roadmapIdsKey = useMemo(() => roadmaps.map((r) => r.id).join(','), [roadmaps]);

  useEffect(() => {
    if (!authReady || !user || !roadmapIdsKey) {
      setTasksByRoadmap({});
      return;
    }
    const ids = roadmapIdsKey.split(',').filter(Boolean);
    return subscribeTasksByRoadmaps(
      user.uid,
      ids,
      setTasksByRoadmap,
      (err) => console.error('Tasks subscription error:', err.message)
    );
  }, [authReady, user, roadmapIdsKey]);

  const guestActions = useMemo(
    () => createGuestActions(updateGuestWorkspace),
    [updateGuestWorkspace]
  );

  const firestoreActions = useMemo(
    () => (user ? createFirestoreActions(user.uid) : null),
    [user]
  );

  const activeActions = user && firestoreActions ? firestoreActions : guestActions;
  const activeProfile = user ? profile : guestWorkspace.profile;
  const activeCheckins = user ? checkins : guestWorkspace.checkins;
  const activeWorries = user ? worries : guestWorkspace.worries;
  const activeRoadmaps = user ? roadmaps : guestWorkspace.roadmaps;
  const activeTasksByRoadmap = user ? tasksByRoadmap : guestWorkspace.tasksByRoadmap;
  const activeGoalLogs = user ? goalLogs : guestWorkspace.goalLogs;
  const activeMessages = user ? messages : guestWorkspace.messages;
  const activeRecommendedPrograms = user
    ? recommendedPrograms
    : guestWorkspace.recommendedPrograms;

  const allThreads = useMemo(() => groupConversations(activeMessages, activity.threadDetails), [activeMessages, activity.threadDetails]);
  const threads = useMemo(() => allThreads.filter((thread) => !thread.deleted), [allThreads]);
  const activeThread = threads.find((thread) => thread.id === activity.activeThreadId);
  const todayCheckin = activeCheckins.find((checkin) => checkin.checkinDate === today);
  const dataReady = Boolean(authReady && activeProfile && (!user || (checkinsLoaded && messagesLoaded)));
  const dailyCheckinDue = dataReady && !todayCheckin;

  useEffect(() => {
    if (!dataReady || activity.day === today && activity.activeThreadId) return;
    const current = threads.filter((thread) => thread.updatedAt).reduce<typeof activeThread>(
      (latest, item) => !latest || item.updatedAt > latest.updatedAt ? item : latest, undefined,
    );
    const nextId = newThreadId();
    updateActivity((previous) => moveToToday(previous, today, nextId, current));
    if (activity.day && activity.day !== today) {
      sidebarRef.current?.close();
      setMenuOpen(false);
      setSettingsOpen(false);
      setShowCheckin(false);
      setSection('chat');
    }
  }, [activity.day, activity.activeThreadId, dataReady, today, threads, updateActivity]);

  const effectiveSelectedRoadmapId = useMemo(() => {
    if (selectedRoadmapId && activeRoadmaps.some((r) => r.id === selectedRoadmapId)) {
      return selectedRoadmapId;
    }
    return activeRoadmaps[0]?.id ?? null;
  }, [selectedRoadmapId, activeRoadmaps]);

  const activeRoadmapTasks = useMemo(() => {
    return effectiveSelectedRoadmapId ? activeTasksByRoadmap[effectiveSelectedRoadmapId] || [] : [];
  }, [effectiveSelectedRoadmapId, activeTasksByRoadmap]);

  const openMenu = () => {
    sidebarRef.current?.showModal();
    setMenuOpen(true);
  };

  const closeMenu = () => {
    sidebarRef.current?.close();
    setMenuOpen(false);
  };

  const handleNavigate = (nextSection: WorkspaceSection, roadmapId?: string) => {
    closeMenu();
    if (roadmapId) setSelectedRoadmapId(roadmapId);
    setFocusedRoadmapId(nextSection === 'roadmap' ? roadmapId : undefined);
    setEditingOnboarding(false);
    setShowCheckin(false);
    setSection(nextSection);
    window.scrollTo({ top: 0 });
  };

  const openCheckin = () => {
    handleNavigate('chat');
    setShowCheckin(true);
  };

  const showProgress = (roadmapId?: string) => {
    handleNavigate('status', roadmapId);
    setJumpToProgress(true);
  };

  useEffect(() => {
    if (!jumpToProgress || section !== 'status') return;
    progressRef.current?.scrollIntoView({ block: 'start' });
    setJumpToProgress(false);
  }, [jumpToProgress, section]);

  const handleEnterAsGuest = async (
    input: { nickname: string; age: number; jobPrepStatus: string; region: string },
    checkin?: CheckinAdviceInput,
  ) => {
    const profileInput = {
      nickname: input.nickname,
      age: input.age,
      ageGroup: mapAgeToAgeGroup(input.age),
      jobPrepStatus: input.jobPrepStatus,
      region: input.region,
      interests: guestWorkspace.profile?.interests ?? ['생활 리듬 회복', '진로 방향 탐색'],
      currentGoalFocus: guestWorkspace.profile?.currentGoalFocus ?? '',
      onboardingCompleted: true,
      onboardingSkipped: false,
    };
    if (checkin) {
      await guestActions.completeFirstEntry(profileInput, {
        ...checkin, availableMinutes: checkin.availableMinutes ?? 20, checkinDate: today, selfCareSuggestion: buildCheckinSuggestion(checkin),
      });
    } else {
      await guestActions.saveProfile(profileInput);
    }
    setShowGuestLanding(false);
    handleNavigate('chat');
  };

  const handleReturnToLanding = () => {
    closeMenu();
    setShowGuestLanding(true);
    setShowCheckin(false);
    setSelectedRoadmapId(null);
    setEditingOnboarding(false);
    setSection('chat');
  };

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Google 로그인 팝업이 차단되었거나 취소되었습니다. 팝업 허용 후 다시 시도해 주세요.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    closeMenu();
    await signOut(auth);
    setShowCheckin(false);
    setEditingOnboarding(false);
    setSection('chat');
  };

  const updateThread = (id: string, details: ThreadDetails) => {
    const replacement = details.deleted ? newThreadId() : '';
    updateActivity((previous) => ({
      ...previous,
      activeThreadId: details.deleted && previous.activeThreadId === id ? replacement : previous.activeThreadId,
      threadDetails: { ...previous.threadDetails, [id]: { ...previous.threadDetails[id], ...details } },
    }));
  };

  const openThread = (id: string) => {
    updateActivity((previous) => ({ ...previous, day: today, activeThreadId: id }));
    handleNavigate('chat');
  };

  const saveActionProposal = (threadId: string, id: string, title: string, description: string, durationMinutes: number) => {
    if (!Number.isFinite(durationMinutes)) return;
    const startedAt = Date.now();
    updateActivity((previous) => trackReminder(previous, {
      id, threadId, title: title.trim().slice(0, FIELD_LIMITS.taskTitleMax), description, durationMinutes: Math.max(1, Math.round(durationMinutes)),
    }, startedAt));
  };

  const linkReminderToRoadmap = (threadId: string, id: string, roadmapId: string, title: string) => {
    updateActivity((previous) => {
      const reminders = previous.reminders.map((reminder) => reminder.status === 'pending' && reminder.threadId === threadId &&
        (reminder.id === id || reminder.title === title.trim().slice(0, FIELD_LIMITS.taskTitleMax)) ? { ...reminder, roadmapId } : reminder);
      return reminders.some((reminder, index) => reminder !== previous.reminders[index]) ? { ...previous, reminders } : previous;
    });
  };

  const updateReminder = (id: string, change: Partial<ActionReminder>) => {
    updateActivity((previous) => ({
      ...previous, reminders: previous.reminders.map((reminder) => reminder.id === id ? { ...reminder, ...change } : reminder),
    }));
  };

  const matchingRoadmapTask = (reminder: ActionReminder) => reminder.roadmapId
    ? activeTasksByRoadmap[reminder.roadmapId]?.find((task) => task.title === reminder.title) : undefined;

  const nextDueReminder = dataReady ? dueReminder(activity, now) : undefined;

  const completeReminder = async (reminder: ActionReminder) => {
    if (savingReminder.current) return;
    savingReminder.current = true;
    setReminderBusy(true);
    setReminderError('');
    try {
      const task = matchingRoadmapTask(reminder);
      const roadmap = activeRoadmaps.find((item) => item.id === task?.roadmapId);
      if (task && roadmap && getEffectiveTaskStatus(task) !== '완료') {
        await activeActions.updateTaskStatus(roadmap.id, task, '완료', activeTasksByRoadmap[roadmap.id], undefined, roadmap.status);
      }
      updateReminder(reminder.id, { status: 'completed', resolvedAt: Date.now(), roadmapId: roadmap?.id });
    } catch {
      setReminderError('완료 기록을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      savingReminder.current = false;
      setReminderBusy(false);
    }
  };

  const exportWorkspace = () => {
    const backup = {
      version: 1, exportedAtKST: today, demo,
      preferences: { theme, ...activity },
      profile: activeProfile, checkins: activeCheckins, conversations: allThreads, worries: activeWorries,
      roadmaps: activeRoadmaps, tasksByRoadmap: activeTasksByRoadmap, goalActivityLogs: activeGoalLogs, activityLogs: user ? auditLogs : [],
      savedPrograms: user ? savedPrograms : guestWorkspace.savedPrograms, recommendedPrograms: activeRecommendedPrograms,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `TOGRO-${today}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[var(--tg-bg)] flex items-center justify-center">
        <p className="text-sm font-medium text-[var(--tg-text-muted)]">TOGRO를 불러오는 중입니다...</p>
      </div>
    );
  }

  // Show LandingScreen when neither signed in nor entered as a guest
  if (!user && (!guestWorkspace.profile || showGuestLanding)) {
    return (
      <LandingScreen
        initialProfile={guestWorkspace.profile}
        theme={theme}
        onTheme={setTheme}
        onEnterAsGuest={handleEnterAsGuest}
        onSignIn={handleSignIn}
        authLoading={authLoading}
        authError={authError}
      />
    );
  }

  const needsOnboarding = user
    ? profileLoaded && (!profile || editingOnboarding)
    : editingOnboarding;
  const currentNavLabel = needsOnboarding ? '맞춤 설정'
    : section === 'history' ? '히스토리 내역'
    : NAV_ITEMS.find((item) => item.id === section)?.label;
  const latestCheckin = todayCheckin ?? activeCheckins[0] ?? null;
  const firstConcernRequired = !user && guestWorkspace.pendingFirstConcern === true;
  const showingCheckin = section === 'chat' && (showCheckin || dailyCheckinDue);
  const showingChat = section === 'chat' && !showingCheckin && !needsOnboarding && dataReady && Boolean(activity.activeThreadId);

  const sidebarContent = (
    <>
      <nav aria-label="주요 메뉴" className="shrink-0 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = !needsOnboarding && section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => handleNavigate(item.id)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                active
                  ? 'border-[var(--tg-primary)] bg-[var(--tg-primary-soft)] font-semibold text-[var(--tg-text-strong)]'
                  : 'border-transparent hover:bg-[var(--tg-bg)] hover:text-[var(--tg-text-strong)]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <ConversationList threads={threads} activeId={activity.activeThreadId} onSelect={openThread}
        onNew={() => openThread(newThreadId())} onUpdate={updateThread} />

      <div className="shrink-0 space-y-2 border-t border-[var(--tg-border)] p-4">
        <button type="button" aria-label="히스토리 내역" title="히스토리 내역" onClick={() => handleNavigate('history')} className="grid size-9 cursor-pointer place-items-center rounded-xl border border-[var(--tg-border)] hover:bg-[var(--tg-primary-soft)]"><History className="size-4" aria-hidden="true" /></button>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--tg-text-strong)]">
              {activeProfile?.nickname || user?.displayName || '청년'}
              {activeProfile?.age ? ` (${activeProfile.age}세)` : ''}
            </p>
            <p className="truncate text-xs text-[var(--tg-text-muted)]">
              {user ? user.email : activeProfile?.jobPrepStatus || '비회원 이용 중'}
            </p>
          </div>
          {demo ? <a href={window.location.pathname} className="tg-btn-secondary inline-flex shrink-0 items-center px-2 text-xs">시연 종료</a> : (
          <button
            type="button"
            onClick={user ? handleSignOut : handleReturnToLanding}
            title={user ? '로그아웃' : '초기 화면으로'}
            aria-label={user ? '로그아웃' : '초기 화면으로'}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl hover:bg-[var(--tg-primary-soft)] cursor-pointer"
          >
            {user ? <LogOut className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
          </button>
          )}
        </div>
        {!user && !demo && (
          <button
            type="button"
            onClick={handleSignIn}
            disabled={authLoading}
            className="tg-btn-secondary inline-flex w-full items-center justify-center gap-2 px-3 text-xs cursor-pointer"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {authLoading ? '연결 중...' : 'Google 계정으로 동기화'}
          </button>
        )}
        {authError && <p role="alert" className="text-xs text-[var(--tg-error)]">{authError}</p>}
      </div>
    </>
  );

  const sidebarToggleLabel = sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기';

  return (
    <div className="flex min-h-dvh bg-[var(--tg-bg)] text-[var(--tg-text)]">
      {isDesktop ? (
        <aside
          aria-label="TOGRO 사이드바"
          className={`sticky top-0 flex h-dvh shrink-0 flex-col self-start overflow-hidden border-r border-[var(--tg-border)] bg-[var(--tg-surface)] transition-[width] duration-200 ease-in-out motion-reduce:transition-none ${sidebarCollapsed ? 'w-[6.5rem]' : 'w-72'}`}
        >
          <div className="flex h-[calc(4rem+1px)] shrink-0 items-center justify-between gap-1 border-b border-[var(--tg-border)] px-2">
            <button
              type="button"
              aria-label="홈"
              aria-current={section === 'chat' && !needsOnboarding ? 'page' : undefined}
              title="홈"
              onClick={() => handleNavigate('chat')}
              className="flex h-10 min-w-10 cursor-pointer items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-[var(--tg-text-strong)] hover:bg-[var(--tg-primary-soft)]"
            >
              <House className="size-5 shrink-0" aria-hidden="true" />
              {!sidebarCollapsed && <span>홈</span>}
            </button>
            <button
              type="button"
              aria-label={sidebarToggleLabel}
              aria-expanded={!sidebarCollapsed}
              aria-controls="workspace-sidebar-content"
              title={sidebarToggleLabel}
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl hover:bg-[var(--tg-primary-soft)]"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="size-5" aria-hidden="true" /> : <PanelLeftClose className="size-5" aria-hidden="true" />}
            </button>
          </div>
          <div
            id="workspace-sidebar-content"
            inert={sidebarCollapsed || firstConcernRequired}
            className={`flex min-h-0 w-[calc(18rem-1px)] flex-1 flex-col transition-opacity duration-200 motion-reduce:transition-none ${sidebarCollapsed ? 'opacity-0' : firstConcernRequired ? 'opacity-50' : 'opacity-100'}`}
          >
            {sidebarContent}
          </div>
        </aside>
      ) : (
        <dialog
          ref={sidebarRef}
          id="workspace-menu"
          aria-labelledby="workspace-menu-title"
          onClose={() => setMenuOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeMenu();
          }}
          className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 border-r border-[var(--tg-border)] bg-[var(--tg-surface)] p-0 text-[var(--tg-text)] shadow-lg backdrop:bg-slate-950/55"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--tg-border)] px-4 py-3">
              <h2 id="workspace-menu-title" className="text-base font-bold text-[var(--tg-text-strong)]">메뉴</h2>
              <button
                type="button"
                aria-label="메뉴 닫기"
                onClick={closeMenu}
                className="grid size-10 cursor-pointer place-items-center rounded-xl hover:bg-[var(--tg-primary-soft)]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </dialog>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 shrink-0 border-b border-[var(--tg-border)] bg-[var(--tg-surface)]/95 backdrop-blur-xs">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-6 sm:px-8">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
              <button
                type="button"
                aria-label="메뉴 열기"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                aria-controls="workspace-menu"
                onClick={openMenu}
                disabled={firstConcernRequired}
                title={firstConcernRequired ? '첫 고민을 전송하면 메뉴를 열 수 있어요.' : undefined}
                className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[var(--tg-border)] px-2.5 text-[var(--tg-text)] hover:bg-[var(--tg-primary-soft)] lg:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="TOGRO 대화 홈"
                onClick={() => handleNavigate('chat')}
                className="font-display flex shrink-0 cursor-pointer items-center gap-2 rounded-md text-lg font-bold tracking-tight text-[var(--tg-text-strong)]"
              >
                <img src="/assets/aistudio/to-grow___App_icon_f7f04fa0.png" alt="" className="size-8 rounded-lg" />
                TOGRO
              </button>
              {currentNavLabel && (
                <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-[var(--tg-text-muted)] sm:text-sm">
                  <span aria-hidden="true">/</span>
                  <span className="truncate">{currentNavLabel}</span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {demo && <span className="rounded-full bg-[var(--tg-secondary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--tg-success)]">시연</span>}
              {section !== 'chat' && <button type="button" onClick={() => handleNavigate('chat')} className="tg-btn-secondary hidden cursor-pointer whitespace-nowrap px-3 text-sm sm:block">대화로 돌아가기</button>}
              <button type="button" aria-label="설정" title="설정" onClick={() => setSettingsOpen(true)} className="grid size-10 cursor-pointer place-items-center rounded-xl border border-[var(--tg-border)] hover:bg-[var(--tg-primary-soft)]"><Settings className="size-5" aria-hidden="true" /></button>
            </div>
          </div>
        </header>

        <main className={showingChat
          ? 'flex h-[calc(100dvh-4rem-1px)] min-h-[20rem] w-full flex-col'
          : 'w-full flex-1'}
        >
          {nextDueReminder && (
            <ActionReminderBanner reminder={nextDueReminder} busy={reminderBusy} error={reminderError}
              onDone={() => completeReminder(nextDueReminder)}
              onLater={() => { setReminderError(''); updateReminder(nextDueReminder.id, { dueAt: Date.now() + 10 * 60_000 }); }} />
          )}
          <div className={showingChat
            ? 'mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 flex-col'
            : 'mx-auto w-full min-w-0 max-w-6xl px-4 py-8 sm:px-8'}
          >
            {storageError && <p role="alert" className="px-4 py-2 text-sm text-[var(--tg-error)]">브라우저에 변경 사항을 영구 저장할 수 없어요.</p>}
            {firestoreError && (
              <div
                role="alert"
                className="mb-6 p-3.5 bg-[var(--tg-error-soft)] border border-[var(--tg-error-border)] rounded-xl text-xs font-medium text-[var(--tg-error)]"
              >
                {firestoreError}
              </div>
            )}

            {user && (!profileLoaded || (profile && (!checkinsLoaded || !messagesLoaded))) ? (
              <div className="py-12 text-center text-sm text-[var(--tg-text-muted)]">
                개인 성장 기록을 불러오는 중입니다...
              </div>
            ) : needsOnboarding ? (
              <OnboardingModal
                defaultName={activeProfile?.nickname || user?.displayName || '청년'}
                initialProfile={activeProfile || guestWorkspace.profile}
                onSave={async (data) => {
                  await activeActions.saveProfile(data);
                  setEditingOnboarding(false);
                }}
                onCancel={editingOnboarding ? () => setEditingOnboarding(false) : undefined}
              />
            ) : (
              <>
                {activity.activeThreadId && <div className={showingChat ? 'min-h-0 flex-1' : 'hidden'}>
                  <AgentCompanionPanel
                    key={`${user?.uid ?? 'guest'}:${activity.activeThreadId}`}
                    demo={demo}
                    today={today}
                    threadId={activity.activeThreadId}
                    threadTitle={activeThread?.title}
                    canStartNew={Boolean(activeThread)}
                    onNewConcern={() => openThread(newThreadId())}
                    onActionProposal={saveActionProposal}
                    onActionSaved={linkReminderToRoadmap}
                    visible={showingChat}
                    firstConcernRequired={firstConcernRequired}
                    actions={activeActions}
                    profile={activeProfile}
                    messages={activeThread?.messages ?? []}
                    latestCheckin={latestCheckin}
                    worries={activeWorries}
                    roadmaps={activeRoadmaps}
                    tasksByRoadmap={activeTasksByRoadmap}
                    recommendedPrograms={activeRecommendedPrograms}
                    onCheckin={openCheckin}
                    onRoadmap={(id) => handleNavigate('roadmap', id)}
                  />
                </div>}

                {section === 'status' && (
                  <DashboardView
                    actions={activeActions}
                    profile={activeProfile}
                    checkins={activeCheckins}
                    worries={activeWorries}
                    roadmaps={activeRoadmaps}
                    tasksByRoadmap={activeTasksByRoadmap}
                    today={today}
                    demo={demo}
                    dailyGoalPlan={activity.dailyGoalPlan?.date === today ? activity.dailyGoalPlan : undefined}
                    onDailyGoals={(date, result) => updateActivity((previous) =>
                      previous.dailyGoalPlan && previous.dailyGoalPlan.date >= date ? previous : {
                        ...previous, dailyGoalPlan: { ...result, date, suggestions: result.suggestions.slice(0, DAILY_GOAL_LIMIT), savedIndexes: [] },
                      },
                    )}
                    onDailyGoalSaved={(date, index) => updateActivity((previous) => {
                      const plan = previous.dailyGoalPlan;
                      if (plan?.date !== date || plan.savedIndexes.includes(index)) return previous;
                      return { ...previous, dailyGoalPlan: { ...plan, savedIndexes: [...plan.savedIndexes, index] } };
                    })}
                    onCheckin={openCheckin}
                    onChat={() => handleNavigate('chat')}
                    onProgress={showProgress}
                    onRoadmap={() => handleNavigate('roadmap')}
                    onEditOnboarding={() => setEditingOnboarding(true)}
                  />
                )}

                {section === 'status' && <div className="mt-6"><CheckinTrend checkins={activeCheckins} today={today} /></div>}

                {showingCheckin && (
                  <CheckinView
                    key={today}
                    checkinDate={today}
                    required={dailyCheckinDue}
                    demo={demo}
                    onSaved={(id, suggestion) => {
                      const minutes = Number(suggestion.match(/^지금은 (\d+)분/)?.[1]);
                      if (minutes && activity.activeThreadId) saveActionProposal(activity.activeThreadId, id, '오늘 체크인에서 정한 행동', suggestion, minutes);
                      if (dailyCheckinDue) setShowCheckin(false);
                    }}
                    actions={activeActions}
                    checkins={activeCheckins}
                    roadmaps={activeRoadmaps}
                    tasksByRoadmap={activeTasksByRoadmap}
                    worries={activeWorries}
                    onGoProgress={showProgress}
                  />
                )}

                {section === 'history' && <WorkspaceHistory threads={threads} logs={activeGoalLogs} reminders={activity.reminders} onOpenThread={openThread} />}

                {section === 'roadmap' && (
                  <RoadmapView
                    actions={activeActions}
                    focusedRoadmapId={focusedRoadmapId}
                    roadmaps={activeRoadmaps}
                    tasksByRoadmap={activeTasksByRoadmap}
                    latestCheckin={latestCheckin}
                    worries={activeWorries}
                    onGoProgress={showProgress}
                  />
                )}

                {section === 'status' && (
                  <div ref={progressRef} className="mt-8 scroll-mt-24 border-t border-[var(--tg-border)] pt-8">
                    <ProgressView
                      actions={activeActions}
                      roadmaps={activeRoadmaps}
                      selectedRoadmapId={effectiveSelectedRoadmapId}
                      onSelectRoadmap={setSelectedRoadmapId}
                      tasks={activeRoadmapTasks}
                      tasksByRoadmap={activeTasksByRoadmap}
                      latestCheckin={latestCheckin}
                      goalLogs={activeGoalLogs}
                      today={today}
                      onGoCreateRoadmap={() => handleNavigate('roadmap')}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
      {settingsOpen && <WorkspaceSettings
        theme={theme} notifications={activity.notifications} allThreads={allThreads} checkins={activeCheckins} logs={activeGoalLogs}
        reminders={activity.reminders} auditLogs={user ? auditLogs : []} demo={demo}
        onClose={() => setSettingsOpen(false)} onTheme={setTheme}
        onNotifications={(notifications) => { setReminderError(''); updateActivity((previous) => ({ ...previous, notifications })); }}
        onRestore={(id) => updateThread(id, { deleted: false })}
        onCancelReminder={(id) => updateReminder(id, { status: 'skipped', resolvedAt: Date.now() })}
        onExport={exportWorkspace}
        onNextDay={() => { if (demo) updateActivity((previous) => ({ ...previous, demoDayAdvance: (previous.demoDayAdvance ?? 0) + 1 })); }}
      />}
    </div>
  );
}

export default function App() {
  const { showIntro, dismissIntro } = useBrandIntro();
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <WorkspaceApp />
        {showIntro && <BrandIntro onDismiss={dismissIntro} />}
      </MotionConfig>
    </ErrorBoundary>
  );
}
