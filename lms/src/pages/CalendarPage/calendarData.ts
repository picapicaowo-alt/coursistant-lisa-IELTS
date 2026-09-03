import {addDays, format, parseISO} from 'date-fns';
import {unwrapData} from '@/apis';
import type {MyCourse} from '@/apis';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {calendarOccurrences} from './calendarOccurrences';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {courseApiService} from '@/apis/services/course-api';
import {dashboardApiService} from '@/apis/services/dashboard-api';
import {quizApiService} from '@/apis/services/quiz-api';

export type CalendarItemKind = 'Session' | 'Assignment' | 'Quiz' | 'Event' | 'Personal';

export interface CalendarItem {
  id: string;
  sourceId: number;
  courseId?: number;
  courseCode: string;
  courseTitle: string;
  title: string;
  kind: CalendarItemKind;
  date: string;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  location: string | null;
  path?: string;
}

export interface CalendarWindowData {
  courses: Array<Pick<MyCourse, 'id' | 'courseCode' | 'title'>>;
  items: CalendarItem[];
  failures: string[];
}

const localDate = (value: string) => value.slice(0, 10);
const localTime = (value: string) => value.length > 10 ? value.slice(11, 16) : null;

const loadAllActiveCourses = async (): Promise<MyCourse[]> => {
  const first = unwrapData(
    await dashboardApiService.getMyCourses({state: 'Active', page: 0, size: 100}),
    'getMyCourses page 0 for calendar',
  );
  if (first.total <= first.items.length) return first.items;

  const pageCount = Math.ceil(first.total / 100);
  const remaining = await Promise.all(Array.from({length: pageCount - 1}, (_, index) => (
    dashboardApiService.getMyCourses({state: 'Active', page: index + 1, size: 100})
  )));
  return [first, ...remaining.map((response, index) => unwrapData(response, `getMyCourses page ${index + 1} for calendar`))]
    .flatMap(page => page.items);
};

export const loadCalendarWindow = async (windowStart: string, windowEnd: string): Promise<CalendarWindowData> => {
  const [courses, dated] = await Promise.all([loadAllActiveCourses(), courseOperationsApiService.getMyCalendar({from: windowStart, to: format(addDays(parseISO(windowEnd), 1), 'yyyy-MM-dd'), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone}).then(response => ({value: unwrapData(response, 'myCalendar'), failed: false})).catch(() => ({value: null, failed: true}))]);
  const occurrences = calendarOccurrences(dated.value, courses, windowStart, windowEnd);
  const courseResults = await Promise.all(courses.map(async course => {
    const sourceNames = ['assignments', 'quizzes', 'events'] as const;
    const results = await Promise.allSettled([
      assignmentApiService.getCourseAssignmentSummaries(course.id),
      quizApiService.listQuizzes(course.id),
      courseApiService.listCourseEvents(course.id),
    ]);
    const failures = results.flatMap((result, index) => result.status === 'rejected'
      ? [`${course.courseCode}: ${sourceNames[index]} could not be loaded`]
      : []);
    const items: CalendarItem[] = [];

    if (results[0].status === 'fulfilled') {
      unwrapData(results[0].value, `course ${course.id} assignments`).forEach(assignment => {
        const date = localDate(assignment.dueAtLocal);
        if (date < windowStart || date > windowEnd) return;
        items.push({
          id: `assignment-${course.id}-${assignment.id}`,
          sourceId: assignment.id,
          courseId: course.id,
          courseCode: course.courseCode,
          courseTitle: course.title,
          title: assignment.title,
          kind: 'Assignment',
          date,
          startTime: localTime(assignment.dueAtLocal),
          endTime: null,
          timezone: assignment.timezone,
          location: null,
          path: `/course/${course.id}/assignments/${assignment.id}`,
        });
      });
    }

    if (results[1].status === 'fulfilled') {
      unwrapData(results[1].value, `course ${course.id} quizzes`)
        .filter(quiz => quiz.state === 'Published')
        .forEach(quiz => {
          const date = localDate(quiz.closesAtLocal);
          if (date < windowStart || date > windowEnd) return;
          items.push({
            id: `quiz-${course.id}-${quiz.id}`,
            sourceId: quiz.id,
            courseId: course.id,
            courseCode: course.courseCode,
            courseTitle: course.title,
            title: quiz.title,
            kind: 'Quiz',
            date,
            startTime: localTime(quiz.closesAtLocal),
            endTime: null,
            timezone: quiz.timezone,
            location: null,
            path: `/course/${course.id}/quizzes/${quiz.id}`,
          });
        });
    }

    if (results[2].status === 'fulfilled') {
      unwrapData(results[2].value, `course ${course.id} events`).forEach(event => {
        if (event.date < windowStart || event.date > windowEnd) return;
        items.push({
          id: `event-${course.id}-${event.id}`,
          sourceId: event.id,
          courseId: course.id,
          courseCode: course.courseCode,
          courseTitle: course.title,
          title: event.name,
          kind: 'Event',
          date: event.date,
          startTime: event.startTime?.slice(0, 5) ?? null,
          endTime: event.endTime?.slice(0, 5) ?? null,
          timezone: event.timezone,
          location: event.location,
          path: `/course/${course.id}/events/${event.id}`,
        });
      });
    }

    return {items, failures};
  }));

  return {
    courses: courses.map(({id, courseCode, title}) => ({id, courseCode, title})),
    items: [...occurrences.items, ...courseResults.flatMap(result => result.items)].sort((a, b) => (
      `${a.date}T${a.startTime ?? '23:59'}`.localeCompare(`${b.date}T${b.startTime ?? '23:59'}`)
    )),
    failures: [...courseResults.flatMap(result => result.failures), ...(dated.failed ? ['Scheduled classes could not be loaded'] : []), ...(occurrences.unavailableCount ? [`${occurrences.unavailableCount} scheduled class records lack required calendar details`] : [])],
  };
};
