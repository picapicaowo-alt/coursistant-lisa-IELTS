import {useTranslation} from 'react-i18next';
import {useRef, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
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
} from 'lucide-react';
import {assignmentApiService} from '@/apis/services/assignment-api';
import type {AssignmentAttachment} from '@/apis';
import {unwrapData} from '@/apis';
import {useAuth} from '@/contexts/AuthContext';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {RichTextEditor} from '@/components/RichTextEditor';
import {formatDeadline} from '@/utils/datetime';
import {isPreviewableFile, openPreviewWindow, saveBlob, showBlobInPreviewWindow} from '@/utils/downloadBlob';
import {SubmitAssignmentDialog} from './SubmitAssignmentDialog';
import {StudentSubmissionHistory} from './StudentSubmissionHistory';
import {uploadRubricWithReplaceConfirmation} from './rubricUpload';
import {loadRubricState} from './rubricState';
import {isStudentAccount} from '@/utils/roleCapabilities';
import {
  buildEmptySubmissionState,
  formatSubmissionStatus,
  isNoFormalSubmissionError,
} from './submissionState';
import styles from './index.module.scss';

const parseId = (value?: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const InstructorAttachmentRow = ({courseId, assignmentId, attachment}: {
  courseId: number;
  assignmentId: number;
  attachment: AssignmentAttachment;
}) => {
  const [activeAction, setActiveAction] = useState<'preview' | 'download' | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const previewable = attachment.previewAvailable
    ?? isPreviewableFile(attachment.originalName, attachment.contentType);

  const download = async () => {
    setActiveAction('download');
    setFileError(null);
    try {
      const blob = await assignmentApiService.downloadAttachment(courseId, assignmentId, attachment.id);
      saveBlob(blob, attachment.originalName);
    } catch {
      setFileError(`Could not download ${attachment.originalName}.`);
    } finally {
      setActiveAction(null);
    }
  };

  const preview = async () => {
    const previewWindow = openPreviewWindow();
    if (!previewWindow) {
      setFileError('Allow pop-ups to preview this file.');
      return;
    }

    setActiveAction('preview');
    setFileError(null);
    try {
      const blob = await assignmentApiService.previewAttachment(courseId, assignmentId, attachment.id);
      showBlobInPreviewWindow(previewWindow, blob);
    } catch {
      previewWindow.close();
      setFileError(`Could not preview ${attachment.originalName}.`);
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <li className={styles.attachmentRow}>
      <FileText size={22} aria-hidden="true"/>
      <button
        type="button"
        className={styles.attachmentName}
        title={`Download ${attachment.originalName}`}
        aria-label={`Download ${attachment.originalName}`}
        onClick={() => void download()}
        disabled={activeAction !== null}
      >
        {attachment.originalName}
      </button>
      <div className={styles.attachmentActions}>
        {previewable ? (
          <button type="button" onClick={() => void preview()} disabled={activeAction !== null}>
            <Eye size={15}/>{activeAction === 'preview' ? 'Opening…' : 'Preview'}
          </button>
        ) : null}
        <button type="button" onClick={() => void download()} disabled={activeAction !== null}>
          <Download size={15}/>{activeAction === 'download' ? 'Downloading…' : 'Download'}
        </button>
      </div>
      {fileError ? <p className={styles.attachmentError} role="alert">{fileError}</p> : null}
    </li>
  );
};

export const RubricEmptyState = ({canConfigureAssignments}: {
  canConfigureAssignments: boolean;
}) => canConfigureAssignments
  ? <p className={styles.secondaryText}>Upload a PDF rubric to keep grading criteria with this assignment.</p>
  : null;

const formatGradeNumber = (value: number) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
}).format(value);

const feedbackToPlainText = (feedback?: string) => {
  const trimmed = feedback?.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('<')) return trimmed;

  if (typeof DOMParser === 'undefined') {
    return trimmed.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || null;
  }

  const document = new DOMParser().parseFromString(trimmed, 'text/html');
  document.body.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
  document.body.querySelectorAll('p, div, li, blockquote').forEach(node => node.append('\n'));
  return document.body.textContent?.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() || null;
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
  const feedbackText = feedbackToPlainText(feedback);
  const numericScore = Number.isFinite(score) && Number.isFinite(pointsPossible)
    ? `${formatGradeNumber(score!)} / ${formatGradeNumber(pointsPossible!)}`
    : null;
  const releasedScore = numericScore
    ?? (gradeDisplay && gradeDisplay !== 'NotGradedYet' ? gradeDisplay : 'Grade released');

  return (
    <section className={styles.summaryCard} aria-labelledby="student-grade-title">
      <div className={styles.gradeSummaryHeader}>
        <h2 id="student-grade-title">Grade</h2>
        <span className={styles.gradeStatus} data-status={gradeReleased ? 'released' : 'pending'}>
          {gradeReleased ? 'Released' : 'Pending'}
        </span>
      </div>

      {gradeReleased ? (
        <>
          <div className={styles.summaryRow}>
            <CheckCircle2 size={20} aria-hidden="true"/>
            <div>
              <span>Score</span>
              <strong className={styles.gradeScoreValue} aria-label={`Score ${releasedScore}`}>
                {releasedScore}
              </strong>
            </div>
          </div>
          <div className={styles.gradeSummaryFeedback}>
            <div className={styles.gradeFeedbackTitle}>
              <MessageSquareText size={18} aria-hidden="true"/>
              <span>Instructor feedback</span>
            </div>
            <p>{feedbackText ?? 'No feedback was provided.'}</p>
          </div>
        </>
      ) : (
        <>
          <div className={styles.summaryRow}>
            <Clock3 size={20} aria-hidden="true"/>
            <div>
              <span>Status</span>
              <strong>Grade pending release</strong>
            </div>
          </div>
          <p className={styles.gradeSummaryHint}>
            Your score and feedback will appear here after your instructor releases the grade.
          </p>
        </>
      )}
    </section>
  );
};

const AssignmentDetailPage = () => {
  const {t: translate} = useTranslation();
  const {courseId: courseIdParam, assignmentId: assignmentIdParam} = useParams();
  const {user} = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const rubricInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [staffMessage, setStaffMessage] = useState<string | null>(null);
  const courseId = parseId(courseIdParam);
  const assignmentId = parseId(assignmentIdParam);
  const access = useCourseAccess(courseId);

  const assignmentQuery = useQuery({
    queryKey: ['assignment', courseId, assignmentId],
    enabled: courseId !== null && assignmentId !== null,
    queryFn: async () => unwrapData(
      await assignmentApiService.getAssignment(courseId!, assignmentId!),
      'getAssignment'
    ),
  });

  const isStaff = assignmentQuery.data?.activeStudentCount !== undefined
    || assignmentQuery.data?.canEditStructure !== undefined;
  const isStudent = access.membership
    ? access.isStudent
    : assignmentQuery.data
      ? !isStaff
      : user ? isStudentAccount(user) : false;

  const submissionQuery = useQuery({
    queryKey: ['assignment-submission', courseId, assignmentId],
    enabled: assignmentQuery.isSuccess && isStudent && courseId !== null && assignmentId !== null,
    queryFn: async () => {
      try {
        return unwrapData(
          await assignmentApiService.getMySubmission(courseId!, assignmentId!),
          'getMySubmission'
        );
      } catch (error) {
        const assignment = assignmentQuery.data;
        if (!isNoFormalSubmissionError(error) || !assignment || !user) throw error;

        // 8081 models “never submitted” as a 404. Preserve any staged files,
        // then turn it into the empty state the student screen expects.
        const stagingFiles = assignment.stagedFileCount
          ? unwrapData(
            await assignmentApiService.listStagingFiles(courseId!, assignmentId!),
            'listStagingFiles'
          )
          : [];

        return buildEmptySubmissionState(assignment, user.id, stagingFiles);
      }
    },
  });

  const submissionId = submissionQuery.data?.submissionId;
  const versionsQuery = useQuery({
    queryKey: ['assignment-submission-versions', courseId, assignmentId, submissionId],
    enabled: submissionId !== undefined && courseId !== null && assignmentId !== null,
    queryFn: async () => unwrapData(
      await assignmentApiService.listSubmissionVersions(courseId!, assignmentId!, submissionId!),
      'listSubmissionVersions',
    ),
  });

  const rubricQuery = useQuery({
    queryKey: ['assignment-rubric', courseId, assignmentId],
    enabled: assignmentQuery.isSuccess && courseId !== null && assignmentId !== null,
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
      setStaffMessage('Assignment unpublished.');
    },
    onError: () => setStaffMessage('The assignment could not be unpublished.'),
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
      await queryClient.invalidateQueries({queryKey: ['course-assignments', courseId]});
      navigate(`/course/${courseId}`, {replace: true});
    },
    onError: () => setStaffMessage('The assignment could not be deleted. It may already have submissions or grades.'),
  });

  const uploadRubric = useMutation({
    mutationFn: (file: File) => uploadRubricWithReplaceConfirmation(
      courseId!, assignmentId!, file,
      Boolean(rubricQuery.data?.gradedAgainstPreviousRubricCount),
    ),
    onSuccess: async () => { await rubricQuery.refetch(); setStaffMessage('Rubric uploaded.'); },
    onError: () => setStaffMessage('The rubric could not be uploaded.'),
  });

  const restoreRubric = useMutation({
    mutationFn: () => assignmentApiService.restorePreviousRubric(
      courseId!, assignmentId!, Boolean(rubricQuery.data?.gradedAgainstPreviousRubricCount),
    ),
    onSuccess: async () => { await rubricQuery.refetch(); setStaffMessage('Previous rubric restored.'); },
    onError: () => setStaffMessage('The previous rubric could not be restored.'),
  });

  const downloadRubric = async () => {
    if (!rubricQuery.data?.posted) return;
    setStaffMessage(null);
    try {
      saveBlob(await assignmentApiService.downloadRubric(courseId!, assignmentId!), rubricQuery.data.originalName || 'rubric.pdf');
    } catch {
      setStaffMessage('The rubric could not be downloaded.');
    }
  };

  const previewRubric = async () => {
    if (!rubricQuery.data?.posted) return;
    const previewWindow = openPreviewWindow();
    if (!previewWindow) {
      setStaffMessage('Allow pop-ups to preview the rubric.');
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
      setStaffMessage('The rubric could not be previewed.');
    }
  };

  if (courseId === null || assignmentId === null) {
    return <div className={styles.status} role="alert">This assignment link is invalid.</div>;
  }

  if (assignmentQuery.isLoading) {
    return <div className={styles.status}>Loading assignment…</div>;
  }

  if (assignmentQuery.isError || !assignmentQuery.data) {
    return (
      <div className={styles.status} role="alert">
        <p>This assignment couldn&apos;t be loaded.</p>
        <button type="button" className={styles.primaryButton} onClick={() => void assignmentQuery.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const assignment = assignmentQuery.data;
  const deadline = formatDeadline(assignment.dueAtLocal, assignment.timezone);
  const submissionVersions = versionsQuery.data
    ?? (submissionQuery.data?.currentVersion ? [submissionQuery.data.currentVersion] : []);
  const studentSubmissionStatus = submissionQuery.data?.submissionStatus ?? assignment.submissionStatus;
  const showStudentGrade = isStudent
    && (assignment.gradeReleased || studentSubmissionStatus?.startsWith('Submitted'));

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
            <span className={styles.stateBadge}>{assignment.state}</span>
            <span>{assignment.submissionType} assignment</span>
          </div>
          <h1>{assignment.title}</h1>
        </div>
        {access.canConfigureAssignments || access.canGrade ? (
          <div className={styles.headerActions}>
            {access.canConfigureAssignments ? (
              <Link to={`/course/${courseId}/assignments/${assignmentId}/edit`} className={styles.secondaryLink}>
                Edit
              </Link>
            ) : null}
            {access.canConfigureAssignments && assignment.state === 'Published' ? (
              <button type="button" className={styles.secondaryLink} onClick={() => {
                if (window.confirm('Unpublish this assignment? Students will no longer see it.')) unpublish.mutate();
              }} disabled={unpublish.isPending}>Unpublish</button>
            ) : null}
            {access.canGrade ? (
              <Link to={`/course/${courseId}/assignments/${assignmentId}/grading`} className={styles.primaryLink}>
                Grade submissions
              </Link>
            ) : null}
          </div>
        ) : null}
      </header>

      {staffMessage ? <p className={staffMessage.includes('could not') ? styles.errorBanner : styles.successBanner} role="status">{staffMessage}</p> : null}

      <div className={styles.layout}>
        <main className={styles.mainColumn}>
          {assignment.description || assignment.attachments?.length ? (
            <section className={styles.card}>
              <h2>Assignment details</h2>
              {assignment.description ? (
                <div className={styles.description}>
                  <RichTextEditor
                    content={assignment.description}
                    disabled
                    displayOnly
                    showToolbar={false}
                    ariaLabel="Assignment instructions"
                  />
                </div>
              ) : null}

              {assignment.attachments?.length > 0 ? (
                <div className={styles.attachments}>
                  <h3>Instructor files</h3>
                  <ul>
                    {assignment.attachments.map(attachment => (
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
              <div><h2>Rubric</h2><p className={styles.secondaryText}>{rubricQuery.data?.posted ? `Version ${rubricQuery.data.versionNo} · ${rubricQuery.data.totalVersions} total` : 'No rubric uploaded'}</p></div>
              {access.canConfigureAssignments ? <button type="button" className={styles.secondaryLink} onClick={() => rubricInputRef.current?.click()} disabled={uploadRubric.isPending}><Upload size={15}/>{uploadRubric.isPending ? 'Uploading…' : rubricQuery.data?.posted ? 'Replace PDF' : 'Upload PDF'}</button> : null}
            </div>
            {access.canConfigureAssignments ? <input ref={rubricInputRef} className={styles.hiddenInput} type="file" accept="application/pdf,.pdf" onChange={event => {
              const file = event.target.files?.[0];
              if (file && (!rubricQuery.data?.gradedAgainstPreviousRubricCount || window.confirm(`${rubricQuery.data.gradedAgainstPreviousRubricCount} grade(s) reference the current rubric. Replace it anyway?`))) uploadRubric.mutate(file);
              event.target.value = '';
            }}/> : null}
            {rubricQuery.isPending ? <p className={styles.secondaryText}>Loading rubric…</p> : rubricQuery.isError ? <p className={styles.errorBanner}>Rubric information could not be loaded.</p> : rubricQuery.data?.posted ? <div className={styles.rubricRow}><FileText size={20}/><button type="button" onClick={() => void previewRubric()}>{rubricQuery.data.originalName}</button><span>{rubricQuery.data.sizeBytes ? `${Math.max(1, Math.round(rubricQuery.data.sizeBytes / 1024))} KB` : ''}</span><button type="button" className={styles.secondaryLink} onClick={() => void previewRubric()}><Eye size={15}/>Preview</button><button type="button" className={styles.secondaryLink} onClick={() => void downloadRubric()}><Download size={15}/>Download</button>{access.canConfigureAssignments && rubricQuery.data.canRestorePrevious ? <button type="button" className={styles.secondaryLink} disabled={restoreRubric.isPending} onClick={() => {
              if (window.confirm('Restore the previous rubric version?')) restoreRubric.mutate();
            }}><RotateCcw size={15}/>Restore previous</button> : null}</div> : <RubricEmptyState canConfigureAssignments={access.canConfigureAssignments}/>}
          </section>

          {isStudent && (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Your submission</h2>
                  <p className={styles.secondaryText}>
                    {formatSubmissionStatus(submissionQuery.data?.submissionStatus)}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setSubmitDialogOpen(true)}
                  disabled={submissionQuery.isPending || !submissionQuery.data?.acceptingSubmissions}
                >
                  {submissionQuery.data?.totalVersions ? 'Submit new version' : 'Submit assignment'}
                </button>
              </div>

              {submissionQuery.isError && (
                <div className={styles.error} role="alert">
                  <span>Submission details couldn&apos;t be loaded.</span>{' '}
                  <button type="button" onClick={() => void submissionQuery.refetch()}>Try again</button>
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
                  <span>Previous submission files couldn&apos;t be loaded.</span>{' '}
                  <button type="button" onClick={() => void versionsQuery.refetch()}>Try again</button>
                </div>
              ) : null}
            </section>
          )}
        </main>

        <aside className={styles.sidebarColumn}>
          <section className={styles.summaryCard}>
            <h2>Summary</h2>
            <div className={styles.summaryRow}>
              <CalendarClock size={20}/>
              <div>
                <span>Due</span>
                <strong>{deadline}</strong>
              </div>
            </div>
            <div className={styles.summaryRow}>
              <UsersRound size={20}/>
              <div>
                <span>Submission type</span>
                <strong>{assignment.submissionType}</strong>
              </div>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.pointsIcon}>#</span>
              <div>
                <span>Points</span>
                <strong>{assignment.pointsPossible ?? 'Not set'}</strong>
              </div>
            </div>

            {!isStudent && (
              <div className={styles.staffMetrics}>
                <span>{assignment.submissionCount ?? 0} submitted</span>
                <span>{assignment.gradedCount ?? 0} graded</span>
                <span>{assignment.releasedCount ?? 0} released</span>
              </div>
            )}
            {access.canConfigureAssignments ? <div className={styles.dangerZone}><button type="button" className={styles.dangerButton} disabled={removeAssignment.isPending} onClick={() => {
              if (window.confirm(`Permanently delete “${assignment.title}”? This only succeeds when no protected submission or grade data depends on it.`)) removeAssignment.mutate();
            }}><Trash2 size={16}/>{removeAssignment.isPending ? 'Deleting…' : 'Delete assignment'}</button></div> : null}
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
            await Promise.all([assignmentQuery.refetch(), submissionQuery.refetch()]);
            await queryClient.invalidateQueries({
              queryKey: ['assignment-submission-versions', courseId, assignmentId],
            });
          }}
        />
      )}
    </div>
  );
};

export default AssignmentDetailPage;
