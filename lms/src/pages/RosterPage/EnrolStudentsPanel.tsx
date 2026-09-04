import React, {useMemo, useState} from 'react';
import {BatchStudentEnrollResponse} from '@/apis';
import styles from './index.module.scss';
import {getApiErrorMessage} from '@/utils/apiError';

interface Props {
  onEnrol: (emails: string[]) => void;
  isPending: boolean;
  result: BatchStudentEnrollResponse | null;
  failed: boolean;
}

const MAX_PER_BATCH = 100;
const parseEmails = (raw: string) => raw.split(/[\s,;]+/).map(value => value.trim()).filter(Boolean);

export const EnrolStudentsPanel: React.FC<Props> = ({onEnrol, isPending, result, failed}) => {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const emails = useMemo(() => parseEmails(raw), [raw]);
  const tooMany = emails.length > MAX_PER_BATCH;

  if (!open) {
    return <button type="button" className={styles.addStudents} onClick={() => setOpen(true)}>+ Add students</button>;
  }

  return (
    <section className={styles.enrolPanel} aria-labelledby="enrol-heading">
      <h2 id="enrol-heading" className={styles.enrolTitle}>Add students</h2>
      <label className={styles.enrolLabel} htmlFor="enrol-emails">Email addresses, separated by spaces, commas or new lines</label>
      <textarea id="enrol-emails" className={styles.enrolInput} rows={3} value={raw} onChange={event => setRaw(event.target.value)} placeholder="student1@example.com, student2@example.com"/>
      <div className={styles.enrolFooter}>
        <span className={tooMany ? styles.enrolError : styles.enrolHint}>{emails.length} address{emails.length === 1 ? '' : 'es'}{tooMany ? ` — ${MAX_PER_BATCH} maximum` : ''}</span>
        <div className={styles.enrolActions}>
          <button type="button" onClick={() => { setOpen(false); setRaw(''); }}>Cancel</button>
          <button type="button" className={styles.primary} disabled={!emails.length || tooMany || isPending} onClick={() => onEnrol(emails)}>{isPending ? 'Adding…' : 'Add'}</button>
        </div>
      </div>
      {failed ? <p className={styles.enrolError} role="alert">Couldn&apos;t add these students. Please try again.</p> : null}
      {result ? (
        <div className={styles.enrolResult} role="status">
          <p>{result.successCount} added, {result.failureCount} failed.</p>
          {result.items.some(item => item.status === 'ERROR') ? (
            <ul className={styles.enrolFailures}>{result.items.filter(item => item.status === 'ERROR').map((item, index) => <li key={`${item.userId ?? 'email'}-${index}`}>{getApiErrorMessage(new Error(item.message ?? ''), 'This student could not be added. Please try again.')}</li>)}</ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
