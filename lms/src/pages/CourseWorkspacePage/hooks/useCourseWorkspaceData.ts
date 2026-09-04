import {useParams} from 'react-router-dom';
import {useQueries} from '@tanstack/react-query';
import {AssignmentSummary, CourseAnnouncementSummary, CourseEvent, CourseGroupSet, CourseResponse, CourseSession, CourseWeek, QuizResponse, unwrapData} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {quizApiService} from '@/apis/services/quiz-api';

/**
 * Everything the course workspace renders.
 *
 * Four independent requests, because that is how the API is shaped — there is
 * no endpoint that returns a course with its contents. They run in parallel
 * and are cached separately, so the schedule and the assignment list do not
 * hold up the outline.
 *
 * Course and weeks are required to render anything and are reported as one
 * loading/error pair. Sessions and assignments each fill a single card, so a
 * failure there is left to that card rather than failing the page.
 */
export interface CourseWorkspaceData {
  /** Null on routes with no course in the path, such as course creation. */
  courseId: number | null;
  course?: CourseResponse;
  weeks: CourseWeek[];
  sessions: CourseSession[];
  assignments: AssignmentSummary[];
  quizzes: QuizResponse[];
  events: CourseEvent[];
  groupSets: CourseGroupSet[];
  announcements: CourseAnnouncementSummary[];
  isLoading: boolean;
  isError: boolean;
  isUnavailable: boolean;
  sessionsFailed: boolean;
  assignmentsFailed: boolean;
  assignmentsLoading?: boolean;
  quizzesLoading?: boolean;
  quizzesFailed: boolean;
  eventsFailed: boolean;
  groupSetsFailed: boolean;
  announcementsFailed: boolean;
  refetch: () => void;
}

const FIVE_MINUTES = 5 * 60 * 1000;
const EMPTY_WEEKS: CourseWeek[] = [];
const EMPTY_SESSIONS: CourseSession[] = [];
const EMPTY_ASSIGNMENTS: AssignmentSummary[] = [];
const EMPTY_QUIZZES: QuizResponse[] = [];
const EMPTY_EVENTS: CourseEvent[] = [];
const EMPTY_GROUP_SETS: CourseGroupSet[] = [];
const EMPTY_ANNOUNCEMENTS: CourseAnnouncementSummary[] = [];

const shared = {
  staleTime: FIVE_MINUTES,
  gcTime: FIVE_MINUTES,
  retry: (failureCount: number, error: unknown) => (
    ![403, 404].includes((error as {code?: number} | null)?.code ?? 0)
    && failureCount < 1
  ),
} as const;

export const useCourseWorkspaceData = (): CourseWorkspaceData => {
  const {courseId} = useParams();

  // No id means this is not a course route — the create screen shares these
  // components and has nothing to load yet. Reporting it as an error state
  // rather than throwing matters: a throw during render unmounts the tree
  // through the error boundary, which is what made the page appear and then
  // vanish.
  const parsed = courseId ? parseInt(courseId, 10) : NaN;
  const id = Number.isNaN(parsed) ? null : parsed;
  const enabled = id !== null;

  const [course, weeks, sessions, assignments, quizzes, events, groupSets, announcements] = useQueries({
    queries: [
      {
        queryKey: ['course', id],
        queryFn: async () => unwrapData(await courseApiService.getCourse(id!), 'getCourse'),
        enabled,
        ...shared,
      },
      {
        queryKey: ['course-weeks', id],
        queryFn: async () => unwrapData(await courseApiService.getCourseWeeks(id!), 'getCourseWeeks'),
        enabled,
        ...shared,
      },
      {
        queryKey: ['course-sessions', id],
        queryFn: async () => (await courseApiService.getCourseSessions(id!)).data ?? [],
        enabled,
        ...shared,
      },
      {
        queryKey: ['course-assignments', id],
        queryFn: async () =>
          (await assignmentApiService.getCourseAssignmentSummaries(id!)).data ?? [],
        enabled,
        ...shared,
      },
      {
        queryKey: ['course-quizzes', id],
        queryFn: async () => (await quizApiService.listQuizzes(id!)).data ?? [],
        enabled,
        ...shared,
      },
      {
        queryKey: ['course-events', id],
        queryFn: async () => unwrapData(await courseApiService.listCourseEvents(id!), 'listCourseEvents'),
        enabled,
        ...shared,
      },
      {
        queryKey: ['course-group-sets', id],
        queryFn: async () => unwrapData(await courseApiService.listGroupSets(id!), 'listGroupSets'),
        enabled,
        ...shared,
      },
      {
        queryKey: ['course-announcements', id],
        queryFn: async () => unwrapData(await courseApiService.listAnnouncements(id!), 'listAnnouncements'),
        enabled,
        ...shared,
      },
    ],
  });

  return {
    courseId: id,
    course: course.data,
    // Stable fallbacks matter here. useCourseEdit depends on `weeks` and
    // mirrors it into a Zustand store; allocating a fresh [] while the weeks
    // request is pending makes that effect write on every store-triggered
    // render and eventually hits React's maximum update depth.
    weeks: weeks.data ?? EMPTY_WEEKS,
    sessions: sessions.data ?? EMPTY_SESSIONS,
    assignments: assignments.data ?? EMPTY_ASSIGNMENTS,
    quizzes: quizzes.data ?? EMPTY_QUIZZES,
    events: events.data ?? EMPTY_EVENTS,
    groupSets: groupSets.data ?? EMPTY_GROUP_SETS,
    announcements: announcements.data ?? EMPTY_ANNOUNCEMENTS,
    // A disabled query stays pending forever, so without an id this would
    // otherwise report a load that never finishes.
    isLoading: enabled && (course.isPending || weeks.isPending),
    isError: !enabled || course.isError || weeks.isError,
    isUnavailable: [course.error, weeks.error].some(
      error => [403, 404].includes((error as {code?: number} | null)?.code ?? 0),
    ),
    sessionsFailed: sessions.isError,
    assignmentsFailed: assignments.isError,
    assignmentsLoading: assignments.isPending,
    quizzesLoading: quizzes.isPending,
    quizzesFailed: quizzes.isError,
    eventsFailed: events.isError,
    groupSetsFailed: groupSets.isError,
    announcementsFailed: announcements.isError,
    refetch: () => {
      void course.refetch();
      void weeks.refetch();
      void sessions.refetch();
      void assignments.refetch();
      void quizzes.refetch();
      void events.refetch();
      void groupSets.refetch();
      void announcements.refetch();
    },
  };
};
