import styles from './ProgressRing.module.scss';
import {useTranslation} from 'react-i18next';
import {formatPercent} from '@/i18n/formatting';

interface ProgressRingProps {
  value: number;
  max: number;
  label: string;
  size?: 'small' | 'large';
}

export const ProgressRing = ({value, max, label, size = 'small'}: ProgressRingProps) => {
  useTranslation();
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      className={`${styles.ring} ${size === 'large' ? styles.large : ''}`}
      style={{'--progress': `${percent * 3.6}deg`} as React.CSSProperties}
      role="img"
      aria-label={`${label}: ${formatPercent(percent / 100)}`}
    >
      <div className={styles.center}>
        <strong>{formatPercent(percent / 100)}</strong>
        {size === 'large' ? <span>{label}</span> : null}
      </div>
    </div>
  );
};
