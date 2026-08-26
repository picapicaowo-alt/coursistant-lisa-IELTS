import React from 'react';
import {useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {tenantAdvisingApiService} from '@/apis/services/tenant-advising-api';
import {isNotFound} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';

const TenantStudentRecordPage: React.FC = () => {
  const {studentUserId} = useParams();
  const id = Number(studentUserId);
  const profile = useQuery({
    queryKey: advisingQueryKeys.tenantProfile(id),
    queryFn: async () => unwrapData(await tenantAdvisingApiService.getStudentProfile(id), 'tenantProfile'),
    enabled: Number.isInteger(id),
    retry: false,
  });
  const plan = useQuery({
    queryKey: advisingQueryKeys.tenantStudyPlan(id),
    queryFn: async () => unwrapData(await tenantAdvisingApiService.getStudentStudyPlan(id), 'tenantStudyPlan'),
    enabled: Number.isInteger(id),
    retry: false,
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Tenant admin</p>
          <h1>Student record #{id}</h1>
          <p className={styles.lede}>Read-only. Advisor private notes are not included in this contract.</p>
        </div>
      </header>
      <section className={styles.card}>
        <h2>Profile</h2>
        {profile.isPending ? <p className={styles.status}>Loading…</p> : null}
        {profile.isError && isNotFound(profile.error) ? <p className={styles.status}>No profile yet.</p> : null}
        {profile.isError && !isNotFound(profile.error) ? <p className={styles.error} role="alert">{advisingErrorMessage(profile.error, 'Profile could not be loaded.')}</p> : null}
        {profile.data ? (
          <dl className={styles.readonly}>
            <dt>Name</dt><dd>{profile.data.name}</dd>
            <dt>Advisor</dt><dd>{profile.data.advisorUserId ?? '—'}</dd>
            <dt>Goal</dt><dd>{profile.data.targetGoal || '—'}</dd>
          </dl>
        ) : null}
        {'advisorPrivateNotes' in (profile.data ?? {}) ? <p className={styles.error}>Private notes leaked into the tenant view.</p> : null}
      </section>
      <section className={styles.card}>
        <h2>Study plan</h2>
        {plan.isPending ? <p className={styles.status}>Loading…</p> : null}
        {plan.isError && isNotFound(plan.error) ? <p className={styles.status}>No study plan yet.</p> : null}
        {plan.isError && !isNotFound(plan.error) ? <p className={styles.error} role="alert">{advisingErrorMessage(plan.error, 'Study plan could not be loaded.')}</p> : null}
        {plan.data ? <p>{plan.data.plan.strategySummary} · version {plan.data.plan.studyPlanVersion}</p> : null}
      </section>
    </main>
  );
};

export default TenantStudentRecordPage;
