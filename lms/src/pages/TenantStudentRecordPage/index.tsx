import React, {useState} from 'react';
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
  const [revisionPage, setRevisionPage] = useState(0);
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
  const revisions = useQuery({
    queryKey: advisingQueryKeys.tenantRevisions(id, revisionPage),
    queryFn: async () => unwrapData(
      await tenantAdvisingApiService.listStudyPlanRevisions(id, revisionPage, 20),
      'tenantStudyPlanRevisions',
    ),
    enabled: Number.isInteger(id) && plan.isSuccess,
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
      {plan.data ? (
        <section className={styles.card}>
          <h2>Study plan revisions</h2>
          <p className={styles.muted}>Immutable metadata only. Revisions cannot be edited here.</p>
          {revisions.isPending ? <p className={styles.status}>Loading revisions…</p> : null}
          {revisions.isError ? (
            <p className={styles.error} role="alert">
              {advisingErrorMessage(revisions.error, 'Study plan revisions could not be loaded.')}
            </p>
          ) : null}
          {revisions.data && revisions.data.items.length === 0 ? (
            <p className={styles.status}>No revisions yet.</p>
          ) : null}
          {(revisions.data?.items ?? []).map(revision => (
            <p key={`${revision.entityVersion}-${revision.createdAt}`}>
              {revision.action} · v{revision.entityVersion} · {revision.createdAt} · actor {revision.actorId}
            </p>
          ))}
          {revisions.data && revisions.data.total > 20 ? (
            <nav className={styles.pagination} aria-label="Study plan revision pages">
              <button
                type="button"
                className={styles.secondary}
                disabled={revisionPage === 0}
                onClick={() => setRevisionPage(page => page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={(revisionPage + 1) * 20 >= revisions.data.total}
                onClick={() => setRevisionPage(page => page + 1)}
              >
                Next
              </button>
            </nav>
          ) : null}
        </section>
      ) : null}
    </main>
  );
};

export default TenantStudentRecordPage;
