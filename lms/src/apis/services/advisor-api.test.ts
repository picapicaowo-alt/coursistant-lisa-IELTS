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

  it('covers course orchestration, action tasks, and student task writes', async () => {
    client.get.mockResolvedValue({status: 200, data: []});
    client.post.mockResolvedValue({status: 200, data: {}});
    await service.listStudentCourses(41);
    await service.linkGroupCourse(41, {courseId: 7, expectedStudyPlanVersion: 2}, 'link-7');
    await service.readyOneOnOneLaunch(41, 7, {expectedCourseLaunchVersion: 1}, 'ready-7');
    await service.startOwnAdvisorTask(9, {expectedVersion: 0}, 'task-9');
    await service.resolveActionTask(12, {expectedVersion: 3}, 'resolve-12');
    expect(client.get).toHaveBeenCalledWith('/v2/advisor/students/41/courses');
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/v2/advisor/students/41/courses/group-links',
      {courseId: 7, expectedStudyPlanVersion: 2},
      {headers: {'Idempotency-Key': 'link-7'}},
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/v2/advisor/students/41/courses/7/launch/ready',
      {expectedCourseLaunchVersion: 1},
      {headers: {'Idempotency-Key': 'ready-7'}},
    );
    expect(client.post).toHaveBeenNthCalledWith(
      3,
      '/v2/student/study-plan/tasks/9/start',
      {expectedVersion: 0},
      {headers: {'Idempotency-Key': 'task-9'}},
    );
    expect(client.post).toHaveBeenNthCalledWith(
      4,
      '/v2/advisor/action-tasks/12/resolve',
      {expectedVersion: 3},
      {headers: {'Idempotency-Key': 'resolve-12'}},
    );
  });

  it('owns course delivery configuration under the advisor scope', async () => {
    client.get.mockResolvedValue({status: 200, data: {courseLaunchVersion: 1}});
    client.put.mockResolvedValue({status: 200, data: {}});
    client.post.mockResolvedValue({status: 200, data: {}});

    await service.getCourseDeliveryConfig(8);
    await service.putCourseDeliveryConfig(8, {catalogCode: 'IELTS-A', capacity: 12, expectedCourseLaunchVersion: 1}, 'delivery-8');
    await service.publishCourseLaunch(8, {expectedCourseLaunchVersion: 2}, 'publish-8');

    expect(client.get).toHaveBeenCalledWith('/v2/advisor/courses/8/delivery-config');
    expect(client.put).toHaveBeenCalledWith(
      '/v2/advisor/courses/8/delivery-config',
      {catalogCode: 'IELTS-A', capacity: 12, expectedCourseLaunchVersion: 1},
      {headers: {'Idempotency-Key': 'delivery-8'}},
    );
    expect(client.post).toHaveBeenCalledWith(
      '/v2/advisor/courses/8/launch/publish',
      {expectedCourseLaunchVersion: 2},
      {headers: {'Idempotency-Key': 'publish-8'}},
    );
  });

  it('connects the advisor conversation inbox, messages, and read receipt', async () => {
    client.get.mockResolvedValue({status: 200, data: {items: []}});
    client.post.mockResolvedValue({status: 200, data: {}});

    await service.listConversations(0, 20);
    await service.listConversationMessages(41);
    await service.sendConversationMessage(41, {clientMessageId: 'message-41', body: 'Progress update'}, 'send-41');
    await service.markConversationRead(41, {messageId: 12}, 'read-12');

    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/advisor/conversations', {params: {page: 0, size: 20}});
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/advisor/students/41/conversation/messages');
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/v2/advisor/students/41/conversation/messages',
      {clientMessageId: 'message-41', body: 'Progress update'},
      {headers: {'Idempotency-Key': 'send-41'}},
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/v2/advisor/students/41/conversation/read',
      {messageId: 12},
      {headers: {'Idempotency-Key': 'read-12'}},
    );
  });

  it('uploads advisor conversation attachments using the documented multipart contract', async () => {
    client.post.mockResolvedValue({status: 200, data: {}});
    const file = new File(['progress'], 'progress.pdf', {type: 'application/pdf'});

    await service.sendConversationMessageMultipart(41, {clientMessageId: 'upload-41', body: 'Attached report', files: [file]}, 'upload-key');

    const [, body, config] = client.post.mock.calls[0];
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('clientMessageId')).toBe('upload-41');
    expect((body as FormData).get('body')).toBe('Attached report');
    expect((body as FormData).getAll('files')).toEqual([file]);
    expect(config).toEqual({headers: {'Idempotency-Key': 'upload-key'}});
  });
  it('uses new Advisor directories and combines search with paging filters', async () => {
    await service.listInstructors({q: 'Ivy', page: 1, size: 20});
    await service.listOwnedCourses({q: 'writing', launchState: 'DRAFT', page: 0, size: 20});
    await service.listStudents(1, 20, {q: 'Wong', risk: 'AT_RISK', studentType: 'VIP'});
    await service.searchGroupCourseOptions(41, {q: 'Academic', page: 0, size: 20});
    await service.listConversations(2, 20, {q: 'Wong', unreadOnly: true});
    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/advisor/instructors', {params: {q: 'Ivy', page: 1, size: 20}});
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/advisor/courses', {params: {q: 'writing', launchState: 'DRAFT', page: 0, size: 20}});
    expect(client.get).toHaveBeenNthCalledWith(3, '/v2/advisor/students', {params: {page: 1, size: 20, q: 'Wong', risk: 'AT_RISK', studentType: 'VIP'}});
    expect(client.get).toHaveBeenNthCalledWith(4, '/v2/advisor/students/41/course-options', {params: {q: 'Academic', page: 0, size: 20}});
    expect(client.get).toHaveBeenNthCalledWith(5, '/v2/advisor/conversations', {params: {page: 2, size: 20, q: 'Wong', unreadOnly: true}});
  });

});
