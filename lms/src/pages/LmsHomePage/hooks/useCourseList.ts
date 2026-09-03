import {formatCourseInstructor} from '@/utils/personName';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {COURSE_VIEWS} from '@/apis/types/dashboard';
import {MyCourse} from '@/apis';
import {useMyCourses} from '@/hooks/useCourseAccess';
import {DashboardCourse} from '../types';

const INSTRUCTOR_AVATAR_FALLBACK = ''; // No photo is supplied by the course summary contract.

/**
 * The dashboard card shows the instructor, so surface the name only when the
 * payload actually carries one. `primaryInstructor` can arrive as `userId`
 * alone when the user row is missing, and inventing a name there would be a
 * false state (PRIN-03).
 */
const toDashboardCourse = (course: MyCourse): DashboardCourse => ({
  id: course.id ?? course.courseId,
  courseCode: course.courseCode,
  title: course.title ?? course.name,
  courseRole: course.courseRole ?? course.role,
  instructorName: formatCourseInstructor(course.primaryInstructor) || null,
  instructorAvatar: INSTRUCTOR_AVATAR_FALLBACK,
  lectureTotal: course.lectureTotal,
  lectureCompleted: course.lectureCompleted,
});

export interface CourseListResult {
  courses: DashboardCourse[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * My Courses region of the dashboard (`GET /v2/me/courses`).
 *
 * Deliberately not a suspense query: the API contract requires each region to
 * fail on its own with an error and a retry, and a thrown suspense error would
 * take down neighbouring widgets instead. An empty list and a failed request
 * must stay distinguishable, so failures propagate as `isError` rather than
 * collapsing into `courses: []`.
 */
export const useCourseList = (): CourseListResult => {
  const {user} = useRequiredAuth();
  const student = user.level === 'STUDENT';
  const query = useMyCourses(student ? COURSE_VIEWS.current : undefined);
  const courses = (query.data ?? [])
    .filter(course => student || course.state == null || (course.state ?? course.status) === 'Active')
    .map(toDashboardCourse);

  return {
    courses,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error instanceof Error ? query.error : null,
    refetch: () => void query.refetch(),
  };
};
