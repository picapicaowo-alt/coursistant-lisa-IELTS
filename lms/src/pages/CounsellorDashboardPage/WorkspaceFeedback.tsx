import {ChevronLeft, ChevronRight} from 'lucide-react';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {getApiErrorCode, isNotFound} from '@/utils/apiError';
import {formatUtcTimestamp} from '@/utils/datetime';
import styles from './index.module.scss';

export function QueryError({error, fallback, onRetry}: {error: unknown; fallback: string; onRetry: () => void}) {
  const code = getApiErrorCode(error);
  const retryAllowed = !isNotFound(error) && !['INVALID_TOKEN', 'FORBIDDEN', 'ACCESS_DENIED'].includes(code ?? '');
  return <div className={styles.feedback} role="alert">
    <p>{advisingErrorMessage(error, fallback)}</p>
    {retryAllowed ? <button className={styles.secondary} type="button" onClick={onRetry}>Try again</button> : null}
  </div>;
}

export function WorkspacePagination({page, size, total, label, onChange}: {
  page: number; size: number; total: number; label: string; onChange: (page: number) => void;
}) {
  return <nav className={styles.pagination} aria-label={label}>
    <div>
      <button type="button" className={styles.iconButton} aria-label={`Previous ${label}`} disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={18}/></button>
      <span className={styles.pageNumber}>{page + 1} / {Math.max(1, Math.ceil(total / size))}</span>
      <button type="button" className={styles.iconButton} aria-label={`Next ${label}`} disabled={(page + 1) * size >= total} onClick={() => onChange(page + 1)}><ChevronRight size={18}/></button>
    </div>
  </nav>;
}

export function IntakeTimestamp({value}: {value?: string}) {
  if (!value) return <span className={styles.muted}>—</span>;
  return <time dateTime={value} title={formatUtcTimestamp(value)}>{formatUtcTimestamp(value, {month: 'short', day: 'numeric', year: 'numeric'})}</time>;
}
