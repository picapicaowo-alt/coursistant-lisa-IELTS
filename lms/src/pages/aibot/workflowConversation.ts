import type {AiAgentChatHistoryTurn} from '@/apis/services/ai-agent-api';
import i18n from '@/i18n';
import {getApiErrorCode, getApiErrorMessage} from '@/utils/apiError';

export interface WorkflowChatMessage {
  id: number;
  sender: 'user' | 'agent';
  text: string;
  /** UI-generated receipts retain identity; authored turns are never translated. */
  translationKey?: string;
  error?: unknown;
  isControl?: boolean;
}

export const workflowErrorMessage = (error: unknown): string => {
  const code = getApiErrorCode(error);
  return code === 'AI_EXAM_LOCKDOWN' || code === 'QUIZ_EXAM_LOCKDOWN'
    ? i18n.t('assistant:workflow.errors.lockdown')
    : getApiErrorMessage(error, i18n.t('assistant:errors.workflowUnavailable'));
};

export const workflowMessageText = (message: WorkflowChatMessage): string =>
  message.error !== undefined ? workflowErrorMessage(message.error)
    : message.translationKey ? i18n.t(message.translationKey) : message.text;

const CONFIRMATION_SHORT_REPLIES = new Set([
  'confirm',
  'confirmed',
  'cancel',
  'cancelled',
  'canceled',
  'yes',
  'y',
  'no',
  'n',
]);

export const isGenericAssistantReset = (reply: string): boolean => {
  const text = reply.trim().toLowerCase();
  return (
    /how can i assist you today/.test(text)
    || /how may i assist you today/.test(text)
    || /^hello[!.,]?\s+how (can|may) i assist you/.test(text)
  );
};

export const isDetailsConfirmationReply = (reply: string): boolean => {
  const text = reply.trim().toLowerCase();
  if (!text || isGenericAssistantReset(text)) return false;

  const asksToConfirm = (
    text.includes('please confirm')
    || text.includes('could you please confirm')
    || text.includes('confirm that you would like')
    || text.includes('is everything correct')
    || text.includes('does this look correct')
  );
  const listsChangeDetails = (
    text.includes('course code')
    && text.includes('assignment title')
    && (text.includes('due date') || text.includes('new date'))
  );

  return asksToConfirm || listsChangeDetails;
};

export const lastOriginalUserRequest = (messages: WorkflowChatMessage[]): string | undefined => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.sender !== 'user' || message.isControl) continue;
    if (CONFIRMATION_SHORT_REPLIES.has(message.text.trim().toLowerCase())) continue;
    return message.text;
  }
  return undefined;
};

export const buildDetailsConfirmationMessage = (originalRequest: string | undefined): string => {
  // Agent protocol, not rendered UI: preserve its language and original request.
  const prefix = 'I confirm those details. Please proceed with the deadline change and wait for my approval before applying it.';
  if (!originalRequest) return prefix;
  return `${prefix} Original request: ${originalRequest}`;
};

export const toChatHistory = (messages: WorkflowChatMessage[]): AiAgentChatHistoryTurn[] =>
  messages
    .filter(message => message.id !== 0)
    .map(message => ({
      role: message.sender === 'user' ? 'user' : 'assistant',
      // Keep generated history language stable without freezing visible UI copy.
      content: message.translationKey ? i18n.getFixedT('en')(message.translationKey) : message.text,
    }));
