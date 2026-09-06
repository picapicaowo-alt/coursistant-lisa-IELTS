import type {CSSProperties} from 'react';
import {useTranslation} from 'react-i18next';
import {formatPercent} from '@/i18n/formatting';
import styles from './index.module.scss';

export function ProgressRing({value, label, inverse = false, compact = false}: {value: number | null; label: string; inverse?: boolean; compact?: boolean}) {
  const {t} = useTranslation();
  const progress = value == null ? null : Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`${styles.ring} ${compact ? styles.compact : ''}`} data-inverse={inverse || undefined}
      role={progress == null ? 'img' : 'progressbar'} aria-label={progress == null ? t('common:progress.unavailableLabel', {label}) : label}
      aria-valuenow={progress ?? undefined} aria-valuemin={progress == null ? undefined : 0} aria-valuemax={progress == null ? undefined : 100}
      style={{'--progress': `${progress ?? 0}%`} as CSSProperties}>
      <div><strong>{progress == null ? '—' : formatPercent(progress / 100)}</strong><span>{label}</span></div>
    </div>
  );
}
