import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {V2ApiClient} from '@/apis';
import {CourseOperationsApiService} from './course-operations-api';

const client = {get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn()};
const service = new CourseOperationsApiService(client as unknown as typeof V2ApiClient);

describe('CourseOperationsApiService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('covers occurrence attendance and schedule-request routes', async () => {
    client.get.mockResolvedValue({status: 200, data: {}});
    client.put.mockResolvedValue({status: 200, data: {}});
    client.post.mockResolvedValue({status: 201, data: {}});
    await service.listSessionOccurrences(3, {from: '2026-09-01'});
    await service.saveOccurrenceAttendance(3, 7, {expectedAttendanceVersion: 2, entries: []}, 'attendance-2');
    await service.createCourseScheduleRequest(3, 7, {requestType: 'RESCHEDULE'}, 'schedule-7');
    expect(client.get).toHaveBeenCalledWith('/v2/courses/3/session-occurrences', {params: {from: '2026-09-01'}});
    expect(client.put).toHaveBeenCalledWith(
      '/v2/courses/3/session-occurrences/7/attendance',
      {expectedAttendanceVersion: 2, entries: []},
      {headers: {'Idempotency-Key': 'attendance-2'}},
    );
    expect(client.post).toHaveBeenCalledWith(
      '/v2/courses/3/session-occurrences/7/schedule-requests',
      {requestType: 'RESCHEDULE'},
      {headers: {'Idempotency-Key': 'schedule-7'}},
    );
  });

  it('covers reports, personal events, and tenant alert rules', async () => {
    client.post.mockResolvedValue({status: 201, data: {}});
    client.patch.mockResolvedValue({status: 200, data: {}});
    client.put.mockResolvedValue({status: 200, data: {}});
    await service.createCourseStudentReport(3, {studentUserId: 41, reportType: 'MID_TERM'}, 'report-1');
    await service.patchMyPersonalEvent(8, {title: 'Practice', expectedVersion: 1}, 'event-8');
    await service.putTenantAlertRules({expectedVersion: 2, inactivityDays: 7}, 'alerts-2');
    expect(client.post).toHaveBeenCalledWith(
      '/v2/courses/3/student-reports',
      {studentUserId: 41, reportType: 'MID_TERM'},
      {headers: {'Idempotency-Key': 'report-1'}},
    );
    expect(client.patch).toHaveBeenCalledWith(
      '/v2/me/personal-events/8',
      {title: 'Practice', expectedVersion: 1},
      {headers: {'Idempotency-Key': 'event-8'}},
    );
    expect(client.put).toHaveBeenCalledWith(
      '/v2/tenant/alert-rules',
      {expectedVersion: 2, inactivityDays: 7},
      {headers: {'Idempotency-Key': 'alerts-2'}},
    );
  });

  it('uses the tenant course-ownership contracts', async () => {
    client.get.mockResolvedValue({status: 200, data: {items: []}});
    client.put.mockResolvedValue({status: 200, data: {}});

    await service.listTenantCourseOwnerships({q: 'IELTS', page: 0, size: 20});
    await service.getTenantCourseOwner(3);
    await service.transferTenantCourseOwner(3, {ownerAdvisorUserId: 44, expectedOwnershipVersion: 2, reason: 'Coverage'});

    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/tenant/course-ownerships', {params: {q: 'IELTS', page: 0, size: 20}});
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/tenant/courses/3/owner');
    expect(client.put).toHaveBeenCalledWith('/v2/tenant/courses/3/owner', {ownerAdvisorUserId: 44, expectedOwnershipVersion: 2, reason: 'Coverage'});
  });

  it('uses the advisor schedule and availability contracts without invented list parameters', async () => {
    client.get.mockResolvedValue({status: 200, data: {}});
    client.post.mockResolvedValue({status: 200, data: {}});

    await service.listAdvisorScheduleRequests();
    await service.getAdvisorInstructorAvailability(44);
    await service.decideAdvisorScheduleRequest(19, {decision: 'APPROVE', expectedVersion: 3}, 'decision-19');

    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/advisor/schedule-requests');
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/advisor/instructors/44/availability');
    expect(client.post).toHaveBeenCalledWith(
      '/v2/advisor/schedule-requests/19/decision',
      {decision: 'APPROVE', expectedVersion: 3},
      {headers: {'Idempotency-Key': 'decision-19'}},
    );
  });

  it('connects advisor attendance, course hours, and published report reads', async () => {
    client.get.mockResolvedValue({status: 200, data: {items: []}});
    client.put.mockResolvedValue({status: 200, data: {}});

    await service.getAdvisorStudentAttendance(41);
    await service.getAdvisorStudentCourseHours(41, 7);
    await service.setAdvisorStudentCourseHours(41, 7, {purchasedMinutes: 600, expectedVersion: 2}, 'hours-2');
    await service.listAdvisorPublishedCourseReports(41, 7, 0, 20);
    await service.getAdvisorPublishedCourseReport(41, 7, 9);

    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/advisor/students/41/attendance');
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/advisor/students/41/courses/7/hours');
    expect(client.put).toHaveBeenCalledWith(
      '/v2/advisor/students/41/courses/7/hours',
      {purchasedMinutes: 600, expectedVersion: 2},
      {headers: {'Idempotency-Key': 'hours-2'}},
    );
    expect(client.get).toHaveBeenNthCalledWith(3, '/v2/advisor/students/41/courses/7/student-reports', {params: {page: 0, size: 20}});
    expect(client.get).toHaveBeenNthCalledWith(4, '/v2/advisor/students/41/courses/7/student-reports/9');
  });
});
