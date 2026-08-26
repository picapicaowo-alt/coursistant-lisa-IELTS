import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {V2ApiClient} from '@/apis';
import {CounsellorApiService} from './counsellor-api';

const client = {get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn()};
const service = new CounsellorApiService(client as unknown as typeof V2ApiClient);

describe('CounsellorApiService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads dashboard and unassigned intakes', async () => {
    client.get.mockResolvedValue({status: 200, data: {createdCount: 1, assignedCount: 0, unassignedCount: 1}});
    await service.getDashboard();
    await service.listStudentIntakes(0, 20);
    await service.getStudentIntake(9);
    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/counsellor/dashboard');
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/counsellor/student-intakes', {params: {page: 0, size: 20}});
    expect(client.get).toHaveBeenNthCalledWith(3, '/v2/counsellor/student-intakes/9');
  });

  it('sends Idempotency-Key on create, patch, and first assign', async () => {
    const create = {name: 'Alex Chen', email: 'alex@example.com', studentType: 'STANDARD' as const, courseRequest: 'Writing'};
    client.post.mockResolvedValue({status: 201, data: {intakeId: 1}});
    client.patch.mockResolvedValue({status: 200, data: {intakeId: 1}});
    client.put.mockResolvedValue({status: 200, data: {assignmentStatus: 'ASSIGNED'}});
    await service.createStudentIntake(create, 'create-1');
    await service.patchStudentIntake(1, {expectedIntakeVersion: 0, name: 'Alexandra Chen'}, 'patch-1');
    await service.assignAdvisor(1, {advisorUserId: 88, expectedIntakeVersion: 1}, 'assign-1');
    expect(client.post).toHaveBeenCalledWith(
      '/v2/counsellor/student-intakes',
      create,
      {headers: {'Idempotency-Key': 'create-1'}},
    );
    expect(client.patch).toHaveBeenCalledWith(
      '/v2/counsellor/student-intakes/1',
      {expectedIntakeVersion: 0, name: 'Alexandra Chen'},
      {headers: {'Idempotency-Key': 'patch-1'}},
    );
    expect(client.put).toHaveBeenCalledWith(
      '/v2/counsellor/student-intakes/1/advisor',
      {advisorUserId: 88, expectedIntakeVersion: 1},
      {headers: {'Idempotency-Key': 'assign-1'}},
    );
  });
});
