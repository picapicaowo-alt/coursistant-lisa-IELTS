import React from 'react';
import {useTranslation} from 'react-i18next';
import {useQueries} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {GradingQueueItem, RecentActivityItem, unwrapData} from '@/apis';
import {dashboardApiService} from '@/apis/services/dashboard-api';
import {parseZonedTimestamp} from '@/utils/datetime';
import {formatDateTime} from '@/i18n/formatting';
import styles from './InstructorWorkComponent.module.scss';

const queueLink = (item: GradingQueueItem) => item.assignmentId
  ? `/course/${item.courseId}/assignments/${item.assignmentId}/grading`
  : `/course/${item.courseId}/quizzes/${item.quizId}/grading`;

const activityLink = (item: RecentActivityItem) => {
  if (item.assignmentId) return `/course/${item.courseId}/assignments/${item.assignmentId}/grading`;
  if (item.groupSetId) return `/course/${item.courseId}/group-sets/${item.groupSetId}`;
  return `/course/${item.courseId}`;
};

const queueLabel = (kind: GradingQueueItem['kind']) => ({
  AssignmentUngraded: 'Needs grading',
  QuizManualPending: 'Manual grading',
  AssignmentAwaitingRelease: 'Ready to release',
  QuizAwaitingRelease: 'Ready to release',
}[kind]);

const InstructorWorkComponent: React.FC = () => {
  useTranslation();
  const [queueQuery, activityQuery] = useQueries({
    queries: [
      {
        queryKey: ['dashboard', 'teaching', 'grading-queue'],
        queryFn: async () => unwrapData(await dashboardApiService.getGradingQueue(), 'getGradingQueue'),
        staleTime: 60_000,
        retry: 1,
      },
      {
        queryKey: ['dashboard', 'teaching', 'recent-activity'],
        queryFn: async () => unwrapData(await dashboardApiService.getRecentActivity(), 'getRecentActivity'),
        staleTime: 60_000,
        retry: 1,
      },
    ],
  });
  const queue = (queueQuery.data ?? []) as GradingQueueItem[];
  const activity = (activityQuery.data ?? []) as RecentActivityItem[];
  const loading = queueQuery.isPending || activityQuery.isPending;
  const failed = queueQuery.isError || activityQuery.isError;

  return (
    <section className={styles.widget} aria-labelledby="instructor-work-title">
      <header className={styles.header}>
        <div><h2 id="instructor-work-title">Teaching activity</h2><p>Grade current work and review recent course changes.</p></div>
        {failed ? <button type="button" onClick={() => { void queueQuery.refetch(); void activityQuery.refetch(); }}>Retry</button> : null}
      </header>

      {loading ? <p className={styles.status}>Loading teaching activity…</p> : null}
      {!loading ? (
        <div className={styles.columns}>
          <section aria-labelledby="grading-queue-title">
            <div className={styles.sectionTitle}><h3 id="grading-queue-title">Grading queue</h3><span>{queue.length}</span></div>
            {queueQuery.isError ? <p className={styles.inlineError}>Couldn&apos;t load the grading queue.</p> : null}
            {!queueQuery.isError && queue.length === 0 ? <p className={styles.empty}>No grading work is waiting.</p> : null}
            <div className={styles.list}>
              {queue.map(item => (
                <Link key={`${item.kind}-${item.courseId}-${item.assignmentId ?? item.quizId}`} to={queueLink(item)} className={styles.item}>
                  <span className={styles.itemMain}><strong>{item.title}</strong><small>{item.courseCode} · {queueLabel(item.kind)}</small></span>
                  <span className={styles.count}>{item.pendingCount}</span>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="recent-activity-title">
            <div className={styles.sectionTitle}><h3 id="recent-activity-title">Recent activity</h3><span>{activity.length}</span></div>
            {activityQuery.isError ? <p className={styles.inlineError}>Couldn&apos;t load recent activity.</p> : null}
            {!activityQuery.isError && activity.length === 0 ? <p className={styles.empty}>No recent teaching activity.</p> : null}
            <div className={styles.list}>
              {activity.map((item, index) => {
                const occurredAt = parseZonedTimestamp(item.occurredAt, item.timezone);
                const hasTime = !Number.isNaN(occurredAt.getTime());
                return (
                <Link key={`${item.kind}-${item.occurredAt}-${index}`} to={activityLink(item)} className={styles.item}>
                  <span className={styles.itemMain}><strong>{item.summary}</strong><small>{item.courseCode} · <time dateTime={hasTime ? occurredAt.toISOString() : undefined}>{hasTime ? formatDateTime(occurredAt, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'}) : item.occurredAt}</time></small></span>
                  <span aria-hidden="true">›</span>
                </Link>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
};

export default InstructorWorkComponent;
