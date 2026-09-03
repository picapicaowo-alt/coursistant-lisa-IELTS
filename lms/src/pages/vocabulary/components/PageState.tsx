import {AlertCircle, BookOpen, RefreshCw} from 'lucide-react';
import styles from './PageState.module.scss';

interface PageStateProps {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  detail: string;
  onRetry?: () => void;
  actionLabel?: string;
  actionPending?: boolean;
}

export const PageState = ({
  kind,
  title,
  detail,
  onRetry,
  actionLabel = 'Try again',
  actionPending = false,
}: PageStateProps) => (
  <div className={styles.state} role={kind === 'error' ? 'alert' : 'status'}>
    <div className={styles.icon} aria-hidden="true">
      {kind === 'error' ? <AlertCircle/> : <BookOpen/>}
    </div>
    <h2>{title}</h2>
    <p>{detail}</p>
    {onRetry ? (
      <button type="button" onClick={onRetry} disabled={actionPending}>
        <RefreshCw size={16}/>
        {actionPending ? 'Resuming…' : actionLabel}
      </button>
    ) : null}
  </div>
);
