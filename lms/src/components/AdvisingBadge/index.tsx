import {PRIORITY_KEYS, RISK_KEYS, ACTION_CATEGORY_KEYS, ACTION_STATUS_KEYS} from './labels';
import styles from './index.module.scss';
import {useTranslation} from 'react-i18next';

/** Priority and risk are distinct server fields. Never derive one from the other. */
export function AdvisingBadge({value, label, kind = 'priority'}: {value?: string; label?: string; kind?: 'priority' | 'risk' | 'category' | 'status'}) {
  const {t} = useTranslation();
  const labels = kind === 'risk' ? RISK_KEYS : kind === 'category' ? ACTION_CATEGORY_KEYS : kind === 'status' ? ACTION_STATUS_KEYS : PRIORITY_KEYS;
  return <span className={styles.badge} data-kind={kind} data-value={value}>{value ? label ?? (labels[value] ? t(labels[value]) : value) : t('common:risk.notAssessed')}</span>;
}
