import React from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {counsellorApiService} from '@/apis/services/counsellor-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';

const CounsellorDashboardPage: React.FC = () => {
  const query = useQuery({
    queryKey: advisingQueryKeys.counsellorDashboard,
    queryFn: async () => unwrapData(await counsellorApiService.getDashboard(), 'counsellorDashboard'),
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Counsellor</p>
          <h1>Intake dashboard</h1>
          <p className={styles.lede}>Counts are independent. They do not have to add up.</p>
        </div>
        <Link className={styles.primary} to="/counsellor/intakes/new">Create student</Link>
      </header>
      {query.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(query.error, 'Dashboard could not be loaded.')}</p> : null}
      {query.isPending ? <p className={styles.status}>Loading dashboard…</p> : null}
      {query.data ? (
        <section className={styles.stats} aria-label="Intake counts">
          <article className={styles.stat}><strong>{query.data.createdCount}</strong><span>Created</span></article>
          <article className={styles.stat}><strong>{query.data.assignedCount}</strong><span>Assigned</span></article>
          <article className={styles.stat}><strong>{query.data.unassignedCount}</strong><span>Unassigned</span></article>
        </section>
      ) : null}
      <p className={styles.toolbar}><Link className={styles.link} to="/counsellor/intakes">Open unassigned queue</Link></p>
    </main>
  );
};

export default CounsellorDashboardPage;
