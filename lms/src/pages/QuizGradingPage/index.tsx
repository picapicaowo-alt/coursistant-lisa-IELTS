import {useTranslation} from 'react-i18next';
import {useDeferredValue, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, CheckCircle2, CheckSquare2, Eye, RotateCcw, Search, Send, Square, Users, X} from 'lucide-react';
import {Link, useParams} from 'react-router-dom';
import type {QuizAttemptSummary} from '@/apis';
import {unwrapData} from '@/apis';
import {quizApiService} from '@/apis/services/quiz-api';
import {courseApiService} from '@/apis/services/course-api';
import MarkdownMessage from '@/components/MarkdownMessage';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {formatUtcTimestamp} from '@/utils/datetime';
import styles from './index.module.scss';

interface GradeDraft {
  score: string;
  feedback: string;
}

interface ReviewTarget {
  userId: number;
  attemptId: number;
}

type OwnedQuizAttemptSummary = QuizAttemptSummary & {userId: number};

interface AttemptRosterData {
  attempts: OwnedQuizAttemptSummary[];
  failedUserIds: number[];
}

const loadCourseStudents = async (courseId: number) => {
  const size = 100;
  const first = unwrapData(
    await courseApiService.listCourseMembers(courseId, {courseRole: 'Student', active: true, page: 0, size}),
    'listCourseMembers page 0',
  );
  const pageCount = Math.ceil(first.total / size);
  if (pageCount <= 1) return first.items;
  const rest = await Promise.all(Array.from({length: pageCount - 1}, async (_, index) => unwrapData(
    await courseApiService.listCourseMembers(courseId, {courseRole: 'Student', active: true, page: index + 1, size}),
    `listCourseMembers page ${index + 1}`,
  )));
  return [first.items, ...rest.map(page => page.items)].flat();
};

const loadStudentQuizAttempts = async (courseId: number, quizId: number, userId: number) => {
  const pageSize = 100;
  const attempts: OwnedQuizAttemptSummary[] = [];
  let page = 1;
  while (true) {
    const batch = unwrapData(
      await quizApiService.listAttempts(courseId, quizId, {userId, page, pageSize}),
      `listAttempts for user ${userId}, page ${page}`,
    );
    attempts.push(...batch.map(attempt => ({...attempt, userId})));
    if (batch.length < pageSize) return attempts;
    page += 1;
  }
};

/**
 * Builds the grading roster from per-student attempt endpoints without letting
 * one unavailable student hide every successful result. Concurrency is capped
 * to keep large courses from issuing an unbounded burst of browser requests.
 */
const loadAllQuizAttempts = async (courseId: number, quizId: number, userIds: number[]): Promise<AttemptRosterData> => {
  const attempts: OwnedQuizAttemptSummary[] = [];
  const failedUserIds: number[] = [];
  const concurrency = 12;

  for (let start = 0; start < userIds.length; start += concurrency) {
    const batchUserIds = userIds.slice(start, start + concurrency);
    const results = await Promise.allSettled(
      batchUserIds.map(userId => loadStudentQuizAttempts(courseId, quizId, userId)),
    );
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') attempts.push(...result.value);
      else failedUserIds.push(batchUserIds[index]);
    });
  }

  return {attempts, failedUserIds};
};

const QuizGradingPage = () => {
  const {t: translate} = useTranslation();
  const {courseId: courseIdParam, quizId: quizIdParam} = useParams();
  const courseId = Number(courseIdParam);
  const quizId = Number(quizIdParam);
  const valid = Number.isInteger(courseId) && courseId > 0 && Number.isInteger(quizId) && quizId > 0;
  const access = useCourseAccess(valid ? courseId : null);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, GradeDraft>>({});
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [studentSearch, setStudentSearch] = useState('');
  const deferredStudentSearch = useDeferredValue(studentSearch);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const reviewDialogRef = useRef<HTMLElement>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const reviewOpen = reviewTarget !== null;

  useEffect(() => {
    if (!reviewOpen) return;

    const trigger = reviewTriggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => reviewDialogRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setReviewTarget(null);
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = reviewDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )).filter(element => element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [reviewOpen]);

  const quizQuery = useQuery({
    queryKey: ['quiz', courseId, quizId],
    queryFn: async () => unwrapData(await quizApiService.getQuiz(courseId, quizId), 'getQuiz'),
    enabled: valid,
  });
  const summaryQuery = useQuery({
    queryKey: ['quiz-grading-summary', courseId, quizId],
    queryFn: async () => unwrapData(await quizApiService.getGradingSummary(courseId, quizId), 'getGradingSummary'),
    enabled: valid && access.canGrade,
  });
  const questionsQuery = useQuery({
    queryKey: ['quiz-questions', courseId, quizId],
    queryFn: async () => unwrapData(await quizApiService.listQuestions(courseId, quizId), 'listQuestions'),
    enabled: valid && access.canGrade,
  });
  const studentsQuery = useQuery({
    queryKey: ['course-students', courseId],
    queryFn: () => loadCourseStudents(courseId),
    enabled: valid && access.canGrade,
  });
  const studentUserIds = useMemo(
    () => (studentsQuery.data ?? []).map(student => student.userId),
    [studentsQuery.data],
  );
  const attemptsQuery = useQuery({
    queryKey: ['quiz-attempts', courseId, quizId, 'grading-roster', studentUserIds],
    queryFn: () => loadAllQuizAttempts(courseId, quizId, studentUserIds),
    enabled: valid && access.canGrade && studentsQuery.isSuccess,
    staleTime: 30_000,
  });
  const shortQuestions = useMemo(
    () => (questionsQuery.data ?? []).filter(question => question.type === 'ShortAnswer'),
    [questionsQuery.data],
  );
  const firstShortQuestionId = shortQuestions[0]?.id ?? null;

  useEffect(() => {
    if (selectedQuestionId === null && firstShortQuestionId !== null) setSelectedQuestionId(firstShortQuestionId);
  }, [firstShortQuestionId, selectedQuestionId]);

  const answersQuery = useQuery({
    queryKey: ['quiz-short-answers', courseId, quizId, selectedQuestionId],
    queryFn: async () => unwrapData(
      await quizApiService.listShortAnswers(courseId, quizId, selectedQuestionId!),
      'listShortAnswers',
    ),
    enabled: access.canGrade && selectedQuestionId !== null,
  });

  const reviewResultQuery = useQuery({
    queryKey: ['quiz-attempt-result', courseId, quizId, reviewTarget?.attemptId],
    queryFn: async () => unwrapData(
      await quizApiService.getAttemptResult(courseId, quizId, reviewTarget!.attemptId),
      'getAttemptResult for grading',
    ),
    enabled: valid && access.canGrade && reviewTarget !== null,
  });
  const reviewAttemptQuery = useQuery({
    queryKey: ['quiz-attempt-detail', courseId, quizId, reviewTarget?.attemptId],
    queryFn: async () => unwrapData(
      await quizApiService.getAttempt(courseId, quizId, reviewTarget!.attemptId),
      'getAttempt for grading',
    ),
    enabled: valid && access.canGrade && reviewTarget !== null,
  });

  useEffect(() => {
    if (!answersQuery.data) return;
    setDrafts(Object.fromEntries(answersQuery.data.map(answer => [answer.attemptId, {
      score: answer.score === null ? '' : String(answer.score),
      feedback: answer.feedback ?? '',
    }])));
  }, [answersQuery.data]);

  const gradeAnswer = useMutation({
    mutationFn: ({attemptId, questionId, draft}: {attemptId: number; questionId: number; draft: GradeDraft}) => {
      const request = {
        score: Number(draft.score),
        feedback: draft.feedback.trim() || undefined,
      };
      const operation = `quiz-grade-${courseId}-${quizId}-${attemptId}-${questionId}`;
      return quizApiService.gradeAnswer(
        courseId,
        quizId,
        attemptId,
        questionId,
        request,
        idempotency.keyFor(operation, idempotencyFingerprint(request)),
      );
    },
    onSuccess: async (_, {attemptId, questionId, draft}) => {
      const request = {score: Number(draft.score), feedback: draft.feedback.trim() || undefined};
      const operation = `quiz-grade-${courseId}-${quizId}-${attemptId}-${questionId}`;
      idempotency.completeFingerprint(operation, idempotencyFingerprint(request));
      setMessage('Grade saved.');
      await queryClient.invalidateQueries({queryKey: ['quiz-short-answers', courseId, quizId, selectedQuestionId]});
      await queryClient.invalidateQueries({queryKey: ['quiz-grading-summary', courseId, quizId]});
      await queryClient.invalidateQueries({queryKey: ['quiz-attempt-result', courseId, quizId, attemptId]});
      await queryClient.invalidateQueries({queryKey: ['quiz-attempt-detail', courseId, quizId, attemptId]});
    },
    onError: () => setMessage('The grade could not be saved.'),
  });

  const updateRelease = useMutation({
    mutationFn: ({action, userIds}: {action: 'release' | 'retract'; userIds?: number[]}) => {
      const operation = `quiz-grades-${action}-${courseId}-${quizId}`;
      const fingerprint = idempotencyFingerprint({action, userIds: userIds ?? []});
      const key = idempotency.keyFor(operation, fingerprint);
      return action === 'release'
        ? quizApiService.releaseGrades(courseId, quizId, userIds, key)
        : quizApiService.retractGrades(courseId, quizId, userIds, key);
    },
    onSuccess: async (_, {action, userIds}) => {
      const operation = `quiz-grades-${action}-${courseId}-${quizId}`;
      const fingerprint = idempotencyFingerprint({action, userIds: userIds ?? []});
      idempotency.completeFingerprint(operation, fingerprint);
      setMessage(action === 'release'
        ? `${userIds?.length ?? 'Eligible'} grade${userIds?.length === 1 ? '' : 's'} released.`
        : `${userIds?.length ?? 'Released'} grade${userIds?.length === 1 ? '' : 's'} retracted.`);
      setSelectedUserIds(new Set());
      await queryClient.invalidateQueries({queryKey: ['quiz-grading-summary', courseId, quizId]});
      await queryClient.invalidateQueries({queryKey: ['quiz-attempt-result', courseId, quizId]});
    },
    onError: () => setMessage('The grade release state could not be changed.'),
  });

  const selectedQuestion = shortQuestions.find(question => question.id === selectedQuestionId);
  const attemptsByUserId = useMemo(() => {
    // Attempt summaries do not carry the staff filter userId, so the loader
    // attaches it before results from separate student requests are combined.
    const grouped = new Map<number, QuizAttemptSummary[]>();
    for (const attempt of attemptsQuery.data?.attempts ?? []) {
      const current = grouped.get(attempt.userId) ?? [];
      current.push(attempt);
      grouped.set(attempt.userId, current);
    }
    return grouped;
  }, [attemptsQuery.data?.attempts]);
  const studentRows = useMemo(() => (studentsQuery.data ?? []).map(student => {
    const attempts = attemptsByUserId.get(student.userId) ?? [];
    const finalizedAttempts = attempts.filter(attempt => attempt.status === 'Submitted');
    return {
      student,
      attempts,
      finalizedAttempts,
      latest: finalizedAttempts[0] ?? attempts[0],
    };
  }), [attemptsByUserId, studentsQuery.data]);
  const visibleStudentRows = useMemo(() => {
    const normalizedSearch = deferredStudentSearch.trim().toLowerCase();
    return normalizedSearch
      ? studentRows.filter(({student}) => `${student.userName ?? ''} ${student.userEmail ?? ''} ${student.userId}`.toLowerCase().includes(normalizedSearch))
      : studentRows;
  }, [deferredStudentSearch, studentRows]);
  const allSelectableUserIds = useMemo(() => studentRows
    .filter(row => row.finalizedAttempts.length > 0)
    .map(row => row.student.userId), [studentRows]);
  const allEligibleSelected = allSelectableUserIds.length > 0
    && allSelectableUserIds.every(userId => selectedUserIds.has(userId));
  const reviewStudentRow = reviewTarget
    ? studentRows.find(row => row.student.userId === reviewTarget.userId)
    : undefined;
  const reviewedAttempt = reviewStudentRow?.finalizedAttempts
    .find(attempt => attempt.id === reviewTarget?.attemptId);

  if (access.isResolved && !access.canGrade) {
    return <main className={styles.page}><p className={styles.error} role="alert">You do not have grading permission for this course.</p></main>;
  }

  const toggleStudent = (userId: number) => setSelectedUserIds(current => {
    const next = new Set(current);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    return next;
  });

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <Link
          to={`/course/${courseId}/quizzes/${quizId}`}
          className={styles.backLink}
          aria-label={translate("common:navigationControls.backToQuiz")}
          title={translate("common:navigationControls.backToQuiz")}
        >
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <div><p className={styles.eyebrow}>Quiz grading</p><h1>{quizQuery.data?.title || 'Loading quiz…'}</h1></div>
        <div className={styles.headerActions}>
          {access.canReleaseGrades ? <><button type="button" className={styles.secondaryButton} onClick={() => updateRelease.mutate({action: 'retract'})} disabled={updateRelease.isPending}><RotateCcw size={16}/> Retract all</button>
          <button type="button" className={styles.primaryButton} onClick={() => updateRelease.mutate({action: 'release'})} disabled={updateRelease.isPending || Boolean(summaryQuery.data?.manualIncompleteAttemptCount)}><Send size={16}/> Release all eligible</button></> : null}
        </div>
      </div>

      <section className={styles.summaryGrid}>
        <div><strong>{summaryQuery.data?.submittedAttemptCount ?? '—'}</strong><span>Submitted attempts</span></div>
        <div><strong>{summaryQuery.data?.pendingShortAnswerCount ?? '—'}</strong><span>Pending short answers</span></div>
        <div><strong>{summaryQuery.data?.manualIncompleteAttemptCount ?? '—'}</strong><span>Incomplete grading</span></div>
        <div><strong>{summaryQuery.data?.releasedUserCount ?? '—'}</strong><span>Released users</span></div>
      </section>

      {message ? <p className={message.includes('could not') ? styles.error : styles.success} role="status">{message}</p> : null}

      {access.canGrade ? (
        <section className={styles.card} aria-labelledby="student-release-title">
          <div className={styles.cardHeader}>
            <div><h2 id="student-release-title">Student results and grade release</h2><p>Review each finalized attempt before releasing grades to learners.</p></div>
            {access.canReleaseGrades ? <div className={styles.selectionActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => updateRelease.mutate({action: 'retract', userIds: [...selectedUserIds]})} disabled={updateRelease.isPending || selectedUserIds.size === 0}><RotateCcw size={16}/> Retract selected</button>
              <button type="button" className={styles.primaryButton} onClick={() => updateRelease.mutate({action: 'release', userIds: [...selectedUserIds]})} disabled={updateRelease.isPending || selectedUserIds.size === 0}><Send size={16}/> Release selected</button>
            </div> : null}
          </div>
          <div className={styles.rosterToolbar}>
            <label className={styles.searchBox}><Search size={17}/><span className={styles.srOnly}>Search students</span><input value={studentSearch} onChange={event => setStudentSearch(event.target.value)} placeholder="Search students"/></label>
            {access.canReleaseGrades ? <>
              <div className={styles.bulkSelection} aria-label="Bulk student selection">
                <button
                  type="button"
                  onClick={() => setSelectedUserIds(new Set(allSelectableUserIds))}
                  disabled={allSelectableUserIds.length === 0 || allEligibleSelected}
                >
                  <CheckSquare2 size={16}/> Select all eligible ({allSelectableUserIds.length})
                </button>
                <button type="button" onClick={() => setSelectedUserIds(new Set())} disabled={selectedUserIds.size === 0}>
                  <Square size={16}/> Clear all
                </button>
              </div>
              <span className={styles.selectedCount}><Users size={16}/> {selectedUserIds.size} selected</span>
            </> : null}
          </div>
          {studentsQuery.isPending || attemptsQuery.isPending ? <p className={styles.empty}>Loading student results…</p> : studentsQuery.isError || attemptsQuery.isError ? <div className={styles.inlineError} role="alert"><p>Student results could not be loaded.</p><button type="button" onClick={() => { void studentsQuery.refetch(); void attemptsQuery.refetch(); }}>Try again</button></div> : visibleStudentRows.length === 0 ? <p className={styles.empty}>No matching active students.</p> : (
            <ul className={styles.studentList}>
              {visibleStudentRows.map(row => {
                const selectable = row.finalizedAttempts.length > 0;
                const studentName = row.student.userName || `User ${row.student.userId}`;
                return <li key={row.student.userId}>
                  <div className={styles.studentIdentity}>
                    {access.canReleaseGrades ? <input type="checkbox" aria-label={`Select ${studentName}`} checked={selectedUserIds.has(row.student.userId)} disabled={!selectable} onChange={() => toggleStudent(row.student.userId)}/> : null}
                    <span><strong>{studentName}</strong><small>{row.student.userEmail || `User ID ${row.student.userId}`}</small></span>
                  </div>
                  <div className={styles.studentResultActions}>
                    <span className={styles.attemptStatus}>{row.latest ? `${row.finalizedAttempts.length} finalized · latest ${row.latest.status}` : 'No attempts'}</span>
                    {row.finalizedAttempts[0] ? <button
                      type="button"
                      className={styles.reviewButton}
                      onClick={event => {
                        reviewTriggerRef.current = event.currentTarget;
                        setReviewTarget({userId: row.student.userId, attemptId: row.finalizedAttempts[0].id});
                      }}
                      aria-label={`Review result for ${studentName}`}
                      aria-haspopup="dialog"
                      aria-expanded={reviewTarget?.userId === row.student.userId}
                    ><Eye size={16}/> Review result</button> : null}
                  </div>
                </li>;
              })}
            </ul>
          )}
          {attemptsQuery.data?.failedUserIds.length ? (
            <div className={styles.inlineError} role="alert">
              <p>Attempt history could not be loaded for {attemptsQuery.data.failedUserIds.length} learner(s).</p>
              <button type="button" onClick={() => void attemptsQuery.refetch()}>Try again</button>
            </div>
          ) : null}

          {reviewTarget && reviewStudentRow && typeof document !== 'undefined' ? createPortal(
            <div className={styles.reviewBackdrop} role="presentation" onMouseDown={event => {
              if (event.target === event.currentTarget) setReviewTarget(null);
            }}>
            <section
              ref={reviewDialogRef}
              className={styles.resultReview}
              role="dialog"
              aria-modal="true"
              aria-labelledby="attempt-review-title"
              aria-describedby="attempt-review-student"
              tabIndex={-1}
            >
              <div className={styles.resultReviewHeader}>
                <div>
                  <p>Attempt review</p>
                  <h3 id="attempt-review-title">{reviewStudentRow.student.userName || `User ${reviewStudentRow.student.userId}`}</h3>
                  <small id="attempt-review-student">{reviewStudentRow.student.userEmail || `User ID ${reviewStudentRow.student.userId}`}</small>
                </div>
                <div className={styles.reviewHeaderActions}>
                  <label>
                    <span>Attempt</span>
                    <select value={reviewTarget.attemptId} onChange={event => setReviewTarget({...reviewTarget, attemptId: Number(event.target.value)})}>
                      {reviewStudentRow.finalizedAttempts.map(attempt => <option key={attempt.id} value={attempt.id}>Attempt {attempt.attemptNumber} · {attempt.status}</option>)}
                    </select>
                  </label>
                  <button type="button" className={styles.closeReviewButton} onClick={() => setReviewTarget(null)} aria-label="Close attempt review"><X size={18}/></button>
                </div>
              </div>

              {reviewResultQuery.isPending || reviewAttemptQuery.isPending ? <p className={styles.empty}>Loading attempt result…</p> : reviewResultQuery.isError || reviewAttemptQuery.isError ? (
                <div className={styles.inlineError} role="alert"><p>This attempt result could not be loaded.</p><button type="button" onClick={() => { void reviewResultQuery.refetch(); void reviewAttemptQuery.refetch(); }}>Try again</button></div>
              ) : reviewResultQuery.data && reviewAttemptQuery.data ? <>
                <div className={styles.resultSummary}>
                  <div><span>Total score</span><strong>{reviewAttemptQuery.data.totalScore ?? '—'} / {quizQuery.data?.totalPoints ?? '—'}</strong></div>
                  <div><span>Auto score</span><strong>{reviewAttemptQuery.data.autoScore ?? '—'}</strong></div>
                  <div><span>Manual score</span><strong>{reviewAttemptQuery.data.manualScore ?? '—'}</strong></div>
                  <div><span>Grade status</span><strong>{reviewResultQuery.data.gradeStatus || 'Not released'}</strong></div>
                </div>
                {!reviewAttemptQuery.data.manualGradingComplete ? <p className={styles.pendingNotice}>Short-answer grading is still incomplete.</p> : null}
                {reviewedAttempt?.submittedAt ? <p className={styles.reviewTimestamp}>Submitted {formatUtcTimestamp(reviewedAttempt.submittedAt)}</p> : null}
                <ol className={styles.resultQuestions}>
                  {reviewResultQuery.data.questions.map((resultQuestion, index) => {
                    const question = questionsQuery.data?.find(item => item.id === resultQuestion.questionId);
                    const selectedOptions = new Set(resultQuestion.selectedOptionIds ?? []);
                    const correctOptions = new Set(resultQuestion.correctOptionIds
                      ?? question?.options.filter(option => option.isCorrect).map(option => option.id)
                      ?? []);
                    return <li key={resultQuestion.questionId}>
                      <div className={styles.resultQuestionHeader}>
                        <div><span>Question {question?.position ?? index + 1}</span><MarkdownMessage content={question?.stem || `Question ${index + 1}`}/></div>
                        <strong>{resultQuestion.score ?? '—'} / {resultQuestion.points}</strong>
                      </div>
                      {resultQuestion.type === 'ShortAnswer' ? (
                        <div className={styles.shortAnswerResult}><span>Student answer</span>{resultQuestion.textAnswer ? <MarkdownMessage content={resultQuestion.textAnswer}/> : <p>No answer submitted.</p>}</div>
                      ) : question?.options.length ? (
                        <ul className={styles.resultOptions}>
                          {question.options.map(option => {
                            const selected = selectedOptions.has(option.id);
                            const correct = correctOptions.has(option.id);
                            return <li key={option.id} data-selected={selected} data-correct={correct}>
                              <span className={styles.optionIndicator} aria-hidden="true">{selected ? '●' : '○'}</span>
                              <MarkdownMessage content={option.label}/>
                              <span className={styles.optionLabels}>{selected ? <em>Student answer</em> : null}{correct ? <em>Correct answer</em> : null}</span>
                            </li>;
                          })}
                        </ul>
                      ) : <p className={styles.empty}>Answer details are unavailable.</p>}
                    </li>;
                  })}
                </ol>
              </> : null}
            </section>
            </div>,
            document.body,
          ) : null}
        </section>
      ) : null}

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div><h2>Short-answer grading</h2><p>Objective questions are graded automatically from the answer key.</p></div>
          {shortQuestions.length ? <label><span>Question</span><select value={selectedQuestionId ?? ''} onChange={event => setSelectedQuestionId(Number(event.target.value))}>{shortQuestions.map(question => <option key={question.id} value={question.id}>{question.position}. {question.stem}</option>)}</select></label> : null}
        </div>

        {!shortQuestions.length ? <p className={styles.empty}>This quiz has no short-answer questions.</p> : answersQuery.isError ? <p className={styles.error} role="alert">Short answers could not be loaded.</p> : (answersQuery.data ?? []).length === 0 ? <p className={styles.empty}>No submitted answers for this question yet.</p> : <div className={styles.answerList}>{answersQuery.data?.map(answer => {
          const draft = drafts[answer.attemptId] ?? {score: '', feedback: ''};
          return <article key={answer.attemptId} className={styles.answerCard}>
            <div className={styles.answerHeading}><div><strong>User {answer.userId}</strong><span>Attempt {answer.attemptId}</span></div>{answer.pendingManual ? <span className={styles.pending}>Needs grading</span> : <span className={styles.graded}><CheckCircle2 size={15}/> Graded</span>}</div>
            <blockquote>{answer.textAnswer || 'No text answer'}</blockquote>
            <div className={styles.gradeControls}>
              <label><span>Score / {selectedQuestion?.points ?? 0}</span><input type="number" min="0" max={selectedQuestion?.points ?? undefined} step="0.5" value={draft.score} onChange={event => setDrafts(previous => ({...previous, [answer.attemptId]: {...draft, score: event.target.value}}))}/></label>
              <label><span>Feedback</span><input value={draft.feedback} onChange={event => setDrafts(previous => ({...previous, [answer.attemptId]: {...draft, feedback: event.target.value}}))}/></label>
              <button type="button" className={styles.primaryButton} disabled={gradeAnswer.isPending || draft.score === '' || Number(draft.score) < 0 || Number(draft.score) > (selectedQuestion?.points ?? 0)} onClick={() => gradeAnswer.mutate({attemptId: answer.attemptId, questionId: answer.questionId, draft})}>Save grade</button>
            </div>
          </article>;
        })}</div>}
      </section>
    </main>
  );
};

export default QuizGradingPage;
