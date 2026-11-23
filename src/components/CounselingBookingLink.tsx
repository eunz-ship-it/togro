import { CalendarDays, MapPin } from 'lucide-react';
import { getCounselingResources } from '../lib/counselingResources';
import { ONTONG_COUNSELING_BOOKING } from '../lib/programLinks';
import type { AgentMessage } from '../types/domain';

const bookingTag = ' · 상담 예약';
const legacyBookingAction = /상담이 필요하다면 예약 가능 여부부터 확인해 보세요/;

export function saveCounselingBooking(supportType: string, showBooking?: boolean) {
  return showBooking ? supportType.slice(0, 80 - bookingTag.length) + bookingTag : supportType;
}

export function displaySupportType(supportType: string) {
  return supportType.endsWith(bookingTag) ? supportType.slice(0, -bookingTag.length) : supportType;
}

export function CounselingBookingLink({ message, region, previous }: { message: AgentMessage; region?: string; previous?: AgentMessage }) {
  const hasBooking = message.role === 'assistant' && (message.supportType.endsWith(bookingTag)
    || legacyBookingAction.test(message.suggestedAction));
  const resources = getCounselingResources(message, region, previous, hasBooking);
  if (!hasBooking && resources.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {hasBooking && (
        <div className="space-y-1.5">
          <a
            href={ONTONG_COUNSELING_BOOKING}
            target="_blank"
            rel="noopener noreferrer"
            className="tg-btn-primary inline-flex min-h-10 items-center gap-1.5 px-3 py-2 text-sm"
          >
            <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0" />
            온통청년 진로·취업 상담 예약하기
          </a>
          <p className="text-xs text-[var(--tg-text-muted)]">온통청년 계정으로 신청할 수 있어요.</p>
        </div>
      )}
      <ul aria-label="지역별 공식 상담 링크" className="flex flex-wrap gap-2">
        {resources.map(({ label, url }) => (
          <li key={url} className="min-w-0 max-w-full">
            <a href={url} target="_blank" rel="noopener noreferrer" className="tg-btn-secondary inline-flex min-h-10 items-center gap-1.5 px-3 py-2 text-sm">
              <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
