import {formatDateTime, formatDateRange, formatDateValue, formatClockTime} from '@/i18n/formatting';
import { useTranslation } from 'react-i18next';
import {useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {addDays, addWeeks, format, isSameDay, startOfWeek} from 'date-fns';
import {generatePath, Link} from 'react-router-dom';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {ADVISOR_PAGE_SIZE} from '@/apis/types/advisorWorkspace';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {contractItems} from './advisorViewModels';
import styles from './AdvisorLearningSchedule.module.scss';

async function loadOwnedCourseSchedule(from: string, to: string) {
  const first = unwrapData(await advisorApiService.listOwnedCourses({page: 0, size: ADVISOR_PAGE_SIZE, lifecycleState: 'Active'}), 'advisorListOwnedCourses');
  const pages = await Promise.all(Array.from({length: Math.max(0, Math.ceil(first.total / ADVISOR_PAGE_SIZE) - 1)}, (_, index) => advisorApiService.listOwnedCourses({page: index + 1, size: ADVISOR_PAGE_SIZE, lifecycleState: 'Active'}).then(response => unwrapData(response, 'advisorListOwnedCourses'))));
  const courses = [first, ...pages].flatMap(page => page.items);
  const responses = await Promise.allSettled(courses.map(course => courseOperationsApiService.listSessionOccurrences(course.courseId, {from, to, includeHistory: false}).then(response => unwrapData(response, 'listSessionOccurrences'))));
  let unavailable = 0;
  const sessions = responses.flatMap((response, index) => {
    if (response.status === 'rejected') { unavailable++; return []; }
    const course = courses[index];
    return contractItems(response.value).flatMap(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const row = value as Record<string, unknown>;
      const id = row.occurrenceId ?? row.id;
      if (typeof id !== 'number' || typeof row.occurrenceDate !== 'string' || typeof row.startTime !== 'string') { unavailable++; return []; }
      if (row.status === 'CANCELLED' || row.occurrenceDate < from || row.occurrenceDate >= to) return [];
      return [{id, courseId: course.courseId, title: course.title || course.courseCode || '', date: row.occurrenceDate, start: row.startTime.slice(0, 5), end: typeof row.endTime === 'string' ? row.endTime.slice(0, 5) : undefined}];
    });
  }).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  return {sessions, unavailable};
}

/** Advisors use dated occurrences for courses they own, not the student-only activity feed. */
export function AdvisorLearningSchedule() {
  const { t: translate } = useTranslation();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string>();
  const week = useMemo(() => startOfWeek(cursor, {weekStartsOn: 1}), [cursor]);
  const from = format(week, 'yyyy-MM-dd');
  const to = format(addDays(week, 7), 'yyyy-MM-dd');
  const query = useQuery({queryKey: ['advisor', 'owned-course-schedule', from, to], queryFn: () => loadOwnedCourseSchedule(from, to), retry: false});
  const sessions = query.data?.sessions.filter(session => !selected || session.date === selected) ?? [];
  return <WorkspaceSection title={translate("dashboard:schedule.title")} bodyClassName={styles.body}>
    <div className={styles.weekNavigation}><button type="button" aria-label={translate('common:navigationControls.previousWeek')} title={translate('common:navigationControls.previousWeek')} onClick={() => {setCursor(addWeeks(cursor, -1)); setSelected(undefined);}}><ChevronLeft size={16} aria-hidden="true"/></button><span>{formatDateRange(week, addDays(week, 6), {month: 'short', day: 'numeric', year: 'numeric'})}</span><button type="button" aria-label={translate('common:navigationControls.nextWeek')} title={translate('common:navigationControls.nextWeek')} onClick={() => {setCursor(addWeeks(cursor, 1)); setSelected(undefined);}}><ChevronRight size={16} aria-hidden="true"/></button></div>
    <div className={styles.days}>{Array.from({length: 7}, (_, index) => {const date = addDays(week, index); const key = format(date, 'yyyy-MM-dd'); return <div key={key}><span>{formatDateTime(date, {weekday: 'narrow'})}</span><button type="button" aria-label={formatDateTime(date, {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'})} aria-pressed={selected === key} aria-current={isSameDay(date, new Date()) ? 'date' : undefined} data-event={query.data?.sessions.some(session => session.date === key) || undefined} onClick={() => setSelected(current => current === key ? undefined : key)}>{formatDateTime(date, {day: 'numeric'})}</button></div>;})}</div>
    {query.isPending ? <p className={styles.status}>{translate("dashboard:loadingSchedule")}</p> : query.isError ? <p role="alert" className={styles.status}>{translate("advising:scheduling.scheduleFailed")}{' '}<button type="button" onClick={() => void query.refetch()}>{translate("common:actions.retry")}</button></p> : <>
      {query.data?.unavailable ? <p className={styles.status} role="alert">{translate("advising:scheduling.partialSchedule")}{' '}<button type="button" onClick={() => void query.refetch()}>{translate("common:actions.retry")}</button></p> : null}
      <div className={styles.timeline}>{sessions.length ? sessions.map(session => <Link key={`${session.courseId}-${session.id}`} to={generatePath(APP_ROUTE_PATHS.advisorCoursesCourseIdDelivery, {courseId: String(session.courseId)})}><i aria-hidden="true"/><div><small>{session.date === format(new Date(), 'yyyy-MM-dd') ? translate("common:dateTime.today") : formatDateValue(session.date, {month: 'short', day: 'numeric', weekday: 'short'})}</small><strong>{session.title || translate("advising:scheduling.courseSession")}</strong><span>{formatClockTime(session.start)}{session.end ? ` – ${formatClockTime(session.end)}` : ''}</span></div></Link>) : !query.data?.unavailable ? <p className={styles.status}>{selected ? translate("advising:scheduling.noDaySessions") : translate("advising:scheduling.noWeekSessions")}</p> : null}</div>
    </>}
    <Link className={styles.manage} to={APP_ROUTE_PATHS.advisorSchedule}>{translate('common:navigationControls.manageScheduleRequests')} </Link>
  </WorkspaceSection>;
}
