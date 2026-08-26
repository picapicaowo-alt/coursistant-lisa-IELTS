import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {isNotFound} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';

const StudentAdvisingPage: React.FC = () => {
  const profile = useQuery({
    queryKey: advisingQueryKeys.studentProfile,
    queryFn: async () => unwrapData(await advisorApiService.getOwnProfile(), 'studentProfile'),
    retry: false,
  });
  const plan = useQuery({
    queryKey: advisingQueryKeys.studentStudyPlan,
    queryFn: async () => unwrapData(await advisorApiService.getOwnStudyPlan(), 'studentStudyPlan'),
    retry: false,
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Student</p>
          <h1>My advising record</h1>
          <p className={styles.lede}>Read-only. Your advisor maintains the profile and study plan.</p>
        </div>
      </header>
      <section className={styles.card}>
        <h2>Profile</h2>
        {profile.isPending ? <p className={styles.status}>Loading profile…</p> : null}
        {profile.isError && isNotFound(profile.error) ? <p className={styles.status}>Your advisor has not created a profile yet.</p> : null}
        {profile.isError && !isNotFound(profile.error) ? <p className={styles.error} role="alert">{advisingErrorMessage(profile.error, 'Profile could not be loaded.')}</p> : null}
        {profile.data ? (
          <dl className={styles.readonly}>
            <dt>Name</dt><dd>{profile.data.name}</dd>
            <dt>Goal</dt><dd>{profile.data.targetGoal || '—'}</dd>
            <dt>Target</dt><dd>{[profile.data.targetMetric, profile.data.targetValue, profile.data.targetDate].filter(Boolean).join(' · ') || '—'}</dd>
            <dt>Skills</dt>
            <dd>
              {(profile.data.skills ?? []).map(skill => (
                <div key={skill.skillCode}>{skill.displayName}: {skill.currentValue || '—'} → {skill.targetValue || '—'}</div>
              ))}
            </dd>
          </dl>
        ) : null}
        {'advisorPrivateNotes' in (profile.data ?? {}) ? <p className={styles.error}>Private notes leaked into the student view.</p> : null}
      </section>
      <section className={styles.card}>
        <h2>Study plan</h2>
        {plan.isPending ? <p className={styles.status}>Loading study plan…</p> : null}
        {plan.isError && isNotFound(plan.error) ? <p className={styles.status}>Your advisor has not created a study plan yet.</p> : null}
        {plan.isError && !isNotFound(plan.error) ? <p className={styles.error} role="alert">{advisingErrorMessage(plan.error, 'Study plan could not be loaded.')}</p> : null}
        {plan.data ? (
          <div>
            <p>{plan.data.plan.strategySummary}</p>
            <p className={styles.muted}>{plan.data.plan.startDate} – {plan.data.plan.planEndDate} · version {plan.data.plan.studyPlanVersion}</p>
            {(plan.data.plan.checkpoints ?? []).map(checkpoint => (
              <article key={checkpoint.id ?? checkpoint.position} className={styles.nested}>
                <strong>{checkpoint.description}</strong>
                <p>{checkpoint.goal}</p>
                <p className={styles.muted}>Due {checkpoint.dueDate}</p>
                {(checkpoint.tasks ?? []).map(task => (
                  <p key={task.id ?? task.position}>{task.title} {task.dueDate ? `· ${task.dueDate}` : ''}</p>
                ))}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
};

export default StudentAdvisingPage;
