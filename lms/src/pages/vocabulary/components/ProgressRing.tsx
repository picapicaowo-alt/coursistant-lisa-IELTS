import styles from './ProgressRing.module.scss';

interface ProgressRingProps {
  value: number;
  max: number;
  label: string;
  size?: 'small' | 'large';
}

export const ProgressRing = ({value, max, label, size = 'small'}: ProgressRingProps) => {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      className={`${styles.ring} ${size === 'large' ? styles.large : ''}`}
      style={{'--progress': `${percent * 3.6}deg`} as React.CSSProperties}
      role="img"
      aria-label={`${label}: ${percent}%`}
    >
      <div className={styles.center}>
        <strong>{percent}%</strong>
        {size === 'large' ? <span>{label}</span> : null}
      </div>
    </div>
  );
};
