import type { PublicProgram } from '../types/domain';

export const ONTONG_COUNSELING_PROGRAM = 'prog-mind-health-109';
export const ONTONG_COUNSELING_BOOKING = 'https://www.youthcenter.go.kr/youthApply/ythApplyCounsel/deepCounselMain/ythacDcReservation/ythacDcrStep01';
export const FUTURE_WORK_EXPERIENCE_PROGRAM = 'prog-future-work-experience';
export const FUTURE_WORK_EXPERIENCE_PORTAL = 'https://yw.work24.go.kr/main.do';

export const workExperienceTopic = /일\s*경험|직무(?:를)?\s*(?:(?:직접|짧게)\s*)?체험|기업\s*탐방|현업.{0,12}(?:알아|경험|체험|해\s*보|접해|멘토링)|현직자.{0,10}(?:만나|멘토링)|^\s*현업[\s.!?]*$/;

export const PROGRAM_LINKS: Record<string, Pick<PublicProgram, 'applyUrl' | 'linkType'>> = {
  'prog-alio-public-intern': { applyUrl: 'https://job.alio.go.kr/recruit.do', linkType: '공식 안내 페이지' },
  'prog-youth-allinone': { applyUrl: 'https://opendata.alio.go.kr/new/main.do', linkType: '공식 안내 페이지' },
  'prog-youth-challenge': { applyUrl: 'https://www.work24.go.kr/wk/g/b/1110/acceptApplyPopup.do', linkType: '공식 신청 페이지' },
  'prog-national-employment': { applyUrl: 'https://www.work24.go.kr/ua/t/a/1100/selectEmssRqutCeck.do', linkType: '공식 신청 페이지' },
  'prog-tomorrow-learning': { applyUrl: 'https://www.work24.go.kr/hr/h/a/1100/selectIssueRequest.do', linkType: '공식 신청 페이지' },
  [FUTURE_WORK_EXPERIENCE_PROGRAM]: { applyUrl: FUTURE_WORK_EXPERIENCE_PORTAL, linkType: '공식 안내 페이지' },
  'prog-work24-career-counseling': { applyUrl: 'https://www.work24.go.kr/wk/r/c/1000/jobPsyExamList.do', linkType: '공식 안내 페이지' },
  'prog-seoul-youth-center': { applyUrl: 'https://youth.seoul.go.kr/crm/front/index.do', linkType: '공식 안내 페이지' },
  'prog-gyeonggi-youth': { applyUrl: 'https://youth.gg.go.kr/gg/intro/youth-policy-job-test.do?article.offset=0&articleLimit=10&articleNo=8943&mode=view', linkType: '공식 안내 페이지' },
  'prog-youth-center-portal': { applyUrl: 'https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch', linkType: '공식 안내 페이지' },
  [ONTONG_COUNSELING_PROGRAM]: { applyUrl: ONTONG_COUNSELING_BOOKING, linkType: '공식 신청 페이지' },
  'prog-k-digital-training': { applyUrl: 'https://www.work24.go.kr/hr/a/a/1100/trnnCrsInf2.do', linkType: '공식 안내 페이지' },
};

export function safeProgramLink(programId: string, savedUrl: string, savedType?: PublicProgram['linkType']) {
  if (Object.hasOwn(PROGRAM_LINKS, programId)) return PROGRAM_LINKS[programId];
  try {
    const url = new URL(savedUrl);
    if (url.protocol === 'https:' && !url.username && !url.password
      && ['alio.go.kr', 'job.alio.go.kr'].includes(url.hostname)) {
      return { applyUrl: url.href, linkType: savedType ?? '공식 안내 페이지' };
    }
  } catch {
    // No link is rendered when a stored address cannot be validated.
  }
  return { applyUrl: '', linkType: undefined };
}
