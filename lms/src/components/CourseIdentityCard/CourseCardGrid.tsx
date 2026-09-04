import type {ReactNode} from 'react';
import styles from './CourseCardGrid.module.scss';

/** Container-aware so the same collection also fits Advisor and Parent side regions. */
export function CourseCardGrid({children, view = 'grid', label, busy}: {children: ReactNode; view?: 'grid' | 'list'; label?: string; busy?: boolean}) {
  return <div className={styles.container}>
    <div className={styles.grid} data-view={view} role={label ? 'region' : undefined} aria-label={label} aria-busy={busy}>{children}</div>
  </div>;
}
