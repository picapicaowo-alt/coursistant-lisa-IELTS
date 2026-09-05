import {formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import { useTranslation } from 'react-i18next';
import {Link} from 'react-router-dom';
import {UserRound} from 'lucide-react';
import type {UseQueryResult} from '@tanstack/react-query';
import type {ParentStudentLinkResponse, StudentIntakeResponse} from '@/apis';
import {formatPersonName} from '@/utils/personName';
import {formatUtcTimestamp} from '@/utils/datetime';
import {assignmentPath, intakePath} from './presentation';
import {QueryError} from './WorkspaceFeedback';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from './index.module.scss';

export function IntakePreview({query, parents, selectedId, unavailable}: {
  query: UseQueryResult<StudentIntakeResponse, Error>;
  parents: UseQueryResult<ParentStudentLinkResponse[], Error>;
  selectedId: number | null; unavailable: boolean;
}) {
  const { t: translate } = useTranslation();
  const intake = query.data;
  return <section className={`${styles.panel} ${styles.previewPanel}`} id="intake-preview" aria-labelledby="intake-preview-title">
    <header className={styles.panelHeader}><h2 id="intake-preview-title" aria-label={translate("advising:counsellor.preview")}><span className={styles.previewHeading}>{translate("advising:counsellor.preview")}</span><span className={styles.compactStudentName}>{intake && !unavailable && !query.isError ? formatPersonName(intake, translate('advising:counsellor.preview')) : translate("advising:counsellor.preview")}</span></h2><UserRound size={19} aria-hidden="true"/></header>
    {selectedId === null ? <div className={styles.emptyState}><p>{translate("advising:counsellor.selectIntakeHelp")}</p></div> :
      unavailable ? <p className={styles.feedback} role="status">{translate("advising:counsellor.unavailableRefreshing")}</p> :
        query.isError ? <QueryError error={query.error} fallback={translate('advising:studentWorkspace.intakeFailed')} onRetry={() => void query.refetch()}/> :
          query.isPending || !intake ? <p className={styles.feedback} role="status">{translate("advising:studentIntake.loading")}</p> :
            <div className={styles.previewBody} data-parent-error={parents.isError}>
              <div className={styles.previewIdentity}>
                <h3>{formatPersonName(intake, translate('common:people.studentFallback', {id: formatNumber(intake.studentUserId)}))}</h3>
                <p>{intake.email || translate("advising:counsellor.noEmail")}</p>
                <div className={styles.badges}><span className={styles.badge}>{statusLabel(intake.assignmentStatus)}</span>{intake.studentType ? <span className={styles.neutralBadge}>{statusLabel(intake.studentType)}</span> : null}</div>
              </div>
              <dl className={styles.recordFields}>
                <div><dt>{translate("advising:studentIntake.courseRequest")}</dt><dd>{intake.courseRequest || translate("common:feedback.notProvided")}</dd></div>
                <div className={styles.extendedField}><dt>{translate("advising:intake.phone")}</dt><dd>{intake.contactPhone || translate("common:feedback.notProvided")}</dd></div>
                <div className={styles.extendedField}><dt>{translate("advising:studentIntake.background")}</dt><dd>{intake.basicBackground || translate("common:feedback.notProvided")}</dd></div>
              </dl>
              <div className={styles.parentSummary} data-error={parents.isError}>
                <div className={styles.sectionLabel}><h3>{parents.isSuccess && parents.data.length > 1 ? translate('advising:counsellor.parentCount', {number: formatNumber(parents.data.length)}) : translate('advising:counsellor.parentGuardian')}</h3><Link className={styles.textLink} to={intakePath(intake.intakeId)}>{translate("common:admin.manage")}</Link></div>
                {parents.isError ? <QueryError error={parents.error} fallback={translate('advising:parents.loadFailed')} onRetry={() => void parents.refetch()}/> : parents.isPending ?
                  <p className={styles.muted} role="status">{translate("advising:parents.loading")}</p> : parents.data?.length ?
                    <ul>{parents.data.slice(0, 1).map((parent, index) => <li key={parent.linkId ?? parent.parentUserId ?? index}>
                      <strong>{formatPersonName({firstName: parent.parentFirstName, middleName: parent.parentMiddleName, lastName: parent.parentLastName}, translate('advising:counsellor.parentGuardian'))}</strong>
                      {parent.parentEmail ? <span>{parent.parentEmail}</span> : null}
                    </li>)}</ul> : <p className={styles.muted}>{translate("advising:parents.empty")}</p>}
              </div>
              {parents.isError ? <p className={styles.compactParentError} role="alert" title={advisingErrorMessage(parents.error, translate('advising:parents.loadFailed'))}>{translate("advising:counsellor.parentsUnavailable")}</p> : null}
              <div className={styles.previewActions}>
                <Link className={`${styles.secondary} ${styles.compactParents}`} to={intakePath(intake.intakeId)}>{parents.isSuccess ? translate('advising:counsellor.parentsCount', {number: formatNumber(parents.data.length)}) : translate('advising:counsellor.parents')}</Link>
                <Link className={styles.primary} aria-label={translate('common:navigationControls.selectAdvisor')} to={assignmentPath(intake.intakeId)}><span className={styles.actionLabelFull}>{translate('common:navigationControls.selectAdvisor')}</span><span className={styles.actionLabelShort}>{translate("common:roles.ADVISOR")}</span></Link>
                <Link className={styles.secondary} aria-label={translate("advising:counsellor.edit")} to={intakePath(intake.intakeId)}><span className={styles.actionLabelFull}>{translate("advising:counsellor.edit")}</span><span className={styles.actionLabelShort}>{translate("common:actions.edit")}</span></Link>
              </div>
              <dl className={styles.timestamps}>
                <div><dt>{translate("common:fields.created")}</dt><dd>{intake.createdAt ? formatUtcTimestamp(intake.createdAt) : '—'}</dd></div>
                <div><dt>{translate("common:fields.updated")}</dt><dd>{intake.updatedAt ? formatUtcTimestamp(intake.updatedAt) : '—'}</dd></div>
              </dl>
            </div>}
  </section>;
}
