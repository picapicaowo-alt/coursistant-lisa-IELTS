import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {V2ApiClient} from '@/apis';
import {ParentApiService} from './parent-api';

const client = {get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn()};
const service = new ParentApiService(client as unknown as typeof V2ApiClient);

describe('ParentApiService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the linked-student academic read routes', async () => {
    client.get.mockResolvedValue({status: 200, data: {}});
    await service.listLinkedStudents(0, 20);
    await service.getStudentDashboard(41);
    await service.listStudentCalendar(41, 25);
    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/parent/linked-students', {params: {page: 0, size: 20}});
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/parent/students/41/dashboard');
    expect(client.get).toHaveBeenNthCalledWith(3, '/v2/parent/students/41/calendar', {params: {limit: 25}});
  });

  it('links a parent with an idempotency key', async () => {
    client.post.mockResolvedValue({status: 201, data: {}});
    await service.createOrReuseParentLink(7, {email: 'parent@example.test', firstName: 'Pat', lastName: 'Parent'}, 'parent-link-7');
    expect(client.post).toHaveBeenCalledWith(
      '/v2/counsellor/student-intakes/7/parent-links',
      {email: 'parent@example.test', firstName: 'Pat', lastName: 'Parent'},
      {headers: {'Idempotency-Key': 'parent-link-7'}},
    );
  });

  it('creates or reuses a parent from the tenant student scope', async () => {
    client.post.mockResolvedValue({status: 201, data: {}});
    await service.createOrReuseTenantParentLink(41, {email: 'parent@example.test'});
    expect(client.post).toHaveBeenCalledWith(
      '/v2/tenant/students/41/parent-links',
      {email: 'parent@example.test'},
    );
  });

  it('reads the counsellor parent links so relationships survive a refresh', async () => {
    client.get.mockResolvedValue({status: 200, data: []});
    await service.listCounsellorParentLinks(7);
    expect(client.get).toHaveBeenCalledWith('/v2/counsellor/student-intakes/7/parent-links');
  });

  it('sends parent schedule and conversation writes through their scoped routes', async () => {
    client.post.mockResolvedValue({status: 201, data: {}});
    await service.createScheduleRequest(41, {courseId: 3, occurrenceId: 9, requestType: 'RESCHEDULE'}, 'schedule-1');
    await service.markConversationRead(41, {messageId: 8}, 'read-8');
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/v2/parent/students/41/schedule-requests',
      {courseId: 3, occurrenceId: 9, requestType: 'RESCHEDULE'},
      {headers: {'Idempotency-Key': 'schedule-1'}},
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/v2/parent/students/41/conversation/read',
      {messageId: 8},
      {headers: {'Idempotency-Key': 'read-8'}},
    );
  });
});
