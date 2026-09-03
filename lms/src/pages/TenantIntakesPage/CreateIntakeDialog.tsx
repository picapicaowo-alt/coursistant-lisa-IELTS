import {useEffect, useRef, type FormEvent} from 'react';
import {X} from 'lucide-react';
import {StudentIntakeFormFields} from '@/components/StudentIntakeFormFields';
import type {StudentIntakeFormValue} from '@/components/StudentIntakeFormFields/model';
import styles from './CreateIntakeDialog.module.scss';

export function CreateIntakeDialog({value, onChange, onClose, onSubmit, pending, error}: {
  value: StudentIntakeFormValue;
  onChange: (value: StudentIntakeFormValue) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  error?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.current?.showModal();
    dialog.current?.querySelector('input')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {document.body.style.overflow = overflow; trigger?.focus();};
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="create-intake-title" aria-describedby="create-intake-description" onClose={onClose} onCancel={event => {if (pending) event.preventDefault();}}>
    <header className={styles.header}>
      <div><h2 id="create-intake-title">Create student intake</h2><p id="create-intake-description">Add a student and their learning needs. They can set a password through Forgot password.</p></div>
      <button type="button" aria-label="Close create form" disabled={pending} onClick={() => dialog.current?.close()}><X size={20}/></button>
    </header>
    <form onSubmit={onSubmit} aria-busy={pending}>
      <div className={styles.body}><StudentIntakeFormFields value={value} onChange={onChange}/>{error ? <p className={styles.error} role="alert">{error}</p> : null}</div>
      <footer className={styles.footer}><button type="button" className={styles.secondary} disabled={pending} onClick={() => dialog.current?.close()}>Cancel</button><button className={styles.primary} disabled={pending}>{pending ? 'Creating…' : 'Create intake'}</button></footer>
    </form>
  </dialog>;
}
