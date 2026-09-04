import {useEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {generatePath, Link} from 'react-router-dom';
import {Bell, BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, ClipboardList, GraduationCap} from 'lucide-react';
import {unwrapData} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {advisorApiService} from '@/apis/services/advisor-api';
import {CourseIdentityCard} from '@/components/CourseIdentityCard';
import {AssignmentProgress} from '@/components/AssignmentProgress';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {LearningBadge, LearningEmpty, LearningQueryState} from '@/components/LearningWorkspace';
import {asRecord, collection} from '@/components/RecordSummaryList/recordPresentation';
import {useStudentProgress} from '@/hooks/useStudentProgress';
import {APP_ROUTE_PATHS, STUDENT_LEARNING_PATH, STUDY_PLAN_QUERY_PARAMS} from '@/configs/routePaths';
import {advisingQueryKeys} from '@/pages/advising/queryKeys';
import {studyPlanRecordKey} from '@/pages/StudentAdvisingPage/studyPlanView';
import {formatPlanDate, TASK_STATUS, taskStatusLabel} from '@/utils/studyPlan';
import {isNotFound} from '@/utils/apiError';
import LearningScheduleComponent from '@/sections/learning_schedule/LearningScheduleComponent';
import {useCourseList} from '../hooks/useCourseList';
import type {DashboardCourse} from '../types';
import {dashboardExamActionLabel, resolveDashboardExamRoute} from './dashboardExam';
import s from './StudentDashboard.module.scss';

const PREVIEW_LIMIT = 3;
const TASK_PREVIEW_LIMIT = 4;
const DAY_LABELS: Record<string, string> = {MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun'};
const viewAll = (to: string) => <Link className={s.textLink} to={to}>View all <ChevronRight size={15} aria-hidden="true"/></Link>;

function DashboardCourseCard({course}: {course: DashboardCourse}) {
  const progress = useStudentProgress(true);
  const sessions = useQuery({queryKey: ['course-sessions', course.id], queryFn: async () => unwrapData(await courseApiService.getCourseSessions(course.id), 'course sessions'), staleTime: 300_000, retry: false});
  const session = sessions.data?.[0];
  return <CourseIdentityCard courseId={course.id} title={course.title || course.courseCode}
    icon={<BookOpen size={23} aria-hidden="true"/>} code={course.courseCode} instructor={course.instructorName ?? undefined}
    metadata={<span className={s.schedule}><CalendarDays size={15} aria-hidden="true"/>{sessions.isError ? <button type="button" onClick={() => void sessions.refetch()}>Retry schedule</button> : session ? `${DAY_LABELS[session.dayOfWeek] ?? session.dayOfWeek} · ${session.startTime.slice(0, 5)}–${session.endTime.slice(0, 5)}` : sessions.isPending ? 'Loading schedule…' : 'No schedule published'}</span>}
    actions={<Link to={generatePath(APP_ROUTE_PATHS.courseCourseId, {courseId: String(course.id)})} aria-label={`${course.title}: View course`}>View course <ChevronRight size={14} aria-hidden="true"/></Link>}>
    <AssignmentProgress progress={progress.data?.courses?.find(item => item.courseId === course.id)} loading={progress.isPending} failed={progress.isError}/>
  </CourseIdentityCard>;
}

function DashboardCourses() {
  const query = useCourseList();
  const strip = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({previous: false, next: false});
  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    const update = () => setPosition({previous: element.scrollLeft > 2, next: element.scrollLeft + element.clientWidth < element.scrollWidth - 2});
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update, {passive: true});
    update();
    return () => {observer.disconnect(); element.removeEventListener('scroll', update);};
  }, [query.courses.length]);
  const move = (direction: number) => strip.current?.scrollBy({left: direction * strip.current.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  return <WorkspaceSection title="My courses" appearance="record" meta={viewAll(APP_ROUTE_PATHS.course)} className={s.courses} bodyClassName={s.courseBody}>
    <LearningQueryState query={{...query, isPending: query.isLoading}}/>
    {!query.isLoading && !query.isError && !query.courses.length ? <LearningEmpty icon={BookOpen} title="No active courses" description="Your enrolled courses will appear here."/> : null}
    <div className={s.courseStrip} ref={strip} aria-label="Active courses">{query.courses.map(course => <DashboardCourseCard key={course.id} course={course}/>)}</div>
    {position.previous || position.next ? <nav className={s.carouselNav} aria-label="Course cards"><button type="button" aria-label="Previous courses" disabled={!position.previous} onClick={() => move(-1)}><ChevronLeft size={18}/></button><span>{query.courses.length} active courses</span><button type="button" aria-label="Next courses" disabled={!position.next} onClick={() => move(1)}><ChevronRight size={18}/></button></nav> : null}
  </WorkspaceSection>;
}

function DashboardTasks() {
  const [expanded, setExpanded] = useState(false);
  const query = useQuery({queryKey: advisingQueryKeys.studentStudyPlan, queryFn: async () => unwrapData(await advisorApiService.getOwnStudyPlan(), 'student study plan'), retry: false});
  const tasks = (query.data?.plan?.checkpoints ?? []).flatMap((checkpoint, index) => (checkpoint.tasks ?? []).map((task, taskIndex) => {
    const key = studyPlanRecordKey(checkpoint, index);
    const params = new URLSearchParams({[STUDY_PLAN_QUERY_PARAMS.checkpoint]: key});
    if (task.id != null) params.set(STUDY_PLAN_QUERY_PARAMS.task, String(task.id));
    return {task, key: `${key}-${task.id ?? taskIndex}`, checkpoint: checkpoint.description || checkpoint.goal, to: `${APP_ROUTE_PATHS.myPlan}?${params}`};
  })).sort((a, b) => Number(a.task.status === TASK_STATUS.completed) - Number(b.task.status === TASK_STATUS.completed) || (a.task.dueDate ?? '9999').localeCompare(b.task.dueDate ?? '9999'));
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const missingPlan = query.isError && isNotFound(query.error);
  return <WorkspaceSection title="Advisor Tasks" appearance="record" meta={viewAll(`${APP_ROUTE_PATHS.myPlan}?view=tasks`)}>
    {!missingPlan ? <LearningQueryState query={query}/> : null}
    {(!query.isPending && !query.isError || missingPlan) && !tasks.length ? <LearningEmpty icon={ClipboardList} title="No advisor tasks right now" description="Your next steps will appear when your advisor updates your plan."/> : null}
    <div className={s.taskList}>{tasks.slice(0, expanded ? TASK_PREVIEW_LIMIT * 2 : TASK_PREVIEW_LIMIT).map(({task, key, to, checkpoint}) => {
      const completed = task.status === TASK_STATUS.completed;
      const overdue = !completed && Boolean(task.dueDate && task.dueDate.slice(0, 10) < todayKey);
      return <Link className={s.task} to={to} key={key}>
        <span className={s.taskIcon} data-complete={completed || undefined}>{completed ? <CheckCircle2 size={21}/> : <Circle size={21}/>}</span>
        <span className={s.taskCopy}><strong>{task.title || 'Learning task'}</strong>{checkpoint ? <small>{checkpoint}</small> : null}</span>
        <span className={s.taskMeta}><LearningBadge value={overdue ? 'OVERDUE' : task.status} label={overdue ? 'Overdue' : taskStatusLabel(task.status)}/><small>{formatPlanDate(task.dueDate)}</small></span>
        <span className={s.taskAction}>{task.advisorFeedback ? 'View feedback' : completed ? 'View detail' : 'Open'}<ChevronRight size={14} aria-hidden="true"/></span>
      </Link>;
    })}</div>
    {tasks.length > TASK_PREVIEW_LIMIT ? <button className={s.showMore} type="button" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show fewer tasks' : 'Show more tasks'}</button> : null}
  </WorkspaceSection>;
}

function DashboardExams() {
  const query = useQuery({queryKey: ['dashboard', 'mock-exams'], queryFn: async () => unwrapData(await mockExamApiService.listStudentExams(), 'student exams'), retry: false});
  const exams = (collection(query.data) ?? []).flatMap(value => {const item = asRecord(value); return item ? [item] : [];});
  return <WorkspaceSection title="Exams" appearance="record" meta={viewAll(APP_ROUTE_PATHS.mockExams)}>
    <LearningQueryState query={query}/>
    {!query.isPending && !query.isError && !exams.length ? <LearningEmpty icon={GraduationCap} title="No mock exams have been assigned." description="Check back here for updates."/> : null}
    <div className={s.examList}>{exams.slice(0, PREVIEW_LIMIT).map((exam, index) => {
      const title = String(exam.title ?? exam.templateTitle ?? 'IELTS Mock Test');
      const status = String(exam.status ?? exam.attemptStatus ?? 'Not started');
      const destination = resolveDashboardExamRoute(exam);
      return <Link to={destination} key={String(exam.id ?? index)} className={s.exam}><span className={s.examIcon}><GraduationCap size={22}/></span><span><strong>{title}</strong><LearningBadge value={status}/></span><span className={s.textLink}>{dashboardExamActionLabel(status, typeof exam.score === 'number' ? exam.score : undefined, destination !== APP_ROUTE_PATHS.mockExams)}<ChevronRight size={15}/></span></Link>;
    })}</div>
  </WorkspaceSection>;
}

function DashboardAlerts() {
  const query = useQuery({queryKey: ['me', 'alerts'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyAlerts(), 'my alerts'), retry: false});
  const alerts = (collection(query.data) ?? []).flatMap(value => {const item = asRecord(value); return item ? [item] : [];});
  return <WorkspaceSection title="Alerts" appearance="record" meta={query.isSuccess ? <Link className={s.textLink} to={`${STUDENT_LEARNING_PATH}&learningDetail=alerts`}>{alerts.length} alerts <ChevronRight size={15}/></Link> : undefined}>
    <LearningQueryState query={query}/>
    {query.isSuccess && !alerts.length ? <LearningEmpty icon={Bell} title="No active alerts."/> : null}
    <div className={s.alertList}>{alerts.slice(0, PREVIEW_LIMIT).map((alert, index) => <Link to={`${STUDENT_LEARNING_PATH}&learningDetail=alerts`} key={String(alert.id ?? index)}><Bell size={17}/><span>{String(alert.title ?? alert.message ?? 'Learning update')}</span><ChevronRight size={16}/></Link>)}</div>
  </WorkspaceSection>;
}

export function StudentDashboard() {
  return <section className={s.dashboard} aria-label="Student dashboard">
    <div className={s.main}><DashboardCourses/><DashboardTasks/><DashboardExams/></div>
    <aside className={s.side} aria-label="Schedule and alerts"><section className={s.schedulePanel}><LearningScheduleComponent spacious/></section><DashboardAlerts/></aside>
  </section>;
}
