import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {V2ApiClient} from '@/apis';
import {MockExamApiService} from './mock-exam-api';

const client = {get: vi.fn(), post: vi.fn(), delete: vi.fn()};
const service = new MockExamApiService(client as unknown as typeof V2ApiClient);

describe('MockExamApiService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists role-scoped mock exams', async () => {
    client.get.mockResolvedValue({status: 200, data: []});
    await service.listStudentExams(0, 20);
    await service.listAdvisorTemplates(1, 10);
    await service.listTenantTemplates(2, 5);
    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/student/mock-exams', {params: {page: 0, size: 20}});
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/advisor/mock-exam-templates', {params: {page: 1, size: 10}});
    expect(client.get).toHaveBeenNthCalledWith(3, '/v2/tenant/mock-exam-templates', {params: {page: 2, size: 5}});
  });

  it('creates a student assignment and attempt with stable keys', async () => {
    client.post.mockResolvedValue({status: 201, data: {}});
    await service.createAdvisorStudentExam(41, {templateId: 3, listeningSelected: true}, 'assign-1');
    await service.createStudentAttempt(9, 'attempt-1');
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/v2/advisor/students/41/mock-exams',
      {templateId: 3, listeningSelected: true},
      {headers: {'Idempotency-Key': 'assign-1'}},
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/v2/student/mock-exams/9/attempts',
      undefined,
      {headers: {'Idempotency-Key': 'attempt-1'}},
    );
  });

  it('grades writing through the instructor queue', async () => {
    client.post.mockResolvedValue({status: 200, data: {}});
    await service.gradeInstructorWriting(12, {score: 7, feedback: 'Clear structure'}, 'grade-12');
    expect(client.post).toHaveBeenCalledWith(
      '/v2/instructor/mock-exams/writing-grades/12',
      {score: 7, feedback: 'Clear structure'},
      {headers: {'Idempotency-Key': 'grade-12'}},
    );
  });
});
