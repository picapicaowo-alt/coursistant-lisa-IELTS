import { useTranslation } from 'react-i18next';
import {focusFirstInvalidField} from '@/utils/formFocus';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {X} from 'lucide-react';
import {StudentIntakeFormFields} from './index';
import {studentIntakeValidationKey, type StudentIntakeFormValue} from './model';
import styles from './CreateIntakeDialog.module.scss';

export function CreateIntakeDialog({value, onChange, onClose, onSubmit, pending, error}: {
  value: StudentIntakeFormValue;
  onChange: (value: StudentIntakeFormValue) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  error?: string;
}) {
  const { t: translate } = useTranslation();
  const [validationKey, setValidationKey] = useState<string>();
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
      <div><h2 id="create-intake-title">{translate("advising:intake.create")}</h2><p id="create-intake-description">{translate("advising:intake.createHelp")}</p></div>
      <button type="button" aria-label={translate("advising:intake.closeCreate")} disabled={pending} onClick={() => dialog.current?.close()}><X size={20}/></button>
    </header>
    <form noValidate onSubmit={event => {
      event.preventDefault();
      if (pending) return;
      const key = studentIntakeValidationKey(event.currentTarget);
      setValidationKey(key);
      if (key) focusFirstInvalidField(event.currentTarget);
      if (!key) onSubmit(event);
    }} aria-busy={pending}>
      <div className={styles.body}><StudentIntakeFormFields value={value} onChange={next => {setValidationKey(undefined); onChange(next);}}/>{validationKey ? <p className={styles.error} role="alert">{translate(validationKey)}</p> : error ? <p className={styles.error} role="alert">{error}</p> : null}</div>
      <footer className={styles.footer}><button type="button" className={styles.secondary} disabled={pending} onClick={() => dialog.current?.close()}>{translate("common:actions.cancel")}</button><button className={styles.primary} disabled={pending}>{pending ? translate("common:actions.creating") : translate("advising:intake.createAction")}</button></footer>
    </form>
  </dialog>;
}
