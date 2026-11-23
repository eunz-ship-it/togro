import { Moon, Sun } from 'lucide-react';
import type { Theme } from './ActivityViews';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CheckinAdviceInput } from '../lib/checkinAdvice';
import { FIELD_LIMITS, JOB_PREP_STATUS_OPTIONS } from '../types/domain';
import { PROFILE_REGIONS } from '../lib/counselingResources';
import { CheckinFields, INITIAL_CHECKIN } from './CheckinFields';

interface EntryProfile {
  nickname: string;
  age: number;
  jobPrepStatus: string;
  region: string;
}

interface LandingScreenProps {
  initialProfile: Partial<EntryProfile> | null;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  onEnterAsGuest: (input: EntryProfile, checkin?: CheckinAdviceInput) => Promise<void>;
  onSignIn: () => Promise<void>;
  authLoading: boolean;
  authError: string | null;
}

export function LandingScreen({ initialProfile, theme, onTheme, onEnterAsGuest, onSignIn, authLoading, authError }: LandingScreenProps) {
  const [step, setStep] = useState(initialProfile ? 2 : 1);
  const [draft, setDraft] = useState(INITIAL_CHECKIN);
  const [nickname, setNickname] = useState(initialProfile?.nickname ?? '');
  const [ageInput, setAgeInput] = useState(initialProfile?.age?.toString() ?? '');
  const [jobPrepStatus, setJobPrepStatus] = useState(initialProfile?.jobPrepStatus || JOB_PREP_STATUS_OPTIONS[0]);
  const [region, setRegion] = useState(initialProfile?.region ?? '');
  const [formError, setFormError] = useState('');
  const [entering, setEntering] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [step]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (entering) return;

    setFormError('');
    if (step === 1) {
      if (draft.moodLabel) setStep(2);
      return;
    }

    if (!nickname.trim()) {
      setFormError('불리고 싶은 별명을 입력해 주세요.');
      return;
    }

    const age = Number(ageInput);
    if (!Number.isInteger(age) || age < 15 || age > 99) {
      setFormError('만 나이를 15세부터 99세 사이로 입력해 주세요.');
      return;
    }

    setEntering(true);
    try {
      const { moodLabel } = draft;
      await onEnterAsGuest({ nickname: nickname.trim(), age, jobPrepStatus, region }, moodLabel ? { ...draft, moodLabel } : undefined);
    } catch {
      setFormError('브라우저에 기록을 저장하지 못했어요. 입력을 그대로 두었으니 다시 시도해 주세요.');
    } finally {
      setEntering(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--tg-bg)] pb-[120mm] text-[var(--tg-text)]">
      <header className="border-b border-[var(--tg-border)] bg-[var(--tg-surface)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5 font-display text-lg font-bold text-[var(--tg-text-strong)]">
            <img src="/assets/aistudio/to-grow___App_icon_f7f04fa0.png" alt="" className="size-8 rounded-lg" />
            TOGRO
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" title={theme === 'light' ? '다크 모드' : '라이트 모드'} aria-label={theme === 'light' ? '다크 모드' : '라이트 모드'}
              onClick={() => onTheme(theme === 'light' ? 'dark' : 'light')} className="grid size-10 cursor-pointer place-items-center rounded-xl border border-[var(--tg-border)] hover:bg-[var(--tg-primary-soft)]">
              {theme === 'light' ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
            </button>
            <a href="?demo=1" className="tg-btn-secondary inline-flex shrink-0 items-center px-3 text-xs sm:text-sm">샘플로 시연하기</a>
            <button type="button" onClick={onSignIn} disabled={authLoading || entering} className="tg-btn-secondary cursor-pointer px-3 text-xs sm:text-sm">
            {authLoading ? '연결 중…' : 'Google 기록 불러오기'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-7 sm:px-6 sm:py-12">
        <form onSubmit={handleSubmit} className="tg-card space-y-5 p-5 sm:p-8">
          <div>
            {!initialProfile && (
              <p className="mb-2 text-sm font-semibold text-[var(--tg-success)]">
                {step === 1 ? '1 / 3 · 오늘의 상태' : '2 / 3 · 기본 정보'}
              </p>
            )}
            <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold text-[var(--tg-text-strong)] outline-none">
              {step === 1 ? '오늘의 체크인' : '어떻게 불러드릴까요?'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--tg-text-muted)]">
              {step === 1
                ? '지금 기분과 쓸 수 있는 시간을 알려주세요. 오늘의 여력에 맞춰 다음 행동을 함께 정해요.'
                : '별명과 나이, 현재 취업 준비 상황을 알려주세요. 지역을 선택하면 가까운 지원 정보를 찾아드려요.'}
            </p>
          </div>

          {step === 1 ? (
            <CheckinFields draft={draft} onChange={setDraft} />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                <label className="space-y-1.5 text-sm font-semibold">별명
                  <input required value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={FIELD_LIMITS.nicknameMax} placeholder="예: 은지" className="tg-input w-full px-3 py-2" />
                </label>
                <label className="space-y-1.5 text-sm font-semibold">만 나이
                  <input required type="number" min={15} max={99} value={ageInput} onChange={(event) => setAgeInput(event.target.value)} className="tg-input w-full px-3 py-2" />
                </label>
              </div>
              <label className="block space-y-1.5 text-sm font-semibold">활동 지역 (선택)
                <select value={region} onChange={(event) => setRegion(event.target.value)} className="tg-input w-full px-3 py-2">
                  <option value="">전국 (미선택)</option>
                  {PROFILE_REGIONS.map((item) => <option key={item}>{item}</option>)}
                  <option>기타 지역</option>
                </select>
              </label>
              <label className="block space-y-1.5 text-sm font-semibold">현재 취업 준비 상황
                <select value={jobPrepStatus} onChange={(event) => setJobPrepStatus(event.target.value)} className="tg-input w-full px-3 py-2">
                  {JOB_PREP_STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
          )}

          {(formError || authError) && <p role="alert" className="text-sm text-[var(--tg-error)]">{formError || authError}</p>}
          <div className="flex gap-2">
            {step === 2 && !initialProfile && (
              <button type="button" onClick={() => setStep(1)} disabled={entering} className="tg-btn-secondary min-h-11 cursor-pointer px-4 text-sm">이전</button>
            )}
            <button type="submit" disabled={entering || (step === 1 && !draft.moodLabel)} className="tg-btn-primary min-h-11 flex-1 cursor-pointer px-4 text-sm font-semibold disabled:cursor-not-allowed">
              {entering ? '저장 중…' : step === 1 ? '기본 정보 입력하기' : '고민 이야기하기'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
