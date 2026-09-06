import { useTranslation } from "react-i18next";
import { LocalizedError } from "@/i18n/errors";
import { formatNumber } from "@/i18n/formatting";
import { formatFileSize } from "@/utils/file-utils";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  FileText,
  Trash2,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  ApiResponse,
  AssignmentDetail,
  AssignmentLearningType,
  AssignmentSubmissionType,
  CreateAssignmentPayload,
  PatchAssignmentPayload,
} from "@/apis";
import { ASSIGNMENT_LEARNING_TYPES, unwrapData } from "@/apis";
import { assignmentApiService } from "@/apis/services/assignment-api";
import { courseApiService } from "@/apis/services/course-api";
import { EnglishDateTimeInput } from "@/components/EnglishDateInput";
import { TeachingDialog } from "@/components/TeachingWorkspace";
import type { DueDateChangePreview } from "@/apis";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import {
  idempotencyFingerprint,
  useIdempotencyCheckpoint,
} from "@/hooks/useIdempotencyCheckpoint";
import { getApiErrorCode, isConflict } from "@/utils/apiError";
import {
  normalizeCourseLocalDateTime,
  toCourseLocalDateTimeInput,
} from "@/utils/courseLocalDateTime";
import {
  isPreviewableFile,
  openPreviewWindow,
  saveBlob,
  showBlobInPreviewWindow,
} from "@/utils/downloadBlob";
import { FileTypeMultiSelect } from "./FileTypeMultiSelect";
import styles from "./index.module.scss";

const parseId = (value?: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

interface AssignmentEditorFormProps {
  courseId: number;
  assignment?: AssignmentDetail;
}

type EditorPayload = Omit<CreateAssignmentPayload, "weekId" | "learningType"> &
  Partial<Pick<CreateAssignmentPayload, "weekId" | "learningType">>;
const LEARNING_LABELS: Record<AssignmentLearningType, string> = {
  PRE_CLASS: "auth:preview.preClass",
  HOMEWORK: "auth:preview.homework",
  PRACTICE: "auth:preview.practice",
};

export const AssignmentEditorForm = ({
  courseId,
  assignment,
}: AssignmentEditorFormProps) => {
  const { t: translate } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(assignment?.title ?? "");
  const [weekId, setWeekId] = useState(
    assignment?.weekId == null ? "" : String(assignment.weekId),
  );
  const [learningType, setLearningType] = useState<AssignmentLearningType | "">(
    assignment?.learningType ?? "",
  );
  const [description, setDescription] = useState(assignment?.description ?? "");
  const [dueAt, setDueAt] = useState(
    toCourseLocalDateTimeInput(assignment?.dueAtLocal),
  );
  const [lateUntil, setLateUntil] = useState(
    toCourseLocalDateTimeInput(assignment?.lateUntilLocal),
  );
  const [pointsPossible, setPointsPossible] = useState(
    assignment?.pointsPossible === undefined
      ? "100"
      : String(assignment.pointsPossible),
  );
  const [submissionType, setSubmissionType] =
    useState<AssignmentSubmissionType>(
      assignment?.submissionType ?? "Individual",
    );
  const [groupSetId, setGroupSetId] = useState(
    assignment?.groupSetId === undefined ? "" : String(assignment.groupSetId),
  );
  const [allowedFileTypes, setAllowedFileTypes] = useState<string[]>(
    assignment?.allowedFileTypes ?? ["pdf", "docx"],
  );
  const [maxFileCount, setMaxFileCount] = useState(
    String(assignment?.maxFileCount ?? 3),
  );
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(
    String(
      Math.round(
        (assignment?.maxFileSizeBytes ?? 10 * 1024 * 1024) / 1024 / 1024,
      ),
    ),
  );
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  // A successful record write becomes a checkpoint immediately. If a later
  // attachment upload or publish call fails, retrying patches this same record
  // instead of creating a second assignment.
  const [checkpointAssignment, setCheckpointAssignment] =
    useState<AssignmentDetail | null>(assignment ?? null);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<LocalizedError | null>(null);
  const [attachmentError, setAttachmentError] = useState<LocalizedError | null>(
    null,
  );
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
    number | null
  >(null);
  const [previewingAttachmentId, setPreviewingAttachmentId] = useState<
    number | null
  >(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<
    number | null
  >(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [deadlineConfirmation, setDeadlineConfirmation] = useState<{
    preview: DueDateChangePreview;
    timezone?: string;
    decide: (accepted: boolean) => void;
  } | null>(null);
  // A locale change must not restart a confirmation or its preview request.
  // Leaving the editor cancels an outstanding confirmation before any write.
  useEffect(
    () => () => deadlineConfirmation?.decide(false),
    [deadlineConfirmation],
  );
  const confirmDeadline = (accepted: boolean) => {
    deadlineConfirmation?.decide(accepted);
    setDeadlineConfirmation(null);
  };
  const savingRef = useRef(false);
  const idempotency = useIdempotencyCheckpoint();

  const weeksQuery = useQuery({
    queryKey: ["course-weeks", courseId],
    queryFn: async () =>
      unwrapData(
        await courseApiService.getCourseWeeks(courseId),
        "assignmentLectures",
      ),
  });

  const groupSetsQuery = useQuery({
    queryKey: ["course-group-sets", courseId],
    enabled: submissionType === "Group",
    queryFn: async () =>
      unwrapData(
        await courseApiService.listGroupSets(courseId),
        "listGroupSets",
      ),
  });

  const groupSets = groupSetsQuery.data ?? [];
  const hasCurrentGroupSet =
    groupSetId !== "" &&
    groupSets.some((groupSet) => String(groupSet.id) === groupSetId);

  const hasRecoveredDraft = !assignment && checkpointAssignment !== null;
  const exitPath = checkpointAssignment
    ? `/course/${courseId}/assignments/${checkpointAssignment.id}`
    : `/course/${courseId}`;

  const removePendingFile = (index: number) => {
    setPendingFiles((files) =>
      files.filter((_, fileIndex) => fileIndex !== index),
    );
  };

  const downloadExistingAttachment = async (
    attachmentId: number,
    filename: string,
  ) => {
    const savedAssignment = checkpointAssignment;
    if (!savedAssignment) return;
    setDownloadingAttachmentId(attachmentId);
    setAttachmentError(null);
    try {
      const blob = await assignmentApiService.downloadAttachment(
        courseId,
        savedAssignment.id,
        attachmentId,
      );
      saveBlob(blob, filename);
    } catch {
      setAttachmentError(
        new LocalizedError("assessment:assignment.errors.download", {
          name: filename,
        }),
      );
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const previewExistingAttachment = async (
    attachmentId: number,
    filename: string,
  ) => {
    const savedAssignment = checkpointAssignment;
    if (!savedAssignment) return;
    const previewWindow = openPreviewWindow();
    if (!previewWindow) {
      setAttachmentError(new LocalizedError("course:materials.allowPopups"));
      return;
    }
    setPreviewingAttachmentId(attachmentId);
    setAttachmentError(null);
    try {
      showBlobInPreviewWindow(
        previewWindow,
        await assignmentApiService.previewAttachment(
          courseId,
          savedAssignment.id,
          attachmentId,
        ),
      );
    } catch {
      previewWindow.close();
      setAttachmentError(
        new LocalizedError("assessment:assignment.errors.preview", {
          name: filename,
        }),
      );
    } finally {
      setPreviewingAttachmentId(null);
    }
  };

  const onChooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setPendingFiles((current) => [...current, ...files]);
    event.target.value = "";
  };

  const deleteExistingAttachment = async (
    attachmentId: number,
    filename: string,
  ) => {
    const savedAssignment = checkpointAssignment;
    if (!savedAssignment) return;
    setDeletingAttachmentId(attachmentId);
    setAttachmentError(null);
    const operation = `assignment-attachment-delete-${courseId}-${savedAssignment.id}-${attachmentId}`;
    const idempotencyKey = idempotency.keyFor(operation, operation);
    try {
      await assignmentApiService.deleteAttachment(
        courseId,
        savedAssignment.id,
        attachmentId,
        idempotencyKey,
      );
      idempotency.complete(operation, idempotencyKey);
      setCheckpointAssignment((current) =>
        current
          ? {
              ...current,
              attachments: current.attachments.filter(
                (file) => file.id !== attachmentId,
              ),
            }
          : current,
      );
      await queryClient.invalidateQueries({
        queryKey: ["assignment", courseId, savedAssignment.id],
      });
    } catch {
      setAttachmentError(
        new LocalizedError("assessment:assignment.errors.delete", {
          name: filename,
        }),
      );
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const buildPayload = (publish: boolean): EditorPayload | null => {
    const cleanTitle = title.trim();
    const normalizedDueAt = normalizeCourseLocalDateTime(dueAt);
    const normalizedLateUntil = lateUntil
      ? normalizeCourseLocalDateTime(lateUntil)
      : undefined;
    if (!cleanTitle || !normalizedDueAt) {
      setError(new LocalizedError("assessment:assignment.errors.required"));
      return null;
    }
    if ((!checkpointAssignment || publish) && (!weekId || !learningType)) {
      setError(new LocalizedError("assessment:assignment.errors.placement"));
      return null;
    }
    if (
      weekId &&
      Number(weekId) !== checkpointAssignment?.weekId &&
      !weeksQuery.data?.some((week) => week.id === Number(weekId))
    ) {
      setError(
        new LocalizedError("assessment:assignment.errors.courseLecture"),
      );
      return null;
    }
    if (lateUntil && !normalizedLateUntil) {
      setError(new LocalizedError("assessment:assignment.errors.lateTime"));
      return null;
    }

    const points = Number(pointsPossible);
    const fileCount = Number(maxFileCount);
    const sizeMb = Number(maxFileSizeMb);
    const parsedGroupSetId = Number(groupSetId);

    if (
      !Number.isFinite(points) ||
      points < 0 ||
      !Number.isInteger(fileCount) ||
      fileCount < 1 ||
      !Number.isFinite(sizeMb) ||
      sizeMb <= 0
    ) {
      setError(new LocalizedError("assessment:assignment.errors.limits"));
      return null;
    }

    if (allowedFileTypes.length === 0) {
      setError(new LocalizedError("assessment:assignment.errors.fileType"));
      return null;
    }

    if (
      submissionType === "Group" &&
      (!Number.isInteger(parsedGroupSetId) || parsedGroupSetId <= 0)
    ) {
      setError(new LocalizedError("assessment:assignment.errors.group"));
      return null;
    }

    return {
      ...(weekId ? { weekId: Number(weekId) } : {}),
      ...(learningType ? { learningType } : {}),
      title: cleanTitle,
      description: description.trim(),
      pointsPossible: points,
      dueAt: normalizedDueAt,
      ...(normalizedLateUntil ? { lateUntil: normalizedLateUntil } : {}),
      allowedFileTypes,
      maxFileCount: fileCount,
      maxFileSizeBytes: Math.round(sizeMb * 1024 * 1024),
      submissionType,
      ...(submissionType === "Group" ? { groupSetId: parsedGroupSetId } : {}),
    };
  };

  /**
   * Persists the editor as a resumable record → attachments → publish workflow.
   * Each successful stage advances `checkpointAssignment`, so retrying a later
   * failure does not create a second assignment or re-upload completed files.
   */
  const persist = async (publish: boolean) => {
    if (savingRef.current) return;

    const payload = buildPayload(publish);
    if (!payload) return;

    savingRef.current = true;
    setSaving(true);
    setError(null);
    let saved = checkpointAssignment;
    let stage: "record" | "attachments" | "publish" = "record";

    try {
      let confirmShortenDueDate = false;
      if (saved) {
        const nextDueAt = payload.dueAt;
        const nextLateUntil = payload.lateUntil;
        const dueChanged =
          toCourseLocalDateTimeInput(saved.dueAtLocal) !== dueAt;
        const lateChanged =
          toCourseLocalDateTimeInput(saved.lateUntilLocal) !== lateUntil;
        if (dueChanged || lateChanged) {
          // Moving a deadline earlier can retroactively change submission state;
          // preview the impact before sending the confirmed versioned update.
          const preview = unwrapData(
            await assignmentApiService.previewDueDateChange(
              courseId,
              saved.id,
              {
                dueAt: nextDueAt,
                ...(nextLateUntil ? { lateUntil: nextLateUntil } : {}),
                ...(!nextLateUntil && saved.lateUntilLocal
                  ? { clearLateUntil: true }
                  : {}),
              },
            ),
            "previewDueDateChange",
          );
          if (preview.confirmationRequired) {
            const deadlineTimezone = preview.timezone || saved.timezone;
            const accepted = await new Promise<boolean>((decide) => {
              setDeadlineConfirmation({
                preview,
                timezone: deadlineTimezone,
                decide,
              });
            });
            if (!accepted) return;
            confirmShortenDueDate = true;
          }
        }
      }

      let recordOperation: string;
      let recordKey: string;
      let response: ApiResponse<AssignmentDetail>;
      if (saved) {
        const expectedVersion = saved.version;
        if (
          typeof expectedVersion !== "number" ||
          !Number.isInteger(expectedVersion)
        ) {
          setError(new LocalizedError("assessment:assignment.errors.reload"));
          return;
        }
        const recordRequest: PatchAssignmentPayload = {
          // Locked structure is omitted from unrelated edits; sending an unchanged
          // submission type can otherwise make a valid title/deadline edit fail.
          ...Object.fromEntries(
            Object.entries(payload).filter(([key, value]) => {
              const previous =
                key === "dueAt"
                  ? normalizeCourseLocalDateTime(saved!.dueAtLocal)
                  : key === "lateUntil"
                    ? normalizeCourseLocalDateTime(saved!.lateUntilLocal)
                    : saved![key as keyof AssignmentDetail];
              return JSON.stringify(value) !== JSON.stringify(previous);
            }),
          ),
          expectedVersion,
          ...(checkpointAssignment?.lateUntilLocal && !lateUntil
            ? { clearLateUntil: true }
            : {}),
          ...(confirmShortenDueDate ? { confirmShortenDueDate: true } : {}),
        };
        recordOperation = `assignment-update-${courseId}-${saved.id}`;
        recordKey = idempotency.keyFor(
          recordOperation,
          idempotencyFingerprint(recordRequest),
        );
        response = await assignmentApiService.patchAssignment(
          courseId,
          saved.id,
          recordRequest,
          recordKey,
        );
      } else {
        if (payload.weekId == null || !payload.learningType)
          throw new LocalizedError('assessment:assignment.errors.placement');
        recordOperation = `assignment-create-${courseId}`;
        recordKey = idempotency.keyFor(
          recordOperation,
          idempotencyFingerprint(payload),
        );
        response = await assignmentApiService.createAssignment(
          courseId,
          {
            ...payload,
            weekId: payload.weekId,
            learningType: payload.learningType,
          },
          recordKey,
        );
      }
      saved = unwrapData(
        response,
        checkpointAssignment ? "patchAssignment" : "createAssignment",
      );
      idempotency.complete(recordOperation, recordKey);
      setCheckpointAssignment(saved);

      if (pendingFiles.length > 0) {
        stage = "attachments";
        const attachmentOperation = `assignment-attachments-upload-${courseId}-${saved.id}`;
        const attachmentKey = idempotency.keyFor(
          attachmentOperation,
          idempotencyFingerprint({
            assignmentId: saved.id,
            files: pendingFiles,
          }),
        );
        const uploaded = unwrapData(
          await assignmentApiService.uploadAttachments(
            courseId,
            saved.id,
            pendingFiles,
            attachmentKey,
          ),
          "uploadAttachments",
        );
        idempotency.complete(attachmentOperation, attachmentKey);
        saved = {
          ...saved,
          attachments: [...(saved.attachments ?? []), ...uploaded],
        };
        setCheckpointAssignment(saved);
        // If publishing fails next, a retry must not upload the same successful
        // batch again.
        setPendingFiles([]);
      }

      if (publish && saved.state !== "Published") {
        stage = "publish";
        const publishOperation = `assignment-publish-${courseId}-${saved.id}`;
        const publishKey = idempotency.keyFor(
          publishOperation,
          publishOperation,
        );
        saved = unwrapData(
          await assignmentApiService.publishAssignment(
            courseId,
            saved.id,
            publishKey,
          ),
          "publishAssignment",
        );
        idempotency.complete(publishOperation, publishKey);
        setCheckpointAssignment(saved);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["course-assignments", courseId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["assignment", courseId, saved.id],
        }),
      ]);
      navigate(`/course/${courseId}/assignments/${saved.id}`);
    } catch (err) {
      const isVersionConflict =
        isConflict(err) ||
        getApiErrorCode(err) === "ASSIGNMENT_VERSION_CONFLICT";
      if (isVersionConflict && saved) {
        let reloaded = false;
        try {
          const fresh = unwrapData(
            await assignmentApiService.getAssignment(courseId, saved.id),
            "getAssignment",
          );
          setCheckpointAssignment(fresh);
          reloaded = true;
        } catch {
          // ignore
        }
        setError(
          new LocalizedError(
            reloaded
              ? "assessment:assignment.errors.conflict"
              : "assessment:assignment.errors.conflictReload",
          ),
        );
      } else if (stage === "attachments" && saved) {
        setError(
          new LocalizedError("assessment:assignment.errors.attachments", {
            id: saved.id,
          }),
        );
      } else if (stage === "publish" && saved) {
        setError(
          new LocalizedError("assessment:assignment.errors.publish", {
            id: saved.id,
          }),
        );
      } else {
        setError(
          checkpointAssignment
            ? new LocalizedError("assessment:assignment.errors.update")
            : new LocalizedError("assessment:assignment.errors.create"),
        );
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const submitDraft = (event: FormEvent) => {
    event.preventDefault();
    void persist(false);
  };

  return (
    <div className={styles.page}>
      <form noValidate className={styles.editor} onSubmit={submitDraft}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>
              {assignment
                ? translate("assessment:assignment.edit")
                : hasRecoveredDraft
                  ? translate("assessment:assignment.resume")
                  : translate("assessment:assignment.new")}
            </p>
            <h1>
              {assignment
                ? translate("assessment:assignment.editHomework")
                : hasRecoveredDraft
                  ? translate("assessment:assignment.finishHomework")
                  : translate("assessment:assignment.createHomework")}
            </h1>
          </div>
          <Link
            to={exitPath}
            className={styles.closeButton}
            aria-label={translate("assessment:assignment.closeEditor")}
          >
            <X size={22} />
          </Link>
        </header>

        {hasRecoveredDraft ? (
          <div className={styles.recoveryNotice} role="status">
            <CheckCircle2 size={20} aria-hidden="true" />
            <div>
              <strong>
                {translate("assessment:assignment.savedDraft", {
                  id: checkpointAssignment.id,
                })}
              </strong>
              <span>{translate("assessment:assignment.retryDraftHelp")}</span>
            </div>
            <Link to={exitPath}>
              {translate("assessment:assignment.openDraft")}
            </Link>
          </div>
        ) : null}

        <div className={styles.fieldGrid}>
          <label className={`${styles.field} ${styles.titleField}`}>
            <span>{translate("assessment:assignment.name")}</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={translate("course:assignmentModal.titlePlaceholder")}
              maxLength={180}
              autoFocus
            />
          </label>

          <label className={styles.field}>
            <span>{translate("common:status.LECTURE")}</span>
            <select
              value={weekId}
              onChange={(event) => setWeekId(event.target.value)}
              disabled={isSaving || weeksQuery.isPending}
              required={!checkpointAssignment}
            >
              <option value="">
                {translate("assessment:assignment.selectLecture")}
              </option>
              {weekId &&
              !weeksQuery.data?.some((week) => String(week.id) === weekId) ? (
                <option value={weekId}>
                  {translate("assessment:assignment.currentLecture")}
                </option>
              ) : null}
              {(weeksQuery.data ?? []).map((week) => (
                <option key={week.id} value={week.id}>
                  {week.title}
                </option>
              ))}
            </select>
            {weeksQuery.isError ? (
              <span role="alert">
                {translate("assessment:assignment.lecturesFailed")}{" "}
                <button type="button" onClick={() => void weeksQuery.refetch()}>
                  {translate("common:actions.retry")}
                </button>
              </span>
            ) : null}
            {!weeksQuery.isPending &&
            !weeksQuery.isError &&
            !weeksQuery.data?.length ? (
              <small>
                {translate("assessment:assignment.addLectureFirst")}
              </small>
            ) : null}
          </label>
          <label className={styles.field}>
            <span>{translate("assessment:assignment.learningCategory")}</span>
            <select
              value={learningType}
              onChange={(event) =>
                setLearningType(
                  event.target.value as AssignmentLearningType | "",
                )
              }
              disabled={isSaving}
              required={!checkpointAssignment}
            >
              <option value="">
                {translate("assessment:assignment.selectCategory")}
              </option>
              {ASSIGNMENT_LEARNING_TYPES.map((value) => (
                <option key={value} value={value}>
                  {translate(LEARNING_LABELS[value])}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>
              <CalendarClock size={16} />{" "}
              {translate("course:assignmentModal.dueTimeLabel")}
            </span>
            <EnglishDateTimeInput aria-label={translate('course:assignmentModal.dueTimeLabel')} value={dueAt} onChangeValue={setDueAt} />
          </label>

          <label className={styles.field}>
            <span>
              <CalendarClock size={16} />{" "}
              {translate("assessment:assignment.lateUntil")}
            </span>
            <EnglishDateTimeInput
              aria-label={translate('assessment:assignment.lateUntil')}
              value={lateUntil}
              onChangeValue={setLateUntil}
            />
          </label>

          <label className={styles.field}>
            <span>
              <FileText size={16} />{" "}
              {translate("assessment:assignment.submissionType")}
            </span>
            <select
              value={submissionType}
              disabled={isSaving || assignment?.canEditStructure === false}
              onChange={(event) =>
                setSubmissionType(
                  event.target.value as AssignmentSubmissionType,
                )
              }
            >
              <option value="Individual">
                {translate("assessment:assignment.individual")}
              </option>
              <option value="Group">
                {translate("course:assignmentSubmissionDetail.group")}
              </option>
            </select>
          </label>

          {submissionType === "Group" ? (
            <div className={styles.field}>
              <span>
                <UsersRound size={16} />{" "}
                {translate("assessment:assignment.groupSet")}
              </span>
              <select
                aria-label={translate("assessment:assignment.groupSet")}
                value={groupSetId}
                onChange={(event) => setGroupSetId(event.target.value)}
                disabled={
                  isSaving ||
                  groupSetsQuery.isPending ||
                  assignment?.canEditStructure === false
                }
              >
                <option value="">
                  {groupSetsQuery.isPending
                    ? translate("assessment:assignment.loadingGroups")
                    : groupSets.length === 0
                      ? translate("assessment:assignment.noGroups")
                      : translate("assessment:assignment.selectGroup")}
                </option>
                {!hasCurrentGroupSet && groupSetId ? (
                  <option value={groupSetId}>
                    {translate("assessment:assignment.currentGroup", {
                      id: groupSetId,
                    })}
                  </option>
                ) : null}
                {groupSets.map((groupSet) => (
                  <option key={groupSet.id} value={groupSet.id}>
                    {translate("assessment:assignment.groupChoice", {
                      name: groupSet.name,
                      count: groupSet.groups.length,
                      number: formatNumber(groupSet.groups.length),
                    })}
                  </option>
                ))}
              </select>
              <span className={styles.fieldHelp}>
                {groupSetsQuery.isError
                  ? translate("assessment:assignment.groupsFailed")
                  : translate("assessment:assignment.groupHelp")}
                {groupSetsQuery.isError ? (
                  <button
                    type="button"
                    onClick={() => void groupSetsQuery.refetch()}
                  >
                    {translate("common:actions.tryAgain")}
                  </button>
                ) : null}
                <Link to={`/course/${courseId}/groups`}>
                  {translate("assessment:assignment.manageGroups")}
                </Link>
              </span>
            </div>
          ) : null}

          <label className={styles.field}>
            <span>{translate("assessment:assignment.pointsPossible")}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pointsPossible}
              onChange={(event) => setPointsPossible(event.target.value)}
            />
          </label>

          <div className={`${styles.field} ${styles.fullWidth}`}>
            <span id="assignment-instructions-label">
              {translate("common:admin.examFields.instructions")}
            </span>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder={translate(
                "assessment:assignment.instructionsPlaceholder",
              )}
              ariaLabel={translate("assessment:assignment.instructionsAria")}
            />
          </div>

          <FileTypeMultiSelect
            value={allowedFileTypes}
            onChange={setAllowedFileTypes}
          />

          <label className={styles.field}>
            <span>{translate("assessment:assignment.maxFiles")}</span>
            <input
              type="number"
              min="1"
              value={maxFileCount}
              onChange={(event) => setMaxFileCount(event.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span>{translate("assessment:assignment.maxSize")}</span>
            <input
              type="number"
              min="1"
              step="1"
              value={maxFileSizeMb}
              onChange={(event) => setMaxFileSizeMb(event.target.value)}
            />
          </label>
        </div>

        <label className={styles.uploadArea}>
          <Upload size={30} aria-hidden="true" />
          <span>{translate("assessment:assignment.chooseUpload")}</span>
          <small>{translate("assessment:assignment.uploadHelp")}</small>
          <input type="file" multiple onChange={onChooseFiles} />
        </label>

        {checkpointAssignment?.attachments.length ? (
          <section
            className={styles.existingAttachments}
            aria-labelledby="current-attachments-title"
          >
            <p id="current-attachments-title">
              {translate("assessment:assignment.currentAttachments")}
            </p>
            <ul>
              {checkpointAssignment.attachments.map((file) => (
                <li key={file.id}>
                  <FileText size={18} aria-hidden="true" />
                  <button
                    type="button"
                    title={file.originalName}
                    onClick={() =>
                      void downloadExistingAttachment(
                        file.id,
                        file.originalName,
                      )
                    }
                    disabled={downloadingAttachmentId !== null}
                  >
                    {downloadingAttachmentId === file.id
                      ? translate("course:materials.downloading")
                      : file.originalName}
                  </button>
                  <span>{formatFileSize(file.sizeBytes)}</span>
                  {(file.previewAvailable ??
                  isPreviewableFile(file.originalName, file.contentType)) ? (
                    <button
                      type="button"
                      aria-label={translate("course:materials.previewNamed", {
                        name: file.originalName,
                      })}
                      onClick={() =>
                        void previewExistingAttachment(
                          file.id,
                          file.originalName,
                        )
                      }
                      disabled={
                        previewingAttachmentId !== null ||
                        downloadingAttachmentId !== null
                      }
                    >
                      <Eye size={16} />
                      {previewingAttachmentId === file.id
                        ? translate("course:materials.opening")
                        : translate("course:materials.preview")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.deleteAttachmentButton}
                    aria-label={translate("assessment:assignment.deleteNamed", {
                      name: file.originalName,
                    })}
                    onClick={() =>
                      setAttachmentToDelete({
                        id: file.id,
                        name: file.originalName,
                      })
                    }
                    disabled={deletingAttachmentId !== null}
                  >
                    <Trash2 size={16} />
                    {deletingAttachmentId === file.id
                      ? translate("common:actions.deleting")
                      : translate("common:actions.delete")}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {attachmentError ? (
          <p className={styles.error} role="alert">
            {attachmentError.localizedMessage()}
          </p>
        ) : null}

        {pendingFiles.length > 0 ? (
          <ul
            className={styles.pendingFiles}
            aria-label={translate("assessment:assignment.pendingFiles")}
          >
            {pendingFiles.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}-${index}`}>
                <span>{file.name}</span>
                <button
                  type="button"
                  onClick={() => removePendingFile(index)}
                  aria-label={translate("assessment:assignment.removePending", {
                    name: file.name,
                  })}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error.localizedMessage()}
          </p>
        ) : null}

        <footer className={styles.actions}>
          <Link to={exitPath} className={styles.secondaryButton}>
            {translate("common:actions.cancel")}
          </Link>
          <button
            type="submit"
            className={styles.secondaryButton}
            disabled={isSaving}
          >
            {assignment || hasRecoveredDraft
              ? translate("common:actions.saveChanges")
              : translate("operations:saveDraft")}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={isSaving}
            onClick={() => void persist(true)}
          >
            {isSaving
              ? translate("common:actions.saving")
              : checkpointAssignment?.state === "Published"
                ? translate("assessment:assignment.keepPublished")
                : translate("course:addContent.publishButton")}
          </button>
        </footer>
      </form>

      {attachmentToDelete ? (
        <TeachingDialog
          title={translate("assessment:assignment.deleteAttachmentTitle")}
          description={translate("assessment:assignment.deleteAttachment", {
            name: attachmentToDelete.name,
          })}
          onClose={() => setAttachmentToDelete(null)}
        >
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setAttachmentToDelete(null)}
            >
              {translate("common:actions.cancel")}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                const attachment = attachmentToDelete;
                setAttachmentToDelete(null);
                void deleteExistingAttachment(attachment.id, attachment.name);
              }}
            >
              {translate("common:actions.delete")}
            </button>
          </div>
        </TeachingDialog>
      ) : null}
      {deadlineConfirmation ? (
        <TeachingDialog
          title={translate("assessment:assignment.shortenTitle")}
          description={translate("assessment:assignment.shortenImpact", {
            active: formatNumber(
              deadlineConfirmation.preview.activeStudentCount,
            ),
            submitted: formatNumber(
              deadlineConfirmation.preview.submittedCount,
            ),
            late: formatNumber(
              deadlineConfirmation.preview.submissionsBecomingLateCount,
            ),
          })}
          onClose={() => confirmDeadline(false)}
        >
          {deadlineConfirmation.timezone ? (
            <p>
              {translate("assessment:assignment.deadlineTimezone", {
                timezone: deadlineConfirmation.timezone,
              })}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => confirmDeadline(false)}
            >
              {translate("common:actions.cancel")}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => confirmDeadline(true)}
            >
              {translate("common:actions.confirm")}
            </button>
          </div>
        </TeachingDialog>
      ) : null}

      <Link to={`/course/${courseId}`} className={styles.backLink}>
        {translate("course:grades.back")}
      </Link>
    </div>
  );
};

const AssignmentEditorPage = () => {
  const { t: translate } = useTranslation();
  const { courseId: courseParam, assignmentId: assignmentParam } = useParams();
  const courseId = parseId(courseParam);
  const assignmentId = assignmentParam ? parseId(assignmentParam) : null;
  const isEditing = Boolean(assignmentParam);
  const access = useCourseAccess(courseId);

  const assignmentQuery = useQuery({
    queryKey: ["assignment", courseId, assignmentId],
    enabled:
      courseId !== null &&
      assignmentId !== null &&
      access.isResolved &&
      access.canConfigureAssignments,
    queryFn: async () =>
      unwrapData(
        await assignmentApiService.getAssignment(courseId!, assignmentId!),
        "getAssignment",
      ),
  });

  if (courseId === null || (isEditing && assignmentId === null)) {
    return (
      <div className={styles.status} role="alert">
        {translate("assessment:assignment.invalidLink")}
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

  if (!access.canConfigureAssignments) {
    return (
      <div className={styles.status} role="alert">
        {translate("assessment:assignment.instructorOnly")}
      </div>
    );
  }

  if (isEditing && assignmentQuery.isLoading) {
    return (
      <div className={styles.status}>
        {translate("assessment:assignment.loading")}
      </div>
    );
  }

  if (isEditing && (assignmentQuery.isError || !assignmentQuery.data)) {
    return (
      <div className={styles.status} role="alert">
        {translate("assessment:assignment.loadFailed")}
      </div>
    );
  }

  return (
    <AssignmentEditorForm
      key={assignmentQuery.data?.id ?? "new"}
      courseId={courseId}
      assignment={assignmentQuery.data}
    />
  );
};

export default AssignmentEditorPage;
