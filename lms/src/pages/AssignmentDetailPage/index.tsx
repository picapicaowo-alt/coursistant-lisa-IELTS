import { statusLabel } from "@/i18n/presentation";
import { formatFileSize } from "@/utils/file-utils";
import { useConfirmationDialog } from "@/components/TeachingWorkspace/useConfirmationDialog";
import { LocalizedError } from "@/i18n/errors";
import { formatNumber } from "@/i18n/formatting";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  MessageSquareText,
  RotateCcw,
  Trash2,
  Upload,
  UsersRound,
} from "lucide-react";
import { assignmentApiService } from "@/apis/services/assignment-api";
import type { AssignmentAttachment } from "@/apis";
import { unwrapData } from "@/apis";
import { useAuth } from "@/contexts/AuthContext";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import { useIdempotencyCheckpoint } from "@/hooks/useIdempotencyCheckpoint";
import { RichTextEditor } from "@/components/RichTextEditor";
import { formatDeadline } from "@/utils/datetime";
import {
  isPreviewableFile,
  openPreviewWindow,
  saveBlob,
  showBlobInPreviewWindow,
} from "@/utils/downloadBlob";
import { SubmitAssignmentDialog } from "./SubmitAssignmentDialog";
import { StudentSubmissionHistory } from "./StudentSubmissionHistory";
import { uploadRubricWithReplaceConfirmation } from "./rubricUpload";
import { loadRubricState } from "./rubricState";
import { isStudentAccount } from "@/utils/roleCapabilities";
import {
  buildEmptySubmissionState,
  formatSubmissionStatus,
  isNoFormalSubmissionError,
} from "./submissionState";
import styles from "./index.module.scss";

const parseId = (value?: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const InstructorAttachmentRow = ({
  courseId,
  assignmentId,
  attachment,
}: {
  courseId: number;
  assignmentId: number;
  attachment: AssignmentAttachment;
}) => {
  const { t: translate } = useTranslation();
  const [activeAction, setActiveAction] = useState<
    "preview" | "download" | null
  >(null);
  const [fileError, setFileError] = useState<LocalizedError | null>(null);
  const previewable =
    attachment.previewAvailable ??
    isPreviewableFile(attachment.originalName, attachment.contentType);

  const download = async () => {
    setActiveAction("download");
    setFileError(null);
    try {
      const blob = await assignmentApiService.downloadAttachment(
        courseId,
        assignmentId,
        attachment.id,
      );
      saveBlob(blob, attachment.originalName);
    } catch {
      setFileError(
        new LocalizedError("assessment:assignment.errors.download", {
          name: attachment.originalName,
        }),
      );
    } finally {
      setActiveAction(null);
    }
  };

  const preview = async () => {
    const previewWindow = openPreviewWindow();
    if (!previewWindow) {
      setFileError(new LocalizedError("course:materials.allowPopups"));
      return;
    }

    setActiveAction("preview");
    setFileError(null);
    try {
      const blob = await assignmentApiService.previewAttachment(
        courseId,
        assignmentId,
        attachment.id,
      );
      showBlobInPreviewWindow(previewWindow, blob);
    } catch {
      previewWindow.close();
      setFileError(
        new LocalizedError("assessment:assignment.errors.preview", {
          name: attachment.originalName,
        }),
      );
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <li className={styles.attachmentRow}>
      <FileText size={22} aria-hidden="true" />
      <button
        type="button"
        className={styles.attachmentName}
        title={translate("assessment:files.downloadName", {
          name: attachment.originalName,
        })}
        aria-label={translate("assessment:files.downloadName", {
          name: attachment.originalName,
        })}
        onClick={() => void download()}
        disabled={activeAction !== null}
      >
        {attachment.originalName}
      </button>
      <div className={styles.attachmentActions}>
        {previewable ? (
          <button
            type="button"
            onClick={() => void preview()}
            disabled={activeAction !== null}
          >
            <Eye size={15} />
            {activeAction === "preview"
              ? translate("course:materials.opening")
              : translate("course:materials.preview")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void download()}
          disabled={activeAction !== null}
        >
          <Download size={15} />
          {activeAction === "download"
            ? translate("course:materials.downloading")
            : translate("common:actions.download")}
        </button>
      </div>
      {fileError ? (
        <p className={styles.attachmentError} role="alert">
          {fileError.localizedMessage()}
        </p>
      ) : null}
    </li>
  );
};

export const RubricEmptyState = ({
  canConfigureAssignments,
}: {
  canConfigureAssignments: boolean;
}) => {
  const { t: translate } = useTranslation();
  return canConfigureAssignments ? (
    <p className={styles.secondaryText}>
      {translate("assessment:submission.rubricHelp")}
    </p>
  ) : null;
};

const formatGradeNumber = (value: number) =>
  formatNumber(value, { maximumFractionDigits: 2 });

const feedbackToPlainText = (feedback?: string) => {
  const trimmed = feedback?.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("<")) return trimmed;

  if (typeof DOMParser === "undefined") {
    return (
      trimmed
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim() || null
    );
  }

  const document = new DOMParser().parseFromString(trimmed, "text/html");
  document.body
    .querySelectorAll("br")
    .forEach((node) => node.replaceWith("\n"));
  document.body
    .querySelectorAll("p, div, li, blockquote")
    .forEach((node) => node.append("\n"));
  return (
    document.body.textContent
      ?.replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() || null
  );
};

export const StudentGradeSummary = ({
  gradeReleased,
  score,
  pointsPossible,
  gradeDisplay,
  feedback,
}: {
  gradeReleased?: boolean;
  score?: number;
  pointsPossible?: number;
  gradeDisplay?: string;
  feedback?: string;
}) => {
  const { t: translate } = useTranslation();
  const feedbackText = feedbackToPlainText(feedback);
  const numericScore =
    Number.isFinite(score) && Number.isFinite(pointsPossible)
      ? `${formatGradeNumber(score!)} / ${formatGradeNumber(pointsPossible!)}`
      : null;
  const releasedScore =
    numericScore ??
    (gradeDisplay && gradeDisplay !== "NotGradedYet"
      ? gradeDisplay
      : translate("notification:types.ASSIGNMENT_GRADE_RELEASED"));

  return (
    <section
      className={styles.summaryCard}
      aria-labelledby="student-grade-title"
    >
      <div className={styles.gradeSummaryHeader}>
        <h2 id="student-grade-title">
          {translate("course:assignmentTeacher.grade")}
        </h2>
        <span
          className={styles.gradeStatus}
          data-status={gradeReleased ? "released" : "pending"}
        >
          {gradeReleased
            ? translate("common:status.RELEASED")
            : translate("common:status.pending")}
        </span>
      </div>

      {gradeReleased ? (
        <>
          <div className={styles.summaryRow}>
            <CheckCircle2 size={20} aria-hidden="true" />
            <div>
              <span>{translate("records:fields.score")}</span>
              <strong
                className={styles.gradeScoreValue}
                aria-label={translate("assessment:submission.scoreLabel", {
                  score: releasedScore,
                })}
              >
                {releasedScore}
              </strong>
            </div>
          </div>
          <div className={styles.gradeSummaryFeedback}>
            <div className={styles.gradeFeedbackTitle}>
              <MessageSquareText size={18} aria-hidden="true" />
              <span>
                {translate("assessment:submission.instructorFeedback")}
              </span>
            </div>
            <p>
              {feedbackText ?? translate("assessment:submission.noFeedback")}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className={styles.summaryRow}>
            <Clock3 size={20} aria-hidden="true" />
            <div>
              <span>{translate("common:fields.status")}</span>
              <strong>{translate("assessment:submission.gradePending")}</strong>
            </div>
          </div>
          <p className={styles.gradeSummaryHint}>
            {translate("assessment:submission.gradePendingHelp")}
          </p>
        </>
      )}
    </section>
  );
};

const AssignmentDetailPage = () => {
  const { t: translate } = useTranslation();
  const { courseId: courseIdParam, assignmentId: assignmentIdParam } =
    useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const rubricInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [staffMessage, setStaffMessage] = useState<{
    key: string;
    tone: "error" | "success";
  } | null>(null);
  const confirmation = useConfirmationDialog(`${courseIdParam}/${assignmentIdParam}`);
  const courseId = parseId(courseIdParam);
  const assignmentId = parseId(assignmentIdParam);
  const access = useCourseAccess(courseId);

  const assignmentQuery = useQuery({
    queryKey: ["assignment", courseId, assignmentId],
    enabled: courseId !== null && assignmentId !== null,
    queryFn: async () =>
      unwrapData(
        await assignmentApiService.getAssignment(courseId!, assignmentId!),
        "getAssignment",
      ),
  });

  const isStaff =
    assignmentQuery.data?.activeStudentCount !== undefined ||
    assignmentQuery.data?.canEditStructure !== undefined;
  const isStudent = access.membership
    ? access.isStudent
    : assignmentQuery.data
      ? !isStaff
      : user
        ? isStudentAccount(user)
        : false;

  const submissionQuery = useQuery({
    queryKey: ["assignment-submission", courseId, assignmentId],
    enabled:
      assignmentQuery.isSuccess &&
      isStudent &&
      courseId !== null &&
      assignmentId !== null,
    queryFn: async () => {
      try {
        return unwrapData(
          await assignmentApiService.getMySubmission(courseId!, assignmentId!),
          "getMySubmission",
        );
      } catch (error) {
        const assignment = assignmentQuery.data;
        if (!isNoFormalSubmissionError(error) || !assignment || !user)
          throw error;

        // 8081 models “never submitted” as a 404. Preserve any staged files,
        // then turn it into the empty state the student screen expects.
        const stagingFiles = assignment.stagedFileCount
          ? unwrapData(
              await assignmentApiService.listStagingFiles(
                courseId!,
                assignmentId!,
              ),
              "listStagingFiles",
            )
          : [];

        return buildEmptySubmissionState(assignment, user.id, stagingFiles);
      }
    },
  });

  const submissionId = submissionQuery.data?.submissionId;
  const versionsQuery = useQuery({
    queryKey: [
      "assignment-submission-versions",
      courseId,
      assignmentId,
      submissionId,
    ],
    enabled:
      submissionId !== undefined && courseId !== null && assignmentId !== null,
    queryFn: async () =>
      unwrapData(
        await assignmentApiService.listSubmissionVersions(
          courseId!,
          assignmentId!,
          submissionId!,
        ),
        "listSubmissionVersions",
      ),
  });

  const rubricQuery = useQuery({
    queryKey: ["assignment-rubric", courseId, assignmentId],
    enabled:
      assignmentQuery.isSuccess && courseId !== null && assignmentId !== null,
    queryFn: () => loadRubricState(courseId!, assignmentId!),
  });

  const unpublish = useMutation({
    mutationFn: () => {
      const operation = `assignment-unpublish-${courseId}-${assignmentId}`;
      return assignmentApiService.unpublishAssignment(
        courseId!,
        assignmentId!,
        idempotency.keyFor(operation, operation),
      );
    },
    onSuccess: async () => {
      const operation = `assignment-unpublish-${courseId}-${assignmentId}`;
      idempotency.completeFingerprint(operation, operation);
      await assignmentQuery.refetch();
      setStaffMessage({
        key: "assessment:submission.unpublished",
        tone: "success",
      });
    },
    onError: () =>
      setStaffMessage({
        key: "assessment:submission.unpublishFailed",
        tone: "error",
      }),
  });

  const removeAssignment = useMutation({
    mutationFn: () => {
      const operation = `assignment-delete-${courseId}-${assignmentId}`;
      return assignmentApiService.deleteAssignment(
        courseId!,
        assignmentId!,
        idempotency.keyFor(operation, operation),
      );
    },
    onSuccess: async () => {
      const operation = `assignment-delete-${courseId}-${assignmentId}`;
      idempotency.completeFingerprint(operation, operation);
      await queryClient.invalidateQueries({
        queryKey: ["course-assignments", courseId],
      });
      navigate(`/course/${courseId}`, { replace: true });
    },
    onError: () =>
      setStaffMessage({
        key: "assessment:submission.deleteFailed",
        tone: "error",
      }),
  });

  const uploadRubric = useMutation({
    mutationFn: (file: File) =>
      uploadRubricWithReplaceConfirmation(
        courseId!,
        assignmentId!,
        file,
        Boolean(rubricQuery.data?.gradedAgainstPreviousRubricCount),
        () =>
          confirmation.confirm({
            titleKey: "assessment:submission.replacePdf",
            messageKey: "assessment:submission.replaceReferenced",
          }),
      ),
    onSuccess: async () => {
      await rubricQuery.refetch();
      setStaffMessage({
        key: "assessment:submission.rubricUploaded",
        tone: "success",
      });
    },
    onError: () =>
      setStaffMessage({
        key: "assessment:submission.rubricUploadFailed",
        tone: "error",
      }),
  });

  const restoreRubric = useMutation({
    mutationFn: () =>
      assignmentApiService.restorePreviousRubric(
        courseId!,
        assignmentId!,
        Boolean(rubricQuery.data?.gradedAgainstPreviousRubricCount),
      ),
    onSuccess: async () => {
      await rubricQuery.refetch();
      setStaffMessage({
        key: "assessment:submission.rubricRestored",
        tone: "success",
      });
    },
    onError: () =>
      setStaffMessage({
        key: "assessment:submission.rubricRestoreFailed",
        tone: "error",
      }),
  });

  const downloadRubric = async () => {
    if (!rubricQuery.data?.posted) return;
    setStaffMessage(null);
    try {
      saveBlob(
        await assignmentApiService.downloadRubric(courseId!, assignmentId!),
        rubricQuery.data.originalName ||
          translate("assessment:files.rubricDownload"),
      );
    } catch {
      setStaffMessage({
        key: "assessment:submission.rubricDownloadFailed",
        tone: "error",
      });
    }
  };

  const previewRubric = async () => {
    if (!rubricQuery.data?.posted) return;
    const previewWindow = openPreviewWindow();
    if (!previewWindow) {
      setStaffMessage({
        key: "assessment:submission.rubricAllowPopups",
        tone: "error",
      });
      return;
    }
    setStaffMessage(null);
    try {
      showBlobInPreviewWindow(
        previewWindow,
        await assignmentApiService.previewRubric(courseId!, assignmentId!),
      );
    } catch {
      previewWindow.close();
      setStaffMessage({
        key: "assessment:submission.rubricPreviewFailed",
        tone: "error",
      });
    }
  };

  if (courseId === null || assignmentId === null) {
    return (
      <div className={styles.status} role="alert">
        {translate("assessment:submission.invalidLink")}
      </div>
    );
  }

  if (assignmentQuery.isLoading) {
    return (
      <div className={styles.status}>
        {translate("assessment:submission.loadingAssignment")}
      </div>
    );
  }

  if (assignmentQuery.isError || !assignmentQuery.data) {
    return (
      <div className={styles.status} role="alert">
        <p>{translate("assessment:submission.assignmentFailed")}</p>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => void assignmentQuery.refetch()}
        >
          {translate("common:actions.tryAgain")}
        </button>
      </div>
    );
  }

  const assignment = assignmentQuery.data;
  const deadline = formatDeadline(assignment.dueAtLocal, assignment.timezone);
  const submissionVersions =
    versionsQuery.data ??
    (submissionQuery.data?.currentVersion
      ? [submissionQuery.data.currentVersion]
      : []);
  const studentSubmissionStatus =
    submissionQuery.data?.submissionStatus ?? assignment.submissionStatus;
  const showStudentGrade =
    isStudent &&
    (assignment.gradeReleased ||
      studentSubmissionStatus?.startsWith("Submitted"));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link
          to={`/course/${courseId}`}
          className={styles.backLink}
          aria-label={translate("course:grades.back")}
          title={translate("course:grades.back")}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <div className={styles.headerText}>
          <div className={styles.eyebrow}>
            <span className={styles.stateBadge}>
              {statusLabel(assignment.state)}
            </span>
            <span>
              {translate("assessment:submission.assignmentType", {
                type: statusLabel(assignment.submissionType),
              })}
            </span>
          </div>
          <h1>{assignment.title}</h1>
        </div>
        {access.canConfigureAssignments || access.canGrade ? (
          <div className={styles.headerActions}>
            {access.canConfigureAssignments ? (
              <Link
                to={`/course/${courseId}/assignments/${assignmentId}/edit`}
                className={styles.secondaryLink}
              >
                {translate("common:actions.edit")}
              </Link>
            ) : null}
            {access.canConfigureAssignments &&
            assignment.state === "Published" ? (
              <button
                type="button"
                className={styles.secondaryLink}
                onClick={() => {
                  void confirmation
                    .confirm({
                      titleKey: "assessment:quiz.unpublish",
                      messageKey: "assessment:submission.unpublishConfirm",
                    })
                    .then((accepted) => {
                      if (accepted) unpublish.mutate();
                    });
                }}
                disabled={unpublish.isPending}
              >
                {translate("assessment:quiz.unpublish")}
              </button>
            ) : null}
            {access.canGrade ? (
              <Link
                to={`/course/${courseId}/assignments/${assignmentId}/grading`}
                className={styles.primaryLink}
              >
                {translate("assessment:submission.gradeSubmissions")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </header>

      {staffMessage ? (
        <p
          className={
            staffMessage.tone === "error"
              ? styles.errorBanner
              : styles.successBanner
          }
          role="status"
        >
          {translate(staffMessage.key)}
        </p>
      ) : null}

      <div className={styles.layout}>
        <main className={styles.mainColumn}>
          {assignment.description || assignment.attachments?.length ? (
            <section className={styles.card}>
              <h2>{translate("assessment:submission.details")}</h2>
              {assignment.description ? (
                <div className={styles.description}>
                  <RichTextEditor
                    content={assignment.description}
                    disabled
                    displayOnly
                    showToolbar={false}
                    ariaLabel={translate("assessment:assignment.instructionsAria")}
                  />
                </div>
              ) : null}

              {assignment.attachments?.length > 0 ? (
                <div className={styles.attachments}>
                  <h3>{translate("assessment:submission.instructorFiles")}</h3>
                  <ul>
                    {assignment.attachments.map((attachment) => (
                      <InstructorAttachmentRow
                        key={attachment.id}
                        courseId={courseId}
                        assignmentId={assignmentId}
                        attachment={attachment}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>{translate("assessment:submission.rubric")}</h2>
                <p className={styles.secondaryText}>
                  {rubricQuery.data?.posted
                    ? translate("assessment:submission.rubricVersion", {
                        number: formatNumber(rubricQuery.data.versionNo ?? 0),
                        total: formatNumber(
                          rubricQuery.data.totalVersions ?? 0,
                        ),
                      })
                    : translate("assessment:submission.noRubric")}
                </p>
              </div>
              {access.canConfigureAssignments ? (
                <button
                  type="button"
                  className={styles.secondaryLink}
                  onClick={() => rubricInputRef.current?.click()}
                  disabled={uploadRubric.isPending}
                >
                  <Upload size={15} />
                  {uploadRubric.isPending
                    ? translate("assessment:submission.uploading")
                    : rubricQuery.data?.posted
                      ? translate("assessment:submission.replacePdf")
                      : translate("assessment:submission.uploadPdf")}
                </button>
              ) : null}
            </div>
            {access.canConfigureAssignments ? (
              <input
                ref={rubricInputRef}
                className={styles.hiddenInput}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    const count =
                      rubricQuery.data?.gradedAgainstPreviousRubricCount ?? 0;
                    if (!count) uploadRubric.mutate(file);
                    else
                      void confirmation
                        .confirm({
                          titleKey: "assessment:submission.replacePdf",
                          messageKey: "assessment:submission.replaceRubric",
                          values: { count, number: formatNumber(count) },
                        })
                        .then((accepted) => {
                          if (accepted) uploadRubric.mutate(file);
                        });
                  }
                  event.target.value = "";
                }}
              />
            ) : null}
            {rubricQuery.isPending ? (
              <p className={styles.secondaryText}>
                {translate("assessment:submission.loadingRubric")}
              </p>
            ) : rubricQuery.isError ? (
              <p className={styles.errorBanner}>
                {translate("assessment:submission.rubricFailed")}
              </p>
            ) : rubricQuery.data?.posted ? (
              <div className={styles.rubricRow}>
                <FileText size={20} />
                <button type="button" onClick={() => void previewRubric()}>
                  {rubricQuery.data.originalName}
                </button>
                <span>
                  {rubricQuery.data.sizeBytes
                    ? formatFileSize(rubricQuery.data.sizeBytes)
                    : ""}
                </span>
                <button
                  type="button"
                  className={styles.secondaryLink}
                  onClick={() => void previewRubric()}
                >
                  <Eye size={15} />
                  {translate("course:materials.preview")}
                </button>
                <button
                  type="button"
                  className={styles.secondaryLink}
                  onClick={() => void downloadRubric()}
                >
                  <Download size={15} />
                  {translate("common:actions.download")}
                </button>
                {access.canConfigureAssignments &&
                rubricQuery.data.canRestorePrevious ? (
                  <button
                    type="button"
                    className={styles.secondaryLink}
                    disabled={restoreRubric.isPending}
                    onClick={() => {
                      void confirmation
                        .confirm({
                          titleKey: "assessment:submission.restorePrevious",
                          messageKey: "assessment:submission.restoreConfirm",
                        })
                        .then((accepted) => {
                          if (accepted) restoreRubric.mutate();
                        });
                    }}
                  >
                    <RotateCcw size={15} />
                    {translate("assessment:submission.restorePrevious")}
                  </button>
                ) : null}
              </div>
            ) : (
              <RubricEmptyState
                canConfigureAssignments={access.canConfigureAssignments}
              />
            )}
          </section>

          {isStudent && (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>{translate("assessment:submission.yourSubmission")}</h2>
                  <p className={styles.secondaryText}>
                    {formatSubmissionStatus(
                      submissionQuery.data?.submissionStatus,
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setSubmitDialogOpen(true)}
                  disabled={
                    submissionQuery.isPending ||
                    !submissionQuery.data?.acceptingSubmissions
                  }
                >
                  {submissionQuery.data?.totalVersions
                    ? translate("assessment:submission.newVersion")
                    : translate("assessment:submission.submitAssignment")}
                </button>
              </div>

              {submissionQuery.isError && (
                <div className={styles.error} role="alert">
                  <span>
                    {translate("assessment:submission.detailsFailed")}
                  </span>{" "}
                  <button
                    type="button"
                    onClick={() => void submissionQuery.refetch()}
                  >
                    {translate("common:actions.tryAgain")}
                  </button>
                </div>
              )}

              {submissionId && submissionVersions.length > 0 ? (
                <StudentSubmissionHistory
                  courseId={courseId}
                  assignmentId={assignmentId}
                  submissionId={submissionId}
                  versions={submissionVersions}
                />
              ) : null}

              {versionsQuery.isError ? (
                <div className={styles.error} role="alert">
                  <span>
                    {translate("assessment:submission.historyFailed")}
                  </span>{" "}
                  <button
                    type="button"
                    onClick={() => void versionsQuery.refetch()}
                  >
                    {translate("common:actions.tryAgain")}
                  </button>
                </div>
              ) : null}
            </section>
          )}
        </main>

        <aside className={styles.sidebarColumn}>
          <section className={styles.summaryCard}>
            <h2>{translate("assessment:submission.summary")}</h2>
            <div className={styles.summaryRow}>
              <CalendarClock size={20} />
              <div>
                <span>{translate("assessment:submission.due")}</span>
                <strong>{deadline}</strong>
              </div>
            </div>
            <div className={styles.summaryRow}>
              <UsersRound size={20} />
              <div>
                <span>{translate("assessment:assignment.submissionType")}</span>
                <strong>{statusLabel(assignment.submissionType)}</strong>
              </div>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.pointsIcon}>#</span>
              <div>
                <span>{translate("assessment:points")}</span>
                <strong>
                  {assignment.pointsPossible != null
                    ? formatNumber(assignment.pointsPossible)
                    : translate("assessment:submission.notSet")}
                </strong>
              </div>
            </div>

            {!isStudent && (
              <div className={styles.staffMetrics}>
                <span>
                  {translate("assessment:submission.submittedCount", {
                    number: formatNumber(assignment.submissionCount ?? 0),
                  })}
                </span>
                <span>
                  {translate("assessment:submission.gradedCount", {
                    number: formatNumber(assignment.gradedCount ?? 0),
                  })}
                </span>
                <span>
                  {translate("assessment:submission.releasedCount", {
                    number: formatNumber(assignment.releasedCount ?? 0),
                  })}
                </span>
              </div>
            )}
            {access.canConfigureAssignments ? (
              <div className={styles.dangerZone}>
                <button
                  type="button"
                  className={styles.dangerButton}
                  disabled={removeAssignment.isPending}
                  onClick={() => {
                    void confirmation
                      .confirm({
                        titleKey: "assessment:submission.deleteAssignment",
                        messageKey: "assessment:submission.deleteConfirm",
                        values: { title: assignment.title },
                      })
                      .then((accepted) => {
                        if (accepted) removeAssignment.mutate();
                      });
                  }}
                >
                  <Trash2 size={16} />
                  {removeAssignment.isPending
                    ? translate("common:actions.deleting")
                    : translate("assessment:submission.deleteAssignment")}
                </button>
              </div>
            ) : null}
          </section>

          {showStudentGrade ? (
            <StudentGradeSummary
              gradeReleased={assignment.gradeReleased}
              score={assignment.score}
              pointsPossible={assignment.pointsPossible}
              gradeDisplay={assignment.gradeDisplay}
              feedback={assignment.feedback}
            />
          ) : null}
        </aside>
      </div>

      {confirmation.dialog}
      {isSubmitDialogOpen && submissionQuery.data && (
        <SubmitAssignmentDialog
          assignment={assignment}
          courseId={courseId}
          submission={submissionQuery.data}
          onClose={() => setSubmitDialogOpen(false)}
          onStaged={async () => {
            await submissionQuery.refetch();
          }}
          onSubmitted={async () => {
            await Promise.all([
              assignmentQuery.refetch(),
              submissionQuery.refetch(),
            ]);
            await queryClient.invalidateQueries({
              queryKey: [
                "assignment-submission-versions",
                courseId,
                assignmentId,
              ],
            });
          }}
        />
      )}
    </div>
  );
};

export default AssignmentDetailPage;
