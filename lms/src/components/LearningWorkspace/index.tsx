import type {LucideIcon} from 'lucide-react';
import {Inbox} from 'lucide-react';
import {TeachingState} from '@/components/TeachingWorkspace';
import styles from './index.module.scss';

export function LearningEmpty({title, description, icon: Icon = Inbox}: {title: string; description?: string; icon?: LucideIcon}) {
  return <div className={styles.empty}><span className={styles.emptyIcon}><Icon size={25} aria-hidden="true"/></span><strong>{title}</strong>{description ? <p>{description}</p> : null}</div>;
}

export function LearningQueryState({query}: {query: {isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown}}) {
  return query.isPending || query.isError ? <TeachingState compact loading={query.isPending} error={query.isError ? query.error ?? new Error('This section could not be loaded.') : undefined} onRetry={() => void query.refetch()}/> : null;
}

const complete = new Set(['COMPLETED', 'REACHED_COMPLETED', 'PRESENT', 'APPROVED', 'PUBLISHED', 'ACTIVE']);
const active = new Set(['IN_PROGRESS', 'ONGOING']);
const warning = new Set(['PENDING', 'SCHEDULED', 'REACHED_INCOMPLETE', 'APPROVED_ABSENCE', 'EXCUSED']);
const danger = new Set(['OVERDUE', 'ABSENT', 'UNAPPROVED_ABSENCE', 'REJECTED']);
export function LearningBadge({value, label}: {value?: string; label?: string}) {
  const status = value?.toUpperCase() ?? '';
  const tone = complete.has(status) ? 'success' : active.has(status) ? 'brand' : warning.has(status) ? 'warning' : danger.has(status) ? 'danger' : 'neutral';
  return <span className={styles.badge} data-tone={tone}>{label || (value ? value.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : 'Not available')}</span>;
}
