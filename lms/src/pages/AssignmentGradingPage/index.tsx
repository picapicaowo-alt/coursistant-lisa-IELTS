import {formatPersonName} from '@/utils/personName';
import {FormEvent, useEffect, useMemo, useRef, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, CheckCircle2, Download, FileText, MessageSquare, RotateCcw, Search, Trash2, Upload, X} from 'lucide-react';
import {Link, useParams} from 'react-router-dom';
import type {GradingRosterItem, UpsertGradePayload} from '@/apis';
import {unwrapData} from '@/apis';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {saveBlob} from '@/utils/downloadBlob';
import {formatUtcTimestamp} from '@/utils/datetime';
import {StudentSubmissionHistory} from '@/pages/AssignmentDetailPage/StudentSubmissionHistory';
import {RichTextEditor} from '@/components/RichTextEditor';
import {buildGradeSelection, rosterRowKey} from './gradeSelection';
import styles from './index.module.scss';

type RosterFilter = 'All' | 'Ungraded' | 'Graded';

const parseId = (value?: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getDisplayName = (row: GradingRosterItem) => row.groupName || formatPersonName({firstName: row.studentFirstName, middleName: row.studentMiddleName, lastName: row.studentLastName}, row.studentName || 'Unknown learner');
const getDisplayEmail = (row: GradingRosterItem) => row.groupId
  ? `${row.memberCount ?? 0} group member(s)`
  : row.studentEmail || 'No email available';

const getInitials = (value: string) => value
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0]?.toUpperCase())
  .join('') || '?';

const formatSubmissionTime = (value?: string) => {
  if (!value) return '—';
  return formatUtcTimestamp(value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
};

const getSubmissionLabel = (value: string) => {
  const labels: Record<string, string> = {
    NotSubmitted: 'Not submitted',
    NotSubmittedClosed: 'Not submitted · closed',
    Submitted: 'Submitted',
    SubmittedLate: 'Submitted late',
  };
  return labels[value] ?? value.replace(/([a-z])([A-Z])/g, '$1 $2');
};

interface GradeDialogProps {
  courseId: number;
  assignmentId: number;
  row: GradingRosterItem;
  pointsPossible?: number;
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: UpsertGradePayload, annotatedFileChange: AnnotatedFileChange) => void;
}

type AnnotatedFileChange =
  | {kind: 'keep'}
  | {kind: 'upload'; file: File};

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

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
  const [score, setScore] = useState(row.score === undefined ? '' : String(row.score));
  const [feedback, setFeedback] = useState('');
  const [annotatedFile, setAnnotatedFile] = useState<File | undefined>();
  const annotatedFileInputRef = useRef<HTMLInputElement>(null);
  const gradingViewQuery = useQuery({
    queryKey: ['assignment-grading-view', courseId, assignmentId, row.studentUserId, row.groupId],
    queryFn: async () => unwrapData(
      row.groupId !== undefined
        ? await assignmentApiService.getGroupGradingView(courseId, assignmentId, row.groupId)
        : await assignmentApiService.getStudentGradingView(courseId, assignmentId, row.studentUserId!),
      'getGradingView',
    ),
  });
  const submissionVersionsQuery = useQuery({
    queryKey: ['assignment-submission-versions', courseId, assignmentId, row.submissionId],
    enabled: row.submissionId !== undefined,
    queryFn: async () => unwrapData(
      await assignmentApiService.listSubmissionVersions(
        courseId, assignmentId, row.submissionId!,
      ),
      'listSubmissionVersionsForGrading',
    ),
  });

  useEffect(() => {
    const html = gradingViewQuery.data?.grade?.feedbackHtml;
    if (html) setFeedback(html);
    const nextScore = gradingViewQuery.data?.grade?.score;
    if (nextScore !== undefined) setScore(String(nextScore));
  }, [gradingViewQuery.data?.grade?.feedbackHtml, gradingViewQuery.data?.grade?.score]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsedScore = Number(score);
    if (!Number.isFinite(parsedScore)) return;
    const annotatedFileChange: AnnotatedFileChange = annotatedFile
      ? {kind: 'upload', file: annotatedFile}
      : {kind: 'keep'};
    onSave({
      score: parsedScore,
      feedbackHtml: feedback.trim() || undefined,
      submissionVersionId: row.submissionVersionId,
      rubricVersionId: gradingViewQuery.data?.grade?.rubricVersionId
        ?? gradingViewQuery.data?.rubric?.versionId,
      aiAssisted: false,
    }, annotatedFileChange);
  };

  const clearSelectedAnnotatedFile = () => {
    setAnnotatedFile(undefined);
    if (annotatedFileInputRef.current) annotatedFileInputRef.current.value = '';
  };

  const openAnnotatedFilePicker = () => {
    if (!annotatedFileInputRef.current) return;
    annotatedFileInputRef.current.value = '';
    annotatedFileInputRef.current.click();
  };

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !isSaving) onClose();
    }}>
      <form className={styles.gradeDialog} role="dialog" aria-modal="true" aria-labelledby="grade-dialog-title" onSubmit={submit}>
        <header>
          <div>
            <p>Grade submission</p>
            <h2 id="grade-dialog-title">{getDisplayName(row)}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} aria-label="Close grade editor">
            <X size={20}/>
          </button>
        </header>

        <section className={styles.submittedFiles} aria-labelledby="submitted-files-title">
          <div className={styles.submittedFilesHeader}>
            <div>
              <h3 id="submitted-files-title">Submitted files</h3>
              <p>Review the learner&apos;s files before entering a grade.</p>
            </div>
            {row.fileCount ? <span>{row.fileCount} file(s)</span> : null}
          </div>

          {row.submissionId === undefined ? (
            <p className={styles.noSubmittedFiles}>This learner has not submitted files.</p>
          ) : submissionVersionsQuery.isPending ? (
            <p className={styles.noSubmittedFiles}>Loading submitted files…</p>
          ) : submissionVersionsQuery.isError ? (
            <div className={styles.submissionFilesError} role="alert">
              <span>Submitted files couldn&apos;t be loaded.</span>
              <button type="button" onClick={() => void submissionVersionsQuery.refetch()}>Try again</button>
            </div>
          ) : submissionVersionsQuery.data.length > 0 ? (
            <StudentSubmissionHistory
              courseId={courseId}
              assignmentId={assignmentId}
              submissionId={row.submissionId}
              versions={submissionVersionsQuery.data}
            />
          ) : (
            <p className={styles.noSubmittedFiles}>No submitted versions were found.</p>
          )}
        </section>

        <label className={styles.scoreField}>
          <span>Score</span>
          <div>
            <input
              type="number"
              min="0"
              max={pointsPossible}
              step="0.01"
              value={score}
              onChange={event => setScore(event.target.value)}
              required
              autoFocus
            />
            <span>/ {pointsPossible ?? '—'}</span>
          </div>
        </label>

        <div className={styles.feedbackField}>
          <span>Feedback for the learner</span>
          {gradingViewQuery.isPending ? <p className={styles.dialogNote}>Loading existing feedback…</p> : null}
          {gradingViewQuery.isError ? (
            <div className={styles.submissionFilesError} role="alert">
              <span>Existing feedback couldn&apos;t be loaded.</span>
              <button type="button" onClick={() => void gradingViewQuery.refetch()}>Try again</button>
            </div>
          ) : null}
          <RichTextEditor
            content={feedback}
            onChange={setFeedback}
            outputFormat="html"
            showToolbar
            placeholder="Add clear, actionable feedback…"
            ariaLabel="Feedback for the learner"
          />
        </div>

        <div className={styles.annotatedField}>
          <div className={styles.annotatedFieldHeader}>
            <span><Upload size={17}/> Annotated feedback file</span>
            <small>Optional</small>
          </div>
          <input
            ref={annotatedFileInputRef}
            className={styles.srOnly}
            type="file"
            accept=".pdf,.docx,.png,.jpg,.jpeg,.gif,.webp"
            disabled={isSaving}
            aria-label="Choose annotated feedback file"
            onChange={event => {
              const nextFile = event.target.files?.[0];
              setAnnotatedFile(nextFile);
            }}
          />

          {annotatedFile ? (
            <div className={styles.annotatedFileCard}>
              <span className={styles.annotatedFileIcon}><FileText size={20}/></span>
              <span className={styles.annotatedFileDetails}>
                <strong title={annotatedFile.name}>{annotatedFile.name}</strong>
                <small>{formatFileSize(annotatedFile.size)} · Ready to upload</small>
              </span>
              <div className={styles.annotatedFileActions}>
                <button
                  type="button"
                  className={styles.replaceFileButton}
                  onClick={openAnnotatedFilePicker}
                  disabled={isSaving}
                >
                  Replace
                </button>
                <button
                  type="button"
                  className={styles.removeFileButton}
                  onClick={clearSelectedAnnotatedFile}
                  disabled={isSaving}
                  aria-label={`Remove selected file ${annotatedFile.name}`}
                >
                  <Trash2 size={16}/> Remove
                </button>
              </div>
            </div>
          ) : row.hasAnnotatedFile ? (
            <div className={styles.annotatedFileCard}>
              <span className={styles.annotatedFileIcon}><FileText size={20}/></span>
              <span className={styles.annotatedFileDetails}>
                <strong>Current annotated feedback file</strong>
                <small>Saved with this grade · replacement is supported</small>
              </span>
              <div className={styles.annotatedFileActions}>
                <button
                  type="button"
                  className={styles.replaceFileButton}
                  onClick={openAnnotatedFilePicker}
                  disabled={isSaving}
                >
                  Replace
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
              <Upload size={19}/>
              <span>
                <strong>Upload annotated file</strong>
                <small>Choose a marked-up file for the learner</small>
              </span>
            </button>
          )}
          <p className={styles.annotatedFileHint}>PDF, DOCX, or image · Maximum 100 MB</p>
        </div>

        <p className={styles.dialogNote}>
          Saving creates an Entered grade. The learner will not see it until grades are released.
        </p>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}

        <footer>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" className={styles.primaryButton} disabled={isSaving || score === ''}>
            {isSaving ? 'Saving…' : 'Save grade'}
          </button>
        </footer>
      </form>
    </div>
  );
};

const AssignmentGradingPage = () => {
  const {courseId: courseParam, assignmentId: assignmentParam, studentUserId, groupId} = useParams();
  const courseId = parseId(courseParam);
  const assignmentId = parseId(assignmentParam);
  const access = useCourseAccess(courseId);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RosterFilter>('All');
  const [selectedRow, setSelectedRow] = useState<GradingRosterItem | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isSaving, setSaving] = useState(false);
  const [isReleasing, setReleasing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const rosterQuery = useQuery({
    queryKey: ['assignment-grading-roster', courseId, assignmentId],
    enabled: courseId !== null && assignmentId !== null && access.isResolved && access.canGrade,
    queryFn: async () => unwrapData(
      await assignmentApiService.getGradingRoster(courseId!, assignmentId!),
      'getGradingRoster'
    ),
  });

  const openedTarget = useRef<string>();
  useEffect(() => {
    const target = `${courseId}/${assignmentId}/${studentUserId ?? ''}/${groupId ?? ''}`;
    if (openedTarget.current === target || !rosterQuery.data || (!studentUserId && !groupId)) return;
    openedTarget.current = target;
    const row = rosterQuery.data.items.find(item => groupId
      ? item.groupId === parseId(groupId)
      : item.groupId == null && item.studentUserId === parseId(studentUserId));
    if (row) setSelectedRow(row);
    else setActionError('This submission is not available in your grading roster.');
  }, [assignmentId, courseId, groupId, rosterQuery.data, studentUserId]);

  const rows = useMemo(() => {
    const roster = rosterQuery.data?.items ?? [];
    const needle = search.trim().toLowerCase();

    return roster.filter(row => {
      const graded = row.gradeStatus !== 'Ungraded';
      const matchesFilter = filter === 'All' || (filter === 'Graded' ? graded : !graded);
      const matchesSearch = !needle || [getDisplayName(row), row.studentEmail]
        .some(value => value?.toLowerCase().includes(needle));
      return matchesFilter && matchesSearch;
    });
  }, [filter, rosterQuery.data?.items, search]);

  const saveGrade = async (payload: UpsertGradePayload, annotatedFileChange: AnnotatedFileChange) => {
    if (!selectedRow || courseId === null || assignmentId === null) return;
    setSaving(true);
    setActionError(null);

    try {
      // Grade data and the optional annotated file are separate resources. Save
      // the grade first, keep the dialog draft on either failure, and refresh
      // the roster only after both operations complete.
      if (selectedRow.groupId !== undefined) {
        await assignmentApiService.upsertGroupGrade(courseId, assignmentId, selectedRow.groupId, payload);
        if (annotatedFileChange.kind === 'upload') {
          await assignmentApiService.uploadGroupAnnotatedFile(courseId, assignmentId, selectedRow.groupId, annotatedFileChange.file);
        }
      } else if (selectedRow.studentUserId !== undefined) {
        await assignmentApiService.upsertStudentGrade(courseId, assignmentId, selectedRow.studentUserId, payload);
        if (annotatedFileChange.kind === 'upload') {
          await assignmentApiService.uploadStudentAnnotatedFile(courseId, assignmentId, selectedRow.studentUserId, annotatedFileChange.file);
        }
      } else {
        throw new Error('Roster row has no grading target.');
      }

      await queryClient.invalidateQueries({queryKey: ['assignment-grading-roster', courseId, assignmentId]});
      setSelectedRow(null);
    } catch {
      setActionError('The grade or annotated file could not be saved. Your score and feedback are still here.');
    } finally {
      setSaving(false);
    }
  };

  const downloadAnnotated = async (row: GradingRosterItem) => {
    if (courseId === null || assignmentId === null) return;
    setActionError(null);
    try {
      const blob = row.groupId !== undefined
        ? await assignmentApiService.downloadGroupAnnotatedFile(courseId, assignmentId, row.groupId)
        : await assignmentApiService.downloadStudentAnnotatedFile(courseId, assignmentId, row.studentUserId!);
      saveBlob(blob, `${getDisplayName(row).replace(/[^a-z0-9_-]+/gi, '-')}-annotated-feedback`);
    } catch {
      setActionError('The annotated feedback file could not be downloaded.');
    }
  };

  const releaseAll = async () => {
    if (courseId === null || assignmentId === null) return;
    if (!window.confirm('Release every entered grade to learners now?')) return;

    setReleasing(true);
    setActionError(null);
    const operation = `assignment-release-all-${courseId}-${assignmentId}`;
    const fingerprint = idempotencyFingerprint({courseId, assignmentId, action: 'release-all'});
    try {
      await assignmentApiService.releaseAllGrades(
        courseId,
        assignmentId,
        idempotency.keyFor(operation, fingerprint),
      );
      idempotency.completeFingerprint(operation, fingerprint);
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['assignment-grading-roster', courseId, assignmentId]}),
        queryClient.invalidateQueries({queryKey: ['assignment', courseId, assignmentId]}),
      ]);
      setSelectedKeys(new Set());
    } catch {
      setActionError('Grades could not be released. No local status was changed.');
    } finally {
      setReleasing(false);
    }
  };

  const updateSelectedRelease = async (action: 'release' | 'retract') => {
    if (courseId === null || assignmentId === null || selectedKeys.size === 0) return;
    const selection = buildGradeSelection(rows, selectedKeys);
    const confirmMessage = action === 'release'
      ? `Release ${selectedKeys.size} selected grade(s) to learners now?`
      : `Retract ${selectedKeys.size} selected grade(s)? Learners will lose access until they are released again.`;
    if (!window.confirm(confirmMessage)) return;

    setReleasing(true);
    setActionError(null);
    const operation = `assignment-grades-${action}-${courseId}-${assignmentId}`;
    const fingerprint = idempotencyFingerprint({action, selection});
    try {
      if (action === 'release') {
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
        queryClient.invalidateQueries({queryKey: ['assignment-grading-roster', courseId, assignmentId]}),
        queryClient.invalidateQueries({queryKey: ['assignment', courseId, assignmentId]}),
      ]);
      setSelectedKeys(new Set());
    } catch {
      setActionError(action === 'release'
        ? 'Selected grades could not be released. No local status was changed.'
        : 'Selected grades could not be retracted. No local status was changed.');
    } finally {
      setReleasing(false);
    }
  };

  const toggleRow = (key: string) => setSelectedKeys(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  if (courseId === null || assignmentId === null) {
    return <div className={styles.status} role="alert">This grading link is invalid.</div>;
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

  if (!access.canGrade) {
    return <div className={styles.status} role="alert">You don&apos;t have grading permission for this course.</div>;
  }

  if (rosterQuery.isLoading || rosterQuery.isPending) {
    return <div className={styles.status}>Loading grading roster…</div>;
  }

  if (rosterQuery.isError || !rosterQuery.data) {
    return (
      <div className={styles.status} role="alert">
        <p>This grading roster couldn&apos;t be loaded.</p>
        <button type="button" className={styles.primaryButton} onClick={() => void rosterQuery.refetch()}>Try again</button>
      </div>
    );
  }

  const roster = rosterQuery.data;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headingGroup}>
          <Link to={`/course/${courseId}/assignments/${assignmentId}`} className={styles.backButton} aria-label="Back to assignment">
            <ArrowLeft size={20}/>
          </Link>
          <div>
            <p className={styles.eyebrow}>Grading</p>
            <h1>{roster.assignmentTitle}</h1>
          </div>
        </div>
        {access.canReleaseGrades ? (
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void updateSelectedRelease('retract')}
              disabled={isReleasing || selectedKeys.size === 0 || !roster.gradingWritable}
            >
              <RotateCcw size={18}/>
              Retract selected
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void updateSelectedRelease('release')}
              disabled={isReleasing || selectedKeys.size === 0 || !roster.gradingWritable}
            >
              <CheckCircle2 size={18}/>
              Release selected
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void releaseAll()}
              disabled={isReleasing || roster.enteredCount === 0 || !roster.gradingWritable}
            >
              <CheckCircle2 size={18}/>
              {isReleasing ? 'Updating…' : `Release entered grades (${roster.enteredCount})`}
            </button>
          </div>
        ) : (
          <p className={styles.taNotice}>TA access: grades can be entered, but only the Instructor can release them.</p>
        )}
      </header>

      <section className={styles.metrics} aria-label="Grading summary">
        <div><span>Submitted</span><strong>{roster.submittedCount}/{roster.totalStudents}</strong></div>
        <div><span>Late</span><strong>{roster.lateCount}</strong></div>
        <div><span>Ungraded</span><strong>{roster.ungradedCount}</strong></div>
        <div><span>Released</span><strong>{roster.releasedCount}</strong></div>
      </section>

      <section className={styles.rosterCard}>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <Search size={18}/>
            <span className={styles.srOnly}>Search learners</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search learners"/>
          </label>
          <div className={styles.filters} aria-label="Grade status filter">
            {(['All', 'Ungraded', 'Graded'] as const).map(value => (
              <button
                key={value}
                type="button"
                className={filter === value ? styles.activeFilter : undefined}
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {actionError && !selectedRow ? <p className={styles.error} role="alert">{actionError}</p> : null}

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {access.canReleaseGrades ? (
                  <th>
                    <span className={styles.srOnly}>Select</span>
                  </th>
                ) : null}
                <th>Learner</th>
                <th>Submission</th>
                <th>Submitted at</th>
                <th>Score</th>
                <th>Grade status</th>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
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
                          aria-label={`Select ${name}`}
                        />
                      </td>
                    ) : null}
                    <td>
                      <div className={styles.learner}>
                        <span className={styles.avatar}>{getInitials(name)}</span>
                        <span><strong>{name}</strong><small>{getDisplayEmail(row)}</small></span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.submissionCell}>
                        <span className={styles.submissionBadge} data-status={row.submissionStatus}>{getSubmissionLabel(row.submissionStatus)}</span>
                        {row.fileCount ? <small>{row.fileCount} file(s)</small> : null}
                      </span>
                    </td>
                    <td>{formatSubmissionTime(row.submittedAt)}</td>
                    <td className={styles.score}>{row.score ?? '—'} / {roster.pointsPossible ?? '—'}</td>
                    <td><span className={styles.gradeBadge} data-status={row.gradeStatus}>{row.gradeStatus}</span></td>
                    <td>
                      <div className={styles.rowButtons}>{row.hasAnnotatedFile ? <button type="button" className={styles.gradeButton} onClick={() => void downloadAnnotated(row)} aria-label={`Download annotated feedback for ${name}`}><Download size={17}/><span>File</span></button> : null}<button
                        type="button"
                        className={styles.gradeButton}
                        onClick={() => {
                          setActionError(null);
                          setSelectedRow(row);
                        }}
                        disabled={!roster.gradingWritable}
                        aria-label={row.submissionId
                          ? `View submission files and grade ${name}`
                          : `Grade ${name}`}
                      >
                        <MessageSquare size={18}/>
                        <span>{row.submissionId ? 'View & grade' : row.gradeStatus === 'Ungraded' ? 'Grade' : 'Edit'}</span>
                      </button></div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <p className={styles.empty}>No roster rows match this view.</p> : null}
        </div>
      </section>

      {!roster.gradingWritable ? (
        <p className={styles.readOnlyNotice} role="status">This course is outside its grading window. The roster is read-only.</p>
      ) : null}

      {selectedRow ? (
        <GradeDialog
          courseId={courseId}
          assignmentId={assignmentId}
          row={selectedRow}
          pointsPossible={roster.pointsPossible}
          isSaving={isSaving}
          error={actionError}
          onClose={() => {
            if (!isSaving) setSelectedRow(null);
          }}
          onSave={(payload, annotatedFileChange) => void saveGrade(payload, annotatedFileChange)}
        />
      ) : null}
    </div>
  );
};

export default AssignmentGradingPage;
