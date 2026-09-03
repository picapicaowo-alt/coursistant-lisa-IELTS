import {CollapsibleSection} from '@/components/CollapsibleSection';
import React, {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import styles from './OperationCard.module.scss';

type Tone = 'default' | 'danger';

const responseData = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null || !('data' in value)) return value;
  return (value as {data?: unknown}).data;
};

export const OperationCard = ({
  title,
  description,
  actionLabel,
  onRun,
  children,
  disabled = false,
  tone = 'default',
}: {
  title: string;
  description?: string;
  actionLabel: string;
  onRun: () => Promise<unknown>;
  children?: React.ReactNode;
  disabled?: boolean;
  tone?: Tone;
}) => {
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const operation = useMutation({
    mutationFn: onRun,
    onSuccess: () => setCompletedAt(new Date().toLocaleTimeString()),
  });

  return (
    <CollapsibleSection title={title} summary={description} headingLevel={3}>
      {completedAt ? <span className={styles.timestamp}>Updated {completedAt}</span> : null}
      {children ? <div className={styles.fields}>{children}</div> : null}
      <button
        type="button"
        className={tone === 'danger' ? styles.danger : styles.primary}
        disabled={disabled || operation.isPending}
        onClick={() => operation.mutate()}
      >
        {operation.isPending ? 'Working…' : actionLabel}
      </button>
      {operation.isError ? <p className={styles.error} role="alert">The operation could not be completed. Check the required fields, permissions, and current record version.</p> : null}
      {operation.isSuccess ? (
        <div className={styles.result} aria-live="polite">
          <RecordSummaryList value={responseData(operation.data)}/>
        </div>
      ) : null}
    </CollapsibleSection>
  );
};

export const Field = ({label, children, hint}: {label: string; children: React.ReactNode; hint?: string}) => (
  <label className={styles.field}>
    <span>{label}</span>
    {children}
    {hint ? <small>{hint}</small> : null}
  </label>
);
