import {useEffect, useId, useRef} from 'react';
import {CheckCircle2, X} from 'lucide-react';
import styles from './ExamSubmissionDialog.module.scss';

export function ExamSubmissionDialog({open, pending, submitted, error, onSubmit, onClose}: {
  open: boolean; pending: boolean; submitted: boolean; error: string;
  onSubmit: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {if (open && !dialog.current?.open) dialog.current?.showModal(); else if (!open) dialog.current?.close();}, [open]);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} onClose={onClose} onCancel={event => {if (pending) event.preventDefault();}}>
    <button type="button" className={styles.close} aria-label="Close submission dialog" disabled={pending} onClick={onClose}><X size={20}/></button>
    {submitted ? <CheckCircle2 className={styles.successIcon} size={56} aria-hidden="true"/> : null}
    <h2 id={title}>{submitted ? 'Section submitted' : 'Ready to submit?'}</h2>
    <p>{submitted ? 'Your responses have been received. You can now review the available results.' : 'Submit your current responses to finish this section. You can return to the questions before submitting.'}</p>
    {error ? <p className={styles.error} role="alert">{error} Your responses are preserved.</p> : null}
    <div className={styles.actions}>
      {submitted ? <button type="button" className={styles.primary} onClick={onClose}>View results</button> : <><button type="button" disabled={pending} onClick={onClose}>Keep working</button><button type="button" className={styles.primary} disabled={pending} onClick={onSubmit}>{pending ? 'Submitting…' : 'Submit section'}</button></>}
    </div>
  </dialog>;
}
