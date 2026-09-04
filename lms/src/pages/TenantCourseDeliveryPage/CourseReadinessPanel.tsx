import {AlertCircle, Check, LoaderCircle} from 'lucide-react';
import type {CourseDeliveryConfigResponse, CourseReadinessBlocker, CourseResponse, CourseSession} from '@/apis';
import {courseLaunchLabel} from '../advising/courseManagement';
import styles from '../advising/CourseManagement.module.scss';

export function CourseReadinessPanel({course, sessions, config, blockers, loading, transitionPending, canReady, canPublish, onReady, onPublish}: {
  course?: CourseResponse;
  sessions?: CourseSession[];
  config: CourseDeliveryConfigResponse | null | undefined;
  blockers: CourseReadinessBlocker[];
  loading: boolean;
  transitionPending: boolean;
  canReady: boolean;
  canPublish: boolean;
  onReady: () => void;
  onPublish: () => void;
}) {
  const state = config?.launchState;
  const hasConfig = Boolean(config?.catalogCode && config.capacity);
  const checks = [
    {label: 'Course details configured', complete: Boolean(course?.courseCode && course?.title)},
    {label: 'Delivery parameters set', complete: hasConfig},
    {label: `Schedule configured (${sessions?.length ?? 0} recurring)`, complete: Boolean(sessions?.length)},
    {label: 'Primary instructor assigned', complete: Boolean(course?.primaryInstructor)},
  ];
  const completed = checks.filter(check => check.complete).length;
  const ready = state === 'READY' && blockers.length === 0;

  return <aside className={styles.readinessPanel} aria-labelledby="course-readiness-title" aria-busy={loading}>
    <div className={styles.statusHeading}>
      <h2 id="course-readiness-title">Course readiness</h2>
      <span className={styles.statusBadge} data-state={state}>{courseLaunchLabel(state)}</span>
    </div>
    {loading ? <p role="status" className={styles.helper}><LoaderCircle size={16} aria-hidden="true" /> Loading readiness…</p> : <>
      <div className={styles.readinessSummary}>
        <span className={styles.readinessMark} data-ready={ready || undefined} aria-hidden="true">{completed}/{checks.length}</span>
        <div><strong>{state === 'PUBLISHED' ? 'Course published' : ready ? 'Ready for publication' : 'Configuration in progress'}</strong><span>Review the course details before publishing.</span></div>
      </div>
      <ul className={styles.checkList} aria-label="Course configuration checks">{checks.map(check => <li key={check.label} data-complete={check.complete || undefined}>{check.complete ? <Check size={12} aria-hidden="true" /> : <AlertCircle size={13} aria-hidden="true" />}<span>{check.label}</span></li>)}</ul>
      {blockers.length > 0 ? <ul className={styles.blockerList} aria-label="Readiness blockers">
        {blockers.map((blocker, index) => <li key={`${blocker.code ?? 'blocker'}-${index}`}><AlertCircle size={16} aria-hidden="true" /><span><strong>{blocker.code?.replace(/_/g, ' ') || 'Course requirement'}</strong><br />{blocker.message || 'This requirement is not complete.'}</span></li>)}
      </ul> : <div className={styles.readyNote}><strong>Readiness blockers</strong>{!state || state === 'DRAFT' ? 'Check readiness before publishing.' : 'No outstanding requirements.'}</div>}
      {config?.deliveryMode === 'GROUP' && state !== 'PUBLISHED' ? <div className={styles.readinessActions}>
        {config?.launchState === 'DRAFT' ? <button type="button" className={styles.secondaryButton} onClick={onReady} disabled={!canReady}>Check readiness</button> : null}
        <button type="button" className={styles.primaryButton} onClick={onPublish} disabled={!canPublish}>{transitionPending ? 'Updating…' : 'Publish course'}</button>
      </div> : null}
    </>}
  </aside>;
}
