import React from 'react';
import styles from './RecordSummaryList.module.scss';

type RecordValue = Record<string, unknown>;

const asRecord = (value: unknown): RecordValue | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as RecordValue : null;

const firstText = (record: RecordValue, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) return String(value);
  }
  return undefined;
};

const collection = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  for (const key of ['items', 'content', 'records', 'results']) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
};

const humanize = (value: string): string => value
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/^./, letter => letter.toUpperCase());

const titleFor = (record: RecordValue): string => firstText(record, [
  'title', 'name', 'studentName', 'courseTitle', 'courseCode', 'eventTitle',
  'message', 'description', 'overallSummary', 'taskType', 'notificationType',
  'reportType', 'status',
]) ?? 'Record';

const descriptionFor = (record: RecordValue): string | undefined => firstText(record, [
  'body', 'reason', 'strategySummary', 'summary', 'strengths', 'latestPreview',
  'improvementSuggestions',
]);

const metaFor = (record: RecordValue): string[] => {
  const values = [
    firstText(record, ['status', 'state', 'availability', 'priority']),
    firstText(record, ['courseCode', 'catalogCode']),
    firstText(record, ['occurrenceDate', 'eventDate', 'dueDate', 'publishedAt', 'createdAt', 'latestAt']),
  ];
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
};

const SummaryRows = ({items}: {items: unknown[]}) => (
  <div className={styles.list}>
    {items.map((item, index) => {
      const record = asRecord(item);
      if (!record) return <div className={styles.row} key={index}><strong>{String(item)}</strong></div>;
      const description = descriptionFor(record);
      const meta = metaFor(record);
      return (
        <article className={styles.row} key={firstText(record, ['id', 'notificationId', 'reportId', 'messageId', 'courseId', 'eventId', 'taskId']) ?? index}>
          <strong>{titleFor(record)}</strong>
          {description && description !== titleFor(record) ? <p>{description}</p> : null}
          {meta.length > 0 ? <small>{meta.join(' · ')}</small> : null}
        </article>
      );
    })}
  </div>
);

export const RecordSummaryList = ({value, emptyMessage = 'No records are available.'}: {value: unknown; emptyMessage?: string}) => {
  const direct = collection(value);
  if (direct.length > 0) return <SummaryRows items={direct}/>;
  if (Array.isArray(value)) return <p className={styles.empty}>{emptyMessage}</p>;

  const record = asRecord(value);
  if (!record) return value == null ? <p className={styles.empty}>{emptyMessage}</p> : <p className={styles.confirmation}>Updated successfully.</p>;

  const grouped = Object.entries(record).flatMap(([key, item]) => {
    const items = collection(item);
    return items.length > 0 ? [{key, items}] : [];
  });
  if (grouped.length > 0) return <div className={styles.groups}>{grouped.map(group => <section key={group.key}><h4>{humanize(group.key)}</h4><SummaryRows items={group.items}/></section>)}</div>;

  const primary = titleFor(record);
  const description = descriptionFor(record);
  const meta = metaFor(record);
  const hasRecognizedContent = primary !== 'Record' || description || meta.length > 0;
  return hasRecognizedContent ? <SummaryRows items={[record]}/> : <p className={styles.confirmation}>Latest data loaded successfully.</p>;
};
