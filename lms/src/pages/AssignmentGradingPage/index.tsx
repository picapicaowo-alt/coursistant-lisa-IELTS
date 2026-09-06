import {formatPersonName} from '@/utils/personName';
import i18n from "@/i18n";
import { statusLabel } from "@/i18n/presentation";
import { formatNumber } from "@/i18n/formatting";
import { formatFileSize } from "@/utils/file-utils";
import { useConfirmationDialog } from "@/components/TeachingWorkspace/useConfirmationDialog";
import { formatSubmissionStatus } from "@/pages/AssignmentDetailPage/submissionState";
import { LocalizedError } from "@/i18n/errors";
import { useTranslation } from "react-i18next";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  MessageSquare,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { GradingRosterItem, UpsertGradePayload } from "@/apis";
import { unwrapData } from "@/apis";
import { assignmentApiService } from "@/apis/services/assignment-api";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import {
  idempotencyFingerprint,
  useIdempotencyCheckpoint,
} from "@/hooks/useIdempotencyCheckpoint";
import { saveBlob } from "@/utils/downloadBlob";
import { formatUtcTimestamp } from "@/utils/datetime";
import { TeachingDialog } from "@/components/TeachingWorkspace";
import { StudentSubmissionHistory } from "@/pages/AssignmentDetailPage/StudentSubmissionHistory";
import { RichTextEditor } from "@/components/RichTextEditor";
import { buildGradeSelection, rosterRowKey } from "./gradeSelection";
import styles from "./index.module.scss";

type RosterFilter = "All" | "Ungraded" | "Graded";

const parseId = (value?: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getDisplayName = (row: GradingRosterItem) =>
  row.groupName || formatPersonName({firstName: row.studentFirstName, middleName: row.studentMiddleName, lastName: row.studentLastName}, row.studentName || i18n.t("assessment:grading.unknownLearner"));
const getDisplayEmail = (row: GradingRosterItem) =>
  row.groupId
    ? i18n.t("assessment:grading.groupMembers", {
        count: row.memberCount ?? 0,
        number: formatNumber(row.memberCount ?? 0),
      })
    : row.studentEmail || i18n.t("assessment:grading.noEmail");

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

const formatSubmissionTime = (value?: string) => {
  if (!value) return "—";
  return formatUtcTimestamp(value, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
};

const getSubmissionLabel = formatSubmissionStatus;

interface GradeDialogProps {
  courseId: number;
  assignmentId: number;
  row: GradingRosterItem;
  pointsPossible?: number;
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (
    payload: UpsertGradePayload,
    annotatedFileChange: AnnotatedFileChange,
  ) => void;
}

type AnnotatedFileChange = { kind: "keep" } | { kind: "upload"; file: File };

export const GradeDialog = ({
  courseId,
  assignmentId,
  row,
  pointsPossible,
  isSaving,
  error,
  onClose,
  onSave,
}: GradeDialogProps) => {
  const { t: translate } = useTranslation();
  const [score, setScore] = useState(
    row.score === undefined ? "" : String(row.score),
  );
  const [feedback, setFeedback] = useState("");
  const [annotatedFile, setAnnotatedFile] = useState<File | undefined>();
  const [validation, setValidation] = useState<LocalizedError | null>(null);
  const annotatedFileInputRef = useRef<HTMLInputElement>(null);
  const gradingViewQuery = useQuery({
    queryKey: [
      "assignment-grading-view",
      courseId,
      assignmentId,
      row.studentUserId,
      row.groupId,
    ],
    queryFn: async () =>
      unwrapData(
        row.groupId !== undefined
          ? await assignmentApiService.getGroupGradingView(
              courseId,
              assignmentId,
              row.groupId,
            )
          : await assignmentApiService.getStudentGradingView(
              courseId,
              assignmentId,
              row.studentUserId!,
            ),
        "getGradingView",
      ),
  });
  const submissionVersionsQuery = useQuery({
    queryKey: [
      "assignment-submission-versions",
      courseId,
      assignmentId,
      row.submissionId,
    ],
    enabled: row.submissionId !== undefined,
    queryFn: async () =>
      unwrapData(
        await assignmentApiService.listSubmissionVersions(
          courseId,
          assignmentId,
          row.submissionId!,
        ),
        "listSubmissionVersionsForGrading",
      ),
  });

  useEffect(() => {
    const html = gradingViewQuery.data?.grade?.feedbackHtml;
    if (html) setFeedback(html);
    const nextScore = gradingViewQuery.data?.grade?.score;
    if (nextScore !== undefined) setScore(String(nextScore));
  }, [
    gradingViewQuery.data?.grade?.feedbackHtml,
    gradingViewQuery.data?.grade?.score,
  ]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsedScore = Number(score);
    if (
      !score.trim() ||
      !Number.isFinite(parsedScore) ||
      parsedScore < 0 ||
      (pointsPossible != null && parsedScore > pointsPossible)
    ) {
      setValidation(
        new LocalizedError(
          pointsPossible != null
            ? "assessment:grading.scoreInvalid"
            : "assessment:grading.scoreNonnegative",
          { maximum: pointsPossible ?? 0 },
        ),
      );
      return;
    }
    setValidation(null);
    const annotatedFileChange: AnnotatedFileChange = annotatedFile
      ? { kind: "upload", file: annotatedFile }
      : { kind: "keep" };
    onSave(
      {
        score: parsedScore,
        feedbackHtml: feedback.trim() || undefined,
        submissionVersionId: row.submissionVersionId,
        rubricVersionId:
          gradingViewQuery.data?.grade?.rubricVersionId ??
          gradingViewQuery.data?.rubric?.versionId,
        aiAssisted: false,
      },
      annotatedFileChange,
    );
  };

  const clearSelectedAnnotatedFile = () => {
    setAnnotatedFile(undefined);
    if (annotatedFileInputRef.current) annotatedFileInputRef.current.value = "";
  };

  const openAnnotatedFilePicker = () => {
    if (!annotatedFileInputRef.current) return;
    annotatedFileInputRef.current.value = "";
    annotatedFileInputRef.current.click();
  };

  return (
    <TeachingDialog
      title={getDisplayName(row)}
      description={translate("assessment:grading.gradeSubmission")}
      busy={isSaving}
      onClose={onClose}
    >
      <form className={styles.gradeDialog} onSubmit={submit} noValidate>
        <section
          className={styles.submittedFiles}
          aria-labelledby="submitted-files-title"
        >
          <div className={styles.submittedFilesHeader}>
            <div>
              <h3 id="submitted-files-title">
                {translate("assessment:grading.submittedFiles")}
              </h3>
              <p>{translate("assessment:grading.reviewFilesHelp")}</p>
            </div>
            {row.fileCount ? (
              <span>
                {translate("assessment:files.count", {
                  count: row.fileCount,
                  number: formatNumber(row.fileCount),
                })}
              </span>
            ) : null}
          </div>

          {row.submissionId === undefined ? (
            <p className={styles.noSubmittedFiles}>
              {translate("assessment:grading.learnerNoFiles")}
            </p>
          ) : submissionVersionsQuery.isPending ? (
            <p className={styles.noSubmittedFiles}>
              {translate("assessment:grading.loadingFiles")}
            </p>
          ) : submissionVersionsQuery.isError ? (
            <div className={styles.submissionFilesError} role="alert">
              <span>{translate("assessment:grading.filesFailed")}</span>
              <button
                type="button"
                onClick={() => void submissionVersionsQuery.refetch()}
              >
                {translate("common:actions.tryAgain")}
              </button>
            </div>
          ) : submissionVersionsQuery.data.length > 0 ? (
            <StudentSubmissionHistory
              courseId={courseId}
              assignmentId={assignmentId}
              submissionId={row.submissionId}
              versions={submissionVersionsQuery.data}
            />
          ) : (
            <p className={styles.noSubmittedFiles}>
              {translate("assessment:grading.noVersions")}
            </p>
          )}
        </section>

        <label className={styles.scoreField}>
          <span>{translate("records:fields.score")}</span>
          <div>
            <input
              type="number"
              min="0"
              max={pointsPossible}
              step="0.01"
              value={score}
              onChange={(event) => setScore(event.target.value)}
              required
              autoFocus
            />
            <span>
              / {pointsPossible != null ? formatNumber(pointsPossible) : "—"}
            </span>
          </div>
        </label>

        <div className={styles.feedbackField}>
          <span>{translate("assessment:grading.feedback")}</span>
          {gradingViewQuery.isPending ? (
            <p className={styles.dialogNote}>
              {translate("assessment:grading.loadingFeedback")}
            </p>
          ) : null}
          {gradingViewQuery.isError ? (
            <div className={styles.submissionFilesError} role="alert">
              <span>{translate("assessment:grading.feedbackFailed")}</span>
              <button
                type="button"
                onClick={() => void gradingViewQuery.refetch()}
              >
                {translate("common:actions.tryAgain")}
              </button>
            </div>
          ) : null}
          <RichTextEditor
            content={feedback}
            onChange={setFeedback}
            outputFormat="html"
            showToolbar
            placeholder={translate("assessment:grading.feedbackPlaceholder")}
            ariaLabel={translate("assessment:grading.feedback")}
          />
        </div>

        <div className={styles.annotatedField}>
          <div className={styles.annotatedFieldHeader}>
            <span>
              <Upload size={17} />{" "}
              {translate("assessment:grading.annotatedFile")}
            </span>
            <small>{translate("common:fields.optional")}</small>
          </div>
          <input
            ref={annotatedFileInputRef}
            className={styles.srOnly}
            type="file"
            accept=".pdf,.docx,.png,.jpg,.jpeg,.gif,.webp"
            disabled={isSaving}
            aria-label={translate("assessment:grading.chooseAnnotated")}
            onChange={(event) => {
              const nextFile = event.target.files?.[0];
              setAnnotatedFile(nextFile);
            }}
          />

          {annotatedFile ? (
            <div className={styles.annotatedFileCard}>
              <span className={styles.annotatedFileIcon}>
                <FileText size={20} />
              </span>
              <span className={styles.annotatedFileDetails}>
                <strong title={annotatedFile.name}>{annotatedFile.name}</strong>
                <small>
                  {translate("assessment:grading.readyUpload", {
                    size: formatFileSize(annotatedFile.size),
                  })}
                </small>
              </span>
              <div className={styles.annotatedFileActions}>
                <button
                  type="button"
                  className={styles.replaceFileButton}
                  onClick={openAnnotatedFilePicker}
                  disabled={isSaving}
                >
                  {translate("assessment:grading.replace")}
                </button>
                <button
                  type="button"
                  className={styles.removeFileButton}
                  onClick={clearSelectedAnnotatedFile}
                  disabled={isSaving}
                  aria-label={translate("assessment:grading.removeFile", {
                    name: annotatedFile.name,
                  })}
                >
                  <Trash2 size={16} /> {translate("common:actions.remove")}
                </button>
              </div>
            </div>
          ) : row.hasAnnotatedFile ? (
            <div className={styles.annotatedFileCard}>
              <span className={styles.annotatedFileIcon}>
                <FileText size={20} />
              </span>
              <span className={styles.annotatedFileDetails}>
                <strong>
                  {translate("assessment:grading.currentAnnotated")}
                </strong>
                <small>{translate("assessment:grading.annotatedSaved")}</small>
              </span>
              <div className={styles.annotatedFileActions}>
                <button
                  type="button"
                  className={styles.replaceFileButton}
                  onClick={openAnnotatedFilePicker}
                  disabled={isSaving}
                >
                  {translate("assessment:grading.replace")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={styles.annotatedUploadButton}
              onClick={openAnnotatedFilePicker}
              disabled={isSaving}
            >
              <Upload size={19} />
              <span>
                <strong>
                  {translate("assessment:grading.uploadAnnotated")}
                </strong>
                <small>
                  {translate("assessment:grading.uploadAnnotatedHelp")}
                </small>
              </span>
            </button>
          )}
          <p className={styles.annotatedFileHint}>
            {translate("assessment:grading.annotatedLimits")}
          </p>
        </div>

        <p className={styles.dialogNote}>
          {translate("assessment:grading.saveHelp")}
        </p>
        {validation ? (
          <p className={styles.error} role="alert">
            {validation.localizedMessage()}
          </p>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <footer>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClose}
            disabled={isSaving}
          >
            {translate("common:actions.cancel")}
          </button>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={isSaving || score === ""}
          >
            {isSaving
              ? translate("common:actions.saving")
              : translate("assessment:grading.save")}
          </button>
        </footer>
      </form>
    </TeachingDialog>
  );
};

const AssignmentGradingPage = () => {
  const { t: translate } = useTranslation();
  const { courseId: courseParam, assignmentId: assignmentParam } = useParams();
  const courseId = parseId(courseParam);
  const assignmentId = parseId(assignmentParam);
  const access = useCourseAccess(courseId);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RosterFilter>("All");
  const [selectedRow, setSelectedRow] = useState<GradingRosterItem | null>(
    null,
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isSaving, setSaving] = useState(false);
  const [isReleasing, setReleasing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const confirmation = useConfirmationDialog(`${courseId}/${assignmentId}`);

  const rosterQuery = useQuery({
    queryKey: ["assignment-grading-roster", courseId, assignmentId],
    enabled:
      courseId !== null &&
      assignmentId !== null &&
      access.isResolved &&
      access.canGrade,
    queryFn: async () =>
      unwrapData(
        await assignmentApiService.getGradingRoster(courseId!, assignmentId!),
        "getGradingRoster",
      ),
  });

  const rows = useMemo(() => {
    const roster = rosterQuery.data?.items ?? [];
    const needle = search.trim().toLowerCase();

    return roster.filter((row) => {
      const graded = row.gradeStatus !== "Ungraded";
      const matchesFilter =
        filter === "All" || (filter === "Graded" ? graded : !graded);
      const matchesSearch =
        !needle ||
        [getDisplayName(row), row.studentEmail].some((value) =>
          value?.toLowerCase().includes(needle),
        );
      return matchesFilter && matchesSearch;
    });
  }, [filter, rosterQuery.data?.items, search]);

  const saveGrade = async (
    payload: UpsertGradePayload,
    annotatedFileChange: AnnotatedFileChange,
  ) => {
    if (!selectedRow || courseId === null || assignmentId === null) return;
    setSaving(true);
    setActionError(null);

    try {
      // Grade data and the optional annotated file are separate resources. Save
      // the grade first, keep the dialog draft on either failure, and refresh
      // the roster only after both operations complete.
      if (selectedRow.groupId !== undefined) {
        await assignmentApiService.upsertGroupGrade(
          courseId,
          assignmentId,
          selectedRow.groupId,
          payload,
        );
        if (annotatedFileChange.kind === "upload") {
          await assignmentApiService.uploadGroupAnnotatedFile(
            courseId,
            assignmentId,
            selectedRow.groupId,
            annotatedFileChange.file,
          );
        }
      } else if (selectedRow.studentUserId !== undefined) {
        await assignmentApiService.upsertStudentGrade(
          courseId,
          assignmentId,
          selectedRow.studentUserId,
          payload,
        );
        if (annotatedFileChange.kind === "upload") {
          await assignmentApiService.uploadStudentAnnotatedFile(
            courseId,
            assignmentId,
            selectedRow.studentUserId,
            annotatedFileChange.file,
          );
        }
      } else {
        throw new LocalizedError("assessment:grading.noTarget");
      }

      await queryClient.invalidateQueries({
        queryKey: ["assignment-grading-roster", courseId, assignmentId],
      });
      setSelectedRow(null);
    } catch {
      setActionError("assessment:grading.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  const downloadAnnotated = async (row: GradingRosterItem) => {
    if (courseId === null || assignmentId === null) return;
    setActionError(null);
    try {
      const blob =
        row.groupId !== undefined
          ? await assignmentApiService.downloadGroupAnnotatedFile(
              courseId,
              assignmentId,
              row.groupId,
            )
          : await assignmentApiService.downloadStudentAnnotatedFile(
              courseId,
              assignmentId,
              row.studentUserId!,
            );
      saveBlob(
        blob,
        translate("assessment:files.annotatedDownload", {
          name: getDisplayName(row).replace(/[\\/:*?"<>|]/g, "-"),
        }),
      );
    } catch {
      setActionError("assessment:grading.downloadFailed");
    }
  };

  const releaseAll = async () => {
    if (courseId === null || assignmentId === null) return;
    if (
      !(await confirmation.confirm({
        titleKey: "assessment:grading.releaseSelected",
        messageKey: "assessment:grading.releaseConfirm",
      }))
    )
      return;

    setReleasing(true);
    setActionError(null);
    const operation = `assignment-release-all-${courseId}-${assignmentId}`;
    const fingerprint = idempotencyFingerprint({
      courseId,
      assignmentId,
      action: "release-all",
    });
    try {
      await assignmentApiService.releaseAllGrades(
        courseId,
        assignmentId,
        idempotency.keyFor(operation, fingerprint),
      );
      idempotency.completeFingerprint(operation, fingerprint);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["assignment-grading-roster", courseId, assignmentId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["assignment", courseId, assignmentId],
        }),
      ]);
      setSelectedKeys(new Set());
    } catch {
      setActionError("assessment:grading.releaseFailed");
    } finally {
      setReleasing(false);
    }
  };

  const updateSelectedRelease = async (action: "release" | "retract") => {
    if (courseId === null || assignmentId === null || selectedKeys.size === 0)
      return;
    const selection = buildGradeSelection(rows, selectedKeys);
    if (
      !(await confirmation.confirm({
        titleKey:
          action === "release"
            ? "assessment:grading.releaseSelected"
            : "assessment:grading.retractSelected",
        messageKey:
          action === "release"
            ? "assessment:grading.releaseSelectedConfirm"
            : "assessment:grading.retractSelectedConfirm",
        values: {
          count: selectedKeys.size,
          number: formatNumber(selectedKeys.size),
        },
      }))
    )
      return;

    setReleasing(true);
    setActionError(null);
    const operation = `assignment-grades-${action}-${courseId}-${assignmentId}`;
    const fingerprint = idempotencyFingerprint({ action, selection });
    try {
      if (action === "release") {
        await assignmentApiService.releaseGrades(
          courseId,
          assignmentId,
          selection,
          idempotency.keyFor(operation, fingerprint),
        );
      } else {
        await assignmentApiService.retractGrades(
          courseId,
          assignmentId,
          selection,
          idempotency.keyFor(operation, fingerprint),
        );
      }
      idempotency.completeFingerprint(operation, fingerprint);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["assignment-grading-roster", courseId, assignmentId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["assignment", courseId, assignmentId],
        }),
      ]);
      setSelectedKeys(new Set());
    } catch {
      setActionError(
        action === "release"
          ? "assessment:grading.releaseSelectedFailed"
          : "assessment:grading.retractSelectedFailed",
      );
    } finally {
      setReleasing(false);
    }
  };

  const toggleRow = (key: string) =>
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (courseId === null || assignmentId === null) {
    return (
      <div className={styles.status} role="alert">
        {translate("assessment:grading.invalidLink")}
      </div>
    );
  }

  if (access.isLoading) {
    return (
      <div className={styles.status}>
        {translate("assessment:checkingPermissions")}
      </div>
    );
  }

  if (access.isError) {
    return (
      <div className={styles.status} role="alert">
        <p>{translate("assessment:permissionsFailed")}</p>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={access.refetch}
        >
          {translate("common:actions.tryAgain")}
        </button>
      </div>
    );
  }

  if (!access.canGrade) {
    return (
      <div className={styles.status} role="alert">
        {translate("assessment:grading.noPermission")}
      </div>
    );
  }

  if (rosterQuery.isLoading || rosterQuery.isPending) {
    return (
      <div className={styles.status}>
        {translate("assessment:grading.loadingRoster")}
      </div>
    );
  }

  if (rosterQuery.isError || !rosterQuery.data) {
    return (
      <div className={styles.status} role="alert">
        <p>{translate("assessment:grading.rosterFailed")}</p>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => void rosterQuery.refetch()}
        >
          {translate("common:actions.tryAgain")}
        </button>
      </div>
    );
  }

  const roster = rosterQuery.data;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headingGroup}>
          <Link
            to={`/course/${courseId}/assignments/${assignmentId}`}
            className={styles.backButton}
            aria-label={translate("common:navigationControls.backToAssignment")}
            title={translate("common:navigationControls.backToAssignment")}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <div>
            <p className={styles.eyebrow}>
              {translate("detailWorkspace:assignmentReview.grading")}
            </p>
            <h1>{roster.assignmentTitle}</h1>
          </div>
        </div>
        {access.canReleaseGrades ? (
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void updateSelectedRelease("retract")}
              disabled={
                isReleasing ||
                selectedKeys.size === 0 ||
                !roster.gradingWritable
              }
            >
              <RotateCcw size={18} />
              {translate("assessment:grading.retractSelected")}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void updateSelectedRelease("release")}
              disabled={
                isReleasing ||
                selectedKeys.size === 0 ||
                !roster.gradingWritable
              }
            >
              <CheckCircle2 size={18} />
              {translate("assessment:grading.releaseSelected")}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void releaseAll()}
              disabled={
                isReleasing ||
                roster.enteredCount === 0 ||
                !roster.gradingWritable
              }
            >
              <CheckCircle2 size={18} />
              {isReleasing
                ? translate("settings:updating")
                : translate("assessment:grading.releaseEntered", {
                    number: formatNumber(roster.enteredCount),
                  })}
            </button>
          </div>
        ) : (
          <p className={styles.taNotice}>
            {translate("assessment:grading.taNotice")}
          </p>
        )}
      </header>

      <section
        className={styles.metrics}
        aria-label={translate("assessment:grading.summary")}
      >
        <div>
          <span>{translate("common:status.SUBMITTED")}</span>
          <strong>
            {formatNumber(roster.submittedCount)}/
            {formatNumber(roster.totalStudents)}
          </strong>
        </div>
        <div>
          <span>{translate("common:status.LATE")}</span>
          <strong>{formatNumber(roster.lateCount)}</strong>
        </div>
        <div>
          <span>{translate("course:assignmentSubmissionDetail.ungraded")}</span>
          <strong>{formatNumber(roster.ungradedCount)}</strong>
        </div>
        <div>
          <span>{translate("common:status.RELEASED")}</span>
          <strong>{formatNumber(roster.releasedCount)}</strong>
        </div>
      </section>

      <section className={styles.rosterCard}>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <Search size={18} />
            <span className={styles.srOnly}>
              {translate("assessment:grading.search")}
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={translate("assessment:grading.search")}
            />
          </label>
          <div
            className={styles.filters}
            aria-label={translate("assessment:grading.statusFilter")}
          >
            {(["All", "Ungraded", "Graded"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={filter === value ? styles.activeFilter : undefined}
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {value === "All"
                  ? translate("course:detail.filterAll")
                  : statusLabel(value)}
              </button>
            ))}
          </div>
        </div>

        {actionError && !selectedRow ? (
          <p className={styles.error} role="alert">
            {translate(actionError)}
          </p>
        ) : null}

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {access.canReleaseGrades ? (
                  <th>
                    <span className={styles.srOnly}>
                      {translate("operations:select")}
                    </span>
                  </th>
                ) : null}
                <th>{translate("assessment:grading.learner")}</th>
                <th>
                  {translate("detailWorkspace:assignmentReview.submission")}
                </th>
                <th>{translate("assessment:grading.submittedAt")}</th>
                <th>{translate("records:fields.score")}</th>
                <th>{translate("assessment:grading.status")}</th>
                <th>
                  <span className={styles.srOnly}>
                    {translate("common:fields.actions")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name = getDisplayName(row);
                const key = rosterRowKey(row);
                return (
                  <tr key={key}>
                    {access.canReleaseGrades ? (
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(key)}
                          onChange={() => toggleRow(key)}
                          aria-label={translate(
                            "assessment:grading.selectName",
                            { name },
                          )}
                        />
                      </td>
                    ) : null}
                    <td>
                      <div className={styles.learner}>
                        <span className={styles.avatar}>
                          {getInitials(name)}
                        </span>
                        <span>
                          <strong>{name}</strong>
                          <small>{getDisplayEmail(row)}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.submissionCell}>
                        <span
                          className={styles.submissionBadge}
                          data-status={row.submissionStatus}
                        >
                          {getSubmissionLabel(row.submissionStatus)}
                        </span>
                        {row.fileCount ? (
                          <small>
                            {translate("assessment:files.count", {
                              count: row.fileCount,
                              number: formatNumber(row.fileCount),
                            })}
                          </small>
                        ) : null}
                      </span>
                    </td>
                    <td>{formatSubmissionTime(row.submittedAt)}</td>
                    <td className={styles.score}>
                      {row.score != null ? formatNumber(row.score) : "—"} /{" "}
                      {roster.pointsPossible != null
                        ? formatNumber(roster.pointsPossible)
                        : "—"}
                    </td>
                    <td>
                      <span
                        className={styles.gradeBadge}
                        data-status={row.gradeStatus}
                      >
                        {statusLabel(row.gradeStatus)}
                      </span>
                    </td>
                    <td>
                      <div className={styles.rowButtons}>
                        {row.hasAnnotatedFile ? (
                          <button
                            type="button"
                            className={styles.gradeButton}
                            onClick={() => void downloadAnnotated(row)}
                            aria-label={translate(
                              "assessment:grading.downloadAnnotatedName",
                              { name },
                            )}
                          >
                            <Download size={17} />
                            <span>{translate("common:status.FILE")}</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={styles.gradeButton}
                          onClick={() => {
                            setActionError(null);
                            setSelectedRow(row);
                          }}
                          disabled={!roster.gradingWritable}
                          aria-label={
                            row.submissionId
                              ? translate(
                                  "assessment:grading.viewAndGradeName",
                                  { name },
                                )
                              : translate("assessment:grading.gradeName", {
                                  name,
                                })
                          }
                        >
                          <MessageSquare size={18} />
                          <span>
                            {row.submissionId
                              ? translate("assessment:grading.viewAndGrade")
                              : row.gradeStatus === "Ungraded"
                                ? translate("course:assignmentTeacher.grade")
                                : translate("common:actions.edit")}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className={styles.empty}>
              {translate("assessment:grading.noRows")}
            </p>
          ) : null}
        </div>
      </section>

      {!roster.gradingWritable ? (
        <p className={styles.readOnlyNotice} role="status">
          {translate("assessment:grading.readOnly")}
        </p>
      ) : null}

      {confirmation.dialog}
      {selectedRow ? (
        <GradeDialog
          courseId={courseId}
          assignmentId={assignmentId}
          row={selectedRow}
          pointsPossible={roster.pointsPossible}
          isSaving={isSaving}
          error={actionError ? translate(actionError) : null}
          onClose={() => {
            if (!isSaving) setSelectedRow(null);
          }}
          onSave={(payload, annotatedFileChange) =>
            void saveGrade(payload, annotatedFileChange)
          }
        />
      ) : null}
    </div>
  );
};

export default AssignmentGradingPage;
