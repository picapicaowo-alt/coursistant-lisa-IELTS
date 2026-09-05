import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {UserRound} from 'lucide-react';
import type {UseQueryResult} from '@tanstack/react-query';
import type {ParentStudentLinkResponse, StudentIntakeResponse} from '@/apis';
import {formatPersonName} from '@/utils/personName';
import {formatUtcTimestamp} from '@/utils/datetime';
import {ASSIGNMENT_LABELS, STUDENT_TYPE_LABELS, assignmentPath, intakePath} from './presentation';
import {QueryError} from './WorkspaceFeedback';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from './index.module.scss';

export function IntakePreview({query, parents, selectedId, unavailable}: {
  query: UseQueryResult<StudentIntakeResponse, Error>;
  parents: UseQueryResult<ParentStudentLinkResponse[], Error>;
  selectedId: number | null; unavailable: boolean;
}) {
  const {t: translate} = useTranslation();
  const intake = query.data;
  return <section className={`${styles.panel} ${styles.previewPanel}`} id="intake-preview" aria-labelledby="intake-preview-title">
    <header className={styles.panelHeader}><h2 id="intake-preview-title" aria-label="Intake preview"><span className={styles.previewHeading}>Intake preview</span><span className={styles.compactStudentName}>{intake && !unavailable && !query.isError ? formatPersonName(intake, 'Intake preview') : 'Intake preview'}</span></h2><UserRound size={19} aria-hidden="true"/></header>
    {selectedId === null ? <div className={styles.emptyState}><p>Select a student from your intake queue to see their details.</p></div> :
      unavailable ? <p className={styles.feedback} role="status">This intake is no longer available. The queue is being refreshed.</p> :
        query.isError ? <QueryError error={query.error} fallback="Intake could not be loaded." onRetry={() => void query.refetch()}/> :
          query.isPending || !intake ? <p className={styles.feedback} role="status">Loading intake…</p> :
            <div className={styles.previewBody} data-parent-error={parents.isError}>
              <div className={styles.previewIdentity}>
                <h3>{formatPersonName(intake, `Student #${intake.studentUserId}`)}</h3>
                <p>{intake.email || 'Email not provided'}</p>
                <div className={styles.badges}><span className={styles.badge}>{ASSIGNMENT_LABELS[intake.assignmentStatus]}</span>{intake.studentType ? <span className={styles.neutralBadge}>{STUDENT_TYPE_LABELS[intake.studentType]}</span> : null}</div>
              </div>
              <dl className={styles.recordFields}>
                <div><dt>Course request</dt><dd>{intake.courseRequest || 'Not provided'}</dd></div>
                <div className={styles.extendedField}><dt>Contact phone</dt><dd>{intake.contactPhone || 'Not provided'}</dd></div>
                <div className={styles.extendedField}><dt>Background</dt><dd>{intake.basicBackground || 'Not provided'}</dd></div>
              </dl>
              <div className={styles.parentSummary} data-error={parents.isError}>
                <div className={styles.sectionLabel}><h3>Parent / guardian{parents.isSuccess && parents.data.length > 1 ? ` (${parents.data.length})` : ''}</h3><Link className={styles.textLink} to={intakePath(intake.intakeId)}>Manage</Link></div>
                {parents.isError ? <QueryError error={parents.error} fallback="Parent links could not be loaded." onRetry={() => void parents.refetch()}/> : parents.isPending ?
                  <p className={styles.muted} role="status">Loading parent links…</p> : parents.data?.length ?
                    <ul>{parents.data.slice(0, 1).map((parent, index) => <li key={parent.linkId ?? parent.parentUserId ?? index}>
                      <strong>{formatPersonName({firstName: parent.parentFirstName, middleName: parent.parentMiddleName, lastName: parent.parentLastName}, 'Parent / guardian')}</strong>
                      {parent.parentEmail ? <span>{parent.parentEmail}</span> : null}
                    </li>)}</ul> : <p className={styles.muted}>No parent or guardian linked</p>}
              </div>
              {parents.isError ? <p className={styles.compactParentError} role="alert" title={advisingErrorMessage(parents.error, 'Parent links could not be loaded.')}>Parent links unavailable</p> : null}
              <div className={styles.previewActions}>
                <Link className={`${styles.secondary} ${styles.compactParents}`} to={intakePath(intake.intakeId)}>Parents{parents.isSuccess ? ` (${parents.data.length})` : ''}</Link>
                <Link className={styles.primary} aria-label={translate('common:navigationControls.selectAdvisor')} to={assignmentPath(intake.intakeId)}><span className={styles.actionLabelFull}>{translate('common:navigationControls.selectAdvisor')}</span><span className={styles.actionLabelShort}>{translate("common:roles.ADVISOR")}</span></Link>
                <Link className={styles.secondary} aria-label="Edit intake" to={intakePath(intake.intakeId)}><span className={styles.actionLabelFull}>Edit intake</span><span className={styles.actionLabelShort}>Edit</span></Link>
              </div>
              <dl className={styles.timestamps}>
                <div><dt>Created</dt><dd>{intake.createdAt ? formatUtcTimestamp(intake.createdAt) : '—'}</dd></div>
                <div><dt>Updated</dt><dd>{intake.updatedAt ? formatUtcTimestamp(intake.updatedAt) : '—'}</dd></div>
              </dl>
            </div>}
  </section>;
}
