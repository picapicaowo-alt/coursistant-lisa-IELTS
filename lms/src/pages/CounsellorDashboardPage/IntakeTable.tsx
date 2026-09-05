import {formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import { useTranslation } from 'react-i18next';
import type {Ref} from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight, Inbox} from 'lucide-react';
import type {UseQueryResult} from '@tanstack/react-query';
import type {AdvisingPage, StudentIntakeResponse} from '@/apis';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {formatPersonName} from '@/utils/personName';
import {intakePath} from './presentation';
import {IntakeTimestamp, QueryError, WorkspacePagination} from './WorkspaceFeedback';
import styles from './index.module.scss';

export function IntakeTable({query, selectedId, onSelect, onPageChange, tableRef}: {
  query: UseQueryResult<AdvisingPage<StudentIntakeResponse>, Error>;
  selectedId: number | null; onSelect: (id: number) => void; onPageChange: (page: number) => void; tableRef: Ref<HTMLDivElement>;
}) {
  const { t: translate } = useTranslation();
  const items = query.data?.items ?? [];
  return <section className={`${styles.panel} ${styles.intakesPanel}`} aria-labelledby="your-intakes-title">
    <header className={styles.panelHeader}>
      <h2 id="your-intakes-title"><Link className={styles.headingLink} to={APP_ROUTE_PATHS.counsellorIntakes}>{translate("advising:counsellor.yourIntakes")}</Link>{query.data && !query.isError ? <span className={styles.count}>{formatNumber(query.data.total)}</span> : null}</h2>
      {query.data && !query.isError ? <WorkspacePagination {...query.data} label={translate('advising:counsellor.intakePages')} onChange={onPageChange}/> : null}
    </header>
    <div ref={tableRef} className={styles.tableContainer}>
    {query.isPending ? <p className={styles.feedback} role="status">{translate("advising:counsellor.loadingIntakes")}</p> : query.isError ?
      <QueryError error={query.error} fallback={translate('advising:counsellor.intakesFailed')} onRetry={() => void query.refetch()}/> : items.length === 0 ?
        <div className={styles.emptyState}><Inbox size={30} aria-hidden="true"/><h3>{translate("advising:counsellor.emptyIntakes")}</h3><p>{translate("advising:counsellor.emptyIntakesHelp")}</p><Link className={styles.secondary} to={APP_ROUTE_PATHS.counsellorIntakesNew}>{translate("advising:intake.createAction")}</Link></div> : <>
            <table className={styles.table}>
              <thead><tr><th scope="col">{translate("common:roles.STUDENT")}</th><th scope="col">{translate("common:fields.status")}</th><th scope="col">{translate("common:fields.created")}</th><th scope="col">{translate("common:fields.updated")}</th><th scope="col">{translate("advising:counsellor.action")}</th></tr></thead>
              <tbody>{items.map(intake => <tr key={intake.intakeId} data-selected={selectedId === intake.intakeId}>
                <td data-label={translate("common:roles.STUDENT")}><button type="button" className={styles.studentButton} aria-pressed={selectedId === intake.intakeId} aria-controls="intake-preview" onClick={() => onSelect(intake.intakeId)}>
                  <strong>{formatPersonName(intake, translate('common:people.studentFallback', {id: formatNumber(intake.studentUserId)}))}</strong>
                  <span>{intake.email || translate("advising:counsellor.noEmail")}</span>
                </button></td>
                <td data-label={translate("common:fields.status")}><span className={styles.badge}>{statusLabel(intake.assignmentStatus)}</span>{intake.studentType ? <small className={styles.studentType}>{statusLabel(intake.studentType)}</small> : null}</td>
                <td data-label={translate("common:fields.created")}><IntakeTimestamp value={intake.createdAt}/></td>
                <td data-label={translate("common:fields.updated")}><IntakeTimestamp value={intake.updatedAt}/></td>
                <td data-label={translate("advising:counsellor.action")}><Link className={styles.rowAction} to={intakePath(intake.intakeId)} aria-label={translate('common:actions.editNamed', {name: formatPersonName(intake, translate('advising:counsellor.preview'))})}>{translate("common:actions.edit")}<ArrowUpRight size={14} aria-hidden="true"/></Link></td>
              </tr>)}</tbody>
            </table>
        </>}
    </div>
  </section>;
}
