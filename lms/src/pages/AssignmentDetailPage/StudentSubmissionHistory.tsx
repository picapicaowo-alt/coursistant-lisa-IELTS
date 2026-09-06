import { formatFileSize } from "@/utils/file-utils";
import { LocalizedError } from "@/i18n/errors";
import { formatNumber } from "@/i18n/formatting";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Download, Eye, FileText } from "lucide-react";
import type { SubmissionFile, SubmissionVersion } from "@/apis";
import { assignmentApiService } from "@/apis/services/assignment-api";
import {
  openPreviewWindow,
  saveBlob,
  showBlobInPreviewWindow,
} from "@/utils/downloadBlob";
import styles from "./index.module.scss";

interface StudentSubmissionHistoryProps {
  courseId: number;
  assignmentId: number;
  submissionId: number;
  versions: SubmissionVersion[];
}

export const StudentSubmissionHistory = ({
  courseId,
  assignmentId,
  submissionId,
  versions,
}: StudentSubmissionHistoryProps) => {
  const { t: translate } = useTranslation();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [fileError, setFileError] = useState<LocalizedError | null>(null);

  const downloadFile = async (file: SubmissionFile) => {
    setActiveAction(`download-${file.id}`);
    setFileError(null);
    try {
      const blob = await assignmentApiService.downloadSubmissionFile(
        courseId,
        assignmentId,
        submissionId,
        file.id,
      );
      saveBlob(blob, file.originalName);
    } catch {
      setFileError(
        new LocalizedError("assessment:assignment.errors.download", {
          name: file.originalName,
        }),
      );
    } finally {
      setActiveAction(null);
    }
  };

  const previewFile = async (file: SubmissionFile) => {
    const previewWindow = openPreviewWindow();
    if (!previewWindow) {
      setFileError(new LocalizedError("course:materials.allowPopups"));
      return;
    }

    setActiveAction(`preview-${file.id}`);
    setFileError(null);
    try {
      const blob = await assignmentApiService.previewSubmissionFile(
        courseId,
        assignmentId,
        submissionId,
        file.id,
      );
      showBlobInPreviewWindow(previewWindow, blob);
    } catch {
      previewWindow.close();
      setFileError(
        new LocalizedError("assessment:assignment.errors.preview", {
          name: file.originalName,
        }),
      );
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div
      className={styles.submissionVersions}
      aria-label={translate("assessment:submission.history")}
    >
      {versions.map((version, index) => (
        <section className={styles.submissionVersion} key={version.id}>
          <div className={styles.versionHeader}>
            <div>
              <strong>
                {translate("assessment:submission.version", {
                  number: formatNumber(version.versionNo),
                })}
              </strong>
              <span>
                {translate("assessment:files.count", {
                  count: version.fileCount,
                  number: formatNumber(version.fileCount),
                })}
              </span>
            </div>
            <span>
              {index === 0
                ? translate("assessment:submission.current")
                : translate("assessment:submission.previousSubmission")}
            </span>
          </div>

          {version.files.length > 0 ? (
            <ul className={styles.submissionFiles}>
              {version.files.map((file) => (
                <li key={file.id}>
                  <FileText size={20} aria-hidden="true" />
                  <span className={styles.submissionFileName}>
                    <strong>{file.originalName}</strong>
                    <small>{formatFileSize(file.sizeBytes)}</small>
                  </span>
                  <span className={styles.submissionFileActions}>
                    {file.previewAvailable ? (
                      <button
                        type="button"
                        onClick={() => void previewFile(file)}
                        disabled={activeAction !== null}
                      >
                        <Eye size={15} />
                        {activeAction === `preview-${file.id}`
                          ? translate("course:materials.opening")
                          : translate("course:materials.preview")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void downloadFile(file)}
                      disabled={activeAction !== null}
                    >
                      <Download size={15} />
                      {activeAction === `download-${file.id}`
                        ? translate("course:materials.downloading")
                        : translate("common:actions.download")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.secondaryText}>
              {translate("assessment:submission.noFiles")}
            </p>
          )}
        </section>
      ))}
      {fileError ? (
        <p className={styles.error} role="alert">
          {fileError.localizedMessage()}
        </p>
      ) : null}
    </div>
  );
};
