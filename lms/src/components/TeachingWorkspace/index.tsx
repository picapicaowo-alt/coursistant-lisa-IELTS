import {teachingLabel} from './presentation';
import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  X,
} from "lucide-react";
import { getApiErrorMessage } from "@/utils/apiError";
import styles from "./index.module.scss";

export function TeachingDialog({
  title,
  description,
  children,
  onClose,
  busy = false,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={[styles.dialog, className].filter(Boolean).join(' ')}
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className={styles.dialogHeader}>
        <div>
          <h2 id={heading}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <button
          type="button"
          className={styles.iconButton}
          disabled={busy}
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <fieldset className={styles.dialogBody} disabled={busy} aria-busy={busy}>
        {children}
      </fieldset>
    </dialog>
  );
}

export function TeachingState({
  loading,
  error,
  empty,
  onRetry,
  compact = false,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const className = `${styles.state} ${compact ? styles.compactState : ''}`;
  if (loading)
    return (
      <div className={className} role="status">
        <LoaderCircle className={styles.spinner} size={24} />
        <span>Loading…</span>
      </div>
    );
  if (error)
    return (
      <div className={className} role="alert">
        <AlertCircle size={24} />
        <p>{getApiErrorMessage(error, "This section could not be loaded.")}</p>
        {onRetry ? (
          <button type="button" className={styles.secondary} onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    );
  return empty ? (
    <div className={className}>
      <Inbox size={26} />
      <p>{empty}</p>
    </div>
  ) : null;
}

export function TeachingError({ error }: { error: unknown }) {
  return error ? (
    <p className={styles.error} role="alert">
      {getApiErrorMessage(
        error,
        "The change could not be saved. Your entries are preserved.",
      )}
    </p>
  ) : null;
}

const success = new Set([
  "PUBLISHED",
  "COMPLETED",
  "PRESENT",
  "ACTIVE",
  "APPROVED",
]);
const warning = new Set([
  "SCHEDULED",
  "UPCOMING",
  "PENDING",
  "LATE",
  "EXCUSED",
]);
const danger = new Set(["ABSENT", "CANCELLED", "REJECTED", "OVERDUE"]);

export function TeachingBadge({
  value,
  children,
}: {
  value?: string;
  children?: ReactNode;
}) {
  const normalized = value?.toUpperCase() ?? "";
  const tone = success.has(normalized)
    ? "success"
    : warning.has(normalized)
      ? "warning"
      : danger.has(normalized)
        ? "danger"
        : normalized === "ONGOING"
          ? "brand"
          : "neutral";
  return (
    <span className={styles.badge} data-tone={tone}>
      {children ?? teachingLabel(value)}
    </span>
  );
}

export function TeachingAvatar({ name }: { name: string }) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      {Array.from(name.trim())[0]?.toUpperCase() || "—"}
    </span>
  );
}

export function TeachingPagination({
  page,
  size,
  total,
  count,
  loading,
  onChange,
  label = "Records",
}: {
  page: number;
  size: number;
  total?: number;
  count: number;
  loading?: boolean;
  onChange: (page: number) => void;
  label?: string;
}) {
  if (!page && count < size && (total == null || total <= size)) return null;
  const hasNext = total == null ? count >= size : (page + 1) * size < total;
  return (
    <nav className={styles.pagination} aria-label={`${label} pages`}>
      <span>
        {total == null
          ? `Page ${page + 1}`
          : `${total} ${label.toLowerCase()} · Page ${page + 1} of ${Math.max(1, Math.ceil(total / size))}`}
      </span>
      <div>
        <button
          type="button"
          className={styles.secondary}
          disabled={loading || !page}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={loading || !hasNext}
          onClick={() => onChange(page + 1)}
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
