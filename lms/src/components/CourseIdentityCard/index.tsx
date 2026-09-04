import {useId, type ReactNode} from 'react';
import {UserRound} from 'lucide-react';
import {UserAvatar} from '@/components/UserAvatar';
import progressStyles from '@/components/AssignmentProgress/index.module.scss';
import styles from './index.module.scss';

interface CourseIdentityCardProps {
  courseId: string | number;
  title: string;
  headingLevel?: 2 | 3;
  code?: string | null;
  status?: ReactNode;
  metadata?: ReactNode;
  instructor?: string;
  instructorAvatar?: string;
  progress?: {completed?: number; total?: number};
  children?: ReactNode;
  footer?: ReactNode;
  /** Direct buttons/links share the action treatment; use data-variant="secondary" for a supporting action. */
  actions?: ReactNode;
  menu?: ReactNode;
}

/** Presentation only: callers retain their own contracts, capabilities and mutations. */
export function CourseIdentityCard({courseId, title, headingLevel = 3, code, status, metadata, instructor, instructorAvatar, progress, children, footer, actions, menu}: CourseIdentityCardProps) {
  const titleId = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const completed = progress?.completed;
  const total = progress?.total;
  const validProgress = completed != null && total != null && Number.isFinite(completed) && Number.isFinite(total) && total > 0 && completed >= 0 && completed <= total;

  return <article className={styles.card} aria-labelledby={titleId} data-course-card={courseId}>
    {status || code || menu ? <div className={styles.top}>
      {status ? <div className={styles.status}>{status}</div> : null}
      {code ? <span className={styles.code}>{code}</span> : null}
      {menu ? <div className={styles.menu}>{menu}</div> : null}
    </div> : null}
    <header className={styles.heading}>
      <Heading id={titleId}>{title}</Heading>
      {instructor ? <div className={styles.instructor}>
        {instructorAvatar ? <UserAvatar src={instructorAvatar} className={styles.avatar}/> : <UserRound size={17} aria-hidden="true"/>}
        <span>{instructor}</span>
      </div> : null}
    </header>
    {metadata ? <div className={styles.metadata}>{metadata}</div> : null}
    {progress ? <div className={`${progressStyles.progress} ${styles.progress}`}>
      <span>Lecture progress <strong>{validProgress ? `${Math.round(completed / total * 100)}%` : 'Not available'}</strong></span>
      {validProgress ? <><progress aria-label={`${title}: lecture progress`} value={completed} max={total}/><small>{completed} / {total} completed</small></> : null}
    </div> : null}
    {children}
    {footer || actions ? <footer className={styles.footer}>
      {footer}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </footer> : null}
  </article>;
}
