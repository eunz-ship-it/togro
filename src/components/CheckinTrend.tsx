import { useId, useMemo, useState } from 'react';
import { checkinSeries } from '../lib/activityWorkspace';
import type { DailyCheckin } from '../types/domain';
import { WorkspaceDialog } from './WorkspaceDialog';

const W = 760;
const H = 216;
const pointY = (score: number) => 18 + (5 - score) * 42;

export function CheckinTrend({ checkins, today }: { checkins: DailyCheckin[]; today: string }) {
  const titleId = useId();
  const [days, setDays] = useState(7);
  const [hovered, setHovered] = useState<string>();
  const [selected, setSelected] = useState<DailyCheckin>();
  const points = useMemo(() => checkinSeries(checkins, today, days), [checkins, today, days]);
  const pointX = (index: number) => 43 + index * (W - 82) / (days - 1);
  const active = points.find(({ date }) => date === hovered)?.checkin;
  const line = (key: 'moodScore' | 'energyLevel') => points.map(({ checkin }, index) => checkin
    ? `${points[index - 1]?.checkin ? 'L' : 'M'} ${pointX(index)} ${pointY(checkin[key])}` : '').join(' ');

  return (
    <section aria-labelledby={titleId} className="tg-card space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id={titleId} className="text-lg font-bold text-[var(--tg-text-strong)]">체크인 변화</h2>
          <p className="mt-1 text-sm text-[var(--tg-text-muted)]">최근 {days}일 · 한국 시간 기준</p>
        </div>
        <div aria-label="그래프 기간" role="group" className="flex rounded-xl border border-[var(--tg-border)] bg-[var(--tg-bg)] p-1 text-sm">
          {[[7, '주간'], [30, '월간']].map(([period, label]) => (
            <button type="button" key={period} aria-pressed={days === period} onClick={() => { setDays(Number(period)); setHovered(undefined); }}
              className={`min-h-9 cursor-pointer rounded-lg px-4 font-semibold ${days === period ? 'bg-[var(--tg-primary-soft)] text-[var(--tg-text-strong)] ring-1 ring-[var(--tg-border)]' : ''}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="flex gap-5 text-sm" aria-label="범례">
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 bg-[var(--tg-chart-mood)]" />기분</span>
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 border-t-2 border-dashed border-[var(--tg-chart-energy)]" />에너지</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--tg-border)] bg-[var(--tg-bg)]">
        <div className={`relative h-[13.5rem] ${days === 30 ? 'min-w-[760px]' : 'min-w-[280px]'}`}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
            {[1, 2, 3, 4, 5].map((value) => (
              <line key={value} x1="35" x2={W - 26} y1={pointY(value)} y2={pointY(value)} stroke="var(--tg-border)" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={line('moodScore')} fill="none" stroke="var(--tg-chart-mood)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            <path d={line('energyLevel')} fill="none" stroke="var(--tg-chart-energy)" strokeWidth="2.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          </svg>
          {[1, 2, 3, 4, 5].map((value) => (
            <span key={value} className="pointer-events-none absolute left-[2%] -translate-y-1/2 text-xs text-[var(--tg-text-muted)]" style={{ top: `${pointY(value) / H * 100}%` }}>{value}</span>
          ))}
          {points.map(({ date, checkin }, index) => {
            const left = `${pointX(index) / W * 100}%`;
            return (
              <div key={date}>
                {(days === 7 || index % 5 === 0 || index === days - 1) && <span className="pointer-events-none absolute bottom-2 -translate-x-1/2 whitespace-nowrap text-xs text-[var(--tg-text-muted)]" style={{ left }}>{date.slice(5).replace('-', '/')}</span>}
                {checkin && <>
                  <span aria-hidden="true" className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--tg-chart-energy)] bg-[var(--tg-bg)]" style={{ left, top: `${pointY(checkin.energyLevel) / H * 100}%` }} />
                  <button type="button" aria-label={`${date} 체크인 상세 · ${checkin.moodLabel} · 기분 ${checkin.moodScore}점 · 에너지 ${checkin.energyLevel}점`}
                    onFocus={() => setHovered(date)} onBlur={() => setHovered(undefined)}
                    onPointerEnter={() => setHovered(date)} onPointerLeave={() => setHovered(undefined)}
                    onClick={() => { setHovered(undefined); setSelected(checkin); }}
                    className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tg-chart-mood)]"
                    style={{ left, top: `${pointY(checkin.moodScore) / H * 100}%` }}>
                    <span className="size-2.5 rounded-full border border-[var(--tg-surface)] bg-[var(--tg-chart-mood)]" aria-hidden="true" />
                  </button>
                </>}
              </div>
            );
          })}
          {active && !selected && (
            <div role="tooltip" className="pointer-events-none absolute z-10 max-w-[min(15rem,66%)] rounded-xl border border-[var(--tg-border)] bg-[var(--tg-surface)] p-3 text-xs shadow-md" style={{
              left: `${Math.max(34, Math.min(79, pointX(points.findIndex(({ date }) => date === hovered)) / W * 100))}%`,
              top: active.moodScore < 3 ? '10%' : '52%', transform: 'translateX(-50%)',
            }}>
              <p className="font-bold text-[var(--tg-text-strong)]">{active.checkinDate.slice(5)} · {active.moodLabel} · 에너지 {active.energyLevel}/5</p>
              {active.selfCareSuggestion && <p className="mt-1 line-clamp-2 leading-relaxed">{active.selfCareSuggestion}</p>}
            </div>
          )}
          {!points.some(({ checkin }) => checkin) && (
            <p className="absolute inset-0 grid place-items-center p-8 text-center text-sm text-[var(--tg-text-muted)]">이 기간에 기록한 체크인이 없어요.</p>
          )}
        </div>
      </div>
      {selected && (
        <WorkspaceDialog title={`${selected.checkinDate} 체크인`} onClose={() => setSelected(undefined)}>
          <dl className="space-y-4 text-sm">
            <div><dt className="font-bold">오늘의 상태</dt><dd className="mt-1">{selected.moodLabel} · 기분 {selected.moodScore}/5 · 에너지 {selected.energyLevel}/5 · {selected.availableMinutes ?? 20}분</dd></div>
            {selected.reflection && <div><dt className="font-bold">기록한 메모</dt><dd className="mt-1 whitespace-pre-wrap">{selected.reflection}</dd></div>}
            <div><dt className="font-bold">오늘의 제안</dt><dd className="mt-1 whitespace-pre-wrap">{selected.selfCareSuggestion || '저장된 제안이 없어요.'}</dd></div>
          </dl>
        </WorkspaceDialog>
      )}
    </section>
  );
}
