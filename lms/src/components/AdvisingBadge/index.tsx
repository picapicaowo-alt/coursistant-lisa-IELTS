import {PRIORITY_LABELS, RISK_LABELS, ACTION_CATEGORY_LABELS, ACTION_STATUS_LABELS} from './labels';
import styles from './index.module.scss';

/** Priority and risk are distinct server fields. Never derive one from the other. */
export function AdvisingBadge({value, label, kind = 'priority'}: {value?: string; label?: string; kind?: 'priority' | 'risk' | 'category' | 'status'}) {
  const labels = kind === 'risk' ? RISK_LABELS : kind === 'category' ? ACTION_CATEGORY_LABELS : kind === 'status' ? ACTION_STATUS_LABELS : PRIORITY_LABELS;
  return <span className={styles.badge} data-kind={kind} data-value={value}>{value ? label ?? labels[value] ?? value : 'Not assessed'}</span>;
}
