import {getApiErrorMessage, isHttpStatus} from '@/utils/apiError';
import styles from './index.module.scss';

/** Permission and hidden-resource failures are terminal for the current selection. */
export function QueryFeedback({pending, error, onRetry}: {
  pending: boolean; error: unknown; onRetry: () => void;
}) {
  if (pending) return <p role="status">Loading…</p>;
  if (!error) return null;
  const terminal = isHttpStatus(error, 403) || isHttpStatus(error, 404);
  return <div role="alert" className={styles.feedback}><p>{getApiErrorMessage(error, 'This section could not be loaded.')}</p>
    {!terminal ? <button type="button" onClick={onRetry}>Retry</button> : null}
  </div>;
}
