import type {MyCourse} from '@/apis';
import {generatePath} from 'react-router-dom';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import type {CalendarItem} from './calendarData';
import {calendarLocalFields} from '@/utils/datetime';

/** Reuse the occurrence fields consumed by Learning operations. A recurring
 * template is not evidence that a class still takes place after rescheduling. */
export function calendarOccurrences(
  value: unknown,
  courses: Pick<MyCourse, 'id' | 'courseCode' | 'title'>[],
  from: string,
  to: string,
) {
  const envelope = object(value);
  const rows = Array.isArray(value)
    ? value
    : (envelope?.items ?? envelope?.content);
  const items: CalendarItem[] = [];
  let unavailableCount = 0;
  if (!Array.isArray(rows))
    return {items, unavailableCount: value == null ? 0 : 1};
  for (const value of rows) {
    const row = object(value);
    if (!row) {
      unavailableCount++;
      continue;
    }
    const id = row.occurrenceId ?? row.sessionOccurrenceId;
    // The unified feed also contains other kinds; their typed course endpoints
    // supply the assignment, quiz and event details below the timetable.
    if (id == null) continue;
    const course = courses.find((course) => course.id === row.courseId);
    const timezone = envelope?.timezone ?? row.timezone;
    const local = typeof row.startsAtUtc === 'string' && typeof timezone === 'string'
      ? calendarLocalFields(row.startsAtUtc, typeof row.endsAtUtc === 'string' ? row.endsAtUtc : undefined, timezone)
      : undefined;
    const date = local?.date ?? row.occurrenceDate ?? row.date;
    const startTime = local?.startTime ?? row.startTime;
    const endTime = local?.endTime ?? row.endTime;
    if (
      typeof id !== 'number' ||
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !course ||
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof startTime !== 'string' ||
      !/^\d{2}:\d{2}/.test(startTime) ||
      typeof timezone !== 'string' ||
      !timezone
    ) {
      unavailableCount++;
      continue;
    }
    if (date < from || date > to) continue;
    items.push({
      id: `occurrence-${id}`,
      sourceId: id,
      courseId: course.id,
      courseCode: course.courseCode,
      courseTitle: course.title,
      title:
        typeof row.title === 'string' && row.title ? row.title : course.title,
      kind: 'Session',
      date,
      startTime: startTime.slice(0, 5),
      endTime: typeof endTime === 'string' ? endTime.slice(0, 5) : null,
      timezone,
      location: typeof row.location === 'string' ? row.location : null,
      path: generatePath(APP_ROUTE_PATHS.courseCourseIdSchedule, {
        courseId: String(course.id),
      }),
    });
  }
  return {items, unavailableCount};
}
function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
