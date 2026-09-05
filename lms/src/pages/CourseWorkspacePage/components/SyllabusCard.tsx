import {formatFileSize} from '@/utils/file-utils';
import {getApiErrorMessage} from '@/utils/apiError';
import {Trans, useTranslation} from 'react-i18next';
import React, {useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {SyllabusState, unwrapData} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';
import styles from './CourseDetailView/index.module.scss';

interface SyllabusCardProps {
  courseId: number;
  canManage: boolean;
}

export const SyllabusCard: React.FC<SyllabusCardProps> = ({courseId, canManage}) => {
  const { t: translate } = useTranslation();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const syllabusQuery = useQuery({
    queryKey: ['syllabus', courseId],
    queryFn: async (): Promise<SyllabusState> => unwrapData(
      await courseApiService.getSyllabus(courseId),
      'getSyllabus',
    ),
    staleTime: 60_000,
    retry: 1,
  });

  const refresh = () => queryClient.invalidateQueries({queryKey: ['syllabus', courseId]});
  const upload = useMutation({
    mutationFn: (file: File) => courseApiService.uploadSyllabus(courseId, file),
    onSuccess: () => void refresh(),
  });
  const restore = useMutation({
    mutationFn: () => courseApiService.restoreSyllabus(courseId),
    onSuccess: () => void refresh(),
  });
  const clear = useMutation({
    mutationFn: () => courseApiService.clearSyllabus(courseId),
    onSuccess: () => void refresh(),
  });

  const posted = syllabusQuery.data?.posted ? syllabusQuery.data : null;
  const failedWrite = [upload, restore, clear].find(mutation => mutation.isError);
  const failure = fileError ? translate(fileError) : failedWrite ? getApiErrorMessage(failedWrite.error, translate("course:syllabusCard.writeFailed")) : null;
  const writing = upload.isPending || restore.isPending || clear.isPending;

  const selectFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || writing || !canManage) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFileError("course:syllabusCard.pdfRequired");
      return;
    }
    setFileError(null);
    upload.mutate(file);
  };

  const fetchPdf = async (inline: boolean) => {
    const previewWindow = inline ? openPreviewWindow() : null;
    if (inline && !previewWindow) {
      setFileError("course:syllabusCard.allowPopups");
      return;
    }
    setReading(true);
    setFileError(null);
    try {
      const blob = await courseApiService.downloadSyllabus(courseId, inline);
      if (previewWindow) {
        showBlobInPreviewWindow(previewWindow, blob);
      } else {
        saveBlob(blob, posted?.originalFilename ?? translate('course:syllabusCard.filename'));
      }
    } catch {
      previewWindow?.close();
      setFileError("course:syllabusCard.openFailed");
    } finally {
      setReading(false);
    }
  };

  return (
    <section className={`${styles.card} ${styles.syllabusCard}`} aria-labelledby={`syllabus-title-${courseId}`}>
      <div className={styles.cardHeader}>
        <h2 id={`syllabus-title-${courseId}`} className={styles.cardTitle}>{translate("course:syllabusCard.title")}</h2>
      </div>

      {syllabusQuery.isPending ? <p className={styles.cardEmpty}>{translate("course:syllabusCard.loading")}</p> : null}
      {syllabusQuery.isError ? (
        <div className={styles.inlineStatus} role="alert">
          <p>{translate("course:syllabusCard.loadFailed")}</p>
          <button type="button" onClick={() => void syllabusQuery.refetch()}>{translate("common:actions.tryAgain")}</button>
        </div>
      ) : null}

      {!syllabusQuery.isPending && !syllabusQuery.isError && posted ? (
        <div className={styles.material}>
          <span className={styles.materialIcon} aria-hidden="true">PDF</span>
          <span className={styles.materialName}>{posted.originalFilename}</span>
          <span className={styles.materialMeta}>{formatFileSize(posted.sizeBytes)}</span>
          <div className={styles.materialActions}>
            <button type="button" disabled={reading} onClick={() => void fetchPdf(true)}>{translate("course:materials.preview")}</button>
            <button type="button" disabled={reading} onClick={() => void fetchPdf(false)}>{translate("common:actions.download")}</button>
            {canManage ? (
              <>
                <button type="button" disabled={writing} onClick={() => inputRef.current?.click()}>{translate("assessment:grading.replace")}</button>
                {posted.canRestorePrevious ? (
                  <button type="button" disabled={writing} onClick={() => restore.mutate()}>{translate("assessment:submission.restorePrevious")}</button>
                ) : null}
                <button type="button" className={styles.dangerAction} disabled={writing} onClick={() => clear.mutate()}>{translate("common:actions.remove")}</button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {!syllabusQuery.isPending && !syllabusQuery.isError && !posted ? (
        canManage ? (
          <button type="button" className={styles.uploadArea} disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
            {upload.isPending ? translate("assessment:submission.uploading") : <span><Trans i18nKey="course:syllabusCard.uploadPrompt" components={{strong: <strong/>}}/></span>}
          </button>
        ) : <p className={styles.cardEmpty}>{translate("course:syllabusCard.empty")}</p>
      ) : null}

      {canManage ? (
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className={styles.visuallyHidden}
          tabIndex={-1}
          aria-hidden="true"
          onChange={event => {
            selectFile(event.target.files);
            event.target.value = '';
          }}
        />
      ) : null}
      {failure ? <p className={styles.materialError} role="alert">{failure}</p> : null}
    </section>
  );
};
