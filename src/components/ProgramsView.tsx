import React, { useEffect, useState } from 'react';
import { Bell, ShieldCheck, Sparkles } from 'lucide-react';
import { safeProgramLink } from '../lib/programLinks';
import { fetchPrograms } from '../lib/api';
import type { WorkspaceActions } from '../lib/workspaceData';
import type {
  GrowthRoadmap,
  PublicProgram,
  RecommendedProgramItem,
  RoadmapTask,
  SavedProgram,
} from '../types/domain';
import { RecommendedProgramCard } from './RecommendedProgramCard';

interface ProgramsViewProps {
  actions: WorkspaceActions;
  defaultRegion: string;
  savedPrograms: SavedProgram[];
  recommendedPrograms: RecommendedProgramItem[];
  roadmaps: GrowthRoadmap[];
  tasksByRoadmap: Record<string, RoadmapTask[]>;
  onGoRoadmap?: (roadmapId?: string) => void;
}

const REGIONS = ['전체', '전국', '서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const CATEGORIES = [
  '전체',
  '공공기관 채용',
  '취업지원·수당',
  '직업훈련·교육',
  '청년공간·상담',
  '채용박람회·행사',
];

export const ProgramsView: React.FC<ProgramsViewProps> = ({
  actions,
  defaultRegion,
  savedPrograms,
  recommendedPrograms,
  roadmaps,
  tasksByRoadmap,
  onGoRoadmap,
}) => {
  const [region, setRegion] = useState(REGIONS.includes(defaultRegion) ? defaultRegion : '전체');
  const [category, setCategory] = useState('전체');
  const [search, setSearch] = useState('');
  const [programs, setPrograms] = useState<PublicProgram[]>([]);
  const [apiNote, setApiNote] = useState('');
  const [externalApiWarning, setExternalApiWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerFailed, setBannerFailed] = useState(false);
  const [missionBanner, setMissionBanner] = useState<string | null>(null);

  // Explicit consent state for specialist counseling connection
  const [counselingConsent, setCounselingConsent] = useState(false);
  const [showCounselingInfo, setShowCounselingInfo] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchPrograms({ region, category, q: search })
      .then((res) => {
        if (!active) return;
        setPrograms(res.programs);
        setApiNote(res.meta.apiStatusNote);
        setExternalApiWarning(res.meta.externalApiError || null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : '지원정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [region, category, search]);

  const savedMap = new Map(savedPrograms.map((s) => [s.programId, s]));

  const handleToggleSave = async (prog: PublicProgram, isCurrentlySaved: boolean) => {
    const safeId = prog.programId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    if (isCurrentlySaved) {
      await actions.removeSavedProgram(safeId);
    } else {
      await actions.saveProgramBookmark(prog, false);
    }
  };

  const handleAddMission = async (prog: PublicProgram) => {
    const roadmapId = await actions.addProgramMissionToRoadmap(prog, roadmaps, tasksByRoadmap);
    setMissionBanner(`"${prog.title}" 신청 준비 미션이 성장 로드맵에 추가되었습니다.`);
    if (onGoRoadmap) {
      // Allow user to stay or click banner link to view immediately
      void roadmapId;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--tg-text-strong)]">지역·공공 지원 프로그램 연결</h1>
        <p className="text-sm text-[var(--tg-text-muted)] mt-1">
          '나의 고민'에서 추천받은 맞춤 지원 프로그램과 검증된 공공기관 채용·취업지원·훈련 정보를 확인하고 공식 사이트로 바로 이동할 수 있습니다.
        </p>
      </div>

      {missionBanner && (
        <div className="p-4 bg-[var(--tg-secondary-soft)] border border-[var(--tg-secondary)] rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-[var(--tg-success)]">
          <span>{missionBanner}</span>
          {onGoRoadmap && (
            <button
              type="button"
              onClick={() => onGoRoadmap()}
              className="underline hover:text-[var(--tg-text-strong)] cursor-pointer"
            >
              성장 로드맵에서 확인하기
            </button>
          )}
        </div>
      )}

      {/* Synced Recommendations from "나의 고민" */}
      {recommendedPrograms.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--tg-text)]" />
              <h2 className="font-display text-lg font-bold text-[var(--tg-text-strong)]">
                나의 고민에서 추천된 맞춤 프로그램 ({recommendedPrograms.length})
              </h2>
            </div>
            <span className="text-xs text-[var(--tg-text-muted)]">
              공식 신청 가능 여부 및 세부 자격 조건은 공식 사이트에서 최종 확인해 주세요
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendedPrograms.map((prog) => {
              const safeId = prog.programId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
              return (
                <RecommendedProgramCard
                  key={`rec-${prog.programId}`}
                  program={prog}
                  saved={savedMap.get(safeId)}
                  onToggleSave={handleToggleSave}
                  onAddMissionToRoadmap={handleAddMission}
                  highlightRecommended
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Saved Programs Quick Notice */}
      {savedPrograms.length > 0 && (
        <div className="tg-card p-4 flex flex-wrap items-center justify-between gap-3 bg-[var(--tg-bg)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--tg-text-strong)]">
            <Bell className="w-4 h-4 text-[var(--tg-text)]" />
            <span>관심 저장된 지원 프로그램 {savedPrograms.length}건이 있습니다</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedPrograms.map((saved) => {
              const link = safeProgramLink(saved.programId, saved.applyUrl);
              const style = 'text-xs bg-[var(--tg-surface)] border border-[var(--tg-border)] text-[var(--tg-text)] px-2.5 py-1 rounded-lg';
              return link.applyUrl ? (
                <a key={saved.id} className={style} href={link.applyUrl} target="_blank" rel="noopener noreferrer">
                  {saved.title}
                </a>
              ) : <span key={saved.id} className={style}>{saved.title}</span>;
            })}
          </div>
        </div>
      )}

      {/* Youth Center Editorial Banner + Counseling Consent Gate */}
      <div className="tg-card overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-5 min-h-[200px] bg-[var(--tg-primary-soft)]">
          {!bannerFailed ? (
            <img
              src="/src/assets/images/youth_center_space_1795050081690.jpg"
              alt="지역 청년지원센터 공간"
              referrerPolicy="no-referrer"
              onError={() => setBannerFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-6 text-[var(--tg-text-muted)] text-sm">
              지역 청년센터 및 공공지원 네트워크
            </div>
          )}
        </div>
        <div className="lg:col-span-7 p-6 flex flex-col justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[var(--tg-success)] mb-1">전문 상담기관 연결 안내</p>
            <h2 className="font-display text-lg font-bold text-[var(--tg-text-strong)] mb-2">
              혼자 해결하기 버거울 때는 전문 상담기관과 안전하게 연결될 수 있습니다
            </h2>
            <p className="text-sm text-[var(--tg-text-muted)] leading-relaxed">
              기관에 먼저 연락하기 부담스러울 때, 사용자의 명시적 동의가 있는 경우에만 지역 청년센터·정신건강복지센터 연결 절차와 연락처를 안내합니다.
            </p>
          </div>

          <div className="p-4 bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-xl space-y-3">
            <label className="flex items-start gap-2.5 text-xs text-[var(--tg-text)] cursor-pointer">
              <input
                type="checkbox"
                checked={counselingConsent}
                onChange={(e) => {
                  setCounselingConsent(e.target.checked);
                  if (!e.target.checked) setShowCounselingInfo(false);
                }}
                className="mt-0.5 accent-[var(--tg-text)]"
              />
              <span>
                전문 상담기관 안내 및 연결 절차 확인에 동의합니다 (AI가 자동으로 외부 기관에 개인정보를 전송하지 않으며, 사용자가 직접 선택해 연락합니다).
              </span>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[var(--tg-text-muted)]">{apiNote || '검증된 공식 공개정보 안내'}</span>
              <button
                type="button"
                disabled={!counselingConsent}
                onClick={() => setShowCounselingInfo((prev) => !prev)}
                className="tg-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs min-h-[36px] whitespace-nowrap cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{showCounselingInfo ? '안내 닫기' : '전문 상담기관 연결 안내 보기'}</span>
              </button>
            </div>

            {showCounselingInfo && counselingConsent && (
              <div className="pt-3 border-t border-[var(--tg-border)] text-xs text-[var(--tg-text)] space-y-1.5">
                <p className="font-bold text-[var(--tg-text-strong)]">공식 전문 상담기관 연결 창구</p>
                <p>
                  1. 지역 정신건강복지센터 상담전화: <span className="font-mono font-semibold">1577-0199</span> (24시간 상담 <span className="font-mono font-semibold">109</span>)
                </p>
                <p>
                  2. 복지로 청년마음건강지원사업: 거점 기관·상담 바우처 신청 (
                  <a
                    href="https://www.bokjiro.go.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--tg-text-strong)] font-semibold underline"
                  >
                    bokjiro.go.kr
                  </a>
                  )
                </p>
                <p>
                  3. 지역 청년센터 1:1 진로·생활 매니저 상담 (
                  <a
                    href="https://www.youthcenter.go.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--tg-text-strong)] font-semibold underline"
                  >
                    온통청년 youthcenter.go.kr
                  </a>
                  )
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {externalApiWarning && (
        <div className="p-3.5 bg-[var(--tg-warning-soft)] border border-[var(--tg-warning-border)] rounded-xl text-xs text-[var(--tg-warning)]">
          {externalApiWarning}
        </div>
      )}

      {/* Filters */}
      <div className="tg-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {REGIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegion(r)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  region === r
                    ? 'bg-[var(--tg-text)] text-[var(--tg-text-strong)] border-[var(--tg-text)]'
                    : 'bg-[var(--tg-bg)] text-[var(--tg-text-muted)] border-[var(--tg-border)] hover:text-[var(--tg-text)] hover:bg-[var(--tg-primary-soft)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="프로그램명, 기관, 키워드 검색..."
            className="tg-input px-3.5 py-2 text-sm w-full md:w-72"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-[var(--tg-border-subtle)]">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                category === c
                  ? 'bg-[var(--tg-primary)] text-[var(--tg-text-strong)] border-[var(--tg-primary-border)] font-semibold'
                  : 'bg-[var(--tg-bg)] text-[var(--tg-text-muted)] border-[var(--tg-border)] hover:text-[var(--tg-text)] hover:bg-[var(--tg-primary-soft)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Program List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="tg-card p-6 h-44 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="bg-[var(--tg-error-soft)] border border-[var(--tg-error-border)] rounded-2xl p-6 text-sm font-medium text-[var(--tg-error)]">
          {error}
        </div>
      ) : programs.length === 0 ? (
        <div className="tg-card p-10 text-center">
          <p className="text-sm font-semibold text-[var(--tg-text)]">조건에 맞는 지원 프로그램이 없습니다.</p>
          <p className="text-xs text-[var(--tg-text-muted)] mt-1">지역이나 분류 필터를 '전체'로 변경해 보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {programs.map((prog) => {
            const safeId = prog.programId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
            return (
              <RecommendedProgramCard
                key={prog.programId}
                program={prog}
                saved={savedMap.get(safeId)}
                onToggleSave={handleToggleSave}
                onAddMissionToRoadmap={handleAddMission}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
