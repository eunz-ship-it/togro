export const JOB_KEYWORDS = {
  intern: '인턴',
  tour: '기업탐방',
  project: '프로젝트형',
  certificate: '자격증',
  support: '지원프로그램',
  hiring: '채용',
} as const;

export type JobKeyword = keyof typeof JOB_KEYWORDS;
export type JobSelection = { role: string; keyword?: JobKeyword; region: string; publicSector?: true };
export const JOB_ROLES = ['생산관리', '기획', '경영지원', '엔지니어'] as const;

export function isJobKeyword(value: string): value is JobKeyword {
  return Object.hasOwn(JOB_KEYWORDS, value);
}

type JobProfile = {
  focus: string;
  artifact: string;
  practice: string;
  certification?: string;
};

const profiles: Record<string, JobProfile> = {
  생산관리: {
    focus: '생산계획 대비 실적, 공정별 가동 상황, 자재 투입과 납기 관리',
    artifact: '가상의 일일 생산계획·실적 비교표',
    practice: '제품 하나의 계획량과 실제 생산량을 입력하고 차이가 난 원인과 조치안을 한 줄씩 적어보세요.',
    certification: '품질경영기사 또는 산업안전기사',
  },
  기획: {
    focus: '문제 정의, 사용자 요구, 우선순위와 성과지표',
    artifact: '문제·대상·성공지표가 들어간 1쪽 기획안',
    practice: '자주 쓰는 서비스의 불편 한 가지를 골라 누구의 문제인지 적고 개선 효과를 볼 지표를 하나 정해 보세요.',
  },
  경영지원: {
    focus: '비용 정산, 증빙 확인, 사내 일정과 문서 관리',
    artifact: '가상의 비용 정산표와 증빙 체크리스트',
    practice: '가상 거래 5건을 항목별로 정리하고, 증빙이 빠진 건과 합계가 맞지 않는 건을 표시해 보세요.',
    certification: '컴퓨터활용능력',
  },
  엔지니어: {
    focus: '도면·사양 읽기, 시험 조건과 합격 기준, 원인과 개선 조치 기록',
    artifact: '간단한 부품 또는 시스템의 시험 기록표',
    practice: '부품이나 시스템 하나를 골라 정상 조건, 예상 고장, 이를 확인할 시험 방법을 한 줄씩 적어보세요.',
  },
  '전기·전자 엔지니어': {
    focus: '회로도 읽기, 전압·전류 측정, 시험과 고장 원인 분리',
    artifact: '간단한 회로의 전압 측정 및 이상 진단표',
    practice: '저전압 회로 도면을 보며 측정 지점을 표시하고, 예상 전압과 시뮬레이션 값을 비교해 보세요.',
    certification: '전기기사 또는 전자기사',
  },
  '기계 엔지니어': {
    focus: '기계도면, 치수와 공차, 조립 및 검사 순서',
    artifact: '부품 도면과 검사 기준표',
    practice: '공개 부품 도면에서 기준 치수와 공차를 찾아, 어떤 측정 도구로 확인할지 적어보세요.',
    certification: '일반기계기사',
  },
  '소프트웨어 엔지니어': {
    focus: '기능 요구사항, 구현, 테스트와 버전 관리',
    artifact: '작은 기능의 테스트 결과와 수정 기록',
    practice: '입력값을 받는 작은 기능을 골라 정상 케이스와 예외 케이스를 하나씩 만들어 보세요.',
    certification: '정보처리기사',
  },
  디자인: {
    focus: '사용자 목적, 화면 구조와 접근성, 시안 검증',
    artifact: '화면 하나의 기본 시안과 사용성 점검표',
    practice: '자주 쓰는 화면 하나를 골라 정보의 우선순위를 다시 배치하고 글자 대비를 점검해 보세요.',
  },
  마케팅: {
    focus: '고객군 정의, 메시지 검증, 유입·전환 지표',
    artifact: '가상의 캠페인 가설과 성과 측정표',
    practice: '제품 하나의 고객군과 채널을 정한 뒤 비교할 메시지 두 가지와 측정 지표를 적어보세요.',
  },
  회계: {
    focus: '거래 분개, 전표와 증빙, 계정별 잔액 검산',
    artifact: '가상 거래의 분개장과 월말 검산표',
    practice: '가상 거래 세 건을 분개한 뒤 차변과 대변의 합계를 맞춰 보세요.',
  },
  인사: {
    focus: '채용 운영, 온보딩, 인사 기록 관리',
    artifact: '가상의 신입 입사 준비 체크리스트',
    practice: '입사 첫 주에 필요한 담당자와 준비물을 날짜별로 나눠 보세요.',
  },
  데이터: {
    focus: '분석 질문, 데이터 정제, 지표 해석',
    artifact: '공개 데이터로 만든 요약표와 분석 메모',
    practice: '작은 공개 데이터셋에서 분석 질문 하나를 정하고 누락값과 집계 기준을 확인해 보세요.',
  },
  품질관리: {
    focus: '검사 기준, 불량 유형 분류, 원인 분석과 개선 검증',
    artifact: '가상의 불량 유형 파레토표',
    practice: '불량 사례를 유형별로 집계하고 가장 잦은 원인을 확인할 질문을 적어보세요.',
    certification: '품질경영기사',
  },
};

const roleAliases: Array<[string, RegExp]> = [
  ['생산관리', /생산\s*관리|공정\s*관리|생산\s*계획/],
  ['품질관리', /품질\s*(?:관리|보증)/],
  ['경영지원', /경영\s*지원|사무\s*지원|총무/],
  ['전기·전자 엔지니어', /(?:전기|전자|회로|임베디드).{0,9}(?:엔지니어|설계|개발)|전기·전자 엔지니어/],
  ['기계 엔지니어', /(?:기계|기구|설비).{0,9}(?:엔지니어|설계)|기계 엔지니어/],
  ['소프트웨어 엔지니어', /(?:소프트웨어|SW)\s*(?:엔지니어|개발)|(?:백엔드|프론트엔드)\s*(?:개발자)?/i],
  ['엔지니어', /엔지니어/],
  ['기획', /기획/],
  ['디자인', /디자이너|디자인/],
  ['마케팅', /마케터|마케팅/],
  ['회계', /회계|재무/],
  ['인사', /인사\s*(?:직무|팀|담당|업무)|^인사$/],
  ['데이터', /데이터\s*(?:직무|분석|엔지니어)|^데이터$/],
];

const keywordAliases: Array<[JobKeyword, RegExp]> = [
  ['intern', /인턴/],
  ['tour', /기업\s*탐방|현장\s*견학/],
  ['project', /프로젝트\s*형|팀\s*프로젝트|실무\s*프로젝트/],
  ['certificate', /자격증|국가\s*자격/],
  ['support', /지원\s*(?:프로그램|사업|정책)|취업지원제도/],
  ['hiring', /채용|취업\s*공고|구인\s*공고/],
];

export function detectJobRole(message: string) {
  const explicit = roleAliases.find(([, pattern]) => pattern.test(message))?.[0];
  if (explicit) return explicit;
  const other = message.match(/(?:^|\s)([가-힣a-zA-Z·-]{2,16}(?:\s+[가-힣a-zA-Z·-]{2,12})?)\s*직무(?:[를가에은는이을]|\s|$)/)?.[1]?.trim();
  if (other && other.length <= 20 && !/관심|희망|어떤|다른|해당|이런|있는|맞는|찾는|보고|하고/.test(other)) return other;
}

export function detectJobKeyword(message: string) {
  return keywordAliases.find(([, pattern]) => pattern.test(message))?.[0];
}

const keywordGuide: Record<JobKeyword, { check: string; goal: string; copies: string; finish: string }> = {
  intern: {
    check: '공고의 실제 담당 업무, 멘토 유무, 근무 지역·기간을 확인하세요.',
    goal: '인턴 공고의 담당 업무 2개 표시하기',
    copies: '관심 지역의 인턴 공고 두 건에서 맡는 일과 근무 조건을 비교하세요.',
    finish: '실습 결과를 공고에서 요구하는 업무 하나와 비교하고 보완할 점을 적어보세요.',
  },
  tour: {
    check: '방문 일정, 현업 담당자와 질의응답이 있는지, 실제로 둘러보는 부서를 확인하세요.',
    goal: '기업탐방에서 물어볼 실무 질문 2개 적기',
    copies: '탐방 프로그램의 방문 부서와 활동 내역을 살펴보고, 참여 전에 질문 두 개를 준비하세요.',
    finish: '탐방 안내나 참여 후 알게 된 내용을 바탕으로 직접 해보고 싶은 업무를 한 가지 골라보세요.',
  },
  project: {
    check: '팀에서 맡을 작업, 제출물, 멘토의 피드백 방식과 일정을 확인하세요.',
    goal: '프로젝트에서 맡아보고 싶은 작업 1개 정하기',
    copies: '프로젝트 설명에서 내 역할, 결과물, 마감일을 찾아 간단히 정리하세요.',
    finish: '실습 결과를 프로젝트 요구사항과 대조해 빠진 부분을 한 번 고쳐보세요.',
  },
  certificate: {
    check: '채용 공고에서 자격증이 필수인지 우대인지 구분하고 공식 종목별 응시 요건과 일정을 확인하세요.',
    goal: '공고에서 우대 자격과 실제 직무를 대조하기',
    copies: '공고 두 건에서 겹치는 우대 자격이 있는지 비교해 시험 공부의 우선순위를 정하세요.',
    finish: '관심 자격의 출제기준에서 실습 내용과 연결되는 단원 하나를 골라 예제 한 문제를 풀어보세요.',
  },
  support: {
    check: '사업별 대상 연령, 거주지, 취업 상태, 신청 마감과 실제 지원 내용을 확인하세요.',
    goal: '지원 사업 1개의 참여 조건 확인하기',
    copies: '지원 프로그램 두 건의 참여 조건, 자기부담금 여부, 제공하는 활동을 비교하세요.',
    finish: '이후 더 연습해야 할 업무와 연결되는 지원이나 훈련이 있는지 확인해 보세요.',
  },
  hiring: {
    check: '필수 역량과 우대 조건, 고용 형태, 접수 마감과 근무지를 확인하세요.',
    goal: '채용 공고 2건의 공통 필수 역량 찾기',
    copies: '관심 지역의 채용 공고 두 건에서 반복해서 등장하는 업무나 도구를 골라보세요.',
    finish: '실습 결과와 공고 요구사항을 대조해 다음에 익힐 기술을 한 가지 정하세요.',
  },
};

type JobLink = { label: string; url: string; searchTerm: string; check: string };

export function buildJobDiscovery(selection: JobSelection) {
  const { role, keyword, region } = selection;
  const job = Object.hasOwn(profiles, role) ? profiles[role] : {
    focus: `${role} 채용 공고의 담당 업무, 자주 쓰는 도구와 필요한 실무 지식`,
    artifact: `${role} 업무 하나를 재현한 실습 기록`,
    practice: '공고 두 건에 공통으로 나오는 업무를 골라 입력 자료, 수행할 작업, 예상 결과를 적어보세요.',
  };
  if (!role || !keyword) return undefined;

  const label = JOB_KEYWORDS[keyword];
  const guide = keywordGuide[keyword];
  const searchTerm = `${role} ${label}`;
  const experienceUrl = new URL('https://yw.work24.go.kr/search');
  experienceUrl.searchParams.set('query', searchTerm);
  const hiringUrl = new URL('https://www.jobkorea.co.kr/Search/');
  hiringUrl.searchParams.set('stext', searchTerm);
  const work24: JobLink = { label: '고용24 채용정보 상세검색', url: 'https://www.work24.go.kr/wk/a/b/1200/retriveDtlEmpSrchList.do',
    searchTerm, check: region ? `${region} 근무지와 고용 형태를 지정한 뒤 담당 업무를 비교해 보세요.` : '희망 근무지와 고용 형태를 선택하고 담당 업무를 비교해 보세요.' };
  const experience: JobLink = { label: '미래내일 일경험 검색', url: experienceUrl.href, searchTerm,
    check: `${guide.check} 검색 결과가 적으면 직무명만 입력한 뒤 유형을 선택해 보세요.` };
  const hiring: JobLink = selection.publicSector ? {
    label: '잡알리오 공공기관 채용 조회', url: 'https://job.alio.go.kr/recruit.do', searchTerm, check: guide.check,
  } : { label: '잡코리아 채용 검색', url: hiringUrl.href, searchTerm, check: guide.check };
  const links: JobLink[] = keyword === 'certificate' ? [{
    label: '큐넷 국가자격 종목 조회', url: 'https://q-net.or.kr/crf005.do?id=crf00501',
    searchTerm: job.certification ?? '공고에서 확인한 자격증명', check: guide.check,
  }, work24] : keyword === 'support' ? [{
    label: '온통청년 청년정책 통합검색', url: 'https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch',
    searchTerm: `${region ? region + ' ' : ''}취업지원`, check: guide.check,
  }, {
    label: '고용24 직업훈련 검색', url: 'https://www.work24.go.kr/hr/a/a/1100/trnnCrsInf2.do',
    searchTerm: role, check: '과정 소재지, 훈련 내용, 수강 자격과 자기부담금을 확인하세요.',
  }] : keyword === 'hiring' ? [work24, hiring] : keyword === 'intern' ? [experience, hiring] : [experience];
  const todayDescription = keyword === 'tour'
    ? `탐방 안내를 찾아 ‘${job.focus}’ 중 실제로 관찰하거나 질문하고 싶은 업무를 두 가지 골라보세요.`
    : keyword === 'project'
      ? `‘${job.artifact}’를 연습 결과물로 삼아 필요한 자료와 내가 맡을 작업을 한 줄씩 적어보세요.`
      : `‘${links[0].searchTerm}’으로 검색하고 ${guide.check}`;
  return {
    title: `${role} · ${label} 준비`,
    focus: job.focus,
    check: guide.check,
    links,
    steps: [
      { dayLabel: '오늘', dayOffset: 0, title: `${role} ${guide.goal}`, description: todayDescription, durationMinutes: 10 },
      { dayLabel: '1주차', dayOffset: 3, title: `${job.artifact} 만들어 보기`, description: `${guide.copies} ${job.practice}`, durationMinutes: 30 },
      { dayLabel: '2주차', dayOffset: 10, title: `${role} ${label} 준비 점검하기`, description: guide.finish, durationMinutes: 25 },
    ],
  };
}
