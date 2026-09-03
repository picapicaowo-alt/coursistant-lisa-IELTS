import {isHttpStatus} from '@/utils/apiError';
import {useQuery} from '@tanstack/react-query';
import type {MyCourse, StudentCourseView} from '@/apis';
import {unwrapData} from '@/apis';
import {dashboardApiService, DASHBOARD_LIMITS} from '@/apis/services/dashboard-api';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {deriveCourseAccess} from '@/utils/courseAccess';

const FIVE_MINUTES = 5 * 60 * 1000;

export const myCoursesQueryKey = (userId: number) => ['my-courses', userId] as const;

/**
 * Loads every course enrollment available from `/v2/me/courses`.
 *
 * The first page tells us the total. Remaining pages can then be loaded in
 * parallel, keeping course cards and course-level permission checks on one
 * shared React Query cache entry.
 */
const loadMyCourses = async (courseView?: StudentCourseView): Promise<MyCourse[]> => {
  const pageSize = DASHBOARD_LIMITS.coursePageSize.max;
  const firstPage = unwrapData(
    await dashboardApiService.getMyCourses({page: 0, size: pageSize, courseView}),
    'getMyCourses page 0'
  );

  if (!Array.isArray(firstPage.items)) {
    throw new Error('Malformed response from /v2/me/courses: missing items');
  }

  const pageCount = Math.ceil(firstPage.total / pageSize);
  if (pageCount <= 1) return firstPage.items;

  const remainingPages = await Promise.all(
    Array.from({length: pageCount - 1}, async (_, index) => {
      const page = index + 1;
      const response = unwrapData(
        await dashboardApiService.getMyCourses({page, size: pageSize, courseView}),
        `getMyCourses page ${page}`
      );
      if (!Array.isArray(response.items)) {
        throw new Error(`Malformed response from /v2/me/courses page ${page}: missing items`);
      }
      return response.items;
    })
  );

  return [firstPage.items, ...remainingPages].flat();
};

export const useMyCourses = (courseView?: StudentCourseView) => {
  const {user} = useRequiredAuth();
  const isUserAccount = user.role === 'USER';

  return useQuery({
    queryKey: [...myCoursesQueryKey(user.id), 'enrollments', courseView ?? 'all'],
    queryFn: () => loadMyCourses(courseView),
    enabled: isUserAccount,
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
    retry: (attempt, error) => attempt < 2 && !isHttpStatus(error, 403) && !isHttpStatus(error, 404),
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export const useCourseAccess = (courseId: number | null) => {
  const {user} = useRequiredAuth();
  const query = useMyCourses();
  const resolvesFromMembership = user.role === 'USER';
  const membership = courseId === null
    ? undefined
    : query.data?.find(course => (course.id ?? course.courseId) === courseId);

  return {
    ...deriveCourseAccess(membership),
    membership,
    isLoading: resolvesFromMembership && query.isPending,
    isError: resolvesFromMembership && query.isError,
    isResolved: !resolvesFromMembership || query.isSuccess,
    refetch: () => void query.refetch(),
  };
};
