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
  const query = useQuery({
    queryKey: advisingQueryKeys.advisorStudents(page, 20),
    queryFn: async () => unwrapData(await advisorApiService.listStudents(page, 20), 'listAdvisorStudents'),
  });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 20));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Advisor</p>
          <h1>Student queue</h1>
          <p className={styles.lede}>ACTIVE students currently assigned to you in this tenant. Reassignment is immediate — you will not see a student after they leave.</p>
        </div>
      </header>
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
    </main>
  );
};

export default AdvisorStudentsPage;
