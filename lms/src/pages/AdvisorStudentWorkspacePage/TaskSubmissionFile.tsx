import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {AdvisorTaskResponse} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {LocalizedError} from '@/i18n/errors';
import {formatFileSize} from '@/utils/file-utils';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';

export function TaskSubmissionFile({studentUserId, task}: {studentUserId: number; task?: AdvisorTaskResponse}) {
  const {t} = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const file = task?.submissionFile;
  if (!file || task?.id == null) return null;
  const taskId = task.id;
  const canPreview = file.previewAvailable && (file.contentType === 'application/pdf' || file.contentType.startsWith('image/'));
  const open = async (action: 'preview' | 'download') => {
    const popup = action === 'preview' ? openPreviewWindow() : null;
    setBusy(true);
    setError(undefined);
    try {
      if (action === 'preview' && !popup) throw new LocalizedError('operations:errors.attachmentPopups');
      const blob = await advisorApiService.getTaskSubmissionFile(studentUserId, taskId, action);
      if (popup) showBlobInPreviewWindow(popup, blob);
      else saveBlob(blob, file.originalName);
    } catch (problem) {popup?.close(); setError(problem);}
    finally {setBusy(false);}
  };
  return <section>
    <p>{file.originalName} · {formatFileSize(file.sizeBytes)}</p>
    <div className={styles.actions}>
      {canPreview ? <button type="button" className={styles.secondary} disabled={busy} onClick={() => void open('preview')}>{t('course:materials.preview')}</button> : null}
      <button type="button" className={styles.secondary} disabled={busy} onClick={() => void open('download')}>{t('common:actions.download')}</button>
    </div>
    {error ? <p role="alert" className={styles.error}>{advisingErrorMessage(error, t('learning:messages.attachmentFailed'))}</p> : null}
  </section>;
}
