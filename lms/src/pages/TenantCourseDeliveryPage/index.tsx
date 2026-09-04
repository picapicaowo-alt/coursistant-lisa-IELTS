import {useParams, useSearchParams} from 'react-router-dom';
import {COURSE_SESSION_DAYS} from '@/configs/courseSessions';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {courseDeliveryLabel, courseLaunchLabel, courseTermLabel, formatCourseTime} from '../advising/courseManagement';
import {CourseDeliveryForm} from './CourseDeliveryForm';
import {CourseDeliveryOverview} from './CourseDeliveryOverview';
import {CourseDeliverySummary} from './CourseDeliverySummary';
import {CourseReadinessPanel} from './CourseReadinessPanel';
import {OwnerCourseSchedule} from './OwnerCourseSchedule';
import {useCourseDelivery} from './useCourseDelivery';
import styles from '../advising/CourseManagement.module.scss';

type DeliveryView = 'overview' | 'delivery' | 'schedule';
const DELIVERY_VIEWS: DeliveryView[] = ['overview', 'delivery', 'schedule'];

function CourseDeliveryWorkspace({id}: {id: number}) {
  const [params, setParams] = useSearchParams();
  const requestedView = params.get('view');
  const view = DELIVERY_VIEWS.find(item => item === requestedView) ?? 'delivery';
  const {course, config, sessions, draft, setDraft, save, transition, reload, canEdit, canReady, canPublish, canSchedule, reloadRequired, error} = useCourseDelivery(id);
  const setView = (next: DeliveryView) => setParams(current => {current.set('view', next); return current;});
  const primarySession = sessions.data?.[0];
  const primaryWeekday = primarySession ? COURSE_SESSION_DAYS.find(day => day.value === primarySession.dayOfWeek)?.label ?? primarySession.dayOfWeek : '';
  const sessionSummary = primarySession
    ? `Every ${primaryWeekday} · ${formatCourseTime(primarySession.startTime)}–${formatCourseTime(primarySession.endTime)}`
    : sessions.isPending ? 'Loading schedule…' : sessions.isSuccess ? 'Schedule not configured' : 'Schedule unavailable';

  return <div className={styles.detailPage}>
    <header className={styles.courseIdentity}>
      <div className={styles.detailHeading}>
        <div className={styles.identityCopy}>
          <div className={styles.headingMeta}><h1>{course.data ? `${course.data.courseCode} · ${course.data.title || course.data.name}` : `Course #${id}`}</h1>{config.isSuccess ? <span className={styles.statusBadge} data-state={config.data?.launchState}>{courseLaunchLabel(config.data?.launchState)}</span> : null}</div>
          <p>{courseDeliveryLabel(config.data?.deliveryMode)} · {config.data?.capacity == null ? 'Capacity not set' : `${config.data.capacity} seats`} · {primarySession?.timezone || 'Course timezone not set'}</p>
          <p>{course.data ? courseTermLabel(course.data) : 'Term unavailable'} · {sessionSummary}{sessions.isSuccess ? ` · ${sessions.data.length} recurring ${sessions.data.length === 1 ? 'session' : 'sessions'}` : ''} · Instructor: {course.data?.primaryInstructor?.name || course.data?.primaryInstructor?.email || 'Not assigned'}</p>
        </div>
        <div className={styles.headerActions}>
          {config.data?.deliveryMode === 'GROUP' && config.data.launchState === 'READY' ? <button type="button" className={styles.primaryButton} onClick={() => transition.mutate('publish')} disabled={!canPublish}>Publish course</button> : null}
          {config.data?.deliveryMode === 'GROUP' && config.data.launchState === 'DRAFT' ? <button type="button" className={styles.secondaryButton} onClick={() => transition.mutate('ready')} disabled={!canReady}>Validate readiness</button> : null}
        </div>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Course delivery sections">
        {DELIVERY_VIEWS.map(item => <button key={item} id={`course-tab-${item}`} type="button" role="tab" aria-selected={view === item} aria-controls="course-section" tabIndex={view === item ? 0 : -1} className={styles.tab} onClick={() => setView(item)} onKeyDown={event => {
          const index = DELIVERY_VIEWS.indexOf(item);
          const next = event.key === 'ArrowRight' ? DELIVERY_VIEWS[(index + 1) % DELIVERY_VIEWS.length] : event.key === 'ArrowLeft' ? DELIVERY_VIEWS[(index + DELIVERY_VIEWS.length - 1) % DELIVERY_VIEWS.length] : event.key === 'Home' ? DELIVERY_VIEWS[0] : event.key === 'End' ? DELIVERY_VIEWS[DELIVERY_VIEWS.length - 1] : undefined;
          if (next) {event.preventDefault(); setView(next); document.getElementById(`course-tab-${next}`)?.focus();}
        }}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </div>
    </header>
    <div className={styles.detailBody} id="course-section" role="tabpanel" aria-labelledby={`course-tab-${view}`}>
      {error ? <p className={styles.error} role="alert">{advisingErrorMessage(error, 'Course management data could not be loaded or updated.')} {course.isError || config.isError || sessions.isError ? <button type="button" className={styles.ghostButton} onClick={() => {if (course.isError) void course.refetch(); else {void config.refetch(); if (sessions.isError) void sessions.refetch();}}}>Retry</button> : null}</p> : null}
      {reloadRequired ? <div className={styles.notice} role="alert">Your input is preserved, but this course changed elsewhere. <button type="button" className={styles.ghostButton} onClick={() => void reload()}>Load latest delivery version</button></div> : null}
      {course.isPending || (course.isSuccess && config.isPending) ? <p role="status" className={styles.helper}>Loading course delivery…</p> : null}
      {course.isSuccess && config.isSuccess ? <>
        {config.data?.deliveryMode === 'ONE_ON_ONE' ? <p className={styles.notice}>One-on-one delivery is managed from the student workspace. This course is read only here.</p> : null}
        {view === 'schedule' ? <OwnerCourseSchedule courseId={id} course={course.data} readOnly={!canSchedule} /> : <div className={styles.workspace}>
          <div className={styles.mainColumn}>
            {view === 'overview' ? <CourseDeliveryOverview course={course.data} config={config.data} sessions={sessions.isError ? undefined : sessions.data} sessionsPending={sessions.isPending} onView={setView} /> : <><CourseDeliveryForm config={config.data} draft={draft} pending={save.isPending} canEdit={canEdit} onDraft={setDraft} onSubmit={() => save.mutateAsync()} /><CourseDeliverySummary course={course.data} sessions={sessions.isError ? undefined : sessions.data} sessionsPending={sessions.isPending} onViewSchedule={() => setView('schedule')} /></>}
          </div>
          <div className={styles.sideColumn}><CourseReadinessPanel course={course.data} sessions={sessions.isError ? undefined : sessions.data} config={config.data} loading={config.isFetching || sessions.isPending} transitionPending={transition.isPending} canReady={canReady} canPublish={canPublish} onReady={() => transition.mutate('ready')} onPublish={() => transition.mutate('publish')} /></div>
        </div>}
      </> : null}
    </div>
  </div>;
}

export default function AdvisorCourseDeliveryPage() {
  const {courseId} = useParams();
  const id = Number(courseId);
  if (!Number.isSafeInteger(id) || id <= 0) return <div className={styles.page}><p role="alert" className={styles.error}>This course link is not valid.</p></div>;
  // Remount all drafts and mutation checkpoints when switching course identities.
  return <CourseDeliveryWorkspace key={id} id={id} />;
}
