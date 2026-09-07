import { LocalizedError } from "@/i18n/errors";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileSection } from "@/components/FileSection";
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import { assignmentApiService } from "@/apis/services/assignment-api";
import { unwrapData } from "@/apis";
import type { AssignmentDetail, SubmissionState } from "@/apis";
import type { FileView } from "@/types";
import {
  isPreviewableFile,
  openPreviewWindow,
  saveBlob,
  showBlobInPreviewWindow,
} from "@/utils/downloadBlob";
import styles from "./SubmitAssignmentDialog.module.scss";

interface SubmitAssignmentDialogProps {
  assignment: AssignmentDetail;
  courseId: number;
  submission: SubmissionState;
  onClose: () => void;
  onStaged: () => Promise<void>;
  onSubmitted: () => Promise<void>;
}

const toAcceptValue = (allowedFileTypes?: string[]) => {
  if (!allowedFileTypes?.length) return undefined;
  return allowedFileTypes
    .map((type) => (type.startsWith(".") ? type : `.${type}`))
    .join(",");
};

export const SubmitAssignmentDialog = ({
  assignment,
  courseId,
  submission,
  onClose,
  onStaged,
  onSubmitted,
}: SubmitAssignmentDialogProps) => {
  const { t: translate } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentAction, setAttachmentAction] = useState<
    "preview" | "download" | null
  >(null);
  const [submitError, setSubmitError] = useState<LocalizedError | null>(null);
  const idempotency = useIdempotencyCheckpoint();
  const submittingRef = useRef(false);
  const submittedRef = useRef(false);
  const stagingCountRef = useRef(0);
  const [stagingCount, setStagingCount] = useState(0);
  const [stagingNeedsRefresh, setStagingNeedsRefresh] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const busy = isSubmitting || stagingCount > 0;

  const refreshStaging = async () => {
    try {
      await onStaged();
      setStagingNeedsRefresh(false);
      setSubmitError(null);
    } catch {
      setStagingNeedsRefresh(true);
      setSubmitError(new LocalizedError('assessment:submission.stagingRefreshFailed'));
    }
  };
  const changeStaging = async <T,>(operation: () => Promise<T>): Promise<T> => {
    if (submittingRef.current || submittedRef.current)
      throw new LocalizedError('assessment:submission.filesBusy');
    setStagingCount(++stagingCountRef.current);
    try {return await operation();}
    finally {setStagingCount(--stagingCountRef.current);}
  };

  const stagedFiles = useMemo<FileView[]>(
    () =>
      submission.stagingFiles.map((file) => ({
        id: file.id,
        filename: file.originalName,
        mimeType: file.contentType,
        fileSize: file.sizeBytes,
        updatedAt: file.createdAt,
        uploadStatus: "success",
        uploadProgress: 100,
      })),
    [submission.stagingFiles],
  );

  const accept = toAcceptValue(assignment.allowedFileTypes);
  const instructorAttachment = assignment.attachments?.[0];
  const attachmentPreviewable = instructorAttachment
    ? (instructorAttachment.previewAvailable ??
      isPreviewableFile(
        instructorAttachment.originalName,
        instructorAttachment.contentType,
      ))
    : false;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  const uploadFile = async (
    file: File,
    signal: AbortSignal,
  ): Promise<string> => changeStaging(async () => {
    setSubmitError(null);
    const response = await assignmentApiService.uploadStagingFiles(
      courseId,
      assignment.id,
      [file],
      signal,
    );
    const uploaded = unwrapData(response, "uploadStagingFiles");
    const staged =
      uploaded.find((item) => item.originalName === file.name) ?? uploaded[0];

    if (!staged)
      throw new LocalizedError("assessment:submission.stagedFileMissing");
    await refreshStaging();
    return String(staged.id);
  });

  const deleteFile = async (file: FileView) => changeStaging(async () => {
    const stagingFileId = Number(file.id);
    if (!Number.isInteger(stagingFileId) || stagingFileId <= 0) {
      throw new LocalizedError("assessment:submission.stagedFileInvalid");
    }

    setSubmitError(null);
    await assignmentApiService.deleteStagingFile(
      courseId,
      assignment.id,
      stagingFileId,
    );
    await refreshStaging();
  });

  const downloadInstructorAttachment = async () => {
    if (!instructorAttachment) return;
    setAttachmentAction("download");
    setSubmitError(null);
    try {
      const blob = await assignmentApiService.downloadAttachment(
        courseId,
        assignment.id,
        instructorAttachment.id,
      );
      saveBlob(blob, instructorAttachment.originalName);
    } catch {
      setSubmitError(
        new LocalizedError("assessment:assignment.errors.download", {
          name: instructorAttachment.originalName,
        }),
      );
    } finally {
      setAttachmentAction(null);
    }
  };

  const previewInstructorAttachment = async () => {
    if (!instructorAttachment) return;
    const previewWindow = openPreviewWindow();
    if (!previewWindow) {
      setSubmitError(new LocalizedError("course:materials.allowPopups"));
      return;
    }
    setAttachmentAction("preview");
    setSubmitError(null);
    try {
      showBlobInPreviewWindow(
        previewWindow,
        await assignmentApiService.previewAttachment(
          courseId,
          assignment.id,
          instructorAttachment.id,
        ),
      );
    } catch {
      previewWindow.close();
      setSubmitError(
        new LocalizedError("assessment:assignment.errors.preview", {
          name: instructorAttachment.originalName,
        }),
      );
    } finally {
      setAttachmentAction(null);
    }
  };

  const submit = async () => {
    if (submittingRef.current || stagingCountRef.current > 0 || stagingNeedsRefresh || !submission.acceptingSubmissions && !submittedRef.current) return;
    if (!submittedRef.current && submission.stagingFiles.length === 0) {
      setSubmitError(new LocalizedError("assessment:submission.chooseFile"));
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (!submittedRef.current) {
        await idempotency.run('submit-assignment', [courseId, assignment.id, {
          stagingFileIds: submission.stagingFiles.map(file => file.id).sort((a, b) => a - b),
        }] as const, (key, args) => assignmentApiService.submitStagedFiles(...args, key));
        // Once the server accepts a submission, retries only refresh its receipt.
        // Never resubmit consumed staging files because a follow-up read failed.
        submittedRef.current = true;
        setSubmitted(true);
      }
      await onSubmitted();
      onClose();
    } catch {
      setSubmitError(new LocalizedError(submittedRef.current
        ? 'assessment:submission.submittedRefreshFailed'
        : 'assessment:submission.submitFailed'));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-assignment-title"
      >
        <h2 id="submit-assignment-title" className={styles.title}>
          {translate("course:assignmentStudentModal.title")}
        </h2>
        <p className={styles.subtitle}>
          {translate("assessment:submission.dialogHelp")}
        </p>

        {instructorAttachment && (
          <div className={styles.instructorFile}>
            <p>{translate("assessment:submission.instructorFileHelp")}</p>
            {attachmentPreviewable ? (
              <button
                type="button"
                className={styles.downloadLink}
                onClick={() => void previewInstructorAttachment()}
                disabled={attachmentAction !== null}
                title={translate("assessment:files.previewName", {
                  name: instructorAttachment.originalName,
                })}
              >
                <span>
                  {attachmentAction === "preview"
                    ? translate("course:materials.opening")
                    : translate("assessment:files.previewName", {
                        name: instructorAttachment.originalName,
                      })}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className={styles.downloadLink}
              onClick={() => void downloadInstructorAttachment()}
              disabled={attachmentAction !== null}
              title={instructorAttachment.originalName}
            >
              <img
                src="/icons/assignments/document-download.svg"
                alt=""
                width={24}
                height={24}
              />
              <span>
                {attachmentAction === "download"
                  ? translate("course:materials.downloading")
                  : translate("assessment:files.downloadName", {
                      name: instructorAttachment.originalName,
                    })}
              </span>
            </button>
          </div>
        )}

        <FileSection
          files={stagedFiles}
          accept={accept}
          uploadFunction={uploadFile}
          onUploaded={() => {/* uploadFile already awaits the staging readback. */}}
          onDelete={deleteFile}
          disabled={isSubmitting || submitted}
        />

        <p className={styles.fileHint}>
          {assignment.allowedFileTypes?.length
            ? translate("assessment:submission.allowedTypes", {
                types: assignment.allowedFileTypes.join(", "),
              })
            : translate("assessment:submission.allowedTypesHelp")}
        </p>

        {submitError && (
          <p className={styles.error} role="alert">
            {submitError.localizedMessage()}
          </p>
        )}
        {stagingNeedsRefresh ? <button type="button" disabled={busy} onClick={() => void changeStaging(refreshStaging)}>
          {translate('common:actions.retry')}
        </button> : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onClose}
            disabled={busy}
          >
            {translate("common:actions.cancel")}
          </button>
          <button
            type="button"
            className={styles.submit}
            onClick={() => void submit()}
            disabled={busy || stagingNeedsRefresh || !submission.acceptingSubmissions && !submitted}
          >
            {isSubmitting
              ? translate("common:actions.submitting")
              : translate(submitted ? 'common:actions.retry' : 'assessment:submission.submitFiles')}
          </button>
        </div>
      </section>
    </div>
  );
};
