import {ADVISOR_RISKS, ACTION_TASK_TYPES, type AdvisorStudentFilters} from '@/apis/types/advisorWorkspace';
import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import {formatPersonName} from '@/utils/personName';

const AdvisorStudentsPage: React.FC = () => {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<AdvisorStudentFilters>({});
  const query = useQuery({
    queryKey: [...advisingQueryKeys.advisorStudents(page, 20), filters],
    queryFn: async () => unwrapData(await advisorApiService.listStudents(page, 20, filters), 'listAdvisorStudents'),
  });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 20));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>

          <h1>Student queue</h1>
          <p className={styles.lede}>ACTIVE students currently assigned to you in this tenant. Reassignment is immediate — you will not see a student after they leave.</p>
        </div>
      </header>
      <section className={styles.form} aria-label="Student filters">
        <label>Search students<input type="search" maxLength={100} value={filters.q ?? ''} onChange={event => {setFilters(current => ({...current, q: event.target.value || undefined})); setPage(0);}}/></label>
        <label>Risk<select value={filters.risk ?? ''} onChange={event => {setFilters(current => ({...current, risk: event.target.value as AdvisorStudentFilters['risk'] || undefined})); setPage(0);}}><option value="">All risks</option>{ADVISOR_RISKS.map(risk => <option key={risk}>{risk}</option>)}</select></label>
        <label>Student type<select value={filters.studentType ?? ''} onChange={event => {setFilters(current => ({...current, studentType: event.target.value as AdvisorStudentFilters['studentType'] || undefined})); setPage(0);}}><option value="">All types</option><option>VIP</option><option>STANDARD</option></select></label>
        <label>Active task<select value={filters.activeTaskType ?? ''} onChange={event => {setFilters(current => ({...current, activeTaskType: event.target.value || undefined})); setPage(0);}}><option value="">All tasks</option>{ACTION_TASK_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
      </section>
      {query.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(query.error, 'Students could not be loaded.')}</p> : null}
      {query.isPending ? <p className={styles.status}>Loading students…</p> : null}
      {!query.isPending && !query.isError && items.length === 0 ? <p className={styles.status}>No assigned students yet.</p> : null}
      <div className={styles.list}>
        {items.map(student => (
          <article key={student.studentUserId} className={styles.row}>
            <div className={styles.identity}>
              <strong>{formatPersonName(student, `Student #${student.studentUserId}`)}</strong>
              <span>{student.email}</span>
              <small>{student.studentType} · assignment v{student.assignmentVersion}</small>
            </div>
            <Link className={styles.primary} to={`/advisor/students/${student.studentUserId}/intake`}>Open</Link>
          </article>
        ))}
      </div>
      {pageCount > 1 ? (
        <nav className={styles.pagination} aria-label="Student pages">
          <button type="button" className={styles.secondary} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span>{page + 1} / {pageCount}</span>
          <button type="button" className={styles.secondary} disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      ) : null}
    </div>
  );
};

export default AdvisorStudentsPage;
