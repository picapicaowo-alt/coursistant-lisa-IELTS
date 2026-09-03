import type {CourseProgressResponse} from '@/apis';
import styles from './index.module.scss';

export function AssignmentProgress({
  progress,
  loading = false,
  failed = false,
}: {
  progress?: CourseProgressResponse;
  loading?: boolean;
  failed?: boolean;
}) {
  const completed = progress?.completedAssignmentCount;
  const total = progress?.totalAssignmentCount;
  const valid =
    Number.isInteger(completed) &&
    Number.isInteger(total) &&
    completed! >= 0 &&
    total! > 0 &&
    completed! <= total!;
  return (
    <div className={styles.progress}>
      <span>
        Assignment completion
        {valid ? (
          <strong>{Math.round((completed! / total!) * 100)}%</strong>
        ) : null}
      </span>
      {valid ? (
        <>
          <progress
            aria-label="Assignment completion"
            max={total}
            value={completed}
          />
          <small>
            {completed} / {total} completed
          </small>
        </>
      ) : (
        <small>
          {loading
            ? 'Loading progress…'
            : failed
              ? 'Progress could not be loaded.'
              : total === 0
                ? 'No assignments published yet.'
                : 'No progress record available.'}
        </small>
      )}
    </div>
  );
}
