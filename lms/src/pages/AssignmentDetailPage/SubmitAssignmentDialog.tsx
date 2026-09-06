import { LocalizedError } from "@/i18n/errors";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileSection } from "@/components/FileSection";
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
  const idempotencyKeyRef = useRef(crypto.randomUUID());

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
      if (event.key === "Escape" && !isSubmitting) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  const uploadFile = async (
    file: File,
    signal: AbortSignal,
  ): Promise<string> => {
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
    return String(staged.id);
  };

  const deleteFile = async (file: FileView) => {
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
    void onStaged().catch(() => {
      setSubmitError(
        new LocalizedError("assessment:submission.deletedRefreshFailed"),
      );
    });
  };

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
    if (submission.stagingFiles.length === 0) {
      setSubmitError(new LocalizedError("assessment:submission.chooseFile"));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await assignmentApiService.submitStagedFiles(
        courseId,
        assignment.id,
        { stagingFileIds: submission.stagingFiles.map((file) => file.id) },
        idempotencyKeyRef.current,
      );
      await onSubmitted();
      onClose();
    } catch {
      setSubmitError(new LocalizedError("assessment:submission.submitFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
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
          onUploaded={() => void onStaged()}
          onDelete={deleteFile}
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

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onClose}
            disabled={isSubmitting}
          >
            {translate("common:actions.cancel")}
          </button>
          <button
            type="button"
            className={styles.submit}
            onClick={() => void submit()}
            disabled={isSubmitting || !submission.acceptingSubmissions}
          >
            {isSubmitting
              ? translate("common:actions.submitting")
              : translate("assessment:submission.submitFiles")}
          </button>
        </div>
      </section>
    </div>
  );
};
