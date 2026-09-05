import {ApiClient} from '@/apis/api-client';
import {agentApiClient} from '@/apis/v2-api-client';
import {LocalizedError} from '@/i18n/errors';
import {sanitizeAgentAnswer} from '@/utils/studySupportResponse';

export type AiAgentRole = 'STUDENT' | 'INSTRUCTOR';
export type DeadlineDecision = 'ALLOW' | 'REJECT';

export interface AiAgentPendingAction {
  actionId: string;
  type: 'ASSIGNMENT_DEADLINE_CHANGE' | string;
}

export interface AiAgentChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiAgentResponse {
  reply: string;
  pendingAction: AiAgentPendingAction | null;
  conversationId: string | null;
  confirmationRequired: boolean;
}

export interface AiAgentChatRequest {
  message: string;
  /**
   * UI hint only. The agent backend must derive identity and course role from
   * the Bearer token; do not treat this field as authorization.
   */
  role: AiAgentRole;
  conversationId?: string;
  history?: AiAgentChatHistoryTurn[];
}

export interface DeadlineDecisionRequest {
  actionId: string;
  decision: DeadlineDecision;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
};

const readFlag = (...values: unknown[]): boolean =>
  values.some(value => value === true || value === 'true');

const unwrapPayload = (body: unknown): Record<string, unknown> => {
  const root = asRecord(body);
  if (!root) {
    throw new LocalizedError('assistant:errors.invalidResponse');
  }

  const nested = asRecord(root.data);
  if (nested && (
    'reply' in nested
    || 'message' in nested
    || 'pendingAction' in nested
    || 'pending_action' in nested
  )) {
    return nested;
  }

  return root;
};

const parsePendingAction = (value: unknown): AiAgentPendingAction | null => {
  const action = asRecord(value);
  if (!action) return null;

  const actionId = firstString(action.actionId, action.action_id, action.id);
  if (!actionId) return null;

  const type = firstString(action.type, action.actionType, action.action_type)
    ?? 'ASSIGNMENT_DEADLINE_CHANGE';
  return {actionId, type};
};

const normalizeResponse = (body: unknown): AiAgentResponse => {
  const candidate = unwrapPayload(body);
  const rawReply = firstString(candidate.reply, candidate.message) ?? '';
  const reply = sanitizeAgentAnswer(rawReply);
  const pendingAction = parsePendingAction(
    candidate.pendingAction ?? candidate.pending_action,
  );
  const conversationId = firstString(
    candidate.conversationId,
    candidate.conversation_id,
    candidate.sessionId,
    candidate.session_id,
  );
  const confirmationRequired = readFlag(
    candidate.confirmationRequired,
    candidate.confirmation_required,
    candidate.requiresConfirmation,
    candidate.requires_confirmation,
  );

  if (!reply && !pendingAction) {
    throw new LocalizedError('assistant:errors.emptyResponse');
  }

  if (pendingAction && !reply) {
    throw new LocalizedError('assistant:errors.approvalDetails');
  }

  return {
    reply,
    pendingAction,
    conversationId,
    confirmationRequired,
  };
};

export class AiAgentApiService {
  constructor(private readonly client: ApiClient = agentApiClient) {}

  async chat(body: AiAgentChatRequest): Promise<AiAgentResponse> {
    return this.post('/chat', {
      message: body.message,
      role: body.role,
      conversationId: body.conversationId,
      history: body.history,
    });
  }

  async decideDeadlineChange(body: DeadlineDecisionRequest): Promise<AiAgentResponse> {
    return this.post('/chat/deadline-change/decision', body);
  }

  private async post(path: string, data: unknown): Promise<AiAgentResponse> {
    try {
      // Agent JSON is not the LMS envelope; read Axios data after interceptors
      // have attached Bearer and recovered a 401 through V2ApiClient.
      const response = await this.client.getClient().post(path, data);
      return normalizeResponse(response.data);
    } catch (error) {
      if (error instanceof LocalizedError) throw error;
      throw new LocalizedError('assistant:errors.workflowUnavailable');
    }
  }
}

export const aiAgentApiService = new AiAgentApiService();
