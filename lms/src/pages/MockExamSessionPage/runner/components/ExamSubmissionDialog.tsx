import { useTranslation } from 'react-i18next';
import {useEffect, useId, useRef} from 'react';
import {CheckCircle2, X} from 'lucide-react';
import styles from './ExamSubmissionDialog.module.scss';

export function ExamSubmissionDialog({open, pending, submitted, error, onSubmit, onClose}: {
  open: boolean; pending: boolean; submitted: boolean; error: string;
  onSubmit: () => void; onClose: () => void;
}) {
  const { t: translate } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {if (open && !dialog.current?.open) dialog.current?.showModal(); else if (!open) dialog.current?.close();}, [open]);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} onClose={onClose} onCancel={event => {if (pending) event.preventDefault();}}>
    <button type="button" className={styles.close} aria-label={translate('exams:runner.closeSubmission')} disabled={pending} onClick={onClose}><X size={20}/></button>
    {submitted ? <CheckCircle2 className={styles.successIcon} size={56} aria-hidden="true"/> : null}
    <h2 id={title}>{submitted ? translate('exams:runner.sectionSubmitted') : translate('exams:runner.readyToSubmit')}</h2>
    <p>{submitted ? translate('exams:runner.submittedHelp') : translate('exams:runner.submitHelp')}</p>
    {error ? <p className={styles.error} role="alert">{translate('exams:runner.errorPreserved', {error})}</p> : null}
    <div className={styles.actions}>
      {submitted ? <button type="button" className={styles.primary} onClick={onClose}>{translate('exams:viewResults')}</button> : <><button type="button" disabled={pending} onClick={onClose}>{translate('exams:runner.keepWorking')}</button><button type="button" className={styles.primary} disabled={pending} onClick={onSubmit}>{pending ? translate("common:actions.submitting") : translate('exams:runner.submitSection')}</button></>}
    </div>
  </dialog>;
}
