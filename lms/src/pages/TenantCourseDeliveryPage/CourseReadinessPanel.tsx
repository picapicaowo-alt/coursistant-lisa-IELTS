import { useTranslation } from 'react-i18next';
import {AlertCircle, Check, LoaderCircle} from 'lucide-react';
import type {CourseDeliveryConfigResponse, CourseReadinessBlocker, CourseResponse, CourseSession} from '@/apis';
import {formatNumber} from '@/i18n/formatting';
import {courseLaunchLabel, courseReadinessMessage} from '../advising/courseManagement';
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
  const { t: translate } = useTranslation();
  const state = config?.launchState;
  const hasConfig = Boolean(config?.catalogCode && config.capacity);
  const checks = [
    {key: 'courseTools:readiness.detailsConfigured', complete: Boolean(course?.courseCode && course?.title)},
    {key: 'courseTools:readiness.parametersSet', complete: hasConfig},
    {key: 'courseTools:readiness.scheduleConfigured', number: formatNumber(sessions?.length ?? 0), complete: Boolean(sessions?.length)},
    {key: 'courseTools:readiness.instructorAssigned', complete: Boolean(course?.primaryInstructor)},
  ];
  const completed = checks.filter(check => check.complete).length;
  const ready = state === 'READY' && blockers.length === 0;

  return <aside className={styles.readinessPanel} aria-labelledby="course-readiness-title" aria-busy={loading}>
    <div className={styles.statusHeading}>
      <h2 id="course-readiness-title">{translate("courseTools:readiness.title")}</h2>
      <span className={styles.statusBadge} data-state={state}>{courseLaunchLabel(state)}</span>
    </div>
    {loading ? <p role="status" className={styles.helper}><LoaderCircle size={16} aria-hidden="true" /> {' '}{translate("courseTools:readiness.loading")}</p> : <>
      <div className={styles.readinessSummary}>
        <span className={styles.readinessMark} data-ready={ready || undefined} aria-hidden="true">{formatNumber(completed)}/{formatNumber(checks.length)}</span>
        <div><strong>{state === 'PUBLISHED' ? translate("courseTools:readiness.published") : ready ? translate("courseTools:readiness.ready") : translate("courseTools:readiness.inProgress")}</strong><span>{translate("courseTools:readiness.review")}</span></div>
      </div>
      <ul className={styles.checkList} aria-label={translate("courseTools:readiness.checks")}>{checks.map(check => <li key={check.key} data-complete={check.complete || undefined}>{check.complete ? <Check size={12} aria-hidden="true" /> : <AlertCircle size={13} aria-hidden="true" />}<span>{translate(check.key, {number: check.number})}</span></li>)}</ul>
      {blockers.length > 0 ? <ul className={styles.blockerList} aria-label={translate("courseTools:readiness.blockers")}>
        {/* The consumed contract does not enumerate blocker codes or localize messages.
            Keep the diagnostic code intact; arbitrary server prose is not selected-locale UI. */}
        {blockers.map((blocker, index) => <li key={`${blocker.code ?? 'blocker'}-${index}`}><AlertCircle size={16} aria-hidden="true" /><span><strong>{translate("courseTools:readiness.requirement")}</strong>{blocker.code ? <> · <code>{blocker.code}</code></> : null}<br />{courseReadinessMessage(blocker)}</span></li>)}
      </ul> : <div className={styles.readyNote}><strong>{translate("courseTools:readiness.blockers")}</strong>{!state || state === 'DRAFT' ? translate("courseTools:readiness.checkFirst") : translate("courseTools:readiness.none")}</div>}
      {config?.deliveryMode === 'GROUP' && state !== 'PUBLISHED' ? <div className={styles.readinessActions}>
        {config?.launchState === 'DRAFT' ? <button type="button" className={styles.secondaryButton} onClick={onReady} disabled={!canReady}>{translate("courseTools:delivery.validate")}</button> : null}
        <button type="button" className={styles.primaryButton} onClick={onPublish} disabled={!canPublish}>{transitionPending ? translate("settings:updating") : translate("courseTools:delivery.publish")}</button>
      </div> : null}
    </>}
  </aside>;
}
