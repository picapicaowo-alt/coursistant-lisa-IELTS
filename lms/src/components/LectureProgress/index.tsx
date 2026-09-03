import styles from '../AssignmentProgress/index.module.scss';

/** These counts describe ended scheduled classes, never video playback. */
export function LectureProgress({completed, total}: {completed?: number | null; total?: number | null}) {
  if (completed == null || total == null || !Number.isInteger(completed) || !Number.isInteger(total) || completed < 0 || total < 0 || completed > total) return null;
  return <div className={styles.progress}><span>Class completion{total > 0 ? <strong>{Math.round(completed / total * 100)}%</strong> : null}</span>{total > 0 ? <progress aria-label="Class completion" value={completed} max={total}/> : null}<small>{completed} / {total} classes completed</small></div>;
}
