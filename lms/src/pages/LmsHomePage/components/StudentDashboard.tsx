import {useTranslation} from 'react-i18next';
import {formatWeekday, formatClockTime} from '@/i18n/formatting';
import {ADVISING_ERROR_CODES} from '@/apis';
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
import {isMissingResource} from '@/utils/apiError';
import LearningScheduleComponent from '@/sections/learning_schedule/LearningScheduleComponent';
import {useCourseList} from '../hooks/useCourseList';
import type {DashboardCourse} from '../types';
import {dashboardExamActionLabel, resolveDashboardExamRoute} from './dashboardExam';
import s from './StudentDashboard.module.scss';

const PREVIEW_LIMIT = 3;
const TASK_PREVIEW_LIMIT = 4;
function ViewAll({to}: {to: string}) {
  const {t} = useTranslation();
  return <Link className={s.textLink} to={to}>{t('common:actions.viewAll')}</Link>;
}

function DashboardCourseCard({course}: {course: DashboardCourse}) {
  const {t: translate} = useTranslation();
  const progress = useStudentProgress(true);
  const sessions = useQuery({queryKey: ['course-sessions', course.id], queryFn: async () => unwrapData(await courseApiService.getCourseSessions(course.id), 'course sessions'), staleTime: 300_000, retry: false});
  const session = sessions.data?.[0];
  return <CourseIdentityCard courseId={course.id} title={course.title || course.courseCode}
    icon={<BookOpen size={23} aria-hidden="true"/>} code={course.courseCode} instructor={course.instructorName ?? undefined}
    metadata={<span className={s.schedule}><CalendarDays size={15} aria-hidden="true"/>{sessions.isError ? <button type="button" onClick={() => void sessions.refetch()}>{translate("dashboard:retrySchedule")}</button> : session ? `${formatWeekday(session.dayOfWeek)} · ${formatClockTime(session.startTime)}–${formatClockTime(session.endTime)}` : sessions.isPending ? translate("dashboard:loadingSchedule") : translate("dashboard:noSchedule")}</span>}
    actions={<Link to={generatePath(APP_ROUTE_PATHS.courseCourseId, {courseId: String(course.id)})} aria-label={translate('dashboard:viewNamedCourse', {title: course.title})}>{translate("dashboard:viewCourse")}</Link>}>
    <AssignmentProgress progress={progress.data?.courses?.find(item => item.courseId === course.id)} loading={progress.isPending} failed={progress.isError}/>
  </CourseIdentityCard>;
}

function DashboardCourses() {
  const {t: translate} = useTranslation();
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
  return <WorkspaceSection title={translate("dashboard:myCourses")} appearance="record" meta={<ViewAll to={APP_ROUTE_PATHS.course}/>} className={s.courses} bodyClassName={s.courseBody}>
    <LearningQueryState query={{...query, isPending: query.isLoading}}/>
    {!query.isLoading && !query.isError && !query.courses.length ? <LearningEmpty icon={BookOpen} title={translate("dashboard:noActiveCourses")} description={translate("dashboard:enrolmentHelp")}/> : null}
    <div className={s.courseStrip} ref={strip} aria-label={translate("dashboard:activeCourses")}>{query.courses.map(course => <DashboardCourseCard key={course.id} course={course}/>)}</div>
    {position.previous || position.next ? <nav className={s.carouselNav} aria-label={translate("dashboard:courseCards")}><button type="button" aria-label={translate("dashboard:previousCourses")} title={translate("dashboard:previousCourses")} disabled={!position.previous} onClick={() => move(-1)}><ChevronLeft size={18} aria-hidden="true"/></button><span>{translate('dashboard:activeCourseCount', {count: query.courses.length})}</span><button type="button" aria-label={translate("dashboard:nextCourses")} title={translate("dashboard:nextCourses")} disabled={!position.next} onClick={() => move(1)}><ChevronRight size={18} aria-hidden="true"/></button></nav> : null}
  </WorkspaceSection>;
}

function DashboardTasks() {
  const {t: translate} = useTranslation();
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
  const missingPlan = query.isError && isMissingResource(query.error, ADVISING_ERROR_CODES.studyPlanNotFound);
  return <WorkspaceSection title={translate("dashboard:advisorTasks")} appearance="record" meta={<ViewAll to={`${APP_ROUTE_PATHS.myPlan}?view=tasks`}/>}>
    {!missingPlan ? <LearningQueryState query={query}/> : null}
    {(!query.isPending && !query.isError || missingPlan) && !tasks.length ? <LearningEmpty icon={ClipboardList} title={translate("dashboard:noTasksHeading")} description={translate("dashboard:taskHelp")}/> : null}
    <div className={s.taskList}>{tasks.slice(0, expanded ? TASK_PREVIEW_LIMIT * 2 : TASK_PREVIEW_LIMIT).map(({task, key, to, checkpoint}) => {
      const completed = task.status === TASK_STATUS.completed;
      const overdue = !completed && Boolean(task.dueDate && task.dueDate.slice(0, 10) < todayKey);
      return <Link className={s.task} to={to} key={key}>
        <span className={s.taskIcon} data-complete={completed || undefined}>{completed ? <CheckCircle2 size={21}/> : <Circle size={21}/>}</span>
        <span className={s.taskCopy}><strong>{task.title || translate("dashboard:learningTask")}</strong>{checkpoint ? <small>{checkpoint}</small> : null}</span>
        <span className={s.taskMeta}><LearningBadge value={overdue ? 'OVERDUE' : task.status} label={overdue ? translate("common:status.OVERDUE") : taskStatusLabel(task.status)}/><small>{formatPlanDate(task.dueDate)}</small></span>
        <span className={s.taskAction}>{translate(task.advisorFeedback ? 'dashboard:viewFeedback' : completed ? 'common:actions.viewDetail' : 'common:actions.open')}</span>
      </Link>;
    })}</div>
    {tasks.length > TASK_PREVIEW_LIMIT ? <button className={s.showMore} type="button" onClick={() => setExpanded(value => !value)}>{expanded ? translate("dashboard:fewerTasks") : translate("dashboard:moreTasks")}</button> : null}
  </WorkspaceSection>;
}

function DashboardExams() {
  const {t: translate} = useTranslation();
  useTranslation();
  const query = useQuery({queryKey: ['dashboard', 'mock-exams'], queryFn: async () => unwrapData(await mockExamApiService.listStudentExams(), 'student exams'), retry: false});
  const exams = (collection(query.data) ?? []).flatMap(value => {const item = asRecord(value); return item ? [item] : [];});
  return <WorkspaceSection title={translate("navigation:exams")} appearance="record" meta={<ViewAll to={APP_ROUTE_PATHS.mockExams}/>}>
    <LearningQueryState query={query}/>
    {!query.isPending && !query.isError && !exams.length ? <LearningEmpty icon={GraduationCap} title={translate("dashboard:noMockExams")} description={translate("dashboard:checkUpdates")}/> : null}
    <div className={s.examList}>{exams.slice(0, PREVIEW_LIMIT).map((exam, index) => {
      const title = String(exam.title ?? exam.templateTitle ?? translate("dashboard:mockTest"));
      const status = String(exam.status ?? exam.attemptStatus ?? 'NOT_STARTED');
      const destination = resolveDashboardExamRoute(exam);
      return <Link to={destination} key={String(exam.id ?? index)} className={s.exam}><span className={s.examIcon}><GraduationCap size={22}/></span><span><strong>{title}</strong><LearningBadge value={status}/></span><span className={s.textLink}>{dashboardExamActionLabel(status, typeof exam.score === 'number' ? exam.score : undefined, destination !== APP_ROUTE_PATHS.mockExams)}</span></Link>;
    })}</div>
  </WorkspaceSection>;
}

function DashboardAlerts() {
  const {t: translate} = useTranslation();
  const query = useQuery({queryKey: ['me', 'alerts'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyAlerts(), 'my alerts'), retry: false});
  const alerts = (collection(query.data) ?? []).flatMap(value => {const item = asRecord(value); return item ? [item] : [];});
  return <WorkspaceSection title={translate("dashboard:alerts")} appearance="record" meta={query.isSuccess ? <Link className={s.textLink} to={`${STUDENT_LEARNING_PATH}&learningDetail=alerts`}>{translate('dashboard:alertCount', {count: alerts.length})} </Link> : undefined}>
    <LearningQueryState query={query}/>
    {query.isSuccess && !alerts.length ? <LearningEmpty icon={Bell} title={translate("dashboard:noAlerts")}/> : null}
    <div className={s.alertList}>{alerts.slice(0, PREVIEW_LIMIT).map((alert, index) => <Link to={`${STUDENT_LEARNING_PATH}&learningDetail=alerts`} key={String(alert.id ?? index)}><Bell size={17}/><span>{String(alert.title ?? alert.message ?? translate("dashboard:learningUpdate"))}</span><ChevronRight size={16}/></Link>)}</div>
  </WorkspaceSection>;
}

export function StudentDashboard() {
  const {t: translate} = useTranslation();
  return <section className={s.dashboard} aria-label={translate("dashboard:studentTitle")}>
    <div className={s.main}><DashboardCourses/><DashboardTasks/><DashboardExams/></div>
    <aside className={s.side} aria-label={translate("dashboard:scheduleAlerts")}><section className={s.schedulePanel}><LearningScheduleComponent spacious/></section><DashboardAlerts/></aside>
  </section>;
}
