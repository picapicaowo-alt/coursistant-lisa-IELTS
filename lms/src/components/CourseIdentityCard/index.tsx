import {useTranslation} from 'react-i18next';
import {formatNumber, formatPercent} from '@/i18n/formatting';
import {useId, type ReactNode} from 'react';
import {UserRound} from 'lucide-react';
import {UserAvatar} from '@/components/UserAvatar';
import progressStyles from '@/components/AssignmentProgress/index.module.scss';
import styles from './index.module.scss';

interface CourseIdentityCardProps {
  courseId: string | number;
  title: string;
  compact?: boolean;
  icon?: ReactNode;
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
export function CourseIdentityCard({courseId, title, compact = false, icon, headingLevel = 3, code, status, metadata, instructor, instructorAvatar, progress, children, footer, actions, menu}: CourseIdentityCardProps) {
  const {t: translate} = useTranslation();
  const titleId = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const completed = progress?.completed;
  const total = progress?.total;
  const validProgress = completed != null && total != null && Number.isFinite(completed) && Number.isFinite(total) && total > 0 && completed >= 0 && completed <= total;

  return <article className={`${styles.card} ${compact ? styles.compact : ''}`} aria-labelledby={titleId} data-course-card={courseId}>
    {icon || status || code || menu ? <div className={styles.top}>
      {icon ? <div className={styles.identityIcon}>{icon}</div> : null}
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
      <span>{translate("common:progress.lecture")}{' '}<strong>{validProgress ? formatPercent(completed / total) : translate("common:feedback.notAvailable")}</strong></span>
      {validProgress ? <><progress aria-label={translate('common:progress.courseLecture', {title})} value={completed} max={total}/><small>{translate('common:progress.completed', {completed: formatNumber(completed), total: formatNumber(total)})}</small></> : null}
    </div> : null}
    {children}
    {footer || actions ? <footer className={styles.footer}>
      {footer}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </footer> : null}
  </article>;
}
