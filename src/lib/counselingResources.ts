import type { AgentMessage } from '../types/domain';

export type CounselingTopic = 'career' | 'wellbeing';
type CounselingResource = { label: string; url: string };

const nationwide: Record<CounselingTopic, CounselingResource> = {
  career: {
    label: '온통청년 · 지역별 청년센터 찾기',
    url: 'https://www.youthcenter.go.kr/youthApply/ythCenter/ythCenterMain',
  },
  wellbeing: {
    label: '국가정신건강정보포털 · 지역 상담기관 찾기',
    url: 'https://www.mentalhealth.go.kr/portal/health/fac/PotalHealthFacListTab2.do',
  },
};

const regional: Record<string, Record<CounselingTopic, CounselingResource>> = {
  대구: {
    career: {
      label: '대구광역시청년센터 · 청년상담소 안내',
      url: 'https://dgyouth.kr/business/information.asp',
    },
    wellbeing: {
      label: '대구청년마음건강센터 · 온라인 상담',
      url: 'https://www.youthdgmhc.or.kr/sub.php?menukey=25',
    },
  },
  서울: {
    career: {
      label: '서울청년센터 · 청년정책 종합상담',
      url: 'https://youth.seoul.go.kr/crm/front/index.do',
    },
    wellbeing: {
      label: '서울시 · 청년 마음건강 지원 안내',
      url: 'https://youth.seoul.go.kr/youthConts.do?key=2310100076&sc_bbsCtgrySn=2310200008&sc_bbsStngSn=2212200001&sc_pbancSeCd=009',
    },
  },
};

const counselingReference = /상담\s*(?:정보|기관|센터|서비스|프로그램|지원|안내|신청|예약|홈페이지|사이트|링크)|상담(?:을)?\s*받을\s*(?:수\s*있는|곳)|청년\s*센터|정신건강복지센터|상담소|상담처/;
const lookupSuggestion = /찾아\s*[보볼가]|알아\s*[보볼]|살펴\s*[보볼]|검색해|확인|참고|문의를?\s*(?:해|하)|이용해\s*보|(?:예약|신청)(?:을)?\s*(?:해\s*보|하세요|할 수)/;
const noReferral = /(?:예약|상담|신청).{0,25}(?:필요\s*없|하지\s*않아도|강요)|(?:찾아|알아|예약|신청).{0,10}보지\s*않아도/;
const wellbeingWords = /마음\s*건강|정신\s*건강|마음\s*상담|심리|정서|무기력|기운.{0,6}(?:없|안\s*나)|우울|마음이\s*힘들/;
const careerWords = /진로|취업|직무|구직|면접|채용/;
const statedLocation = /(?:^|[\s,(])(서울|경기|인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)(?:특별시|광역시|특별자치[시도]|에서|에\s|로\s|의\s|\s|[,.?)]|$)/;

export function getCounselingResources(message: AgentMessage, region?: string, previous?: AgentMessage, hasBooking = false) {
  if (message.role !== 'assistant') return [];
  const suggestions = [message.content, message.suggestedAction]
    .flatMap((part) => part.split(/[.!?\n]+/))
    .filter((part) => counselingReference.test(part) && lookupSuggestion.test(part) && !noReferral.test(part));
  if (!hasBooking && suggestions.length === 0) return [];

  const requestedTopic = previous?.role === 'user' ? previous.content : '';
  const advice = suggestions.join(' ');
  const wellbeing = wellbeingWords.test(advice) || (!careerWords.test(advice) && !hasBooking && wellbeingWords.test(requestedTopic));
  const topic = wellbeing ? 'wellbeing' : 'career';

  const statedRegion = requestedTopic.match(statedLocation)?.[1];
  const profileRegion = region?.trim().match(/^(서울|대구)(?:특별시|광역시|\s|$)/)?.[1];
  const local = regional[statedRegion ?? profileRegion ?? '']?.[topic];
  return local ? [local, nationwide[topic]] : [nationwide[topic]];
}

export const PROFILE_REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

export const ONTONG_REGIONAL_PLATFORMS = 'https://www.youthcenter.go.kr/youthApply/ythPortal/ythPortalMain';

const regionalPlatformLinks: Record<string, string> = {
  서울: 'https://youth.seoul.go.kr/mainA.do',
  경기: 'https://youth.gg.go.kr/gg/index.do',
  인천: 'https://youth.incheon.go.kr/',
  부산: 'https://young.busan.go.kr/index.nm',
  대구: 'https://www.daegu.go.kr/YouthPolicy/index.do',
  대전: 'https://www.daejeonyouthportal.kr/index.do',
  광주: 'https://youth.jeonnam-gwangju.go.kr/www',
  울산: 'https://www.ulsan.go.kr/s/ulsanyouth/contents.do',
  세종: 'https://www.4242.or.kr/',
  강원: 'https://job.gwd.go.kr/youth',
  충북: 'https://www.cba.ne.kr/home/sub.php?menukey=303',
  충남: 'https://youth.chungnam.go.kr/web/main/main',
  전북: 'https://www.jb2030.or.kr/',
  전남: 'https://www.jnyouthcenter.kr/',
  경북: 'https://gbyouth.go.kr/main.tc',
  경남: 'https://youth.gyeongnam.go.kr/youth/menu.es?mid=a10400000000',
  제주: 'https://jejuyouthdream.com/',
};

export function findRegionalCounseling(region: string, topic: CounselingTopic) {
  return { local: regional[region]?.[topic], directory: nationwide[topic], platformUrl: regionalPlatformLinks[region] };
}
