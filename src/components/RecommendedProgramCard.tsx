import React, { useState } from 'react';
import { Bookmark, Check, Compass, ExternalLink } from 'lucide-react';
import type { PublicProgram, RecommendedProgramItem, SavedProgram } from '../types/domain';

import { safeProgramLink } from '../lib/programLinks';

interface RecommendedProgramCardProps {
  program: PublicProgram | RecommendedProgramItem;
  saved?: SavedProgram;
  onToggleSave: (program: PublicProgram, isCurrentlySaved: boolean) => Promise<void> | void;
  onAddMissionToRoadmap: (program: PublicProgram) => Promise<void>;
  highlightRecommended?: boolean;
}

export const RecommendedProgramCard: React.FC<RecommendedProgramCardProps> = ({
  program,
  saved,
  onToggleSave,
  onAddMissionToRoadmap,
  highlightRecommended = false,
}) => {
  const [addingMission, setAddingMission] = useState(false);
  const [missionAdded, setMissionAdded] = useState(false);
  const [missionError, setMissionError] = useState<string | null>(null);

  const rec = program as Partial<RecommendedProgramItem>;
  const link = safeProgramLink(program.programId, program.applyUrl, program.linkType);
  const statusLabel = program.recruitmentStatus || program.deadline || '모집 상태 확인 필요';
  const linkTypeLabel = link.linkType || '공식 주소 확인 필요';

  const handleAddMission = async () => {
    if (addingMission || missionAdded) return;
    setAddingMission(true);
    setMissionError(null);
    try {
      await onAddMissionToRoadmap(program);
      setMissionAdded(true);
    } catch (err) {
      setMissionError(err instanceof Error ? err.message : '로드맵 추가 중 오류가 발생했습니다.');
    } finally {
      setAddingMission(false);
    }
  };

  return (
    <article
      className={`rounded-2xl p-5 flex flex-col justify-between gap-4 border transition-colors ${
        highlightRecommended
          ? 'bg-[var(--tg-surface)] border-[var(--tg-primary)] shadow-[0_3px_14px_rgba(40,90,120,0.06)]'
          : 'bg-[var(--tg-surface)] border-[var(--tg-border)]'
      }`}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 text-[var(--tg-text-muted)]">
            <span className="font-semibold text-[var(--tg-success)] bg-[var(--tg-secondary-soft)] border border-[var(--tg-secondary)] px-2 py-0.5 rounded-md">
              {program.category}
            </span>
            <span className="font-medium text-[var(--tg-text)]">{program.region}</span>
            <span aria-hidden="true">·</span>
            <span>{program.provider}</span>
          </div>
          <span className="text-[11px] font-medium text-[var(--tg-text-muted)] bg-[var(--tg-bg)] border border-[var(--tg-border)] px-2 py-0.5 rounded-md">
            {linkTypeLabel}
          </span>
        </div>

        <h3 className="font-display text-base font-bold text-[var(--tg-text-strong)] leading-snug">
          {program.title}
        </h3>

        <p className="text-sm text-[var(--tg-text)] leading-relaxed">{program.summary}</p>

        {rec.recommendationReason && (
          <div className="p-3 bg-[var(--tg-primary-soft)] border border-[var(--tg-border-strong)] rounded-xl text-xs text-[var(--tg-text-strong)] leading-relaxed">
            <span className="font-bold">추천 이유: </span>
            {rec.recommendationReason}
          </div>
        )}

        <div className="p-3.5 bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-xl text-xs text-[var(--tg-text)] space-y-1.5 leading-relaxed">
          <p>
            <span className="font-semibold text-[var(--tg-text-strong)]">지원 대상·주요 조건: </span>
            {program.eligibility}
          </p>
          {rec.conditionNote && (
            <p className="text-[var(--tg-warning)]">
              <span className="font-semibold">확인 필요 사항: </span>
              {rec.conditionNote}
            </p>
          )}
          <p>
            <span className="font-semibold text-[var(--tg-text-strong)]">신청 기간·모집 상태: </span>
            {program.deadline && program.deadline !== statusLabel ? program.deadline + ' · ' : ''}{statusLabel}
          </p>
          <p>
            <span className="font-semibold text-[var(--tg-text-strong)]">신청 방법: </span>
            {program.howToApply}
          </p>
          <p className="text-[var(--tg-text-muted)]">
            <span className="font-semibold text-[var(--tg-text)]">공식 출처: </span>
            {program.sourceNote}
          </p>
        </div>

        {missionError && (
          <p role="alert" className="text-xs text-[var(--tg-error)]">
            {missionError}
          </p>
        )}
      </div>

      <div className="pt-3.5 border-t border-[var(--tg-border-subtle)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleSave(program, Boolean(saved))}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
              saved
                ? 'bg-[var(--tg-secondary)] border-[var(--tg-mint-border)] text-[var(--tg-text-strong)]'
                : 'bg-[var(--tg-surface)] border-[var(--tg-border)] text-[var(--tg-text)] hover:bg-[var(--tg-bg)]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{saved ? '관심 저장됨' : '관심 저장'}</span>
          </button>

          <button
            type="button"
            disabled={addingMission || missionAdded}
            onClick={handleAddMission}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
              missionAdded
                ? 'bg-[var(--tg-secondary-soft)] border-[var(--tg-mint-border)] text-[var(--tg-success)]'
                : 'bg-[var(--tg-surface)] border-[var(--tg-border)] text-[var(--tg-text)] hover:bg-[var(--tg-primary-soft)] hover:border-[var(--tg-primary)]'
            }`}
          >
            {missionAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>로드맵 미션 추가됨</span>
              </>
            ) : (
              <>
                <Compass className="w-3.5 h-3.5" />
                <span>{addingMission ? '추가 중...' : '로드맵 미션으로 추가'}</span>
              </>
            )}
          </button>
        </div>

        {link.applyUrl && <a
          href={link.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3.5 py-2 bg-[var(--tg-text)] text-[var(--tg-text-strong)] text-xs font-semibold rounded-xl hover:bg-[var(--tg-text-strong)] transition-colors whitespace-nowrap"
        >
          <span>공식 사이트 바로가기 ↗</span>
          <ExternalLink className="w-3.5 h-3.5 sr-only" />
        </a>}
      </div>
    </article>
  );
};
