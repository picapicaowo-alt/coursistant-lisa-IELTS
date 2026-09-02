import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {V2ApiClient} from '@/apis';
import {MockExamApiService} from './mock-exam-api';

const rawClient = {get: vi.fn()};
const client = {get: vi.fn(), post: vi.fn(), delete: vi.fn(), getClient: vi.fn(() => rawClient)};
const service = new MockExamApiService(client as unknown as typeof V2ApiClient);

describe('MockExamApiService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists role-scoped mock exams', async () => {
    client.get.mockResolvedValue({status: 200, data: []});
    await service.listStudentExams(0, 20);
    await service.listAdvisorTemplates(1, 10);
    await service.listTenantTemplates();
    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/student/mock-exams', {params: {page: 0, size: 20}});
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/advisor/mock-exam-templates', {params: {page: 1, size: 10}});
    expect(client.get).toHaveBeenNthCalledWith(3, '/v2/tenant/mock-exam-templates');
  });

  it('uses tenant template create-only routes without invented idempotency headers', async () => {
    client.post.mockResolvedValue({status: 201, data: {}});
    await service.createTenantTemplate({label: 'Academic A', title: 'IELTS Academic A'});
    await service.createTenantListening(3, 8, {totalMinutes: 40, parts: [{seq: 1, label: 'Part 1', audioPath: 'media/audio.mp3', sections: [{sortOrder: 1, kind: 'SHORT_ANSWER', title: 'Questions', instruction: 'Answer', questionStart: 1, questionEnd: 10, payload: {}}]}]});
    await service.publishTenantVersion(3, 8);
    expect(client.post).toHaveBeenNthCalledWith(1, '/v2/tenant/mock-exam-templates', {label: 'Academic A', title: 'IELTS Academic A'});
    expect(client.post).toHaveBeenNthCalledWith(2, '/v2/tenant/mock-exam-templates/3/versions/8/listening', expect.any(Object));
    expect(client.post).toHaveBeenNthCalledWith(3, '/v2/tenant/mock-exam-templates/3/versions/8/publish');
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

  it('loads tenant review media through the three contracted binary routes', async () => {
    const audio = new Blob(['audio']);
    const image = new Blob(['image']);
    rawClient.get.mockResolvedValueOnce({data: audio}).mockResolvedValueOnce({data: image}).mockResolvedValueOnce({data: image});

    await expect(service.getTenantListeningAudio(3, 8, 1)).resolves.toBe(audio);
    await expect(service.getTenantReadingImage(3, 8, 2, 4)).resolves.toBe(image);
    await expect(service.getTenantWritingImage(3, 8, 2)).resolves.toBe(image);

    expect(rawClient.get).toHaveBeenNthCalledWith(1, '/v2/tenant/mock-exam-templates/3/versions/8/listening/parts/1/audio', {responseType: 'blob'});
    expect(rawClient.get).toHaveBeenNthCalledWith(2, '/v2/tenant/mock-exam-templates/3/versions/8/reading/passages/2/questions/4/image', {responseType: 'blob'});
    expect(rawClient.get).toHaveBeenNthCalledWith(3, '/v2/tenant/mock-exam-templates/3/versions/8/writing/tasks/2/image', {responseType: 'blob'});
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
