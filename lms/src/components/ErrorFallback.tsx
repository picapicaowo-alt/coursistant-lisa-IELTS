import {useTranslation} from 'react-i18next';
import styles from './ErrorBoundary.module.scss';

// Subscribe independently of the class boundary so an existing error changes language too.
export function ErrorFallback({onRetry}: {onRetry: () => void}) {
  const {t} = useTranslation('common');
  return (
    <div className={styles.container} role="alert">
      <h2 className={styles.title}>{t('feedback.somethingWentWrong')}</h2>
      <p className={styles.message}>{t('feedback.pageFailed')}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.retry} onClick={onRetry}>{t('actions.tryAgain')}</button>
      </div>
    </div>
  );
}
