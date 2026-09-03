import type {CSSProperties, ReactNode} from 'react';
import {CollapsibleSection} from '@/components/CollapsibleSection';
import styles from './index.module.scss';

interface PropertySectionProps {
  title?: string;
  columns?: number;
  children: ReactNode;
  transparent?: boolean;
}

export function PropertyForm({title, columns = 1, children, transparent = false}: PropertySectionProps) {
  const fields = <div className={styles.settingsGrid} style={{'--property-columns': columns} as CSSProperties}>{children}</div>;
  return title
    ? <CollapsibleSection title={title} headingLevel={3}>{fields}</CollapsibleSection>
    : <div className={`${styles.settingsSection} ${transparent ? '' : styles.noTransparent}`}>{fields}</div>;
}
