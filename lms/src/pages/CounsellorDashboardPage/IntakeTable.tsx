import type {Ref} from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight, Inbox} from 'lucide-react';
import type {UseQueryResult} from '@tanstack/react-query';
import type {AdvisingPage, StudentIntakeResponse} from '@/apis';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {formatPersonName} from '@/utils/personName';
import {ASSIGNMENT_LABELS, STUDENT_TYPE_LABELS, intakePath} from './presentation';
import {IntakeTimestamp, QueryError, WorkspacePagination} from './WorkspaceFeedback';
import styles from './index.module.scss';

export function IntakeTable({query, selectedId, onSelect, onPageChange, tableRef}: {
  query: UseQueryResult<AdvisingPage<StudentIntakeResponse>, Error>;
  selectedId: number | null; onSelect: (id: number) => void; onPageChange: (page: number) => void; tableRef: Ref<HTMLDivElement>;
}) {
  const items = query.data?.items ?? [];
  return <section className={`${styles.panel} ${styles.intakesPanel}`} aria-labelledby="your-intakes-title">
    <header className={styles.panelHeader}>
      <h2 id="your-intakes-title"><Link className={styles.headingLink} to={APP_ROUTE_PATHS.counsellorIntakes}>Your intakes</Link>{query.data && !query.isError ? <span className={styles.count}>{query.data.total}</span> : null}</h2>
      {query.data && !query.isError ? <WorkspacePagination {...query.data} label="intake pages" onChange={onPageChange}/> : null}
    </header>
    <div ref={tableRef} className={styles.tableContainer}>
    {query.isPending ? <p className={styles.feedback} role="status">Loading intakes…</p> : query.isError ?
      <QueryError error={query.error} fallback="Intakes could not be loaded." onRetry={() => void query.refetch()}/> : items.length === 0 ?
        <div className={styles.emptyState}><Inbox size={30} aria-hidden="true"/><h3>No unassigned intakes</h3><p>New student intakes will appear here until they are handed to an Advisor.</p><Link className={styles.secondary} to={APP_ROUTE_PATHS.counsellorIntakesNew}>Create an intake</Link></div> : <>
            <table className={styles.table}>
              <thead><tr><th scope="col">Student</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col">Updated</th><th scope="col">Action</th></tr></thead>
              <tbody>{items.map(intake => <tr key={intake.intakeId} data-selected={selectedId === intake.intakeId}>
                <td data-label="Student"><button type="button" className={styles.studentButton} aria-pressed={selectedId === intake.intakeId} aria-controls="intake-preview" onClick={() => onSelect(intake.intakeId)}>
                  <strong>{formatPersonName(intake, `Student #${intake.studentUserId}`)}</strong>
                  <span>{intake.email || 'Email not provided'}</span>
                </button></td>
                <td data-label="Status"><span className={styles.badge}>{ASSIGNMENT_LABELS[intake.assignmentStatus]}</span>{intake.studentType ? <small className={styles.studentType}>{STUDENT_TYPE_LABELS[intake.studentType]}</small> : null}</td>
                <td data-label="Created"><IntakeTimestamp value={intake.createdAt}/></td>
                <td data-label="Updated"><IntakeTimestamp value={intake.updatedAt}/></td>
                <td data-label="Action"><Link className={styles.rowAction} to={intakePath(intake.intakeId)} aria-label={`Edit ${formatPersonName(intake, 'intake')}`}>Edit<ArrowUpRight size={14} aria-hidden="true"/></Link></td>
              </tr>)}</tbody>
            </table>
        </>}
    </div>
  </section>;
}
