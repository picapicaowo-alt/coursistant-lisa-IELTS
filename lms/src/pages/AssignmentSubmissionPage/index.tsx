import {useTranslation} from 'react-i18next';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeft, Clock3, Download, Eye, FileText, ShieldCheck} from 'lucide-react';
import {Link, useParams} from 'react-router-dom';
import type {SubmissionFile} from '@/apis';
import {unwrapData} from '@/apis';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';
import {formatUtcTimestamp} from '@/utils/datetime';
import styles from './index.module.scss';

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AssignmentSubmissionPage = () => {
  const {t: translate} = useTranslation();
  const params = useParams();
  const courseId = Number(params.courseId);
  const assignmentId = Number(params.assignmentId);
  const submissionId = Number(params.submissionId);
  const valid = [courseId, assignmentId, submissionId].every(value => Number.isInteger(value) && value > 0);
  const access = useCourseAccess(valid ? courseId : null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const assignmentQuery = useQuery({
    queryKey: ['assignment', courseId, assignmentId],
    queryFn: async () => unwrapData(await assignmentApiService.getAssignment(courseId, assignmentId), 'getAssignment'),
    enabled: valid,
    retry: 1,
  });
  const versionsQuery = useQuery({
    queryKey: ['assignment-submission-versions', courseId, assignmentId, submissionId],
    queryFn: async () => unwrapData(
      await assignmentApiService.listSubmissionVersions(courseId, assignmentId, submissionId),
      'listSubmissionVersions',
    ),
    enabled: valid,
    retry: 1,
  });

  const downloadFile = async (file: SubmissionFile) => {
    setActiveFile(`download-${file.id}`);
    setFileError(null);
    try {
      const blob = await assignmentApiService.downloadSubmissionFile(courseId, assignmentId, submissionId, file.id);
      saveBlob(blob, file.originalName);
    } catch {
      setFileError(`Could not download ${file.originalName}.`);
    } finally {
      setActiveFile(null);
    }
  };

  const previewFile = async (file: SubmissionFile) => {
    const previewWindow = openPreviewWindow();
    if (!previewWindow) {
      setFileError('Allow pop-ups to preview this file.');
      return;
    }
    setActiveFile(`preview-${file.id}`);
    setFileError(null);
    try {
      const blob = await assignmentApiService.previewSubmissionFile(courseId, assignmentId, submissionId, file.id);
      showBlobInPreviewWindow(previewWindow, blob);
    } catch {
      previewWindow.close();
      setFileError(`Could not preview ${file.originalName}.`);
    } finally {
      setActiveFile(null);
    }
  };

  const failed = !valid || assignmentQuery.isError || versionsQuery.isError;
  const versions = versionsQuery.data ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <Link to={valid ? `/course/${courseId}/assignments/${assignmentId}` : '/'} className={styles.backLink} aria-label={translate('common:navigationControls.backToAssignment')} title={translate('common:navigationControls.backToAssignment')}><ArrowLeft size={22} aria-hidden="true"/></Link>
        <div className={styles.headerText}><p className={styles.eyebrow}>Assignment submission</p><h1>{assignmentQuery.data?.title || (failed ? 'Submission unavailable' : 'Loading submission…')}</h1><p>Submission {submissionId}</p></div>
        {access.canGrade ? <Link className={styles.primaryButton} to={`/course/${courseId}/assignments/${assignmentId}/grading`}><ShieldCheck size={17}/> Open grading roster</Link> : null}
      </div>

      {failed ? (
        <section className={styles.card} role="alert"><h2>This submission could not be loaded</h2><p>It may have been removed, or you may no longer have access to this course.</p>{valid ? <button type="button" className={styles.primaryButton} onClick={() => { void assignmentQuery.refetch(); void versionsQuery.refetch(); }}>Try again</button> : null}</section>
      ) : versionsQuery.isPending ? <section className={styles.card} aria-busy="true">Loading submission history…</section> : versions.length === 0 ? (
        <section className={styles.card}><h2>No submitted versions</h2><p>This notification does not currently point to a formal submission version.</p></section>
      ) : (
        <section className={styles.versionList} aria-label="Submission version history">
          {versions.map((version, index) => (
            <article className={styles.card} key={version.id}>
              <div className={styles.versionHeader}>
                <div><p className={styles.eyebrow}>{index === 0 ? 'Current version' : 'Earlier version'}</p><h2>Version {version.versionNo}</h2></div>
                <div className={styles.metadata}><span><Clock3 size={16}/>{formatUtcTimestamp(version.submittedAt)}</span><span>{version.submissionStatus}</span>{version.usedGraceBuffer ? <span>Grace buffer used</span> : null}</div>
              </div>
              {version.files.length ? (
                <ul className={styles.fileList}>
                  {version.files.map(file => (
                    <li key={file.id}>
                      <FileText size={19}/><span className={styles.fileName}>{file.originalName}<small>{formatSize(file.sizeBytes)}</small></span>
                      <div className={styles.fileActions}>
                        {file.previewAvailable ? <button type="button" onClick={() => void previewFile(file)} disabled={activeFile !== null}><Eye size={15}/>{activeFile === `preview-${file.id}` ? 'Opening…' : 'Preview'}</button> : null}
                        <button type="button" onClick={() => void downloadFile(file)} disabled={activeFile !== null}><Download size={15}/>{activeFile === `download-${file.id}` ? 'Downloading…' : 'Download'}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className={styles.empty}>No files were attached to this version.</p>}
            </article>
          ))}
        </section>
      )}
      {fileError ? <p className={styles.error} role="alert">{fileError}</p> : null}
    </main>
  );
};

export default AssignmentSubmissionPage;
