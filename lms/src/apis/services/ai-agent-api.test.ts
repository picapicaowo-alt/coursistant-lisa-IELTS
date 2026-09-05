import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ApiClient} from '@/apis/api-client';
import {AiAgentApiService} from './ai-agent-api';

const json = (data: unknown) => ({data});

describe('AiAgentApiService', () => {
  const post = vi.fn();
  const client = {getClient: () => ({post})} as unknown as ApiClient;
  let service: AiAgentApiService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiAgentApiService(client);
  });

  it('posts chat through the shared authenticated client', async () => {
    post.mockResolvedValue(json({
      reply: 'You have two upcoming assignments.',
      pendingAction: null,
      trace: {private: 'must not leak into the UI model'},
    }));

    await expect(service.chat({
      message: 'What is due?',
      role: 'STUDENT',
    })).resolves.toEqual({
      reply: 'You have two upcoming assignments.',
      pendingAction: null,
      conversationId: null,
      confirmationRequired: false,
    });

    expect(post).toHaveBeenCalledWith('/chat', {
      message: 'What is due?',
      role: 'STUDENT',
      conversationId: undefined,
      history: undefined,
    });
  });

  it('does not bind a pending decision to a captured access token', async () => {
    post
      .mockResolvedValueOnce(json({
        reply: 'Allow this deadline change?',
        pendingAction: {actionId: 'action-456', type: 'ASSIGNMENT_DEADLINE_CHANGE'},
      }))
      .mockResolvedValueOnce(json({
        reply: 'The deadline change was rejected.',
        pendingAction: null,
      }));

    await service.chat({message: 'Move Assignment A', role: 'INSTRUCTOR'});
    await service.decideDeadlineChange({actionId: 'action-456', decision: 'REJECT'});

    expect(post).toHaveBeenNthCalledWith(2, '/chat/deadline-change/decision', {
      actionId: 'action-456',
      decision: 'REJECT',
    });
  });

  it('rejects an approval request that has no user-visible details', async () => {
    post.mockResolvedValue(json({
      reply: '',
      pendingAction: {actionId: 'action-empty', type: 'ASSIGNMENT_DEADLINE_CHANGE'},
    }));

    await expect(service.chat({
      message: 'Move Assignment A',
      role: 'INSTRUCTOR',
    })).rejects.toThrow('The AI Agent returned an approval request without details.');
  });

  it('surfaces the API error without exposing a server trace', async () => {
    post.mockRejectedValue({
      code: 409,
      message: 'Conflict',
      details: {message: 'No matching pending deadline change', trace: {internal: true}},
    });

    await expect(service.decideDeadlineChange({
      actionId: 'expired-action',
      decision: 'ALLOW',
    })).rejects.toThrow('Workflow is temporarily unavailable. Please try again.');
  });

  it('normalizes snake_case pending actions and conversation ids', async () => {
    post.mockResolvedValue(json({
      data: {
        reply: 'Allow this deadline change?',
        pending_action: {action_id: 456, action_type: 'ASSIGNMENT_DEADLINE_CHANGE'},
        conversation_id: 'conv-9',
        confirmation_required: true,
      },
    }));

    await expect(service.chat({
      message: 'Move Assignment A',
      role: 'INSTRUCTOR',
      conversationId: 'conv-8',
      history: [{role: 'user', content: 'List my courses.'}],
    })).resolves.toEqual({
      reply: 'Allow this deadline change?',
      pendingAction: {actionId: '456', type: 'ASSIGNMENT_DEADLINE_CHANGE'},
      conversationId: 'conv-9',
      confirmationRequired: true,
    });
  });

  it('never exposes verbose think or retrieval blocks in a workflow reply', async () => {
    post.mockResolvedValue(json({
      reply: [
        'You teach two courses.',
        '/begin-think/',
        'model gpt-internal tokens 4000',
        '/end-think/',
        '/begin-rss/',
        'private retrieval diagnostics',
        '/end-rss/',
      ].join('\n'),
      pendingAction: null,
    }));

    await expect(service.chat({
      message: 'List my courses.',
      role: 'INSTRUCTOR',
    })).resolves.toMatchObject({reply: 'You teach two courses.'});
  });
});
