import {useId, type ReactNode} from 'react';
import styles from './index.module.scss';

/** Primary workspace content stays visible; disclosure is reserved for optional editors. */
export function WorkspaceSection({
  title,
  summary,
  meta,
  count,
  children,
  id,
  headingId,
  className,
  bodyClassName,
  headingLevel = 2,
}: {
  title: string;
  summary?: ReactNode;
  meta?: ReactNode;
  count?: number;
  children: ReactNode;
  id?: string;
  headingId?: string;
  className?: string;
  bodyClassName?: string;
  headingLevel?: 2 | 3 | 4;
}) {
  const generatedId = useId();
  const titleId = headingId || generatedId;
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={[styles.section, className].filter(Boolean).join(' ')}
    >
      <header className={styles.header}>
        <div>
          <Heading id={titleId}>{title}</Heading>
          {summary ? <p>{summary}</p> : null}
        </div>
        {count != null ? <span className={styles.count}>{count}</span> : null}
        {meta}
      </header>
      <div className={[styles.body, bodyClassName].filter(Boolean).join(' ')}>
        {children}
      </div>
    </section>
  );
}
