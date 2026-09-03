import {useId, type ReactNode} from 'react';
import {UserRound} from 'lucide-react';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import styles from './index.module.scss';

interface CourseIdentityCardProps {
  courseId: string | number;
  title: string;
  code?: string | null;
  metadata?: ReactNode;
  instructor?: string;
  progress?: {completed?: number; total?: number};
  children: ReactNode;
}

export function CourseIdentityCard({title, code, metadata, instructor, progress, children}: CourseIdentityCardProps) {
  const titleId = useId();
  if (instructor) {
    const validProgress = progress?.completed != null && progress.total != null && progress.total > 0 && progress.completed >= 0 && progress.completed <= progress.total;
    return <article className={`${styles.card} ${styles.identityCard}`} aria-labelledby={titleId}>
      <div className={styles.instructor}><span aria-hidden="true"><UserRound size={23}/></span><div><strong>{instructor}</strong><small>Instructor</small></div></div>
      <h3 id={titleId}>{title}</h3>
      <div className={styles.metadata}>{metadata}</div>
      {code ? <small className={styles.code}>{code}</small> : null}
      <div className={styles.progress}><span>Lecture progress <strong>{validProgress ? `${Math.round(progress!.completed! / progress!.total! * 100)}%` : 'Not available'}</strong></span>{validProgress ? <><progress aria-label={`${title}: lecture progress`} value={progress!.completed} max={progress!.total}/><small>{progress!.completed} / {progress!.total} completed</small></> : null}</div>
      <footer>{children}</footer>
    </article>;
  }
  return <WorkspaceSection
    title={title}
    headingLevel={3}
    className={styles.card}
    summary={<span className={styles.identity}>{code ? <span className={styles.code}>{code}</span> : null}<span className={styles.metadata}>{metadata}</span></span>}
  >{children}</WorkspaceSection>;
}
