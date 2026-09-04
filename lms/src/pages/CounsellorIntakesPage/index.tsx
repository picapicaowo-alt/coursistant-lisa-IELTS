import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {counsellorApiService} from '@/apis/services/counsellor-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {assignmentPath, intakePath} from '../CounsellorDashboardPage/presentation';
import {formatPersonName} from '@/utils/personName';

const PAGE_SIZE = 20;

const CounsellorIntakesPage: React.FC = () => {
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: advisingQueryKeys.counsellorIntakes(page, PAGE_SIZE),
    queryFn: async () => unwrapData(await counsellorApiService.listStudentIntakes(page, PAGE_SIZE), 'listIntakes'),
  });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>

          <h1>Unassigned intakes</h1>
          <p className={styles.lede}>Only OPEN intakes you created in this tenant, before the first advisor assignment.</p>
        </div>
        <Link className={styles.primary} to={APP_ROUTE_PATHS.counsellorIntakesNew}>Create student</Link>
      </header>
      {query.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(query.error, 'Intakes could not be loaded.')}</p> : null}
      {query.isPending ? <p className={styles.status}>Loading intakes…</p> : null}
      {!query.isPending && !query.isError && items.length === 0 ? <p className={styles.status}>No unassigned intakes.</p> : null}
      <div className={styles.grid}>
        <div className={styles.list}>
          {items.map(intake => (
            <article key={intake.intakeId} className={styles.row}>
              <div className={styles.identity}>
                <strong>{formatPersonName(intake, `Student #${intake.studentUserId}`)}</strong>
                <span>{intake.email}</span>
                <small>{intake.studentType} · version {intake.intakeVersion}</small>
              </div>
              <div className={styles.actions}>
                <Link className={styles.link} to={intakePath(intake.intakeId)}>Edit</Link>
                <Link className={styles.primary} to={assignmentPath(intake.intakeId)}>Assign advisor</Link>
              </div>
            </article>
          ))}
        </div>
        {pageCount > 1 ? (
          <nav className={styles.pagination} aria-label="Intake pages">
            <button type="button" className={styles.secondary} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <span>{page + 1} / {pageCount}</span>
            <button type="button" className={styles.secondary} disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Next</button>
          </nav>
        ) : null}
      </div>
    </div>
  );
};

export default CounsellorIntakesPage;
