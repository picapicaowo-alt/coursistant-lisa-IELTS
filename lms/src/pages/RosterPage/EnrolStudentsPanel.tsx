import { useTranslation } from 'react-i18next';
import React, {useMemo, useState} from 'react';
import {BatchStudentEnrollResponse} from '@/apis';
import styles from './index.module.scss';
import {formatNumber} from '@/i18n/formatting';

interface Props {
  onEnrol: (emails: string[]) => void;
  isPending: boolean;
  result: BatchStudentEnrollResponse | null;
  failed: boolean;
}

const MAX_PER_BATCH = 100;
const parseEmails = (raw: string) => raw.split(/[\s,;]+/).map(value => value.trim()).filter(Boolean);

export const EnrolStudentsPanel: React.FC<Props> = ({onEnrol, isPending, result, failed}) => {
  const { t: translate } = useTranslation();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const emails = useMemo(() => parseEmails(raw), [raw]);
  const tooMany = emails.length > MAX_PER_BATCH;
  const addresses = translate('course:roster.addressCount', {count: emails.length, number: formatNumber(emails.length)});

  if (!open) {
    return <button type="button" className={styles.addStudents} onClick={() => setOpen(true)}>{translate("course:roster.addStudentsAction")}</button>;
  }

  return (
    <section className={styles.enrolPanel} aria-labelledby="enrol-heading">
      <h2 id="enrol-heading" className={styles.enrolTitle}>{translate("course:roster.addStudents")}</h2>
      <label className={styles.enrolLabel} htmlFor="enrol-emails">{translate("course:roster.emailHelp")}</label>
      <textarea id="enrol-emails" className={styles.enrolInput} rows={3} value={raw} onChange={event => setRaw(event.target.value)} placeholder={translate("course:roster.emailPlaceholder")}/>
      <div className={styles.enrolFooter}>
        <span className={tooMany ? styles.enrolError : styles.enrolHint}>{tooMany ? translate('course:roster.addressLimit', {addresses, maximum: formatNumber(MAX_PER_BATCH)}) : addresses}</span>
        <div className={styles.enrolActions}>
          <button type="button" onClick={() => { setOpen(false); setRaw(''); }}>{translate("common:actions.cancel")}</button>
          <button type="button" className={styles.primary} disabled={!emails.length || tooMany || isPending} onClick={() => onEnrol(emails)}>{isPending ? translate("assessment:quiz.adding") : translate("common:actions.add")}</button>
        </div>
      </div>
      {failed ? <p className={styles.enrolError} role="alert">{translate("course:roster.enrolFailed")}</p> : null}
      {result ? (
        <div className={styles.enrolResult} role="status">
          <p>{translate('course:roster.enrolSummary', {success: formatNumber(result.successCount), failed: formatNumber(result.failureCount)})}</p>
          {result.items.some(item => item.status === 'ERROR') ? (
            <ul className={styles.enrolFailures}>{result.items.filter(item => item.status === 'ERROR').map((item, index) => <li key={`${item.userId ?? 'email'}-${index}`}>{item.userId === null ? translate('course:roster.enrolItemFailed') : translate('course:roster.enrolStudentFailed', {id: item.userId})}</li>)}</ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
