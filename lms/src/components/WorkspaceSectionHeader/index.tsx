import type {ReactNode} from 'react';
import styles from './index.module.scss';

interface WorkspaceSectionHeaderProps {
  title: string;
  description?: string;
  meta?: ReactNode;
  action?: ReactNode;
  level?: 2 | 3;
}

export const WorkspaceSectionHeader = ({title, description, meta, action, level = 2}: WorkspaceSectionHeaderProps) => {
  const heading = level === 2 ? <h2>{title}</h2> : <h3>{title}</h3>;

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <div className={styles.titleRow}>{heading}{meta}</div>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </header>
  );
};
