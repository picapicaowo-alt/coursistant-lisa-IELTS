import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {V2ApiClient} from '@/apis';
import {QuizApiService} from './quiz-api';

const client = {
  get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
};
const service = new QuizApiService(client as unknown as typeof V2ApiClient);

describe('QuizApiService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('covers the student attempt lifecycle with documented routes', async () => {
    client.post.mockResolvedValue({status: 200, data: {id: 12}});
    client.put.mockResolvedValue({status: 200, data: {revision: 1}});

    await service.startAttempt(4, 3, 'attempt-key');
    await service.autosaveAnswer(4, 3, 12, 101, {selectedOptionIds: [1001]});
    await service.submitAttempt(4, 3, 12);

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/v2/courses/4/quizzes/3/attempts',
      undefined,
      {headers: {'Idempotency-Key': 'attempt-key'}},
    );
    expect(client.put).toHaveBeenCalledWith(
      '/v2/courses/4/quizzes/3/attempts/12/answers/101',
      {selectedOptionIds: [1001]},
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/v2/courses/4/quizzes/3/attempts/12/submit',
      undefined,
      expect.objectContaining({headers: expect.any(Object)}),
    );
  });

  it('uses explicit confirm when deleting a quiz', async () => {
    client.delete.mockResolvedValue({status: 200, data: null});
    await service.deleteQuiz(4, 3);
    expect(client.delete).toHaveBeenCalledWith('/v2/courses/4/quizzes/3', {params: {confirm: true}});
  });

  it('loads attempt history, staff-readable attempt detail, and an individual result', async () => {
    client.get.mockResolvedValue({status: 200, data: []});
    await service.listAttempts(4, 3, {userId: 385, page: 1, pageSize: 50});
    await service.getAttempt(4, 3, 12);
    await service.getAttemptResult(4, 3, 12);
    await service.listMyAttempts(4, 3);
    await service.getAttemptReceipt(4, 3, 12);
    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/courses/4/quizzes/3/attempts', {
      params: {userId: 385, page: 1, pageSize: 50},
    });
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/courses/4/quizzes/3/attempts/12');
    expect(client.get).toHaveBeenNthCalledWith(3, '/v2/courses/4/quizzes/3/attempts/12/result');
    expect(client.get).toHaveBeenNthCalledWith(4, '/v2/courses/4/quizzes/3/my-attempts');
    expect(client.get).toHaveBeenNthCalledWith(5, '/v2/courses/4/quizzes/3/attempts/12/receipt');
  });

  it('edits an existing question and releases only selected users', async () => {
    client.patch.mockResolvedValue({status: 200, data: {id: 101}});
    client.post.mockResolvedValue({status: 200, data: null});
    await service.patchQuestion(4, 3, 101, {expectedVersion: 2, stem: 'Updated'});
    await service.releaseGrades(4, 3, [385, 386]);
    await service.retractGrades(4, 3, [386]);
    expect(client.patch).toHaveBeenCalledWith('/v2/courses/4/quizzes/3/questions/101', {
      expectedVersion: 2, stem: 'Updated',
    }, expect.objectContaining({headers: expect.any(Object)}));
    expect(client.post).toHaveBeenNthCalledWith(1, '/v2/courses/4/quizzes/3/grades/release', {userIds: [385, 386]}, expect.objectContaining({headers: expect.any(Object)}));
    expect(client.post).toHaveBeenNthCalledWith(2, '/v2/courses/4/quizzes/3/grades/retract', {userIds: [386]}, expect.objectContaining({headers: expect.any(Object)}));
  });

  it('uses the dedicated audited answer-key correction route', async () => {
    client.patch.mockResolvedValue({status: 200, data: {id: 101}});
    const request = {
      expectedVersion: 3,
      reason: 'The published key selected the distractor.',
      options: [{optionId: 1001, isCorrect: false}, {optionId: 1002, isCorrect: true}],
    };
    await service.patchAnswerKey(4, 3, 101, request, 'regrade-key');
    expect(client.patch).toHaveBeenCalledWith(
      '/v2/courses/4/quizzes/3/questions/101/answer-key',
      request,
      {headers: {'Idempotency-Key': 'regrade-key'}},
    );
  });
});
