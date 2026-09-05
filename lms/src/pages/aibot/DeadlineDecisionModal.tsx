import { useTranslation } from 'react-i18next';
import {useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import type {DeadlineDecision} from '@/apis/services/ai-agent-api';
import MarkdownMessage from '@/components/MarkdownMessage';
import styles from './index.module.scss';

interface DeadlineDecisionModalProps {
  title?: string;
  eyebrow?: string;
  confirmationText: string;
  warningText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onDecision: (decision: DeadlineDecision) => void;
}

const DeadlineDecisionModal = ({
  title,
  eyebrow,
  confirmationText,
  warningText,
  confirmLabel,
  cancelLabel,
  errorMessage,
  isSubmitting,
  onDecision,
}: DeadlineDecisionModalProps) => {
  const { t: translate } = useTranslation();
  const rejectButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const appRoot = document.getElementById('root');
    const previousAriaHidden = appRoot?.getAttribute('aria-hidden') ?? null;
    const rootWasInert = appRoot?.inert ?? false;
    const previousBodyOverflow = document.body.style.overflow;

    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = 'hidden';
    rejectButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      if (appRoot) {
        appRoot.inert = rootWasInert;
        if (previousAriaHidden === null) {
          appRoot.removeAttribute('aria-hidden');
        } else {
          appRoot.setAttribute('aria-hidden', previousAriaHidden);
        }
      }
      previouslyFocused?.focus();
    };
  }, []);

  return createPortal(
    <div className={styles.modalBackdrop}>
      <section
        className={styles.deadlineModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deadline-decision-title"
        aria-describedby="deadline-decision-copy deadline-decision-warning"
      >
        <div className={styles.modalHeader}>
          <span className={styles.modalIcon} aria-hidden="true">!</span>
          <div>
            <span className={styles.modalEyebrow}>{eyebrow ?? translate('assistant:workflow.actionRequired')}</span>
            <h3 id="deadline-decision-title">{title ?? translate('assistant:workflow.approvalTitle')}</h3>
          </div>
        </div>

        <div id="deadline-decision-copy" className={styles.modalCopy}>
          <MarkdownMessage content={confirmationText}/>
        </div>
        <p id="deadline-decision-warning" className={styles.modalWarning}>
          {warningText ?? translate('assistant:workflow.approvalWarning')}
        </p>

        {errorMessage ? <p className={styles.modalError} role="alert">{errorMessage}</p> : null}

        <div className={styles.modalActions}>
          <button
            ref={rejectButtonRef}
            type="button"
            onClick={() => onDecision('REJECT')}
            disabled={isSubmitting}
          >
            {cancelLabel ?? translate('common:status.REJECT')}
          </button>
          <button
            type="button"
            className={styles.allowButton}
            onClick={() => onDecision('ALLOW')}
            disabled={isSubmitting}
          >
            {isSubmitting ? translate("common:actions.working") : confirmLabel ?? translate('assistant:workflow.allow')}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
};

export default DeadlineDecisionModal;
