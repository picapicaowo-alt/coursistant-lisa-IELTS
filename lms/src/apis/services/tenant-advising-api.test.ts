import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {V2ApiClient} from '@/apis';
import {TenantAdvisingApiService} from './tenant-advising-api';

const client = {get: vi.fn(), post: vi.fn(), put: vi.fn()};
const service = new TenantAdvisingApiService(client as unknown as typeof V2ApiClient);

describe('TenantAdvisingApiService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters tenant intakes and uses assignment-version for reassignment', async () => {
    client.get.mockResolvedValue({status: 200, data: {items: []}});
    client.put.mockResolvedValue({status: 200, data: {}});
    client.post.mockResolvedValue({status: 200, data: {}});
    await service.listStudentIntakes({page: 0, size: 20, assignmentStatus: 'ASSIGNED'});
    await service.reassignAdvisor(41, {advisorUserId: 90, expectedAssignmentVersion: 0, reason: 'Coverage'}, 'reassign-1');
    await service.cancelStudentIntake(9, {expectedIntakeVersion: 1, reason: 'Duplicate'}, 'cancel-1');
    expect(client.get).toHaveBeenCalledWith(
      '/v2/tenant/student-intakes',
      {params: {page: 0, size: 20, assignmentStatus: 'ASSIGNED'}},
    );
    expect(client.put).toHaveBeenCalledWith(
      '/v2/tenant/students/41/advisor',
      {advisorUserId: 90, expectedAssignmentVersion: 0, reason: 'Coverage'},
      {headers: {'Idempotency-Key': 'reassign-1'}},
    );
    expect(client.post).toHaveBeenCalledWith(
      '/v2/tenant/student-intakes/9/cancel',
      {expectedIntakeVersion: 1, reason: 'Duplicate'},
      {headers: {'Idempotency-Key': 'cancel-1'}},
    );
  });

  it('configures and launches course delivery with optimistic versions', async () => {
    client.get.mockResolvedValue({status: 200, data: {courseLaunchVersion: 1}});
    client.put.mockResolvedValue({status: 200, data: {}});
    client.post.mockResolvedValue({status: 200, data: {}});
    await service.getCourseDeliveryConfig(8);
    await service.putCourseDeliveryConfig(8, {catalogCode: 'IELTS-A', capacity: 12, expectedCourseLaunchVersion: 1}, 'delivery-8');
    await service.publishCourseLaunch(8, {expectedCourseLaunchVersion: 2}, 'publish-8');
    expect(client.get).toHaveBeenCalledWith('/v2/tenant/courses/8/delivery-config');
    expect(client.put).toHaveBeenCalledWith(
      '/v2/tenant/courses/8/delivery-config',
      {catalogCode: 'IELTS-A', capacity: 12, expectedCourseLaunchVersion: 1},
      {headers: {'Idempotency-Key': 'delivery-8'}},
    );
    expect(client.post).toHaveBeenCalledWith(
      '/v2/tenant/courses/8/launch/publish',
      {expectedCourseLaunchVersion: 2},
      {headers: {'Idempotency-Key': 'publish-8'}},
    );
  });
});
