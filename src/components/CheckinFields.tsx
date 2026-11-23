import { useId } from 'react';
import type { CheckinAdviceInput } from '../lib/checkinAdvice';
import { FIELD_LIMITS, type MoodLabel } from '../types/domain';

export type CheckinDraft = Omit<CheckinAdviceInput, 'moodLabel'> & { moodLabel: MoodLabel | '' };
export const INITIAL_CHECKIN: CheckinDraft = {
  moodLabel: '', moodScore: 3, energyLevel: 3, availableMinutes: 20, reflection: '',
};

const MOOD_LABELS: MoodLabel[] = ['차분함', '괜찮음', '의욕 있음', '막막함', '지침', '불안함'];
const AVAILABLE_MINUTE_PRESETS = [10, 20, 30, 60];

export function CheckinFields({ draft, onChange }: {
  draft: CheckinDraft;
  onChange: (draft: CheckinDraft) => void;
}) {
  const id = useId();
  const { moodLabel, moodScore, energyLevel, availableMinutes, reflection } = draft;
  return (
    <>
      <div>
        <span className="block text-sm font-semibold text-[var(--tg-text-strong)] mb-2.5">
          오늘 가장 가까운 마음 상태
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MOOD_LABELS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => onChange({ ...draft, moodLabel: label })}
              aria-pressed={moodLabel === label}
              className={`py-2.5 px-3 text-sm rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
                moodLabel === label
                  ? 'bg-[var(--tg-primary)] text-[var(--tg-text-strong)] border-[var(--tg-primary-border)] font-semibold'
                  : 'bg-[var(--tg-bg)] text-[var(--tg-text)] border-[var(--tg-border)] hover:bg-[var(--tg-primary-soft)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${id}-mood-score`} className="block text-xs font-medium text-[var(--tg-text-muted)] mb-1.5">
            기분 지수 (<span className="font-mono font-semibold text-[var(--tg-text-strong)] tabular-nums">{moodScore}/5</span>)
          </label>
          <input
            id={`${id}-mood-score`}
            type="range"
            min={1}
            max={5}
            value={moodScore}
            onChange={(e) => onChange({ ...draft, moodScore: Number(e.target.value) })}
            className="w-full accent-[var(--tg-text)]"
          />
        </div>
        <div>
          <label htmlFor={`${id}-energy-level`} className="block text-xs font-medium text-[var(--tg-text-muted)] mb-1.5">
            에너지 수준 (<span className="font-mono font-semibold text-[var(--tg-text-strong)] tabular-nums">{energyLevel}/5</span>)
          </label>
          <input
            id={`${id}-energy-level`}
            type="range"
            min={1}
            max={5}
            value={energyLevel}
            onChange={(e) => onChange({ ...draft, energyLevel: Number(e.target.value) })}
            className="w-full accent-[var(--tg-text)]"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <label htmlFor={`${id}-available-minutes`} className="block text-sm font-semibold text-[var(--tg-text-strong)]">
            오늘 사용 가능한 시간
          </label>
          <span className="font-mono text-xs font-semibold text-[var(--tg-success)] tabular-nums">
            {availableMinutes}분
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-2.5">
          {AVAILABLE_MINUTE_PRESETS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => onChange({ ...draft, availableMinutes: mins })}
              aria-pressed={availableMinutes === mins}
              className={`py-2 px-2 text-xs rounded-xl border transition-colors whitespace-nowrap cursor-pointer font-mono tabular-nums ${
                availableMinutes === mins
                  ? 'bg-[var(--tg-primary)] text-[var(--tg-text-strong)] border-[var(--tg-primary-border)] font-semibold'
                  : 'bg-[var(--tg-bg)] text-[var(--tg-text)] border-[var(--tg-border)] hover:bg-[var(--tg-primary-soft)]'
              }`}
            >
              {mins}분
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            id={`${id}-available-minutes`}
            type="number"
            required
            min={FIELD_LIMITS.availableMinutesMin}
            max={FIELD_LIMITS.availableMinutesMax}
            value={availableMinutes}
            onChange={(e) => onChange({ ...draft, availableMinutes: Number(e.target.value) })}
            className="tg-input w-24 px-3 py-2 text-xs font-mono tabular-nums"
          />
          <span className="text-xs text-[var(--tg-text-muted)]">분 직접 입력 (5~480분)</span>
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-checkin-memo`} className="block text-sm font-semibold text-[var(--tg-text-strong)] mb-1.5">
          오늘의 짧은 메모 (선택)
        </label>
        <textarea
          id={`${id}-checkin-memo`}
          rows={3}
          maxLength={FIELD_LIMITS.reflectionMax}
          value={reflection}
          onChange={(e) => onChange({ ...draft, reflection: e.target.value })}
          placeholder="예: 어제 늦게 자서 조금 피곤하지만, 오후에는 산책을 한 바퀴 돌고 싶어요."
          className="tg-input w-full px-3.5 py-2.5 text-sm"
        />
      </div>
    </>
  );
}
