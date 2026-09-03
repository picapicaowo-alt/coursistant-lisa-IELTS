import {useEffect, useId, useRef, type ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
import styles from './index.module.scss';

interface CollapsibleSectionProps {
  title: string;
  summary?: ReactNode;
  count?: number;
  meta?: ReactNode;
  /** Leading glyph rendered beside the title so a collapsed panel still reads as a distinct destination. */
  icon?: ReactNode;
  headingId?: string;
  children: ReactNode;
  id?: string;
  className?: string;
  bodyClassName?: string;
  headingLevel?: 2 | 3 | 4;
  defaultOpen?: boolean;
  revealKey?: string | number | null;
}

/** Reveal nested fields without unmounting drafts or bypassing native validation. */
const revealDisclosureAncestors = (target: Element) => {
  let current: Element | null = target;
  while (current) {
    if (current instanceof HTMLDetailsElement) current.open = true;
    current = current.parentElement;
  }
};

export function CollapsibleSection({
  title, summary, count, meta, icon, headingId, children, id, className, bodyClassName,
  headingLevel = 2, defaultOpen = false, revealKey,
}: CollapsibleSectionProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  const generatedId = useId();
  const titleId = headingId ?? generatedId;
  const Heading = `h${headingLevel}` as const;

  useEffect(() => {
    if (revealKey && ref.current) revealDisclosureAncestors(ref.current);
  }, [revealKey]);

  useEffect(() => {
    const revealHash = () => {
      if (!location.hash) return;
      let hash: string;
      try { hash = decodeURIComponent(location.hash.slice(1)); } catch { return; }
      const target = document.getElementById(hash);
      if (target && ref.current?.contains(target)) revealDisclosureAncestors(target);
    };
    revealHash();
    window.addEventListener('hashchange', revealHash);
    return () => window.removeEventListener('hashchange', revealHash);
  }, []);

  return (
    <details
      ref={ref}
      id={id}
      open={defaultOpen}
      className={[styles.section, className].filter(Boolean).join(' ')}
      onInvalidCapture={event => revealDisclosureAncestors(event.target as Element)}
      data-disclosure-section=""
    >
      <summary className={styles.summary} aria-label={title}>
        {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
        <div className={styles.heading}>
          <div className={styles.titleRow}><Heading id={titleId}>{title}</Heading>{count != null ? <span className={styles.count}>{count}</span> : null}{meta}</div>
          {summary ? <span className={styles.preview}>{summary}</span> : null}
        </div>
        <ChevronDown className={styles.chevron} size={20} aria-hidden="true"/>
      </summary>
      <div role="region" aria-labelledby={titleId} className={[styles.body, bodyClassName].filter(Boolean).join(' ')}>{children}</div>
    </details>
  );
}
