import { FUTURE_WORK_EXPERIENCE_PROGRAM, PROGRAM_LINKS, safeProgramLink } from '../src/lib/programLinks';
import type { PublicProgram, RecommendedProgramItem } from '../src/types/domain';

type VerifiedProgram = Omit<PublicProgram, 'applyUrl' | 'linkType' | 'worryThemes'> & {
  worryThemes: string[];
};

export type Program = VerifiedProgram & Pick<PublicProgram, 'applyUrl' | 'linkType'>;

const OFFICIAL_PROGRAMS: VerifiedProgram[] = [
  {
    programId: 'prog-alio-public-intern',
    title: '공공기관 체험형 청년인턴 및 신입 채용정보 (잡알리오)',
    provider: '기획재정부 · 알리오(ALIO)',
    region: '전국',
    category: '공공기관 채용',
    summary: '전국 공공기관의 청년인턴·정규직 채용공고, 기관별 직무 설명자료 및 채용 일정을 공식 통합 조회할 수 있습니다.',
    eligibility: '지원 연령·학력·전공 등은 기관별 채용 공고에서 확인 필요',
    howToApply: '잡알리오 공식 포털에서 관심 지역·분야 검색 후 기관 채용페이지로 이동하여 온라인 접수',
    deadline: '상시 공고 (기관별 상이)',
    sourceNote: '공공기관 경영정보 공개시스템(잡알리오) 공식 안내',
    recruitmentStatus: '상시 공고 (기관별 모집 일정 확인 필요)',
    worryThemes: ['취업 경험 부족', '직무 역량 부족', '진로 고민'],
    isPublicRecruitment: true,
  },
  {
    programId: 'prog-youth-allinone',
    title: '청년일자리 올인원 · 공공기관 채용정보',
    provider: '재정경제부 · 알리오(ALIO)',
    region: '전국',
    category: '공공기관 채용',
    summary: '전국 공공기관의 채용 공고를 조회할 수 있는 공식 데이터 서비스입니다.',
    eligibility: '채용 조건은 기관별 공고에서 확인 필요',
    howToApply: '공식 채용정보에서 개별 모집 공고와 접수처 확인',
    deadline: '상시 업데이트',
    sourceNote: '재정경제부 공공기관 채용정보 API 안내',
    recruitmentStatus: '상시 운영 (세부 공고별 모집 상태 확인 필요)',
    worryThemes: ['취업 경험 부족', '진로 고민', '직무 역량 부족'],
    isPublicRecruitment: true,
  },
  {
    programId: 'prog-youth-challenge',
    title: '청년도전지원사업 (구직단념청년 일상회복·자신감 회복)',
    provider: '고용노동부 · 지역 자치단체 운영기관',
    region: '전국 (시·군·구 운영기관)',
    category: '취업지원·수당',
    summary: '구직에 지치거나 잠시 쉬고 있는 청년에게 밀착 상담, 사례관리, 자신감 회복, 진로 탐색 프로그램을 1~5개월 과정으로 제공합니다(이수 시 참여수당·인센티브 연계 가능).',
    eligibility: '최근 6개월 이상 취업·교육·직업훈련 이력이 없는 만 18~34세 청년 등 (지역별 특화 대상·참여 요건 확인 필요)',
    howToApply: '고용24 누리집에서 거주 지역 운영기관 조회 후 온라인 신청 및 초기 상담 진행',
    deadline: '기수별 수시 모집 (모집 상태 확인 필요)',
    sourceNote: '고용노동부 공식 청년지원사업 안내 (신청 전 지역 기관 자격 확인 필요)',
    recruitmentStatus: '기수별 수시 모집 (지역 운영기관별 모집 상태 확인 필요)',
    worryThemes: ['취업 준비 스트레스', '진로 고민', '취업 경험 부족', '취업 준비 비용 부담'],
  },
  {
    programId: 'prog-national-employment',
    title: '국민취업지원제도 (I·II유형 맞춤형 취업지원 & 구직촉진수당)',
    provider: '고용노동부 · 고용센터',
    region: '전국',
    category: '취업지원·수당',
    summary: '전담 상담사와 1:1 취업활동계획을 수립하고 직업훈련, 일경험, 취업 알선과 함께 소득·재산 요건 충족 시 구직촉진수당 또는 취업활동비용을 지원합니다.',
    eligibility: '만 15~69세 구직자 중 소득·재산 요건(I유형) 또는 청년특례(만 15~34세, 병역 가산 기준 별도) 해당자 (소득·취업상태 확인 필요)',
    howToApply: '고용24 온라인 신청 또는 거주지 관할 고용센터 방문 상담',
    deadline: '연중 상시 신청',
    sourceNote: '고용노동부 국민취업지원제도 공식 안내',
    recruitmentStatus: '연중 상시 신청 가능',
    worryThemes: ['취업 준비 비용 부담', '진로 고민', '취업 경험 부족', '취업 준비 스트레스'],
  },
  {
    programId: 'prog-tomorrow-learning',
    title: '국민내일배움카드 (직업훈련·K-디지털·실무 역량 교육)',
    provider: '고용노동부 · HRD-Net (고용24)',
    region: '전국',
    category: '직업훈련·교육',
    summary: 'IT, 디지털, 디자인, 회계, 데이터 등 직무 역량을 키울 수 있는 직업훈련 과정 수강비를 지원합니다(5년간 300~500만 원 한도 내 과정별 지원).',
    eligibility: '직무 역량 개발을 희망하는 청년·구직자 (재학 여부·일부 제외 대상은 공식 안내 확인 필요)',
    howToApply: '고용24에서 카드 발급 신청 후 희망 훈련과정(K-디지털 기초역량훈련 등) 수강 신청',
    deadline: '연중 상시 신청 (훈련과정별 개강 일정 확인)',
    sourceNote: '고용24 직업능력개발 공식 안내',
    recruitmentStatus: '연중 상시 발급 신청 (개별 훈련과정 모집 상태 확인 필요)',
    worryThemes: ['직무 역량 부족', '취업 준비 비용 부담', '진로 고민'],
  },
  {
    programId: FUTURE_WORK_EXPERIENCE_PROGRAM,
    title: '미래내일 일경험 지원사업 (인턴·프로젝트·기업탐방)',
    provider: '고용노동부 · 대한상공회의소 등 운영기관',
    region: '전국',
    category: '취업지원·수당',
    summary: '직무 경험이 부족한 미취업 청년에게 기업 프로젝트, 인턴형, ESG 지원형 등 실제 직무 체험과 현직자 멘토링 기회를 제공합니다.',
    eligibility: '만 15~34세 미취업 청년 (세부 프로그램별 참여 기준 확인 필요)',
    howToApply: '공식 청년일경험 포털에서 관심 직무나 지역으로 프로그램을 검색하고, 개별 모집 공고에서 신청',
    deadline: '프로그램별 수시 모집',
    sourceNote: '고용노동부 미래내일 일경험 공식 안내',
    recruitmentStatus: '모집 상태 확인 필요 (운영기관별 수시 접수)',
    worryThemes: ['취업 경험 부족', '직무 역량 부족', '진로 고민'],
  },
  {
    programId: 'prog-work24-career-counseling',
    title: '고용24 직업심리검사 · 1:1 진로상담 서비스',
    provider: '고용노동부 · 한국고용정보원',
    region: '전국',
    category: '청년공간·상담',
    summary: '직업선호도검사, 직업가치관검사 등 표준화된 직업심리검사를 무료로 이용하고 고용센터 또는 대학일자리플러스센터 상담과 연계할 수 있습니다.',
    eligibility: '진로와 적성을 탐색 중인 모든 청년',
    howToApply: '고용24 누리집 로그인 후 직업심리검사 무료 응시 및 관할 고용센터 상담 예약',
    deadline: '연중 상시 이용',
    sourceNote: '고용노동부 고용24 직업진로지도 공식 안내',
    recruitmentStatus: '상시 이용 가능',
    worryThemes: ['진로 고민', '취업 준비 스트레스'],
  },
  {
    programId: 'prog-seoul-youth-center',
    title: '서울청년센터 · 청년몽땅정보통 진로·마음·수당 통합 안내',
    provider: '서울특별시 · 서울청년센터',
    region: '서울',
    category: '청년공간·상담',
    summary: '서울청년센터 무료 공간 이용, 청년 매니저 1:1 생활·진로 상담, 청년수당 및 청년마음건강 등 서울시 청년 지원사업을 통합 안내합니다.',
    eligibility: '서울시 거주 또는 활동 중인 만 19~39세 청년 (사업별 소득·졸업 여부 조건 확인 필요)',
    howToApply: '청년몽땅정보통에서 자치구별 청년센터 프로그램 및 지원사업 공고 확인 후 신청',
    deadline: '상시 예약 및 사업별 공고 일정 확인',
    sourceNote: '서울특별시 청년몽땅정보통 공식 공개정보',
    recruitmentStatus: '상시 상담 예약 (수당·특화사업은 모집 상태 확인 필요)',
    worryThemes: ['취업 준비 비용 부담', '취업 준비 스트레스', '진로 고민'],
  },
  {
    programId: 'prog-gyeonggi-youth',
    title: '경기도 청년 면접수당',
    provider: '경기도 · 경기도미래세대재단',
    region: '경기',
    category: '취업지원·수당',
    summary: '경기도 거주 청년의 면접 비용 부담을 덜기 위한 지원사업입니다.',
    eligibility: '경기도에 거주하며 취업 면접에 응시한 만 18~39세 청년 등. 공고별 세부 조건 확인 필요',
    howToApply: '잡아바(JOBaba) 통합접수시스템에서 회원가입 후 사업별 온라인 신청',
    deadline: '사업별 공고 일정 확인',
    sourceNote: '경기도청 청년면접수당 사업 안내',
    recruitmentStatus: '사업별 공고 진행 여부 및 모집 상태 확인 필요',
    worryThemes: ['취업 준비 비용 부담', '직무 역량 부족', '취업 경험 부족'],
  },
  {
    programId: 'prog-youth-center-portal',
    title: '온통청년 — 전국 지역별 청년정책·청년센터·채용행사 통합 검색',
    provider: '국무조정실 · 한국고용정보원',
    region: '전국',
    category: '채용박람회·행사',
    summary: '전국 시·도 청년센터 위치와 주거·일자리·교육·복지 정책 및 지자체별 청년수당·채용행사 일정을 한 곳에서 확인할 수 있습니다.',
    eligibility: '만 19~34세 대한민국 청년 (지역·정책별 연령 및 소득 조건 상이)',
    howToApply: '온통청년 포털에서 지역과 관심 분야(일자리·주거·복지) 선택 후 공식 신청 링크 확인',
    deadline: '상시 업데이트',
    sourceNote: '국무조정실 온통청년 공식 포털',
    recruitmentStatus: '상시 정책 조회 가능 (세부 정책별 모집 상태 확인 필요)',
    worryThemes: ['취업 준비 비용 부담', '진로 고민', '취업 준비 스트레스', '취업 경험 부족'],
  },
  {
    programId: 'prog-mind-health-109',
    title: '온통청년 심층상담',
    provider: '온통청년 청년상담실',
    region: '전국',
    category: '청년공간·상담',
    summary: '전문 상담사에게 진로 설계와 구직 준비에 관한 1:1 상담을 신청할 수 있습니다.',
    eligibility: '상담 주제별 지원 대상과 세부 참여 조건 확인 필요',
    howToApply: '심층상담 예약 화면에서 상담 분야와 일정을 선택해 신청합니다. 온통청년 계정이 필요합니다.',
    deadline: '예약 가능 일정 확인 필요',
    sourceNote: '온통청년 청년상담실 공식 안내',
    recruitmentStatus: '상담별 예약 가능 일정 확인 필요',
    worryThemes: ['취업 준비 스트레스', '진로 고민'],
  },
  {
    programId: 'prog-k-digital-training',
    title: 'K-디지털 트레이닝',
    provider: '고용노동부 · 고용24',
    region: '전국',
    category: '직업훈련·교육',
    summary: '디지털·첨단산업 분야에서 프로젝트를 수행하며 직무 역량을 기르는 직업훈련 과정입니다.',
    eligibility: '국민내일배움카드 발급 및 과정별 수강 조건 확인 필요',
    howToApply: '고용24 K-디지털 훈련에서 과정과 모집 일정을 찾은 후 수강 신청',
    deadline: '과정별 신청 기간 확인 필요',
    sourceNote: '고용24 직업능력개발 K-디지털 훈련',
    recruitmentStatus: '모집 상태 확인 필요',
    worryThemes: ['직무 역량 부족'],
  },
];


export async function loadPrograms(youthJobApiKey?: string) {
  const programs: Program[] = OFFICIAL_PROGRAMS.map((program) => ({
    ...program,
    ...PROGRAM_LINKS[program.programId],
  }));
  let liveApiConnected = false;
  let externalApiError: string | undefined;
  if (youthJobApiKey?.trim()) {
    const startedAt = Date.now();
    let upstreamStatus: number | undefined;
    let upstreamCode: string | undefined;
    let retriedWithoutFilter = false;
    try {
      const url = new URL('https://opendata.alio.go.kr/new/v1/recruit/list.do');
      url.search = new URLSearchParams({
        serviceKey: youthJobApiKey.trim(),
        numOfRows: '10',
        pageNo: '1',
        resultType: 'json',
        ongoingYn: 'Y',
      }).toString();
      const request = async () => {
        upstreamStatus = undefined;
        upstreamCode = undefined;
        const response = await fetch(url, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          redirect: 'manual',
          signal: AbortSignal.timeout(10000),
        });
        upstreamStatus = response.status;
        if (!response.ok) throw new Error('Public recruitment API response failed');
        const data = await response.json() as { result?: Record<string, unknown>[]; resultCode?: number | string };
        const code = String(data.resultCode ?? '');
        if (/^\d{1,3}$/.test(code)) upstreamCode = code;
        return data;
      };
      let data = await request();
      if (String(data.resultCode) === '5') {
        retriedWithoutFilter = true;
        url.searchParams.delete('ongoingYn');
        data = await request();
      }
      const resultCode = String(data.resultCode ?? '');
      if (!Array.isArray(data.result) || (resultCode && !['0', '00', '200'].includes(resultCode))) {
        throw new Error('Invalid public recruitment response');
      }
      const seen = new Set<string>();
      for (const item of data.result) {
        const value = (field: string) => typeof item?.[field] === 'string' ? item[field].trim() : '';
        const id = String(item?.recrutPblntSn ?? '');
        const title = value('recrutPbancTtl');
        const provider = value('instNm');
        if (!/^[0-9a-zA-Z_-]+$/.test(id) || !title || !provider || seen.has(id) || value('ongoingYn') === 'N') continue;
        seen.add(id);
        const end = value('pbancEndYmd');
        const deadline = /^\d{8}$/.test(end)
          ? [end.slice(0, 4), end.slice(4, 6), end.slice(6, 8)].join('-')
          : /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : '';
        if (deadline && deadline < new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())) continue;
        const official = safeProgramLink('live', value('srcUrl'));
        programs.unshift({
          programId: 'live-allinone-' + id,
          title, provider,
          region: value('workRgnNmLst') || '지역 확인 필요',
          category: '공공기관 채용',
          summary: [value('ncsCdNmLst'), value('hireTypeNmLst')].filter(Boolean).join(' · ') || '공고에서 직무와 채용 유형을 확인해 주세요.',
          eligibility: value('acbgCondNmLst') || '공고별 자격요건 확인 필요',
          howToApply: '공식 공고에서 접수처와 제출 방법을 확인',
          deadline: deadline || '모집 상태 확인 필요',
          applyUrl: official.applyUrl || PROGRAM_LINKS['prog-alio-public-intern'].applyUrl,
          sourceNote: '청년일자리 올인원 · 재정경제부 공공기관 채용정보 조회서비스',
          linkType: '공식 안내 페이지',
          recruitmentStatus: '모집 상태 확인 필요',
          worryThemes: ['취업 경험 부족'],
          isPublicRecruitment: true,
        });
      }
      liveApiConnected = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const transportHint = /\b(?:DNS|ENOTFOUND|EAI_AGAIN)\b/i.test(message) ? 'dns'
        : /\b(?:TLS|SSL|certificate)\b/i.test(message) ? 'tls'
        : /timed?\s*out|timeout/i.test(message) ? 'timeout'
        : /ECONNRESET|ECONNREFUSED|socket|connection (?:lost|closed|reset|refused)/i.test(message) ? 'connection'
        : undefined;
      console.warn('TOGRO ALIO recruitment request failed', {
        status: upstreamStatus, code: upstreamCode, reason: error instanceof Error ? error.name : 'UnknownError',
        transportHint, retriedWithoutFilter, elapsedMs: Date.now() - startedAt,
      });
      externalApiError = '실시간 공공채용 정보를 불러오지 못해 공식 공개정보로 안내해요.';
    }
  }
  const apiStatusNote = liveApiConnected
    ? '청년일자리 올인원 공공기관 채용정보 API 및 기관 공식 공개정보'
    : externalApiError || '기관 공식 공개정보 기반 안내';
  return { programs, liveApiConnected, externalApiError, apiStatusNote };
}

export type ProgramProfile = { age?: number; jobPrepStatus?: string; region?: string; interests?: string[] };

const ageRanges: Record<string, [number, number]> = {
  'prog-youth-challenge': [18, 34],
  'prog-national-employment': [15, 69],
  'prog-future-work-experience': [15, 34],
  'prog-seoul-youth-center': [19, 39],
  'prog-gyeonggi-youth': [18, 39],
};

export function programsForProfile(catalog: Program[], profile: ProgramProfile) {
  const region = typeof profile.region === 'string' ? profile.region.trim() : '';
  return catalog.filter((program) => {
    const isNational = program.region.startsWith('전국');
    const sameRegion = region && program.region.split(/[·,/]/).some((part) => part.trim().startsWith(region));
    if (!isNational && !sameRegion) return false;
    const range = ageRanges[program.programId];
    return !range || !Number.isFinite(profile.age) || (profile.age! >= range[0] && profile.age! <= range[1]);
  });
}

export function asRecommendation(program: Program, message: string, reason: string): RecommendedProgramItem {
  return {
    ...program,
    recommendationReason: reason.trim().slice(0, 280),
    conditionNote: '신청 가능 여부 확인 필요 · 공고의 소득, 거주지 및 취업 상태 등 세부 조건을 확인해 주세요.',
    worrySummary: message.trim().slice(0, 120),
  };
}
