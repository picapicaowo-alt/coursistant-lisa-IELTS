import type {ReactNode} from 'react';
import {CollapsibleSection} from '@/components/CollapsibleSection';
import styles from './index.module.scss';
import toneStyles from '@/styles/courseIdentity.module.scss';
import {getCourseIdentityTone} from '@/utils/course';

interface CourseIdentityCardProps {
  courseId: string | number;
  title: string;
  code?: string | null;
  metadata?: ReactNode;
  children: ReactNode;
}

export function CourseIdentityCard({courseId, title, code, metadata, children}: CourseIdentityCardProps) {
  const tone = getCourseIdentityTone(courseId);
  return <CollapsibleSection
    title={title}
    headingLevel={3}
    className={`${styles.card} ${toneStyles[tone]}`}
    summary={<span className={styles.identity}>{code ? <span className={styles.code}>{code}</span> : null}<span className={styles.metadata}>{metadata}</span></span>}
  >{children}</CollapsibleSection>;
}
