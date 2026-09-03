import type {ReactNode} from 'react';
import {CollapsibleSection} from '@/components/CollapsibleSection';
import styles from './index.module.scss';
import toneStyles from '@/styles/courseIdentity.module.scss';
import {getCourseIdentityTone} from '@/utils/course';
import {courseMark, type CourseBadge, type CourseBadgeTone} from './courseBadges';

interface CourseIdentityCardProps {
  courseId: string | number;
  title: string;
  code?: string | null;
  /** Short state chips (delivery mode, launch state). Rendered as pills under the title. */
  badges?: CourseBadge[];
  /** Plain supporting facts (instructor, capacity). Rendered as a dot-separated line. */
  metadata?: ReactNode;
  children: ReactNode;
}

const BADGE_CLASS: Record<CourseBadgeTone, string> = {
  brand: styles.badgeBrand, success: styles.badgeSuccess, info: styles.badgeInfo, warning: styles.badgeWarning, neutral: styles.badgeNeutral,
};

export function CourseIdentityCard({courseId, title, code, badges, metadata, children}: CourseIdentityCardProps) {
  const tone = getCourseIdentityTone(courseId);
  return <CollapsibleSection
    title={title}
    headingLevel={3}
    className={`${styles.card} ${toneStyles[tone]}`}
    icon={<span className={styles.mark}>{courseMark(code, title)}</span>}
    summary={<span className={styles.identity}>
      {badges?.length ? <span className={styles.badges}>{badges.map(badge => <span key={badge.label} className={`${styles.badge} ${BADGE_CLASS[badge.tone ?? 'neutral']}`}>{badge.label}</span>)}</span> : null}
      {code || metadata ? <span className={styles.metadata}>{code ? <span className={styles.code}>{code}</span> : null}{metadata}</span> : null}
    </span>}
  >{children}</CollapsibleSection>;
}
