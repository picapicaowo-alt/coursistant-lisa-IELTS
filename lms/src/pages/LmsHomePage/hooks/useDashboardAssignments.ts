import {useQuery} from '@tanstack/react-query';
import {dashboardApiService} from '@/apis/services/dashboard-api';
import {SubmissionStatus, TeachingDeadline, UpcomingDeadline} from '@/apis';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {isInstructorLevel} from '@/utils/roleCapabilities';

/**
 * One row of the per-course list widget.
 *
 * Students and teaching staff see different things here — it is the only
 * widget whose contents change by role (design spec 4.2) — but both are a
 * course-scoped list of dated work, so they share a row shape and the widget
 * renders one list either way.
 */
export interface AssignmentRow {
  key: string;
  courseId: number;
  courseCode: string;
  title: string;
  /** Tenant wall-clock time, no offset. Render with `timezone` beside it. */
  atLocal: string;
  timezone: string;
  /** Students only. */
  submissionStatus?: SubmissionStatus;
  /** Teaching staff only: how many eligible students have submitted so far. */
  progress?: {submitted: number; total: number};
  assignmentId: number | null;
  /** Exact object destination; dashboard actions should not drop users at the course root. */
  destination: string;
}

const fromStudentDeadline = (d: UpcomingDeadline): AssignmentRow => ({
  key: `student-${d.courseId}-${d.assignmentId}`,
  courseId: d.courseId,
  courseCode: d.courseCode,
  title: d.title,
  atLocal: d.dueAtLocal,
  timezone: d.timezone,
  submissionStatus: d.submissionStatus,
  assignmentId: d.assignmentId,
  destination: `/course/${d.courseId}/assignments/${d.assignmentId}`,
});

const fromTeachingDeadline = (d: TeachingDeadline): AssignmentRow => {
  const objectId = d.kind === 'Quiz' ? d.quizId : d.assignmentId;
  if (objectId === null) {
    throw new Error(`Malformed teaching deadline: ${d.kind} is missing its id`);
  }

  return {
    key: `teaching-${d.kind}-${d.courseId}-${objectId}`,
    courseId: d.courseId,
    courseCode: d.courseCode,
    title: d.title,
    atLocal: d.atLocal,
    timezone: d.timezone,
    progress: {submitted: d.submittedCount, total: d.totalStudents},
    assignmentId: d.assignmentId,
    destination: d.kind === 'Quiz'
      ? `/course/${d.courseId}/quizzes/${objectId}`
      : `/course/${d.courseId}/assignments/${objectId}`,
  };
};

export interface DashboardAssignmentsResult {
  rows: AssignmentRow[];
  isInstructor: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Upcoming work for the dashboard's per-course list.
 *
 * Which endpoint runs depends on the platform level, and the choice is not
 * cosmetic: the teaching endpoints reject anyone whose level is not
 * INSTRUCTOR with 403, so calling the wrong one guarantees a failed region.
 *
 * Both default to a 14-day window. The server filters that window in UTC
 * rather than by tenant calendar days, so the boundary can look a day off from
 * the activities widget — that difference is in the API, not a bug here.
 */
export const useDashboardAssignments = (): DashboardAssignmentsResult => {
  const {user} = useRequiredAuth();
  const isInstructor = isInstructorLevel(user);

  const query = useQuery({
    queryKey: ['dashboard', 'assignments', user.id, isInstructor],
    queryFn: async (): Promise<AssignmentRow[]> => {
      if (isInstructor) {
        const response = await dashboardApiService.getTeachingDeadlines();
        if (!response.data) {
          throw new Error('Malformed response from /v2/me/teaching/deadlines/upcoming');
        }
        return response.data.map(fromTeachingDeadline);
      }

      const response = await dashboardApiService.getUpcomingDeadlines();
      if (!response.data) {
        throw new Error('Malformed response from /v2/me/assignments/upcoming');
      }
      return response.data.map(fromStudentDeadline);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    rows: query.data ?? [],
    isInstructor,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
};
