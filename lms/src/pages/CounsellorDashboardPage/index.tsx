import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {counsellorApiService} from '@/apis/services/counsellor-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';

const CounsellorDashboardPage: React.FC = () => {
  const [activeMetric, setActiveMetric] = useState<'created' | 'assigned' | null>(null);
  const query = useQuery({
    queryKey: advisingQueryKeys.counsellorDashboard,
    queryFn: async () => unwrapData(await counsellorApiService.getDashboard(), 'counsellorDashboard'),
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>

          <h1>Intake dashboard</h1>
          <p className={styles.lede}>Counts are independent. They do not have to add up.</p>
        </div>
        <Link className={styles.primary} to="/counsellor/intakes/new">Create student</Link>
      </header>
      {query.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(query.error, 'Dashboard could not be loaded.')}</p> : null}
      {query.isPending ? <p className={styles.status}>Loading dashboard…</p> : null}
      {query.data ? (
        <section className={styles.stats} aria-label="Intake counts">
          <button type="button" className={styles.statButton} aria-pressed={activeMetric === 'created'} onClick={() => setActiveMetric(current => current === 'created' ? null : 'created')}><strong>{query.data.createdCount}</strong><span>Created</span><small>About this count</small></button>
          <button type="button" className={styles.statButton} aria-pressed={activeMetric === 'assigned'} onClick={() => setActiveMetric(current => current === 'assigned' ? null : 'assigned')}><strong>{query.data.assignedCount}</strong><span>Assigned</span><small>About handover</small></button>
          <Link className={styles.statLink} to="/counsellor/intakes"><strong>{query.data.unassignedCount}</strong><span>Unassigned</span><small>Open queue →</small></Link>
        </section>
      ) : null}
      {activeMetric ? <section className={styles.dashboardNotice} aria-live="polite">
        <strong>{activeMetric === 'created' ? 'Created is a lifetime intake count' : 'Assigned means the handover is complete'}</strong>
        <p>{activeMetric === 'created' ? 'Cancelled records can remain in this count, so it may not equal Assigned plus Unassigned.' : 'Counsellor access ends as soon as a student is handed over. The assigned Advisor takes over the student record; contact your Tenant Admin if reassignment is needed.'}</p>
      </section> : null}
      <section className={styles.capabilityGrid} aria-label="Counsellor workflow">
        <div><span>1</span><strong>Create the intake</strong><p>Create the Student account and admissions record together. The student sets a password through Forgot password.</p></div>
        <div><span>2</span><strong>Complete the record</strong><p>Edit your open intake and add or remove Parent links before assignment.</p></div>
        <div><span>3</span><strong>Hand over to an Advisor</strong><p>Select an eligible Advisor. Successful assignment immediately closes Counsellor access.</p></div>
      </section>
    </div>
  );
};

export default CounsellorDashboardPage;
