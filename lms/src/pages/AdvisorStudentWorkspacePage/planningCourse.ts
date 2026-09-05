import {ApiResponseDataError, unwrapData, type AdvisorStudentCourseResponse} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';

/** Some course-list projections omit the launch token. Read the existing
 * delivery contract before opening actions; never infer a version from state. */
export async function loadPlanningCourse(course: AdvisorStudentCourseResponse): Promise<AdvisorStudentCourseResponse> {
  if (course.deliveryMode !== 'ONE_ON_ONE' || course.courseLaunchVersion != null) return course;
  if (course.courseId == null) throw new ApiResponseDataError('planningCourse');
  const config = unwrapData(await advisorApiService.getCourseDeliveryConfig(course.courseId), 'courseDeliveryConfig');
  if (config.courseId !== course.courseId || !Number.isSafeInteger(config.courseLaunchVersion) ||
      config.courseLaunchVersion == null || config.courseLaunchVersion < 0 || !config.launchState) {
    throw new ApiResponseDataError('courseDeliveryConfig');
  }
  return {...course, courseLaunchVersion: config.courseLaunchVersion, launchState: config.launchState};
}
