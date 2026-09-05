import {formatInstructorName} from '@/utils/personName';
import { useTranslation } from 'react-i18next';
import {useParams, useSearchParams} from 'react-router-dom';
import {formatNumber, formatWeekday} from '@/i18n/formatting';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {courseDeliveryLabel, courseLaunchLabel, courseReadinessMessage, courseTermLabel, formatCourseTime} from '../advising/courseManagement';
import {CourseDeliveryForm} from './CourseDeliveryForm';
import {CourseDeliveryOverview} from './CourseDeliveryOverview';
import {CourseDeliverySummary} from './CourseDeliverySummary';
import {CourseReadinessPanel} from './CourseReadinessPanel';
import {OwnerCourseSchedule} from './OwnerCourseSchedule';
import {useCourseDelivery} from './useCourseDelivery';
import styles from '../advising/CourseManagement.module.scss';

type DeliveryView = 'overview' | 'delivery' | 'schedule';
const DELIVERY_VIEWS: DeliveryView[] = ['overview', 'delivery', 'schedule'];
const DELIVERY_VIEW_LABELS: Record<DeliveryView, string> = {
  overview: 'advising:studentPlan.overview',
  delivery: 'courseTools:delivery.tab.delivery',
  schedule: 'navigation:parent.schedule',
};

function CourseDeliveryWorkspace({id}: {id: number}) {
  const { t: translate } = useTranslation();
  const [params, setParams] = useSearchParams();
  const requestedView = params.get('view');
  const view = DELIVERY_VIEWS.find(item => item === requestedView) ?? 'delivery';
  const {course, config, sessions, draft, setDraft, save, transition, reload, readinessBlockers, canEdit, canReady, canPublish, canSchedule, canGenerateDates, reloadRequired, error} = useCourseDelivery(id);
  const setView = (next: DeliveryView) => setParams(current => {current.set('view', next); return current;});
  const primarySession = sessions.data?.[0];
  const primaryWeekday = primarySession ? formatWeekday(primarySession.dayOfWeek, 'long') : '';
  const sessionSummary = primarySession
    ? `${translate("courseTools:schedule.everyWeekday", {day: primaryWeekday})} · ${formatCourseTime(primarySession.startTime)}–${formatCourseTime(primarySession.endTime)}`
    : translate(sessions.isPending ? 'dashboard:loadingSchedule' : sessions.isSuccess ? 'courseTools:delivery.scheduleUnconfigured' : 'courseTools:delivery.scheduleUnavailable');

  return <div className={styles.detailPage}>
    <header className={styles.courseIdentity}>
      <div className={styles.detailHeading}>
        <div className={styles.identityCopy}>
          <div className={styles.headingMeta}><h1>{course.data ? `${course.data.courseCode} · ${course.data.title || course.data.name}` : translate('assistant:courseFallback', {id})}</h1>{config.isSuccess ? <span className={styles.statusBadge} data-state={config.data?.launchState}>{courseLaunchLabel(config.data?.launchState)}</span> : null}</div>
          <p>{courseDeliveryLabel(config.data?.deliveryMode)} · {config.data?.capacity == null ? translate("courseTools:delivery.capacityMissing") : translate('courseTools:delivery.seats', {count: config.data.capacity, number: formatNumber(config.data.capacity)})} · {primarySession?.timezone || translate("courseTools:delivery.courseTimezoneMissing")}</p>
          <p>{course.data ? courseTermLabel(course.data) : translate("courseTools:delivery.termUnavailable")} · {sessionSummary}{sessions.isSuccess ? ` · ${translate('courseTools:schedule.count', {count: sessions.data.length, number: formatNumber(sessions.data.length)})}` : ''} · {translate('courseTools:delivery.instructorName', {name: formatInstructorName(course.data?.primaryInstructor, course.data?.primaryInstructor?.email || translate('course:learning.notAssigned'))})}</p>
        </div>
        <div className={styles.headerActions}>
          {config.data?.deliveryMode === 'GROUP' && config.data.launchState === 'READY' ? <button type="button" className={styles.primaryButton} onClick={() => transition.mutate('publish')} disabled={!canPublish}>{translate("courseTools:delivery.publish")}</button> : null}
          {config.data?.deliveryMode === 'GROUP' && config.data.launchState === 'DRAFT' ? <button type="button" className={styles.secondaryButton} onClick={() => transition.mutate('ready')} disabled={!canReady}>{translate("courseTools:delivery.validate")}</button> : null}
        </div>
      </div>
      <div className={styles.tabs} role="tablist" aria-label={translate("courseTools:delivery.sections")}>
        {DELIVERY_VIEWS.map(item => <button key={item} id={`course-tab-${item}`} type="button" role="tab" aria-selected={view === item} aria-controls="course-section" tabIndex={view === item ? 0 : -1} className={styles.tab} onClick={() => setView(item)} onKeyDown={event => {
          const index = DELIVERY_VIEWS.indexOf(item);
          const next = event.key === 'ArrowRight' ? DELIVERY_VIEWS[(index + 1) % DELIVERY_VIEWS.length] : event.key === 'ArrowLeft' ? DELIVERY_VIEWS[(index + DELIVERY_VIEWS.length - 1) % DELIVERY_VIEWS.length] : event.key === 'Home' ? DELIVERY_VIEWS[0] : event.key === 'End' ? DELIVERY_VIEWS[DELIVERY_VIEWS.length - 1] : undefined;
          if (next) {event.preventDefault(); setView(next); document.getElementById(`course-tab-${next}`)?.focus();}
        }}>{translate(DELIVERY_VIEW_LABELS[item])}</button>)}
      </div>
    </header>
    <div className={styles.detailBody} id="course-section" role="tabpanel" aria-labelledby={`course-tab-${view}`}>
      {error ? <p className={styles.error} role="alert">{advisingErrorMessage(error, translate('courseTools:delivery.loadFailed'))} {course.isError || config.isError || sessions.isError ? <button type="button" className={styles.ghostButton} onClick={() => {if (course.isError) void course.refetch(); else {void config.refetch(); if (sessions.isError) void sessions.refetch();}}}>{translate("common:actions.retry")}</button> : null}</p> : null}
      {view === 'schedule' && transition.error && readinessBlockers.length > 0 ? <ul className={styles.blockerList} aria-label={translate("courseTools:readiness.blockers")}>{readinessBlockers.map((blocker, index) => <li key={`${blocker.code}-${index}`}>{courseReadinessMessage(blocker)}</li>)}</ul> : null}
      {reloadRequired ? <div className={styles.notice} role="alert">{translate("courseTools:delivery.conflict")}{' '}<button type="button" className={styles.ghostButton} onClick={() => void reload()}>{translate("courseTools:delivery.reload")}</button></div> : null}
      {course.isPending || (course.isSuccess && config.isPending) ? <p role="status" className={styles.helper}>{translate("courseTools:delivery.loading")}</p> : null}
      {course.isSuccess && config.isSuccess ? <>
        {config.data === null ? <p className={styles.notice}>{translate('courseTools:delivery.scheduleBeforeConfig')} <button type="button" className={styles.textAction} onClick={() => setView('schedule')}>{translate('courseTools:delivery.setupSchedule')}</button></p> : config.data?.deliveryMode === 'GROUP' && view === 'schedule' ? <p className={styles.notice}>{translate('courseTools:delivery.recurringLocked')}</p> : null}
        {view === 'schedule' ? <OwnerCourseSchedule courseId={id} course={course.data} readOnly={!canSchedule} canGenerateDates={canGenerateDates} /> : <div className={styles.workspace}>
          <div className={styles.mainColumn}>
            {view === 'overview' ? <CourseDeliveryOverview course={course.data} config={config.data} sessions={sessions.isError ? undefined : sessions.data} sessionsPending={sessions.isPending} onView={setView} /> : <><CourseDeliveryForm config={config.data} draft={draft} pending={save.isPending} canEdit={canEdit} onDraft={setDraft} onSubmit={() => save.mutateAsync()} /><CourseDeliverySummary course={course.data} sessions={sessions.isError ? undefined : sessions.data} sessionsPending={sessions.isPending} onViewSchedule={() => setView('schedule')} /></>}
          </div>
          <div className={styles.sideColumn}><CourseReadinessPanel course={course.data} sessions={sessions.isError ? undefined : sessions.data} config={config.data} blockers={readinessBlockers} loading={config.isFetching || sessions.isPending} transitionPending={transition.isPending} canReady={canReady} canPublish={canPublish} onReady={() => transition.mutate('ready')} onPublish={() => transition.mutate('publish')} /></div>
        </div>}
      </> : null}
    </div>
  </div>;
}

export default function AdvisorCourseDeliveryPage() {
  const {t: translate} = useTranslation();
  const {courseId} = useParams();
  const id = Number(courseId);
  if (!Number.isSafeInteger(id) || id <= 0) return <div className={styles.page}><p role="alert" className={styles.error}>{translate("courseTools:delivery.invalidLink")}</p></div>;
  // Remount all drafts and mutation checkpoints when switching course identities.
  return <CourseDeliveryWorkspace key={id} id={id} />;
}
