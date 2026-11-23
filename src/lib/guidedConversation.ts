import { isJobKeyword, type JobSelection } from './jobDiscovery';

export const GUIDED_TOPICS = ['career-choice', 'career', 'wellbeing', 'experience', 'training', 'employment', 'overload', 'routine', 'general'] as const;
export type GuidedTopic = (typeof GUIDED_TOPICS)[number];
export type GuidedTurn = { stage: 1 | 2 | 3; topic: GuidedTopic };
export type SupportPreview = { kind: 'career' | 'wellbeing' | 'programs' | 'job'; region: string };

export function encodeJobSelection(selection: JobSelection) {
  return `직무;${selection.role};${selection.keyword ?? ''};${selection.region}${selection.publicSector ? ';공공' : ''}`;
}

export function readJobSelection(value?: string): JobSelection | undefined {
  const match = value?.match(/^직무;([가-힣a-zA-Z· -]{0,20});([a-z]*);([가-힣]{0,10})(;공공)?$/);
  if (!match || (match[2] && !isJobKeyword(match[2]))) return;
  return { role: match[1], keyword: isJobKeyword(match[2]) ? match[2] : undefined, region: match[3], publicSector: match[4] ? true : undefined };
}

export function encodeGuidedTurn(turn: GuidedTurn, preview?: SupportPreview) {
  const phase = `대화 ${turn.stage} · ${turn.topic}`;
  return preview ? `${phase};${preview.kind};${preview.region}` : phase;
}

export function readGuidedTurn(value?: string): GuidedTurn | undefined {
  const match = value?.match(/^대화 ([123]) · ([a-z-]+)(?:;[a-z]+;[가-힣]*)?$/);
  if (!match || !GUIDED_TOPICS.some((topic) => topic === match[2])) return;
  return { stage: Number(match[1]) as GuidedTurn['stage'], topic: match[2] as GuidedTopic };
}

export function readSupportPreview(value: string): SupportPreview | undefined {
  const match = value.match(/^대화 2 · [a-z-]+;(career|wellbeing|programs);([가-힣]*)$/);
  if (!match) return;
  return { kind: match[1] as SupportPreview['kind'], region: match[2] };
}
