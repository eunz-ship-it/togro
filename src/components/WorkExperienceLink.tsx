import { ExternalLink } from 'lucide-react';
import { FUTURE_WORK_EXPERIENCE_PORTAL, workExperienceTopic } from '../lib/programLinks';
import type { AgentMessage } from '../types/domain';

export function WorkExperienceLink({ message, previous }: { message: AgentMessage; previous?: AgentMessage }) {
  if (message.role !== 'assistant') return null;
  const question = previous?.role === 'user' ? previous.content : '';
  const reply = `${message.content} ${message.suggestedAction}`;
  if (!workExperienceTopic.test(reply) && !workExperienceTopic.test(question)) return null;

  return (
    <a
      href={FUTURE_WORK_EXPERIENCE_PORTAL}
      target="_blank"
      rel="noopener noreferrer"
      className="tg-btn-secondary mt-3 inline-flex min-h-10 items-center gap-1.5 px-3 py-2 text-sm"
    >
      <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
      미래내일 일경험 공식 홈페이지
    </a>
  );
}
