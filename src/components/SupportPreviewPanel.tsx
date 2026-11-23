import { useState } from 'react';
import { CalendarPlus, X } from 'lucide-react';
import { motion } from 'motion/react';
import { findRegionalCounseling, ONTONG_REGIONAL_PLATFORMS, PROFILE_REGIONS } from '../lib/counselingResources';
import type { SupportPreview } from '../lib/guidedConversation';
import { buildJobDiscovery, type JobSelection } from '../lib/jobDiscovery';
import { ONTONG_COUNSELING_BOOKING, FUTURE_WORK_EXPERIENCE_PROGRAM, safeProgramLink } from '../lib/programLinks';
import type { RecommendedProgramItem } from '../types/domain';

export type PreviewMission = { id: string; provider: string; title: string; description: string };
const officialLinkClass = 'tg-btn-secondary inline-flex min-h-10 items-center px-3 py-1.5 text-sm';

export function SupportPreviewPanel({ preview, programs, jobSelection, saving, saved, error, onSave, onClose, onRoadmap }: {
  preview: SupportPreview;
  programs: RecommendedProgramItem[];
  jobSelection?: JobSelection;
  saving: boolean;
  saved: boolean;
  error: string;
  onSave: (mission: PreviewMission) => void;
  onClose: () => void;
  onRoadmap: () => void;
}) {
  const [region, setRegion] = useState(preview.region);
  const counseling = preview.kind === 'wellbeing' ? 'wellbeing' : 'career';
  const { local, directory, platformUrl } = findRegionalCounseling(region, counseling);
  const isPrograms = preview.kind === 'programs';
  const job = preview.kind === 'job' && jobSelection ? buildJobDiscovery(jobSelection) : undefined;
  const primaryProgram = programs[0];
  const mainTitle = job?.title ?? (isPrograms ? '추천 지원 프로그램' : counseling === 'wellbeing' ? '마음건강 상담 정보' : '청년 진로·취업 상담');
  const mission = job ? undefined : isPrograms
    ? primaryProgram && {
        id: primaryProgram.programId,
        provider: primaryProgram.provider,
        title: primaryProgram.programId === FUTURE_WORK_EXPERIENCE_PROGRAM ? '미래내일 일경험 공고 하나 확인하기' : '추천 프로그램 신청 조건 확인하기',
        description: primaryProgram.howToApply,
      }
    : {
        id: `counseling-${counseling}`,
        provider: local?.label ?? directory.label,
        title: counseling === 'career' ? '상담 예약하기' : '마음건강 상담 문의 방법 확인하기',
        description: counseling === 'career'
          ? `${local?.label ?? '온통청년'}에서 상담 가능한 날짜를 확인하고, 상담에서 물어볼 질문을 한 줄 적어보세요.`
          : `${local?.label ?? directory.label}에서 온라인 문의나 방문 상담 가능 여부를 확인해 보세요.`,
      };

  return (
    <motion.aside
      id="support-preview"
      aria-label="지원 정보 미리보기"
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 32, opacity: 0 }}
      transition={{ duration: 0.23 }}
      className="fixed top-16 right-0 bottom-0 z-30 flex w-full max-w-[min(100vw,27rem)] flex-col overflow-hidden border-l border-[var(--tg-border)] bg-[var(--tg-surface)] shadow-[0_12px_40px_rgba(20,55,77,.15)] lg:static lg:z-auto lg:max-w-none lg:w-[24rem] lg:shrink-0 xl:w-[27rem]"
    >
      <div className="flex items-start justify-between gap-2 border-b border-[var(--tg-border)] px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold text-[var(--tg-success)]">지원 정보 미리보기</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--tg-text-strong)]">{mainTitle}</h2>
        </div>
        <button type="button" aria-label="지원 정보 미리보기 닫기" onClick={onClose} className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl hover:bg-[var(--tg-primary-soft)]">
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
        {job && (
          <>
            <p className="text-sm leading-relaxed"><span className="font-semibold">준비 포인트</span> · {job.focus}</p>
            {job.links.map((link) => (
              <article key={link.label} className="space-y-2 rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-bg)] p-4">
                <h3 className="text-base font-bold text-[var(--tg-text-strong)]">{link.label}</h3>
                <p className="text-sm"><span className="font-semibold">추천 검색어</span> · {link.searchTerm}</p>
                <p className="text-sm leading-relaxed">{link.check}</p>
                <a className={officialLinkClass} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} 열기</a>
              </article>
            ))}
          </>
        )}
        {(isPrograms || (job && programs.length > 0)) && (
          programs.length ? programs.map((program) => {
            const link = safeProgramLink(program.programId, program.applyUrl, program.linkType);
            return (
              <article key={program.programId} className="rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-bg)] p-4">
                <h3 className="text-base font-bold leading-snug text-[var(--tg-text-strong)]">{program.title}</h3>
                <p className="mt-1.5 text-sm text-[var(--tg-text-muted)]">{program.provider}</p>
                <p className="mt-3 text-sm leading-relaxed">{program.summary}</p>
                <p className="mt-2 text-sm leading-relaxed">{program.recommendationReason}</p>
                <dl className="my-3 space-y-2 border-t border-[var(--tg-border)] pt-3 text-sm leading-relaxed">
                  <div><dt className="font-semibold">대상 및 조건</dt><dd>{program.eligibility}</dd></div>
                  <div><dt className="font-semibold">모집 상태</dt><dd>{program.recruitmentStatus || program.deadline || '모집 상태 확인 필요'}</dd></div>
                  <div><dt className="font-semibold">출처</dt><dd>{program.sourceNote}</dd></div>
                </dl>
                <p className="mb-3 text-sm text-[var(--tg-text-muted)]">신청 가능 여부는 공식 사이트에서 확인해 주세요.</p>
                {link.applyUrl && <a className={officialLinkClass} href={link.applyUrl} target="_blank" rel="noopener noreferrer">{program.programId === FUTURE_WORK_EXPERIENCE_PROGRAM ? '미래내일 일경험 공식 홈페이지' : `${link.linkType} 새 탭에서 열기`}</a>}
              </article>
            );
          }) : <p className="text-sm">이 대화에 저장된 프로그램 정보가 없어요.</p>
        )}
        {!job && !isPrograms && (
          <>
            {local && (
              <article className="rounded-2xl border border-[var(--tg-border)] p-4">
                <h3 className="text-base font-bold text-[var(--tg-text-strong)]">{local.label}</h3>
                <p className="my-3 text-sm leading-relaxed">{region === '대구' && counseling === 'career'
                  ? '청년상담소의 상담 안내와 문의처를 확인해 보세요. 이용 대상, 신청 일정, 진로 주제로 상담이 가능한지는 센터에 확인할 수 있어요.'
                  : '공식 안내에서 상담 방식과 이용 대상, 신청 가능 일정을 확인해 보세요.'}</p>
                <a href={local.url} target="_blank" rel="noopener noreferrer" className={officialLinkClass}>센터 공식 안내 새 탭에서 열기</a>
              </article>
            )}


            <div className="rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-bg)] p-4">
              <h3 className="text-base font-bold text-[var(--tg-text-strong)]">{directory.label}</h3>
              <label className="mt-3 block space-y-1.5 text-sm font-semibold">
                지역 선택
                <select value={region} onChange={(event) => setRegion(event.target.value)} className="tg-input w-full px-3 py-2">
                  <option value="">전국</option>
                  {PROFILE_REGIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <div aria-live="polite" className="my-3 space-y-2 text-sm leading-relaxed">
                {platformUrl ? (
                  <a href={platformUrl} target="_blank" rel="noopener noreferrer" className={officialLinkClass}>{region} 청년 지원 안내 새 탭에서 열기</a>
                ) : <p>지역을 선택하면 해당 지역의 청년 지원 정보를 확인할 수 있어요.</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href={directory.url} target="_blank" rel="noopener noreferrer" className={officialLinkClass}>공식 지역 검색 새 탭에서 열기</a>
                {counseling === 'career' && (
                  <a href={ONTONG_REGIONAL_PLATFORMS} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-2">출처 · 온통청년</a>
                )}
              </div>
            </div>

            {counseling === 'career' && (
              <article className="rounded-2xl border border-[var(--tg-border)] p-4">
                <h3 className="text-base font-bold text-[var(--tg-text-strong)]">온통청년 심층상담</h3>
                <p className="my-3 text-sm leading-relaxed">상담 분야에서 진로·취업을 선택할 수 있어요. 예약 가능 시간과 이용 조건은 온통청년에서 확인할 수 있어요.</p>
                <a href={ONTONG_COUNSELING_BOOKING} target="_blank" rel="noopener noreferrer" className={officialLinkClass}>공식 상담 예약 페이지 새 탭에서 열기</a>
              </article>
            )}
          </>
        )}
      </div>

      {mission && (
        <div className="space-y-2 border-t border-[var(--tg-border)] px-5 py-4">
          {error && <p role="alert" className="text-sm text-[var(--tg-error)]">{error}</p>}
          {saved ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span role="status" className="font-semibold text-[var(--tg-success)]">로드맵에 추가했어요.</span>
              <button type="button" onClick={onRoadmap} className="cursor-pointer font-semibold underline underline-offset-4">성장 로드맵 보기</button>
            </div>
          ) : (
            <button type="button" disabled={saving} onClick={() => onSave(mission)} className="tg-btn-mint flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 px-3 text-sm font-semibold">
              <CalendarPlus aria-hidden="true" className="size-4 shrink-0" />
              {saving ? '추가 중…' : `로드맵에 ‘${mission.title}’ 추가`}
            </button>
          )}
        </div>
      )}
    </motion.aside>
  );
}
