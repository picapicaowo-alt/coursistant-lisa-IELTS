import React, {useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {SyllabusState, unwrapData} from '@/apis';
import {getApiErrorMessage} from '@/utils/apiError';
import {courseApiService} from '@/apis/services/course-api';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';
import styles from './CourseDetailView/index.module.scss';

interface SyllabusCardProps {
  courseId: number;
  canManage: boolean;
}

const formatSize = (bytes: number): string => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const SyllabusCard: React.FC<SyllabusCardProps> = ({courseId, canManage}) => {
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
  const failure = fileError ?? (failedWrite
    ? getApiErrorMessage(failedWrite.error, 'The syllabus could not be updated. Please try again.')
    : null);
  const writing = upload.isPending || restore.isPending || clear.isPending;

  const selectFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFileError('The syllabus must be a PDF.');
      return;
    }
    setFileError(null);
    upload.mutate(file);
  };

  const fetchPdf = async (inline: boolean) => {
    const previewWindow = inline ? openPreviewWindow() : null;
    if (inline && !previewWindow) {
      setFileError('Allow pop-ups to preview the syllabus.');
      return;
    }
    setReading(true);
    setFileError(null);
    try {
      const blob = await courseApiService.downloadSyllabus(courseId, inline);
      if (previewWindow) {
        showBlobInPreviewWindow(previewWindow, blob);
      } else {
        saveBlob(blob, posted?.originalFilename ?? 'syllabus.pdf');
      }
    } catch {
      previewWindow?.close();
      setFileError("Couldn't open the syllabus.");
    } finally {
      setReading(false);
    }
  };

  return (
    <section className={`${styles.card} ${styles.syllabusCard}`} aria-labelledby={`syllabus-title-${courseId}`}>
      <div className={styles.cardHeader}>
        <h2 id={`syllabus-title-${courseId}`} className={styles.cardTitle}>Syllabus</h2>
      </div>

      {syllabusQuery.isPending ? <p className={styles.cardEmpty}>Loading syllabus…</p> : null}
      {syllabusQuery.isError ? (
        <div className={styles.inlineStatus} role="alert">
          <p>Couldn&apos;t load the syllabus.</p>
          <button type="button" onClick={() => void syllabusQuery.refetch()}>Try again</button>
        </div>
      ) : null}

      {!syllabusQuery.isPending && !syllabusQuery.isError && posted ? (
        <div className={styles.material}>
          <span className={styles.materialIcon} aria-hidden="true">PDF</span>
          <span className={styles.materialName}>{posted.originalFilename}</span>
          <span className={styles.materialMeta}>{formatSize(posted.sizeBytes)}</span>
          <div className={styles.materialActions}>
            <button type="button" disabled={reading} onClick={() => void fetchPdf(true)}>Preview</button>
            <button type="button" disabled={reading} onClick={() => void fetchPdf(false)}>Download</button>
            {canManage ? (
              <>
                <button type="button" disabled={writing} onClick={() => inputRef.current?.click()}>Replace</button>
                {posted.canRestorePrevious ? (
                  <button type="button" disabled={writing} onClick={() => restore.mutate()}>Restore previous</button>
                ) : null}
                <button type="button" className={styles.dangerAction} disabled={writing} onClick={() => clear.mutate()}>Remove</button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {!syllabusQuery.isPending && !syllabusQuery.isError && !posted ? (
        canManage ? (
          <button type="button" className={styles.uploadArea} disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
            {upload.isPending ? 'Uploading…' : <span>No syllabus yet. <strong>Choose a PDF</strong> to upload.</span>}
          </button>
        ) : <p className={styles.cardEmpty}>No syllabus has been posted for this course.</p>
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
