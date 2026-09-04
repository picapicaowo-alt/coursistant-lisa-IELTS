import {lazy, Suspense, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link, useSearchParams} from 'react-router-dom';
import {ArrowLeft, ArrowRight, Bell, CalendarCheck2, CheckCircle2, ClipboardList, Clock3} from 'lucide-react';
import {unwrapData} from '@/apis';
import {courseOperationsApiService as api} from '@/apis/services/course-operations-api';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {ProgressRing} from '@/components/ProgressRing';
import {AssignmentProgress} from '@/components/AssignmentProgress';
import {LearningBadge, LearningEmpty, LearningQueryState} from '@/components/LearningWorkspace';
import {TeachingPagination} from '@/components/TeachingWorkspace';
import {useMyCourses} from '@/hooks/useCourseAccess';
import {useStudentProgress} from '@/hooks/useStudentProgress';
import {APP_ROUTE_PATHS, STUDY_PLAN_QUERY_PARAMS} from '@/configs/routePaths';
import {recordPage, optionalNumber, textValue, type OperationRecord} from '@/utils/operationRecords';
import {assignmentSummary, attendanceData, courseRecords, DETAIL_LABELS, LEARNING_PAGE_SIZE, LEARNING_PREVIEW_SIZE, learningDate, learningWorkDestination, type LearningDetail} from './learningData';
import {CourseLearningDetails} from './CourseLearningDetails';
import s from './index.module.scss';

const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const DETAIL_PARAM = 'learningDetail';
const COURSE_PARAM = 'learningCourse';

export default function StudentLearningPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'overview' | 'calendar'>('overview');
  const [page, setPage] = useState(0);
  const [progressPage, setProgressPage] = useState(0);
  const detailValue = params.get(DETAIL_PARAM);
  const detail = detailValue && Object.prototype.hasOwnProperty.call(DETAIL_LABELS, detailValue) ? detailValue as LearningDetail : undefined;
  const numericCourse = Number(params.get(COURSE_PARAM));
  const courseId = Number.isSafeInteger(numericCourse) && numericCourse > 0 ? numericCourse : undefined;
  const courses = useMyCourses();
  const progress = useStudentProgress(tab === 'overview');
  const attendance = useQuery({queryKey: ['student-learning', 'attendance', courseId], queryFn: async () => attendanceData(unwrapData(await api.getMyAttendance({courseId}), 'student attendance')), enabled: tab === 'overview', retry: false});
  const alerts = useQuery({queryKey: ['me', 'alerts'], queryFn: async () => unwrapData(await api.getMyAlerts(), 'my alerts'), select: data => recordPage(data).items, enabled: tab === 'overview', retry: false});
  const work = useQuery({queryKey: ['student-learning', 'work'], queryFn: async () => recordPage(unwrapData(await api.getMyWorkQueue(), 'student work queue')).items, enabled: tab === 'overview', retry: false});
  const requests = useQuery({queryKey: ['student-learning', 'requests'], queryFn: async () => recordPage(unwrapData(await api.getMyScheduleRequests(), 'schedule requests')).items, enabled: tab === 'overview', retry: false});
  const summary = assignmentSummary(progress.data, courseId);
  const courseProgress = (progress.data?.courses ?? []).filter(item => !courseId || item.courseId === courseId);
  const workItems = courseRecords(work.data, courseId);
  const requestItems = courseRecords(requests.data, courseId);
  const detailQuery = detail === 'alerts' ? alerts : detail === 'attendance' ? attendance : detail === 'work' ? work : requests;
  const detailItems = detail === 'alerts' ? alerts.data ?? [] : detail === 'attendance' ? attendance.data?.items ?? [] : detail === 'work' ? workItems : requestItems;
  const detailPage = detailItems.slice(page * LEARNING_PAGE_SIZE, (page + 1) * LEARNING_PAGE_SIZE);
  const visibleCourse = courses.data?.find(item => (item.id ?? item.courseId) === courseId);
  const openDetail = (value?: LearningDetail) => {
    setPage(0);
    setParams(current => {const next = new URLSearchParams(current); if (value) next.set(DETAIL_PARAM, value); else next.delete(DETAIL_PARAM); return next;});
  };
  const selectCourse = (value: string) => {
    setPage(0); setProgressPage(0);
    setParams(current => {const next = new URLSearchParams(current); if (value) next.set(COURSE_PARAM, value); else next.delete(COURSE_PARAM); return next;});
  };
  const coursePicker = (label: string) => <label className={s.coursePicker}><span className={s.srOnly}>{label}</span><select aria-label={label} value={courseId ?? ''} onChange={event => selectCourse(event.target.value)}><option value="">All courses</option>{courses.data?.map(item => <option key={item.id ?? item.courseId} value={item.id ?? item.courseId}>{item.title || item.name || item.courseCode}</option>)}</select></label>;
  const detailButton = (value: LearningDetail) => <button className={s.textButton} type="button" onClick={() => openDetail(value)}>View all <ArrowRight size={15}/></button>;

  return <section className={s.page} aria-label="Learning overview workspace">
    <header className={s.header}><div><h2>Learning overview</h2><p>Attendance, reports, and schedule requests.</p></div>{coursePicker('Learning course')}</header>
    <LearningQueryState query={courses}/>
    <nav className={s.tabs} aria-label="Learning views">{(['overview', 'calendar'] as const).map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => {setTab(value); openDetail();}}>{value === 'overview' ? 'Overview' : 'Calendar'}</button>)}</nav>
    {tab === 'calendar' ? <Suspense fallback={<p role="status">Loading calendar…</p>}><CalendarPage embedded courseId={courseId}/></Suspense> : detail ? <>
      <header className={s.detailHeader}><button type="button" className={s.textButton} onClick={() => openDetail()}><ArrowLeft size={17}/> Back to overview</button><h3>{DETAIL_LABELS[detail]}</h3>{visibleCourse ? <p>{visibleCourse.title || visibleCourse.courseCode}</p> : null}</header>
      {detail === 'course' ? courseId ? <CourseLearningDetails key={courseId} courseId={courseId}/> : <LearningEmpty title="Choose a course" description="Select a course above to see hours, reports, and schedule options."/> : <WorkspaceSection title={DETAIL_LABELS[detail]} headingLevel={4} appearance="record">
        <LearningQueryState query={detailQuery} errorMessage={`${DETAIL_LABELS[detail]} could not be loaded.`}/>
        {detailQuery.isSuccess ? <><OperationRows kind={detail} items={detailPage}/><TeachingPagination label={DETAIL_LABELS[detail]} page={page} size={LEARNING_PAGE_SIZE} total={detailItems.length} count={detailPage.length} onChange={setPage}/></> : null}
      </WorkspaceSection>}
    </> : <div className={s.overview}>
      <WorkspaceSection title="Learning progress" appearance="record" className={s.progressPanel}>
        <LearningQueryState query={progress}/>
        {progress.isSuccess ? <>
          <div className={s.overall}><ProgressRing value={summary.percent} label="Assignment completion" compact/><div><h3>{courseId ? 'Course progress' : 'Overall progress'}</h3><p>{summary.total === 0 ? 'No assignments published yet.' : summary.percent == null ? 'No overall progress record available.' : `${summary.completed} of ${summary.total} assignments completed`}</p><span className={s.scope}>Assignment completion{courseId ? ' for this course' : ' across your courses'}</span></div></div>
          <div className={s.courseProgress}>{courseProgress.slice(progressPage * LEARNING_PREVIEW_SIZE, (progressPage + 1) * LEARNING_PREVIEW_SIZE).map((item, index) => <article key={item.courseId ?? index}><h3>{item.courseTitle || courses.data?.find(course => (course.id ?? course.courseId) === item.courseId)?.title || 'Course progress'}</h3><AssignmentProgress progress={item}/></article>)}</div>
          {courseProgress.length > LEARNING_PREVIEW_SIZE ? <TeachingPagination label="Course progress" page={progressPage} size={LEARNING_PREVIEW_SIZE} total={courseProgress.length} count={Math.min(LEARNING_PREVIEW_SIZE, courseProgress.length - progressPage * LEARNING_PREVIEW_SIZE)} onChange={setProgressPage}/> : null}
          {!!progress.data?.checkpoints?.length ? <div className={s.checkpoints}><h3>Study plan milestones</h3>{progress.data.checkpoints.slice(0, LEARNING_PREVIEW_SIZE).map((item, index) => <article className={s.checkpoint} key={item.checkpointId ?? index}><header><span><CheckCircle2 size={19}/>Milestone checkpoint</span><LearningBadge value={item.status}/></header><p>{item.title || 'Learning checkpoint'}</p><footer><span>Due {learningDate(item.dueDate)}</span>{item.checkpointId ? <Link className={s.textButton} to={`${APP_ROUTE_PATHS.myPlan}?${new URLSearchParams({[STUDY_PLAN_QUERY_PARAMS.checkpoint]: String(item.checkpointId)})}`}>View milestone <ArrowRight size={15}/></Link> : null}</footer></article>)}<Link className={s.textButton} to={APP_ROUTE_PATHS.myPlan}>View study plan <ArrowRight size={15}/></Link></div> : null}
        </> : null}
      </WorkspaceSection>
      <WorkspaceSection title="Alerts" summary="Your learning reminders" appearance="record" className={s.alertsPanel} meta={alerts.isSuccess ? <LearningBadge label={`${alerts.data.length} active`}/> : undefined}>
        <LearningQueryState query={alerts} errorMessage="Alerts could not be loaded."/>
        {alerts.isSuccess && !alerts.data.length ? <LearningEmpty icon={Bell} title="No active alerts." description="New learning reminders will appear here."/> : null}
        {alerts.isSuccess ? <div className={s.alerts}>{alerts.data.slice(0, LEARNING_PREVIEW_SIZE).map((item, index) => <article key={optionalNumber(item, 'id') ?? index}><Bell size={18}/><div><strong>{textValue(item, 'title', 'message', 'type') || 'Learning update'}</strong>{textValue(item, 'createdAt') ? <small>{learningDate(textValue(item, 'createdAt'))}</small> : null}</div></article>)}</div> : null}
        {alerts.isSuccess && alerts.data.length > LEARNING_PREVIEW_SIZE ? detailButton('alerts') : null}
      </WorkspaceSection>
      <section className={s.courseEntry} aria-label="Course reports and schedule changes"><div><h3>Need reports or schedule changes?</h3><p>Choose a course to view your hours, read published reports, or request a change.</p></div><div className={s.entryActions}>{coursePicker('Course details selection')}<button className={s.primary} type="button" disabled={!courseId} onClick={() => openDetail('course')}>View details <ArrowRight size={17}/></button></div></section>
      <div className={s.supportGrid}>
        <WorkspaceSection title="Attendance" appearance="record" meta={detailButton('attendance')}>
          <LearningQueryState query={attendance}/>
          {attendance.isSuccess ? <>{attendance.data.present != null || attendance.data.absent != null ? <dl className={s.attendanceCounts}>{[['Present', attendance.data.present], ['Absent', attendance.data.absent], ['Approved absence', attendance.data.approved]].map(([label, value]) => value != null ? <div key={label}><dt>{label}</dt><dd>{value}</dd></div> : null)}</dl> : null}<OperationRows kind="attendance" items={attendance.data.items.slice(0, LEARNING_PREVIEW_SIZE)}/></> : null}
        </WorkspaceSection>
        <WorkspaceSection title="Work queue" appearance="record" meta={detailButton('work')}><LearningQueryState query={work}/>{work.isSuccess ? <OperationRows kind="work" items={workItems.slice(0, LEARNING_PREVIEW_SIZE)}/> : null}</WorkspaceSection>
        <WorkspaceSection title="Schedule requests" appearance="record" meta={detailButton('requests')}><LearningQueryState query={requests}/>{requests.isSuccess ? <OperationRows kind="requests" items={requestItems.slice(0, LEARNING_PREVIEW_SIZE)}/> : null}</WorkspaceSection>
      </div>
    </div>}
  </section>;
}

function OperationRows({items, kind}: {items: OperationRecord[]; kind: Exclude<LearningDetail, 'course'>}) {
  if (!items.length) return <LearningEmpty icon={kind === 'alerts' ? Bell : kind === 'attendance' ? CalendarCheck2 : kind === 'work' ? ClipboardList : Clock3} title={kind === 'alerts' ? 'No active alerts.' : kind === 'attendance' ? 'No attendance recorded.' : kind === 'work' ? 'Nothing needs attention.' : 'No schedule requests.'}/>;
  return <div className={s.recordList}>{items.map((item, index) => {
    const destination = kind === 'work' ? learningWorkDestination(item) : undefined;
    const title = textValue(item, 'title', 'courseTitle', 'message') || (kind === 'requests' ? textValue(item, 'requestType')?.replace(/_/g, ' ').toLowerCase() : undefined) || (kind === 'attendance' ? 'Class attendance' : 'Learning update');
    const status = kind === 'attendance' ? textValue(item, 'effectiveStatus', 'rawStatus') : textValue(item, 'status', 'taskStatus', 'submissionStatus');
    return <article className={s.record} key={optionalNumber(item, 'id', 'notificationId', 'occurrenceId') ?? index}><div><strong>{destination ? <Link to={destination}>{title}</Link> : title}</strong><small>{learningDate(textValue(item, 'occurrenceDate', 'date', 'dueAt', 'createdAt', 'proposedOccurrenceDate'))}</small></div>{status ? <LearningBadge value={status}/> : null}{kind === 'requests' && textValue(item, 'reason') ? <p>{textValue(item, 'reason')}</p> : null}{kind === 'requests' && textValue(item, 'rejectionReason') ? <p>Decision: {textValue(item, 'rejectionReason')}</p> : null}</article>;
  })}</div>;
}
