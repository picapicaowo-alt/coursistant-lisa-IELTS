import {CollapsibleSection} from '@/components/CollapsibleSection';
import React, {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import styles from './OperationCard.module.scss';
import {useTranslation} from 'react-i18next';
import {formatDateTime} from '@/i18n/formatting';

type Tone = 'default' | 'danger';

const responseData = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null || !('data' in value)) return value;
  return (value as {data?: unknown}).data;
};

export const OperationCard = ({
  title,
  description,
  actionLabel,
  successMessage,
  onRun,
  children,
  disabled = false,
  tone = 'default',
}: {
  title: string;
  description?: string;
  actionLabel: string;
  successMessage?: string;
  onRun: () => Promise<unknown>;
  children?: React.ReactNode;
  disabled?: boolean;
  tone?: Tone;
}) => {
  const {t} = useTranslation('common');
  const [completedAt, setCompletedAt] = useState<Date | null>(null);
  const operation = useMutation({
    mutationFn: onRun,
    onSuccess: () => setCompletedAt(new Date()),
  });

  return (
    <CollapsibleSection title={title} summary={description} headingLevel={3}>
      {completedAt ? <span className={styles.timestamp}>{t('feedback.updatedAt', {time: formatDateTime(completedAt, {hour: 'numeric', minute: '2-digit', second: '2-digit'})})}</span> : null}
      {children ? <div className={styles.fields}>{children}</div> : null}
      <button
        type="button"
        className={tone === 'danger' ? styles.danger : styles.primary}
        disabled={disabled || operation.isPending}
        onClick={() => operation.mutate()}
      >
        {operation.isPending ? t('actions.working') : actionLabel}
      </button>
      {operation.isError ? <p className={styles.error} role="alert">{t('feedback.operationFailed')}</p> : null}
      {operation.isSuccess ? (
        <div className={styles.result} aria-live="polite">
          {successMessage ? <p role="status">{successMessage}</p> : null}
          {responseData(operation.data) == null && successMessage ? null : <RecordSummaryList value={responseData(operation.data)}/>}
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
