import React, {useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {generatePath, Link} from 'react-router-dom';
import {APP_ROUTE_PATHS, STUDENT_LEARNING_PATH} from '@/configs/routePaths';
import {AdvisorTasksPanel} from './AdvisorTasksPanel';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import LearningScheduleComponent from '@/sections/learning_schedule/LearningScheduleComponent';
import {useCourseList} from '../hooks/useCourseList';
import {useDashboardAssignments, type AssignmentRow} from '../hooks/useDashboardAssignments';
import {dashboardExamActionLabel, resolveDashboardExamRoute} from './dashboardExam';
import InstructorWorkComponent from './InstructorWorkComponent';
import styles from './Dashboard.module.scss';
import {StudentDashboard} from './StudentDashboard';

export type DashboardAudience = 'student' | 'instructor';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const recordsFrom = (value: unknown): UnknownRecord[] => {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of ['content', 'items', 'data', 'results', 'alerts', 'tasks', 'exams']) {
    if (Array.isArray(value[key])) return value[key].filter(isRecord);
  }
  return [];
};

const textFrom = (record: UnknownRecord, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const numberFrom = (record: UnknownRecord, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
};

const formatLocalDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.replace('T', ' ').slice(0, 16);
  return new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric'}).format(parsed);
};

const humanize = (value: string): string =>
  value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/_/g, ' ').replace(/(^|\s)\S/g, letter => letter.toUpperCase());

const PanelHeader: React.FC<{title: string; to?: string}> = ({title, to}) => (
  <header className={styles.panelHeader}>
    <h2>{title}</h2>
    {to ? (
      <Link to={to} className={styles.viewAll}>
        View all
      </Link>
    ) : null}
  </header>
);

const RegionStatus: React.FC<{
  state: 'loading' | 'error' | 'empty';
  onRetry?: () => void;
  emptyMessage?: string;
}> = ({state, onRetry, emptyMessage}) => (
  <div className={styles.regionStatus} role={state === 'error' ? 'alert' : 'status'}>
    <span>
      {state === 'loading'
        ? 'Loading…'
        : state === 'error'
          ? 'This section could not be loaded.'
          : emptyMessage ?? 'Nothing needs your attention.'}
    </span>
    {state === 'error' && onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}
  </div>
);

const assignmentTone = (row: AssignmentRow): string => {
  const status = row.submissionStatus?.toLowerCase() ?? '';
  if (status.includes('submitted') || status.includes('graded')) return styles.successTag;
  if (status.includes('overdue') || status.includes('late')) return styles.dangerTag;
  return styles.warningTag;
};

const CourseWorkPanel: React.FC = () => {
  const {rows, isLoading, isError, refetch} = useDashboardAssignments();
  const {courses, isLoading: coursesLoading, isError: coursesError, refetch: refreshCourses} = useCourseList();
  const [courseId, setCourseId] = useState('all');
  const visibleRows = useMemo(
    () => rows.filter(row => courseId === 'all' || String(row.courseId) === courseId).slice(0, 4),
    [courseId, rows],
  );

  return (
    <section className={`${styles.panel} ${styles.courseWorkPanel}`} aria-labelledby="all-course-title">
      <header className={styles.courseFilterHeader}>
        <label>
          <span id="all-course-title" className={styles.srOnly}>Course filter</span>
          <select value={courseId} onChange={event => setCourseId(event.target.value)}>
            <option value="all">All courses</option>
            {courses.map(course => <option value={course.id} key={course.id}>{course.title || course.courseCode}</option>)}
          </select>
        </label>
        <Link to="/course" className={styles.viewAll}>
          View all
        </Link>
      </header>

      {isLoading ? <RegionStatus state="loading"/> : null}
      {isError ? <RegionStatus state="error" onRetry={refetch}/> : null}
      {coursesError ? <RegionStatus state="error" onRetry={refreshCourses}/> : null}
      {!isLoading && !isError && visibleRows.length === 0 ? coursesLoading ? <RegionStatus state="loading"/> : !coursesError ? <div className={styles.enrolledCourses}>
        {courses.filter(course => courseId === 'all' || String(course.id) === courseId).slice(0, 4).map(course => <Link key={course.id} className={styles.enrolledCourse} to={generatePath(APP_ROUTE_PATHS.courseCourseId, {courseId: String(course.id)})}>
          <span><strong>{course.title || course.courseCode}</strong><small>{course.courseCode} · No upcoming work</small></span>
          <span className={styles.outlineButton}>View course</span>
        </Link>)}
        {courses.length === 0 ? <RegionStatus state="empty" emptyMessage="No active courses. Visit My Courses to view your enrolments."/> : null}
      </div> : null : null}
      {!isLoading && !isError ? (
        <div className={styles.assignmentList}>
          {visibleRows.map((row, index) => {
            const status = row.submissionStatus ? humanize(row.submissionStatus) : 'View detail';
            const icon = index % 3 === 0 ? 'assignment-book' : 'assignment-clipboard';
            return (
              <Link to={row.destination} className={styles.assignmentRow} key={row.key}>
                <span className={`${styles.assignmentIcon} ${styles[`assignmentIcon${index % 3}`]}`}>
                  <img src={`/icons/figma-dashboard/${icon}.svg`} alt=""/>
                </span>
                <span className={styles.assignmentMain}>
                  <strong>{row.title}</strong>
                  <small>{row.courseCode}</small>
                </span>
                <span className={styles.assignmentMeta}>
                  <small>{formatLocalDate(row.atLocal)}</small>
                  {row.progress ? <span>{row.progress.submitted}/{row.progress.total} submitted</span> : null}
                </span>
                <span className={`${styles.statusTag} ${assignmentTone(row)}`}>{status}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};

const ExamsPanel: React.FC = () => {
  const query = useQuery({
    queryKey: ['dashboard', 'mock-exams'],
    queryFn: async () => (await mockExamApiService.listStudentExams()).data,
    retry: false,
  });
  const exams = recordsFrom(query.data).slice(0, 3);

  return (
    <section className={`${styles.panel} ${styles.examsPanel}`}>
      <PanelHeader title="Exams" to="/mock-exams"/>
      {query.isPending ? <RegionStatus state="loading"/> : null}
      {query.isError ? <RegionStatus state="error" onRetry={() => void query.refetch()}/> : null}
      {!query.isPending && !query.isError && exams.length === 0 ? <RegionStatus state="empty" emptyMessage="No mock exams have been assigned."/> : null}
      <div className={styles.examGrid}>
        {exams.map((exam, index) => {
          const title = textFrom(exam, 'title', 'label', 'templateTitle') ?? 'IELTS Mock Test';
          const status = textFrom(exam, 'status', 'attemptStatus') ?? 'Not started';
          const score = numberFrom(exam, 'score', 'overallScore', 'writingScore');
          const start = textFrom(exam, 'startedAt', 'scheduledAt', 'createdAt');
          const destination = resolveDashboardExamRoute(exam);
          const direct = destination !== '/mock-exams';
          return (
            <article className={styles.examCard} key={numberFrom(exam, 'id', 'testId') ?? `${title}-${index}`}>
              <strong>{title}</strong>
              <small>IELTS</small>
              <span className={`${styles.examStatus} ${status.toLowerCase().includes('progress') ? styles.examProgress : status.toLowerCase().includes('graded') ? styles.examGraded : ''}`}>{humanize(status)}</span>
              <p>{score === undefined ? (start ? `Start time: ${formatLocalDate(start)}` : 'Ready when you are') : `Score: ${score}`}</p>
              <Link to={destination}>
                {dashboardExamActionLabel(status, score, direct)}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
};

const AlertsPanel: React.FC<{audience: DashboardAudience}> = ({audience}) => {
  const query = useQuery({
    queryKey: ['dashboard', audience, 'alerts'],
    queryFn: async () => (await (audience === 'instructor'
      ? courseOperationsApiService.getMyTeachingAlerts()
      : courseOperationsApiService.getMyAlerts())).data,
    retry: false,
  });
  const alerts = recordsFrom(query.data).slice(0, 3);

  return (
    <section className={`${styles.panel} ${styles.alertsPanel}`}>
      <header className={styles.alertHeader}>
        <h2>Alerts</h2>
        <Link to={audience === 'student' ? STUDENT_LEARNING_PATH : APP_ROUTE_PATHS.myOperations}>{alerts.length} alert{alerts.length === 1 ? '' : 's'} </Link>
      </header>
      {query.isPending ? <RegionStatus state="loading"/> : null}
      {query.isError ? <RegionStatus state="error" onRetry={() => void query.refetch()}/> : null}
      {!query.isPending && !query.isError && alerts.length === 0 ? <RegionStatus state="empty" emptyMessage="No active alerts."/> : null}
      <div className={styles.alertList}>
        {alerts.map((alert, index) => (
          <Link to={audience === 'student' ? STUDENT_LEARNING_PATH : APP_ROUTE_PATHS.myOperations} key={textFrom(alert, 'id', 'alertId') ?? index}>
            <span>{textFrom(alert, 'title', 'message', 'type') ?? (audience === 'instructor' ? 'Teaching update' : 'Learning update')}</span>
            <small>{textFrom(alert, 'relativeTime', 'createdAt', 'severity') ?? 'New'}</small>
            <i/>
          </Link>
        ))}
      </div>
    </section>
  );
};

export const Dashboard: React.FC<{audience?: DashboardAudience}> = ({audience = 'student'}) => audience === 'student' ? <StudentDashboard/> : (
  <section className={styles.dashboard} aria-label={audience === 'instructor' ? 'Teaching dashboard' : 'Student dashboard'}>
    <div className={styles.mainColumn}>
      <CourseWorkPanel/>
      {audience === 'instructor'
        ? <section className={`${styles.panel} ${styles.instructorWorkPanel}`}><InstructorWorkComponent/></section>
        : <><AdvisorTasksPanel/><ExamsPanel/></>}
    </div>
    <div className={styles.sideColumn}>
      <section className={`${styles.panel} ${styles.schedulePanel}`}>
        <LearningScheduleComponent/>
      </section>
      <AlertsPanel audience={audience}/>
    </div>
  </section>
);
