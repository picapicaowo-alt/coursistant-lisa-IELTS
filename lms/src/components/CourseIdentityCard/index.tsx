import type {ReactNode} from 'react';
import {CollapsibleSection} from '@/components/CollapsibleSection';
import styles from './index.module.scss';

interface CourseIdentityCardProps {
  courseId: string | number;
  title: string;
  code?: string | null;
  metadata?: ReactNode;
  children: ReactNode;
}

const TONES = ['sky', 'indigo', 'violet'] as const;

export function CourseIdentityCard({courseId, title, code, metadata, children}: CourseIdentityCardProps) {
  // Course color survives sorting, filtering and loading another workspace.
  const hash = Array.from(String(courseId)).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  const tone = TONES[hash % TONES.length];
  return <CollapsibleSection
    title={title}
    headingLevel={3}
    className={`${styles.card} ${styles[tone]}`}
    summary={<span className={styles.identity}>{code ? <span className={styles.code}>{code}</span> : null}<span className={styles.metadata}>{metadata}</span></span>}
  >{children}</CollapsibleSection>;
}
