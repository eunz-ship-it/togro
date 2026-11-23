import type { AgentMessage } from '../types/domain';

const legacyAssistantIntro =
  /^\s*AI 연결을 기다리는 동안 입력에 맞(?:춘 기본 안내를|는 기본 안내와 공식 프로그램을) 보여드려요\.\s*/;

export function getConversationText(message: Pick<AgentMessage, 'role' | 'content'>): string {
  return message.role === 'assistant'
    ? message.content.replace(legacyAssistantIntro, '')
    : message.content;
}
