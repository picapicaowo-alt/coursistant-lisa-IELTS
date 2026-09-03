import {useEffect, useId, useRef, type ReactNode} from 'react';
import {X} from 'lucide-react';
import styles from './workspace.module.scss';

/** Native modal focus containment also supports the nested tenant user selector. */
export function TenantDrawer({
  title,
  description,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const element = ref.current;
    element?.showModal();
    return () => {
      element?.close();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.drawer}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className={styles.drawerHeader}>
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Close ${title.toLowerCase()}`}
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className={styles.drawerBody}>{children}</div>
    </dialog>
  );
}
