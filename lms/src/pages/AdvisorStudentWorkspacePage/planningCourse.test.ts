import {beforeEach, describe, expect, it, vi} from 'vitest';
import {loadPlanningCourse} from './planningCourse';

const api = vi.hoisted(() => ({getCourseDeliveryConfig: vi.fn()}));
vi.mock('@/apis/services/advisor-api', () => ({advisorApiService: api}));
const course = {courseId: 42, deliveryMode: 'ONE_ON_ONE', launchState: 'DRAFT', courseLinkVersion: 5};
describe('planning course launch version', () => {
  beforeEach(() => vi.clearAllMocks());
  it('reads an omitted token from the course delivery contract, preserving enrollment fields', async () => {
    api.getCourseDeliveryConfig.mockResolvedValue({status: 200, code: 'SUCCESS', data: {courseId: 42, courseLaunchVersion: 0, launchState: 'READY'}});
    expect(await loadPlanningCourse(course)).toEqual({...course, courseLaunchVersion: 0, launchState: 'READY'});
    expect(api.getCourseDeliveryConfig).toHaveBeenCalledWith(42);
  });
  it('preserves a reviewed token without a background replacement', async () => {
    const reviewed = {...course, courseLaunchVersion: 3};
    expect(await loadPlanningCourse(reviewed)).toBe(reviewed);
    expect(api.getCourseDeliveryConfig).not.toHaveBeenCalled();
  });
  it('does not request the owner-only delivery contract for group enrollment', async () => {
    const group = {...course, deliveryMode: 'GROUP'};
    expect(await loadPlanningCourse(group)).toBe(group);
    expect(api.getCourseDeliveryConfig).not.toHaveBeenCalled();
  });
  it.each([{courseId: 42, courseLaunchVersion: null}, {courseId: 43, courseLaunchVersion: 3}, {courseId: 42, courseLaunchVersion: -1}])('refuses an unusable delivery token: %j', async data => {
    api.getCourseDeliveryConfig.mockResolvedValue({status: 200, code: 'SUCCESS', data: {...data, launchState: 'READY'}});
    await expect(loadPlanningCourse(course)).rejects.toMatchObject({name: 'ApiResponseDataError'});
  });
  it('keeps permission and network failures as failures', async () => {
    const error = {code: 403, details: {code: 'ACCESS_DENIED'}};
    api.getCourseDeliveryConfig.mockRejectedValue(error);
    await expect(loadPlanningCourse(course)).rejects.toBe(error);
  });
});
