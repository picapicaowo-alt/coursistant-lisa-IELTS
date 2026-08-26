import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {V2ApiClient} from '@/apis';
import {AdvisorApiService} from './advisor-api';

const client = {get: vi.fn(), post: vi.fn(), put: vi.fn()};
const service = new AdvisorApiService(client as unknown as typeof V2ApiClient);

describe('AdvisorApiService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists current-assignment students and intake', async () => {
    client.get.mockResolvedValue({status: 200, data: {items: []}});
    await service.listStudents(0, 20);
    await service.getStudentIntake(41);
    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/advisor/students', {params: {page: 0, size: 20}});
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/advisor/students/41/intake');
  });

  it('requires Idempotency-Key for profile and study-plan writes', async () => {
    const profile = {targetGoal: 'Band 7', skills: [{skillCode: 'W', displayName: 'Writing', scale: '0-9', position: 1}]};
    const plan = {
      expectedProfileVersion: 0,
      strategySummary: 'Focus writing',
      startDate: '2026-09-01',
      planEndDate: '2026-12-01',
      checkpoints: [{description: 'Week 4', goal: 'Task 2', dueDate: '2026-10-01', position: 1}],
    };
    client.post.mockResolvedValue({status: 201, data: {}});
    client.put.mockResolvedValue({status: 200, data: {}});
    await service.createStudentProfile(41, profile, 'profile-create');
    await service.updateStudentProfile(41, {...profile, expectedProfileVersion: 0, skills: profile.skills}, 'profile-put');
    await service.createStudyPlan(41, plan, 'plan-create');
    await service.updateStudyPlan(41, {...plan, expectedStudyPlanVersion: 0}, 'plan-put');
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/v2/advisor/students/41/profile',
      profile,
      {headers: {'Idempotency-Key': 'profile-create'}},
    );
    expect(client.put).toHaveBeenNthCalledWith(
      1,
      '/v2/advisor/students/41/profile',
      expect.objectContaining({expectedProfileVersion: 0}),
      {headers: {'Idempotency-Key': 'profile-put'}},
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/v2/advisor/students/41/study-plan',
      plan,
      {headers: {'Idempotency-Key': 'plan-create'}},
    );
    expect(client.get).not.toHaveBeenCalled();
    await service.getOwnProfile();
    await service.getOwnStudyPlan();
    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/student/profile');
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/student/study-plan');
  });
});
