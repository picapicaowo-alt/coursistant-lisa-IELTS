import { formatSubmissionStatus } from "@/pages/AssignmentDetailPage/submissionState";
import { formatFileSize as formatSize } from "@/utils/file-utils";
import { LocalizedError } from "@/i18n/errors";
import { formatNumber } from "@/i18n/formatting";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock3,
  Download,
  Eye,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { SubmissionFile } from "@/apis";
import { unwrapData } from "@/apis";
import { assignmentApiService } from "@/apis/services/assignment-api";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import {
  openPreviewWindow,
  saveBlob,
  showBlobInPreviewWindow,
} from "@/utils/downloadBlob";
import { formatUtcTimestamp } from "@/utils/datetime";
import styles from "./index.module.scss";

const AssignmentSubmissionPage = () => {
  const { t: translate } = useTranslation();
  const params = useParams();
  const courseId = Number(params.courseId);
  const assignmentId = Number(params.assignmentId);
  const submissionId = Number(params.submissionId);
  const valid = [courseId, assignmentId, submissionId].every(
    (value) => Number.isInteger(value) && value > 0,
  );
  const access = useCourseAccess(valid ? courseId : null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState<LocalizedError | null>(null);

  const assignmentQuery = useQuery({
    queryKey: ["assignment", courseId, assignmentId],
    queryFn: async () =>
      unwrapData(
        await assignmentApiService.getAssignment(courseId, assignmentId),
        "getAssignment",
      ),
    enabled: valid,
    retry: 1,
  });
  const versionsQuery = useQuery({
    queryKey: [
      "assignment-submission-versions",
      courseId,
      assignmentId,
      submissionId,
    ],
    queryFn: async () =>
      unwrapData(
        await assignmentApiService.listSubmissionVersions(
          courseId,
          assignmentId,
          submissionId,
        ),
        "listSubmissionVersions",
      ),
    enabled: valid,
    retry: 1,
  });

  const downloadFile = async (file: SubmissionFile) => {
    setActiveFile(`download-${file.id}`);
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
      setActiveFile(null);
    }
  };

  const previewFile = async (file: SubmissionFile) => {
    const previewWindow = openPreviewWindow();
    if (!previewWindow) {
      setFileError(new LocalizedError("course:materials.allowPopups"));
      return;
    }
    setActiveFile(`preview-${file.id}`);
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
      setActiveFile(null);
    }
  };

  const failed = !valid || assignmentQuery.isError || versionsQuery.isError;
  const versions = versionsQuery.data ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <Link
          to={valid ? `/course/${courseId}/assignments/${assignmentId}` : "/"}
          className={styles.backLink}
          aria-label={translate("common:navigationControls.backToAssignment")}
          title={translate("common:navigationControls.backToAssignment")}
        >
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>
            {translate("assessment:submission.title")}
          </p>
          <h1>
            {assignmentQuery.data?.title ||
              (failed
                ? translate("assessment:submission.unavailable")
                : translate("assessment:submission.loading"))}
          </h1>
          <p>{translate("common:records.submission", { id: submissionId })}</p>
        </div>
        {access.canGrade ? (
          <Link
            className={styles.primaryButton}
            to={`/course/${courseId}/assignments/${assignmentId}/grading`}
          >
            <ShieldCheck size={17} />{" "}
            {translate("assessment:submission.openRoster")}
          </Link>
        ) : null}
      </div>

      {failed ? (
        <section className={styles.card} role="alert">
          <h2>{translate("assessment:submission.loadFailed")}</h2>
          <p>{translate("assessment:submission.loadFailedHelp")}</p>
          {valid ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                void assignmentQuery.refetch();
                void versionsQuery.refetch();
              }}
            >
              {translate("common:actions.tryAgain")}
            </button>
          ) : null}
        </section>
      ) : versionsQuery.isPending ? (
        <section className={styles.card} aria-busy="true">
          {translate("assessment:submission.loadingHistory")}
        </section>
      ) : versions.length === 0 ? (
        <section className={styles.card}>
          <h2>{translate("assessment:submission.noVersions")}</h2>
          <p>{translate("assessment:submission.noVersionsHelp")}</p>
        </section>
      ) : (
        <section
          className={styles.versionList}
          aria-label={translate("assessment:submission.history")}
        >
          {versions.map((version, index) => (
            <article className={styles.card} key={version.id}>
              <div className={styles.versionHeader}>
                <div>
                  <p className={styles.eyebrow}>
                    {index === 0
                      ? translate("assessment:submission.currentVersion")
                      : translate("assessment:submission.earlierVersion")}
                  </p>
                  <h2>
                    {translate("assessment:submission.version", {
                      number: formatNumber(version.versionNo),
                    })}
                  </h2>
                </div>
                <div className={styles.metadata}>
                  <span>
                    <Clock3 size={16} />
                    {formatUtcTimestamp(version.submittedAt)}
                  </span>
                  <span>
                    {formatSubmissionStatus(version.submissionStatus)}
                  </span>
                  {version.usedGraceBuffer ? (
                    <span>{translate("assessment:submission.graceUsed")}</span>
                  ) : null}
                </div>
              </div>
              {version.files.length ? (
                <ul className={styles.fileList}>
                  {version.files.map((file) => (
                    <li key={file.id}>
                      <FileText size={19} />
                      <span className={styles.fileName}>
                        {file.originalName}
                        <small>{formatSize(file.sizeBytes)}</small>
                      </span>
                      <div className={styles.fileActions}>
                        {file.previewAvailable ? (
                          <button
                            type="button"
                            onClick={() => void previewFile(file)}
                            disabled={activeFile !== null}
                          >
                            <Eye size={15} />
                            {activeFile === `preview-${file.id}`
                              ? translate("course:materials.opening")
                              : translate("course:materials.preview")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void downloadFile(file)}
                          disabled={activeFile !== null}
                        >
                          <Download size={15} />
                          {activeFile === `download-${file.id}`
                            ? translate("course:materials.downloading")
                            : translate("common:actions.download")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.empty}>
                  {translate("assessment:submission.noFiles")}
                </p>
              )}
            </article>
          ))}
        </section>
      )}
      {fileError ? (
        <p className={styles.error} role="alert">
          {fileError.localizedMessage()}
        </p>
      ) : null}
    </main>
  );
};

export default AssignmentSubmissionPage;
