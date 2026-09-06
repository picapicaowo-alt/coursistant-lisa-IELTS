import {formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import { useTranslation } from 'react-i18next';
import {lazy, Suspense, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link, useSearchParams} from 'react-router-dom';
import {ArrowRight, Bell, CalendarCheck2, CheckCircle2, ClipboardList, Clock3} from 'lucide-react';
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
import {assignmentSummary, attendanceData, courseRecords, DETAIL_LABEL_KEYS, LEARNING_PAGE_SIZE, LEARNING_PREVIEW_SIZE, learningDate, learningWorkDestination, type LearningDetail} from './learningData';
import {CourseLearningDetails} from './CourseLearningDetails';
import {PublishedReports} from './PublishedReports';
import s from './index.module.scss';

const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const DETAIL_PARAM = 'learningDetail';
const COURSE_PARAM = 'learningCourse';

export default function StudentLearningPage() {
  const { t: translate } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'overview' | 'calendar'>('overview');
  const [page, setPage] = useState(0);
  const [progressPage, setProgressPage] = useState(0);
  const detailValue = params.get(DETAIL_PARAM);
  const detail = detailValue && Object.prototype.hasOwnProperty.call(DETAIL_LABEL_KEYS, detailValue) ? detailValue as LearningDetail : undefined;
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
  const coursePicker = (label: string) => <label className={s.coursePicker}><span className={s.srOnly}>{label}</span><select aria-label={label} value={courseId ?? ''} onChange={event => selectCourse(event.target.value)}><option value="">{translate("dashboard:allCourses")}</option>{courses.data?.map(item => <option key={item.id ?? item.courseId} value={item.id ?? item.courseId}>{item.title || item.name || item.courseCode}</option>)}</select></label>;
  const detailButton = (value: LearningDetail) => <button className={s.textButton} type="button" onClick={() => openDetail(value)}>{translate("common:actions.viewAll")}</button>;

  return <section className={s.page} aria-label={translate("learning:overview.workspace")}>
    <header className={s.header}><div><h2>{translate("advising:studentPlan.learning")}</h2><p>{translate("learning:overview.description")}</p></div>{coursePicker(translate("learning:overview.coursePicker"))}</header>
    <LearningQueryState query={courses}/>
    <nav className={s.tabs} aria-label={translate("navigation:parent.learningViews")}>{(['overview', 'calendar'] as const).map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => {setTab(value); openDetail();}}>{value === 'overview' ? translate("advising:studentPlan.overview") : translate("common:sidebar.calendar")}</button>)}</nav>
    {tab === 'calendar' ? <Suspense fallback={<p role="status">{translate("calendar:loading")}</p>}><CalendarPage embedded courseId={courseId}/></Suspense> : detail ? <>
      <header className={s.detailHeader}><button type="button" className={s.textButton} onClick={() => openDetail()}> {translate('common:navigationControls.backToOverview')}</button><h3>{translate(DETAIL_LABEL_KEYS[detail])}</h3>{visibleCourse ? <p>{visibleCourse.title || visibleCourse.courseCode}</p> : null}</header>
      {detail === 'reports' ? <PublishedReports key={courseId ?? 'all'} courseId={courseId}/> : detail === 'course' ? courseId ? <CourseLearningDetails key={courseId} courseId={courseId}/> : <LearningEmpty title={translate("course:roster.choose")} description={translate("learning:overview.chooseCourseHelp")}/> : <WorkspaceSection title={translate(DETAIL_LABEL_KEYS[detail])} headingLevel={4} appearance="record">
        <LearningQueryState query={detailQuery} errorMessage={translate('operations:legacy.loadFailedNamed', {section: translate(DETAIL_LABEL_KEYS[detail])})}/>
        {detailQuery.isSuccess ? <><OperationRows kind={detail} items={detailPage}/><TeachingPagination label={translate(DETAIL_LABEL_KEYS[detail])} page={page} size={LEARNING_PAGE_SIZE} total={detailItems.length} count={detailPage.length} onChange={setPage}/></> : null}
      </WorkspaceSection>}
    </> : <div className={s.overview}>
      <WorkspaceSection title={translate("learning:overview.progress")} appearance="record" className={s.progressPanel}>
        <LearningQueryState query={progress}/>
        {progress.isSuccess ? <>
          <div className={s.overall}><ProgressRing value={summary.percent} label={translate("common:progress.assignment")} compact/><div><h3>{courseId ? translate("learning:overview.courseProgress") : translate("learning:overview.overallProgress")}</h3><p>{summary.total === 0 ? translate("common:progress.noAssignments") : summary.percent == null ? translate("learning:overview.noProgress") : translate("learning:overview.completedAssignments", {completed: formatNumber(summary.completed ?? 0), total: formatNumber(summary.total ?? 0)})}</p><span className={s.scope}>{translate(courseId ? "common:progress.courseAssignments" : "common:progress.allAssignments")}</span></div></div>
          <div className={s.courseProgress}>{courseProgress.slice(progressPage * LEARNING_PREVIEW_SIZE, (progressPage + 1) * LEARNING_PREVIEW_SIZE).map((item, index) => <article key={item.courseId ?? index}><h3>{item.courseTitle || courses.data?.find(course => (course.id ?? course.courseId) === item.courseId)?.title || translate("learning:overview.courseProgress")}</h3><AssignmentProgress progress={item}/></article>)}</div>
          {courseProgress.length > LEARNING_PREVIEW_SIZE ? <TeachingPagination label={translate("learning:overview.courseProgress")} page={progressPage} size={LEARNING_PREVIEW_SIZE} total={courseProgress.length} count={Math.min(LEARNING_PREVIEW_SIZE, courseProgress.length - progressPage * LEARNING_PREVIEW_SIZE)} onChange={setProgressPage}/> : null}
          {!!progress.data?.checkpoints?.length ? <div className={s.checkpoints}><h3>{translate("learning:overview.milestones")}</h3>{progress.data.checkpoints.slice(0, LEARNING_PREVIEW_SIZE).map((item, index) => <article className={s.checkpoint} key={item.checkpointId ?? index}><header><span><CheckCircle2 size={19}/>{translate("learning:overview.checkpoint")}</span><LearningBadge value={item.status}/></header><p>{item.title || translate("learning:overview.learningCheckpoint")}</p><footer><span>{translate('assessment:attempt.deadline', {date: learningDate(item.dueDate)})}</span>{item.checkpointId ? <Link className={s.textButton} to={`${APP_ROUTE_PATHS.myPlan}?${new URLSearchParams({[STUDY_PLAN_QUERY_PARAMS.checkpoint]: String(item.checkpointId)})}`}>{translate('common:navigationControls.viewMilestone')} </Link> : null}</footer></article>)}<Link className={s.textButton} to={APP_ROUTE_PATHS.myPlan}>{translate('common:navigationControls.viewStudyPlan')} </Link></div> : null}
        </> : null}
      </WorkspaceSection>
      <WorkspaceSection title={translate("dashboard:alerts")} summary={translate("learning:overview.reminders")} appearance="record" className={s.alertsPanel} meta={alerts.isSuccess ? <LearningBadge label={translate("learning:overview.activeAlerts", {count: alerts.data.length, number: formatNumber(alerts.data.length)})}/> : undefined}>
        <LearningQueryState query={alerts} errorMessage={translate('operations:legacy.loadFailedNamed', {section: translate('dashboard:alerts')})}/>
        {alerts.isSuccess && !alerts.data.length ? <LearningEmpty icon={Bell} title={translate("dashboard:noAlerts")} description={translate("learning:overview.remindersHelp")}/> : null}
        {alerts.isSuccess ? <div className={s.alerts}>{alerts.data.slice(0, LEARNING_PREVIEW_SIZE).map((item, index) => <article key={optionalNumber(item, 'id') ?? index}><Bell size={18}/><div><strong>{textValue(item, 'title', 'message') || (textValue(item, 'type') ? statusLabel(textValue(item, 'type')) : undefined) || translate("dashboard:learningUpdate")}</strong>{textValue(item, 'createdAt') ? <small>{learningDate(textValue(item, 'createdAt'))}</small> : null}</div></article>)}</div> : null}
        {alerts.isSuccess && alerts.data.length > LEARNING_PREVIEW_SIZE ? detailButton('alerts') : null}
      </WorkspaceSection>
      <section className={s.courseEntry} aria-label={translate("learning:overview.courseDetailsLabel")}><div><h3>{translate("learning:overview.courseDetailsTitle")}</h3><p>{translate("learning:overview.courseDetailsHelp")}</p></div><div className={s.entryActions}><button className={s.textButton} type="button" onClick={() => openDetail('reports')}>{translate('learning:reports.viewPublished')} <ArrowRight size={17}/></button>{coursePicker(translate("learning:overview.detailsPicker"))}<button className={s.primary} type="button" disabled={!courseId} onClick={() => openDetail('course')}>{translate("common:actions.viewDetails")}</button></div></section>
      <div className={s.supportGrid}>
        <WorkspaceSection title={translate("operations:tabs.attendance")} appearance="record" meta={detailButton('attendance')}>
          <LearningQueryState query={attendance}/>
          {attendance.isSuccess ? <>{attendance.data.present != null || attendance.data.absent != null ? <dl className={s.attendanceCounts}>{[{key: 'common:status.PRESENT', value: attendance.data.present}, {key: 'common:status.ABSENT', value: attendance.data.absent}, {key: 'common:status.APPROVED_ABSENCE', value: attendance.data.approved}].map(({key, value}) => value != null ? <div key={key}><dt>{translate(key)}</dt><dd>{formatNumber(value)}</dd></div> : null)}</dl> : null}<OperationRows kind="attendance" items={attendance.data.items.slice(0, LEARNING_PREVIEW_SIZE)}/></> : null}
        </WorkspaceSection>
        <WorkspaceSection title={translate("learning:overview.work")} appearance="record" meta={detailButton('work')}><LearningQueryState query={work}/>{work.isSuccess ? <OperationRows kind="work" items={workItems.slice(0, LEARNING_PREVIEW_SIZE)}/> : null}</WorkspaceSection>
        <WorkspaceSection title={translate("operations:scheduleRequests")} appearance="record" meta={detailButton('requests')}><LearningQueryState query={requests}/>{requests.isSuccess ? <OperationRows kind="requests" items={requestItems.slice(0, LEARNING_PREVIEW_SIZE)}/> : null}</WorkspaceSection>
      </div>
    </div>}
  </section>;
}

function OperationRows({items, kind}: {items: OperationRecord[]; kind: Exclude<LearningDetail, 'course'>}) {
  const { t: translate } = useTranslation();
  if (!items.length) return <LearningEmpty icon={kind === 'alerts' ? Bell : kind === 'attendance' ? CalendarCheck2 : kind === 'work' ? ClipboardList : Clock3} title={kind === 'alerts' ? translate("dashboard:noAlerts") : kind === 'attendance' ? translate("learning:overview.noAttendance") : kind === 'work' ? translate("learning:overview.noWork") : translate("learning:overview.noRequests")}/>;
  return <div className={s.recordList}>{items.map((item, index) => {
    const destination = kind === 'work' ? learningWorkDestination(item) : undefined;
    const title = textValue(item, 'title', 'courseTitle', 'message') || (kind === 'requests' ? statusLabel(textValue(item, 'requestType')) : undefined) || (kind === 'attendance' ? translate("operations:classAttendance") : translate("dashboard:learningUpdate"));
    const status = kind === 'attendance' ? textValue(item, 'effectiveStatus', 'rawStatus') : textValue(item, 'status', 'taskStatus', 'submissionStatus');
    return <article className={s.record} key={optionalNumber(item, 'id', 'notificationId', 'occurrenceId') ?? index}><div><strong>{destination ? <Link to={destination}>{title}</Link> : title}</strong><small>{learningDate(textValue(item, 'occurrenceDate', 'date', 'dueAt', 'createdAt', 'proposedOccurrenceDate'))}</small></div>{status ? <LearningBadge value={status}/> : null}{kind === 'requests' && textValue(item, 'reason') ? <p>{textValue(item, 'reason')}</p> : null}{kind === 'requests' && textValue(item, 'rejectionReason') ? <p>{translate("learning:overview.decision", {reason: textValue(item, 'rejectionReason')})}</p> : null}</article>;
  })}</div>;
}
