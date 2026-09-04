import {ChangeEvent, FormEvent, useRef, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, CalendarClock, CheckCircle2, Eye, FileText, Trash2, Upload, UsersRound, X} from 'lucide-react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import type {ApiResponse, AssignmentDetail, AssignmentLearningType, AssignmentSubmissionType, CreateAssignmentPayload, PatchAssignmentPayload} from '@/apis';
import {ASSIGNMENT_LEARNING_TYPES, unwrapData} from '@/apis';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {courseApiService} from '@/apis/services/course-api';
import {EnglishDateTimeInput} from '@/components/EnglishDateInput';
import {RichTextEditor} from '@/components/RichTextEditor';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorCode, isConflict} from '@/utils/apiError';
import {normalizeCourseLocalDateTime, toCourseLocalDateTimeInput} from '@/utils/courseLocalDateTime';
import {isPreviewableFile, openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';
import {FileTypeMultiSelect} from './FileTypeMultiSelect';
import styles from './index.module.scss';

const parseId = (value?: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const formatFileSize = (sizeBytes: number) => {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
};

interface AssignmentEditorFormProps {
  courseId: number;
  assignment?: AssignmentDetail;
}

type EditorPayload = Omit<CreateAssignmentPayload, 'weekId' | 'learningType'> & Partial<Pick<CreateAssignmentPayload, 'weekId' | 'learningType'>>;
const LEARNING_LABELS: Record<AssignmentLearningType, string> = {PRE_CLASS: 'Pre-class', HOMEWORK: 'Homework', PRACTICE: 'Practice'};

export const AssignmentEditorForm = ({courseId, assignment}: AssignmentEditorFormProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(assignment?.title ?? '');
  const [weekId, setWeekId] = useState(assignment?.weekId == null ? '' : String(assignment.weekId));
  const [learningType, setLearningType] = useState<AssignmentLearningType | ''>(assignment?.learningType ?? '');
  const [description, setDescription] = useState(assignment?.description ?? '');
  const [dueAt, setDueAt] = useState(toCourseLocalDateTimeInput(assignment?.dueAtLocal));
  const [lateUntil, setLateUntil] = useState(toCourseLocalDateTimeInput(assignment?.lateUntilLocal));
  const [pointsPossible, setPointsPossible] = useState(
    assignment?.pointsPossible === undefined ? '100' : String(assignment.pointsPossible)
  );
  const [submissionType, setSubmissionType] = useState<AssignmentSubmissionType>(
    assignment?.submissionType ?? 'Individual'
  );
  const [groupSetId, setGroupSetId] = useState(
    assignment?.groupSetId === undefined ? '' : String(assignment.groupSetId)
  );
  const [allowedFileTypes, setAllowedFileTypes] = useState<string[]>(
    assignment?.allowedFileTypes ?? ['pdf', 'docx']
  );
  const [maxFileCount, setMaxFileCount] = useState(String(assignment?.maxFileCount ?? 3));
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(
    String(Math.round((assignment?.maxFileSizeBytes ?? 10 * 1024 * 1024) / 1024 / 1024))
  );
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  // A successful record write becomes a checkpoint immediately. If a later
  // attachment upload or publish call fails, retrying patches this same record
  // instead of creating a second assignment.
  const [checkpointAssignment, setCheckpointAssignment] = useState<AssignmentDetail | null>(assignment ?? null);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<number | null>(null);
  const [previewingAttachmentId, setPreviewingAttachmentId] = useState<number | null>(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<number | null>(null);
  const savingRef = useRef(false);
  const idempotency = useIdempotencyCheckpoint();

  const weeksQuery = useQuery({queryKey: ['course-weeks', courseId], queryFn: async () => unwrapData(await courseApiService.getCourseWeeks(courseId), 'assignmentLectures')});

  const groupSetsQuery = useQuery({
    queryKey: ['course-group-sets', courseId],
    enabled: submissionType === 'Group',
    queryFn: async () => unwrapData(
      await courseApiService.listGroupSets(courseId),
      'listGroupSets',
    ),
  });

  const groupSets = groupSetsQuery.data ?? [];
  const hasCurrentGroupSet = groupSetId !== '' && groupSets.some(groupSet => String(groupSet.id) === groupSetId);

  const hasRecoveredDraft = !assignment && checkpointAssignment !== null;
  const exitPath = checkpointAssignment
    ? `/course/${courseId}/assignments/${checkpointAssignment.id}`
    : `/course/${courseId}`;

  const removePendingFile = (index: number) => {
    setPendingFiles(files => files.filter((_, fileIndex) => fileIndex !== index));
  };

  const downloadExistingAttachment = async (attachmentId: number, filename: string) => {
    const savedAssignment = checkpointAssignment;
    if (!savedAssignment) return;
    setDownloadingAttachmentId(attachmentId);
    setAttachmentError(null);
    try {
      const blob = await assignmentApiService.downloadAttachment(courseId, savedAssignment.id, attachmentId);
      saveBlob(blob, filename);
    } catch {
      setAttachmentError(`Could not download ${filename}.`);
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const previewExistingAttachment = async (attachmentId: number, filename: string) => {
    const savedAssignment = checkpointAssignment;
    if (!savedAssignment) return;
    const previewWindow = openPreviewWindow();
    if (!previewWindow) {
      setAttachmentError('Allow pop-ups to preview this file.');
      return;
    }
    setPreviewingAttachmentId(attachmentId);
    setAttachmentError(null);
    try {
      showBlobInPreviewWindow(
        previewWindow,
        await assignmentApiService.previewAttachment(courseId, savedAssignment.id, attachmentId),
      );
    } catch {
      previewWindow.close();
      setAttachmentError(`Could not preview ${filename}.`);
    } finally {
      setPreviewingAttachmentId(null);
    }
  };

  const onChooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setPendingFiles(current => [...current, ...files]);
    event.target.value = '';
  };

  const deleteExistingAttachment = async (attachmentId: number, filename: string) => {
    const savedAssignment = checkpointAssignment;
    if (!savedAssignment || !window.confirm(`Delete ${filename} from this assignment?`)) return;
    setDeletingAttachmentId(attachmentId);
    setAttachmentError(null);
    const operation = `assignment-attachment-delete-${courseId}-${savedAssignment.id}-${attachmentId}`;
    const idempotencyKey = idempotency.keyFor(operation, operation);
    try {
      await assignmentApiService.deleteAttachment(courseId, savedAssignment.id, attachmentId, idempotencyKey);
      idempotency.complete(operation, idempotencyKey);
      setCheckpointAssignment(current => current ? {
        ...current,
        attachments: current.attachments.filter(file => file.id !== attachmentId),
      } : current);
      await queryClient.invalidateQueries({queryKey: ['assignment', courseId, savedAssignment.id]});
    } catch {
      setAttachmentError(`Could not delete ${filename}.`);
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const buildPayload = (publish: boolean): EditorPayload | null => {
    const cleanTitle = title.trim();
    const normalizedDueAt = normalizeCourseLocalDateTime(dueAt);
    const normalizedLateUntil = lateUntil ? normalizeCourseLocalDateTime(lateUntil) : undefined;
    if (!cleanTitle || !normalizedDueAt) {
      setError('Assignment name and due time are required.');
      return null;
    }
    if ((!checkpointAssignment || publish) && (!weekId || !learningType)) {
      setError('Select a lecture and learning category for this assignment.');
      return null;
    }
    if (weekId && Number(weekId) !== checkpointAssignment?.weekId && !weeksQuery.data?.some(week => week.id === Number(weekId))) {
      setError('Select a lecture from this course.');
      return null;
    }
    if (lateUntil && !normalizedLateUntil) {
      setError('The late-work deadline must be a valid course-local time.');
      return null;
    }

    const points = Number(pointsPossible);
    const fileCount = Number(maxFileCount);
    const sizeMb = Number(maxFileSizeMb);
    const parsedGroupSetId = Number(groupSetId);

    if (!Number.isFinite(points) || points < 0 || !Number.isInteger(fileCount) || fileCount < 1 || !Number.isFinite(sizeMb) || sizeMb <= 0) {
      setError('Points and file limits must be valid positive numbers.');
      return null;
    }

    if (allowedFileTypes.length === 0) {
      setError('Select at least one allowed file type.');
      return null;
    }

    if (submissionType === 'Group' && (!Number.isInteger(parsedGroupSetId) || parsedGroupSetId <= 0)) {
      setError('Select a group set for group assignments.');
      return null;
    }

    return {
      ...(weekId ? {weekId: Number(weekId)} : {}),
      ...(learningType ? {learningType} : {}),
      title: cleanTitle,
      description: description.trim(),
      pointsPossible: points,
      dueAt: normalizedDueAt,
      ...(normalizedLateUntil ? {lateUntil: normalizedLateUntil} : {}),
      allowedFileTypes,
      maxFileCount: fileCount,
      maxFileSizeBytes: Math.round(sizeMb * 1024 * 1024),
      submissionType,
      ...(submissionType === 'Group' ? {groupSetId: parsedGroupSetId} : {}),
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
    let stage: 'record' | 'attachments' | 'publish' = 'record';

    try {
      let confirmShortenDueDate = false;
      if (saved) {
        const nextDueAt = payload.dueAt;
        const nextLateUntil = payload.lateUntil;
        const dueChanged = toCourseLocalDateTimeInput(saved.dueAtLocal) !== dueAt;
        const lateChanged = toCourseLocalDateTimeInput(saved.lateUntilLocal) !== lateUntil;
        if (dueChanged || lateChanged) {
          // Moving a deadline earlier can retroactively change submission state;
          // preview the impact before sending the confirmed versioned update.
          const preview = unwrapData(await assignmentApiService.previewDueDateChange(courseId, saved.id, {
            dueAt: nextDueAt,
            ...(nextLateUntil ? {lateUntil: nextLateUntil} : {}),
            ...(!nextLateUntil && saved.lateUntilLocal ? {clearLateUntil: true} : {}),
          }), 'previewDueDateChange');
          if (preview.confirmationRequired) {
            const deadlineTimezone = preview.timezone || saved.timezone;
            const accepted = window.confirm(
              `This earlier deadline affects ${preview.activeStudentCount} active students. ` +
              `${preview.submittedCount} have submitted and ${preview.submissionsBecomingLateCount} submission(s) would become late` +
              `${deadlineTimezone ? ` in ${deadlineTimezone}` : ''}. Continue?`
            );
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
        if (typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion)) {
          setError('Reload the assignment before saving changes.');
          return;
        }
        const recordRequest: PatchAssignmentPayload = {
          // Locked structure is omitted from unrelated edits; sending an unchanged
          // submission type can otherwise make a valid title/deadline edit fail.
          ...Object.fromEntries(Object.entries(payload).filter(([key, value]) => {
            const previous = key === 'dueAt' ? normalizeCourseLocalDateTime(saved!.dueAtLocal) : key === 'lateUntil' ? normalizeCourseLocalDateTime(saved!.lateUntilLocal) : saved![key as keyof AssignmentDetail];
            return JSON.stringify(value) !== JSON.stringify(previous);
          })),
          expectedVersion,
          ...(checkpointAssignment?.lateUntilLocal && !lateUntil ? {clearLateUntil: true} : {}),
          ...(confirmShortenDueDate ? {confirmShortenDueDate: true} : {}),
        };
        recordOperation = `assignment-update-${courseId}-${saved.id}`;
        recordKey = idempotency.keyFor(recordOperation, idempotencyFingerprint(recordRequest));
        response = await assignmentApiService.patchAssignment(courseId, saved.id, recordRequest, recordKey);
      } else {
        if (payload.weekId == null || !payload.learningType) throw new Error('Select a lecture and learning category.');
        recordOperation = `assignment-create-${courseId}`;
        recordKey = idempotency.keyFor(recordOperation, idempotencyFingerprint(payload));
        response = await assignmentApiService.createAssignment(courseId, {...payload, weekId: payload.weekId, learningType: payload.learningType}, recordKey);
      }
      saved = unwrapData(response, checkpointAssignment ? 'patchAssignment' : 'createAssignment');
      idempotency.complete(recordOperation, recordKey);
      setCheckpointAssignment(saved);

      if (pendingFiles.length > 0) {
        stage = 'attachments';
        const attachmentOperation = `assignment-attachments-upload-${courseId}-${saved.id}`;
        const attachmentKey = idempotency.keyFor(
          attachmentOperation,
          idempotencyFingerprint({assignmentId: saved.id, files: pendingFiles}),
        );
        const uploaded = unwrapData(
          await assignmentApiService.uploadAttachments(courseId, saved.id, pendingFiles, attachmentKey),
          'uploadAttachments'
        );
        idempotency.complete(attachmentOperation, attachmentKey);
        saved = {...saved, attachments: [...(saved.attachments ?? []), ...uploaded]};
        setCheckpointAssignment(saved);
        // If publishing fails next, a retry must not upload the same successful
        // batch again.
        setPendingFiles([]);
      }

      if (publish && saved.state !== 'Published') {
        stage = 'publish';
        const publishOperation = `assignment-publish-${courseId}-${saved.id}`;
        const publishKey = idempotency.keyFor(publishOperation, publishOperation);
        saved = unwrapData(
          await assignmentApiService.publishAssignment(courseId, saved.id, publishKey),
          'publishAssignment'
        );
        idempotency.complete(publishOperation, publishKey);
        setCheckpointAssignment(saved);
      }

      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['course-assignments', courseId]}),
        queryClient.invalidateQueries({queryKey: ['assignment', courseId, saved.id]}),
      ]);
      navigate(`/course/${courseId}/assignments/${saved.id}`);
    } catch (err) {
      const isVersionConflict = isConflict(err) || getApiErrorCode(err) === 'ASSIGNMENT_VERSION_CONFLICT';
      if (isVersionConflict && saved) {
        try {
          const fresh = unwrapData(await assignmentApiService.getAssignment(courseId, saved.id), 'getAssignment');
          setCheckpointAssignment(fresh);
        } catch {
          // ignore
        }
        setError('This assignment was modified by another user. The latest version has been loaded. Please review your changes and try saving again.');
      } else if (stage === 'attachments' && saved) {
        setError(`Assignment #${saved.id} is saved, but its attachments could not be uploaded. Retry will continue this same assignment.`);
      } else if (stage === 'publish' && saved) {
        setError(`Assignment #${saved.id} and its attachments are saved, but publishing failed. Retry will publish this same assignment.`);
      } else {
        setError(
          checkpointAssignment
            ? 'The saved assignment could not be updated. Your form values are still here.'
            : 'The assignment could not be created. Your form values are still here.'
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
      <form className={styles.editor} onSubmit={submitDraft}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{assignment ? 'Edit assignment' : hasRecoveredDraft ? 'Resume saved draft' : 'New assignment'}</p>
            <h1>{assignment ? 'Edit Homework/Problem Set' : hasRecoveredDraft ? 'Finish Homework/Problem Set' : 'Create Homework/Problem Set'}</h1>
          </div>
          <Link
            to={exitPath}
            className={styles.closeButton}
            aria-label="Close assignment editor"
          >
            <X size={22}/>
          </Link>
        </header>

        {hasRecoveredDraft ? (
          <div className={styles.recoveryNotice} role="status">
            <CheckCircle2 size={20} aria-hidden="true"/>
            <div>
              <strong>Draft #{checkpointAssignment.id} is already saved.</strong>
              <span>Attachment or publish retries will continue this draft instead of creating a duplicate.</span>
            </div>
            <Link to={exitPath}>Open draft</Link>
          </div>
        ) : null}

        <div className={styles.fieldGrid}>
          <label className={`${styles.field} ${styles.titleField}`}>
            <span>Assignment name</span>
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Enter an assignment name"
              maxLength={180}
              autoFocus
            />
          </label>

          <label className={styles.field}>
            <span>Lecture</span>
            <select value={weekId} onChange={event => setWeekId(event.target.value)} disabled={isSaving || weeksQuery.isPending} required={!checkpointAssignment}>
              <option value="">Select a lecture</option>
              {weekId && !weeksQuery.data?.some(week => String(week.id) === weekId) ? <option value={weekId}>Current lecture</option> : null}
              {(weeksQuery.data ?? []).map(week => <option key={week.id} value={week.id}>{week.title}</option>)}
            </select>
            {weeksQuery.isError ? <span role="alert">Lectures could not be loaded. <button type="button" onClick={() => void weeksQuery.refetch()}>Retry</button></span> : null}
            {!weeksQuery.isPending && !weeksQuery.isError && !weeksQuery.data?.length ? <small>Add a lecture in the course workspace first.</small> : null}
          </label>
          <label className={styles.field}>
            <span>Learning category</span>
            <select value={learningType} onChange={event => setLearningType(event.target.value as AssignmentLearningType | '')} disabled={isSaving} required={!checkpointAssignment}>
              <option value="">Select a category</option>
              {ASSIGNMENT_LEARNING_TYPES.map(value => <option key={value} value={value}>{LEARNING_LABELS[value]}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            <span><CalendarClock size={16}/> Due time</span>
            <EnglishDateTimeInput value={dueAt} onChangeValue={setDueAt}/>
          </label>

          <label className={styles.field}>
            <span><CalendarClock size={16}/> Accept late work until</span>
            <EnglishDateTimeInput value={lateUntil} onChangeValue={setLateUntil}/>
          </label>

          <label className={styles.field}>
            <span><FileText size={16}/> Submission type</span>
            <select
              value={submissionType}
              disabled={isSaving || assignment?.canEditStructure === false}
              onChange={event => setSubmissionType(event.target.value as AssignmentSubmissionType)}
            >
              <option value="Individual">Individual</option>
              <option value="Group">Group</option>
            </select>
          </label>

          {submissionType === 'Group' ? (
            <div className={styles.field}>
              <span><UsersRound size={16}/> Group set</span>
              <select
                aria-label="Group set"
                value={groupSetId}
                onChange={event => setGroupSetId(event.target.value)}
                disabled={isSaving || groupSetsQuery.isPending || assignment?.canEditStructure === false}
              >
                <option value="">
                  {groupSetsQuery.isPending
                    ? 'Loading group sets…'
                    : groupSets.length === 0
                      ? 'No group sets available'
                      : 'Select a group set'}
                </option>
                {!hasCurrentGroupSet && groupSetId ? <option value={groupSetId}>Current group set #{groupSetId}</option> : null}
                {groupSets.map(groupSet => (
                  <option key={groupSet.id} value={groupSet.id}>
                    {groupSet.name} ({groupSet.groups.length} {groupSet.groups.length === 1 ? 'group' : 'groups'})
                  </option>
                ))}
              </select>
              <span className={styles.fieldHelp}>
                {groupSetsQuery.isError ? 'Group sets could not be loaded. ' : 'Students submit once with the group they belong to. '}
                {groupSetsQuery.isError ? <button type="button" onClick={() => void groupSetsQuery.refetch()}>Try again</button> : null}
                <Link to={`/course/${courseId}/groups`}>Manage group sets</Link>
              </span>
            </div>
          ) : null}

          <label className={styles.field}>
            <span>Points possible</span>
            <input type="number" min="0" step="0.01" value={pointsPossible} onChange={event => setPointsPossible(event.target.value)}/>
          </label>

          <div className={`${styles.field} ${styles.fullWidth}`}>
            <span id="assignment-instructions-label">Instructions</span>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder="Write instructions for students…"
              ariaLabel="Assignment instructions"
            />
          </div>

          <FileTypeMultiSelect value={allowedFileTypes} onChange={setAllowedFileTypes}/>

          <label className={styles.field}>
            <span>Maximum files</span>
            <input type="number" min="1" value={maxFileCount} onChange={event => setMaxFileCount(event.target.value)}/>
          </label>

          <label className={styles.field}>
            <span>Maximum size per file (MB)</span>
            <input type="number" min="1" step="1" value={maxFileSizeMb} onChange={event => setMaxFileSizeMb(event.target.value)}/>
          </label>
        </div>

        <label className={styles.uploadArea}>
          <Upload size={30} aria-hidden="true"/>
          <span>Drag and drop files here or <strong>Choose files</strong> to upload</span>
          <small>Attachments are uploaded after the assignment record is saved.</small>
          <input type="file" multiple onChange={onChooseFiles}/>
        </label>

        {checkpointAssignment?.attachments.length ? (
          <section className={styles.existingAttachments} aria-labelledby="current-attachments-title">
            <p id="current-attachments-title">Current attachments</p>
            <ul>
              {checkpointAssignment.attachments.map(file => (
                <li key={file.id}>
                  <FileText size={18} aria-hidden="true"/>
                  <button
                    type="button"
                    title={file.originalName}
                    onClick={() => void downloadExistingAttachment(file.id, file.originalName)}
                    disabled={downloadingAttachmentId !== null}
                  >
                    {downloadingAttachmentId === file.id ? 'Downloading…' : file.originalName}
                  </button>
                  <span>{formatFileSize(file.sizeBytes)}</span>
                  {(file.previewAvailable ?? isPreviewableFile(file.originalName, file.contentType)) ? (
                    <button
                      type="button"
                      aria-label={`Preview ${file.originalName}`}
                      onClick={() => void previewExistingAttachment(file.id, file.originalName)}
                      disabled={previewingAttachmentId !== null || downloadingAttachmentId !== null}
                    >
                      <Eye size={16}/>{previewingAttachmentId === file.id ? 'Opening…' : 'Preview'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.deleteAttachmentButton}
                    aria-label={`Delete ${file.originalName}`}
                    onClick={() => void deleteExistingAttachment(file.id, file.originalName)}
                    disabled={deletingAttachmentId !== null}
                  >
                    <Trash2 size={16}/>{deletingAttachmentId === file.id ? 'Deleting…' : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {attachmentError ? <p className={styles.error} role="alert">{attachmentError}</p> : null}

        {pendingFiles.length > 0 ? (
          <ul className={styles.pendingFiles} aria-label="Files ready to upload">
            {pendingFiles.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}-${index}`}>
                <span>{file.name}</span>
                <button type="button" onClick={() => removePendingFile(index)} aria-label={`Remove ${file.name}`}>
                  <X size={16}/>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? <p className={styles.error} role="alert">{error}</p> : null}

        <footer className={styles.actions}>
          <Link
            to={exitPath}
            className={styles.secondaryButton}
          >
            Cancel
          </Link>
          <button type="submit" className={styles.secondaryButton} disabled={isSaving}>
            {assignment || hasRecoveredDraft ? 'Save changes' : 'Save draft'}
          </button>
          <button type="button" className={styles.primaryButton} disabled={isSaving} onClick={() => void persist(true)}>
            {isSaving ? 'Saving…' : checkpointAssignment?.state === 'Published' ? 'Save & keep published' : 'Publish'}
          </button>
        </footer>
      </form>

      <Link to={`/course/${courseId}`} className={styles.backLink}>
        <ArrowLeft size={18}/> Back to course
      </Link>
    </div>
  );
};

const AssignmentEditorPage = () => {
  const {courseId: courseParam, assignmentId: assignmentParam} = useParams();
  const courseId = parseId(courseParam);
  const assignmentId = assignmentParam ? parseId(assignmentParam) : null;
  const isEditing = Boolean(assignmentParam);
  const access = useCourseAccess(courseId);

  const assignmentQuery = useQuery({
    queryKey: ['assignment', courseId, assignmentId],
    enabled: courseId !== null
      && assignmentId !== null
      && access.isResolved
      && access.canConfigureAssignments,
    queryFn: async () => unwrapData(
      await assignmentApiService.getAssignment(courseId!, assignmentId!),
      'getAssignment'
    ),
  });

  if (courseId === null || (isEditing && assignmentId === null)) {
    return <div className={styles.status} role="alert">This assignment editor link is invalid.</div>;
  }

  if (access.isLoading) {
    return <div className={styles.status}>Checking course permissions…</div>;
  }

  if (access.isError) {
    return (
      <div className={styles.status} role="alert">
        <p>Course permissions couldn&apos;t be loaded.</p>
        <button type="button" className={styles.primaryButton} onClick={access.refetch}>Try again</button>
      </div>
    );
  }

  if (!access.canConfigureAssignments) {
    return <div className={styles.status} role="alert">Only the course Instructor can create or edit assignments.</div>;
  }

  if (isEditing && assignmentQuery.isLoading) {
    return <div className={styles.status}>Loading assignment editor…</div>;
  }

  if (isEditing && (assignmentQuery.isError || !assignmentQuery.data)) {
    return <div className={styles.status} role="alert">This assignment couldn&apos;t be opened for editing.</div>;
  }

  return (
    <AssignmentEditorForm
      key={assignmentQuery.data?.id ?? 'new'}
      courseId={courseId}
      assignment={assignmentQuery.data}
    />
  );
};

export default AssignmentEditorPage;
