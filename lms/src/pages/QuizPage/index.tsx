import {useEffect, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, CalendarClock, CheckCircle2, Clock3, History, Pencil, RotateCcw, ShieldCheck} from 'lucide-react';
import {Link, useParams} from 'react-router-dom';
import type {QuizAttempt, QuizQuestion} from '@/apis';
import {unwrapData} from '@/apis';
import {quizApiService} from '@/apis/services/quiz-api';
import MarkdownMessage from '@/components/MarkdownMessage';
import {RichTextEditor} from '@/components/RichTextEditor';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {formatUtcTimestamp} from '@/utils/datetime';
import {
  formatQuizInstant,
  isMissingCurrentAttempt,
  isMissingQuizResult,
  isQuizAttemptNotFound,
  isQuizAttemptNotInProgress,
  isQuizNotFound,
  isQuizWindowClosed,
  quizQuestionErrorMessage,
  quizWindowStatus,
  quizWindowStatusLabel,
  startAttemptErrorMessage,
} from '@/utils/quizAvailability';
import styles from './index.module.scss';

interface AnswerDraft {
  selectedOptionIds: number[];
  textAnswer: string;
}

const emptyAnswer = (): AnswerDraft => ({selectedOptionIds: [], textAnswer: ''});

const toDrafts = (attempt: QuizAttempt | null): Record<number, AnswerDraft> =>
  Object.fromEntries((attempt?.answers ?? []).map(answer => [answer.questionId, {
    selectedOptionIds: answer.selectedOptionIds ?? [],
    textAnswer: answer.textAnswer ?? '',
  }]));

const QuizPage = () => {
  const {courseId: courseIdParam, quizId: quizIdParam} = useParams();
  const courseId = Number(courseIdParam);
  const quizId = Number(quizIdParam);
  const valid = Number.isInteger(courseId) && courseId > 0 && Number.isInteger(quizId) && quizId > 0;
  const access = useCourseAccess(valid ? courseId : null);
  const isStaff = access.isResolved && (access.canConfigureAssignments || access.canGrade);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [drafts, setDrafts] = useState<Record<number, AnswerDraft>>({});
  const [savedQuestions, setSavedQuestions] = useState<Set<number>>(new Set());
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [selectedHistoryAttemptId, setSelectedHistoryAttemptId] = useState<number | null>(null);

  const quizQuery = useQuery({
    queryKey: ['quiz', courseId, quizId],
    queryFn: async () => unwrapData(await quizApiService.getQuiz(courseId, quizId), 'getQuiz'),
    enabled: valid,
    retry: 1,
  });
  const attemptQuery = useQuery({
    queryKey: ['quiz-current-attempt', courseId, quizId],
    queryFn: async () => {
      try {
        return unwrapData(await quizApiService.getCurrentAttempt(courseId, quizId), 'getCurrentAttempt');
      } catch (error) {
        if (isMissingCurrentAttempt(error)) return null;
        throw error;
      }
    },
    enabled: valid && access.isResolved && !isStaff,
    retry: false,
  });
  const isStudentInProgress = Boolean(attemptQuery.data && attemptQuery.data.status === 'InProgress');
  const questionsQuery = useQuery({
    queryKey: ['quiz-questions', courseId, quizId],
    queryFn: async () => unwrapData(await quizApiService.listQuestions(courseId, quizId), 'listQuestions'),
    // Students receive question content only after an active attempt has been
    // confirmed. Staff use the same endpoint for authoring/review without one.
    enabled: valid && (isStaff || (access.isResolved && isStudentInProgress)),
    retry: (failureCount, error) => {
      if (isQuizAttemptNotFound(error) || isQuizAttemptNotInProgress(error) || isQuizWindowClosed(error) || isQuizNotFound(error)) {
        return false;
      }
      return failureCount < 1;
    },
  });
  const resultQuery = useQuery({
    queryKey: ['quiz-my-result', courseId, quizId],
    queryFn: async () => {
      try {
        return unwrapData(await quizApiService.getMyResult(courseId, quizId), 'getMyResult');
      } catch (error) {
        if (isMissingQuizResult(error)) return null;
        throw error;
      }
    },
    // Do not probe result visibility while an attempt is still active. Once no
    // current attempt exists, an unavailable result becomes a normal empty state.
    enabled: valid && access.isResolved && !isStaff && attemptQuery.data === null,
    retry: false,
  });
  const attemptsQuery = useQuery({
    queryKey: ['quiz-attempts', courseId, quizId, 'mine'],
    queryFn: async () => unwrapData(
      // The results projection omits attempt IDs and timestamps. History needs
      // the attempt collection, which the API scopes to the signed-in student.
      await quizApiService.listAttempts(courseId, quizId),
      'listAttempts',
    ),
    enabled: valid && access.isResolved && !isStaff,
    retry: 1,
  });
  const historyResultQuery = useQuery({
    queryKey: ['quiz-attempt-result', courseId, quizId, selectedHistoryAttemptId],
    queryFn: async () => unwrapData(
      await quizApiService.getAttemptResult(courseId, quizId, selectedHistoryAttemptId!),
      'getAttemptResult',
    ),
    enabled: selectedHistoryAttemptId !== null,
    retry: 1,
  });

  const historyReceiptQuery = useQuery({
    queryKey: ['quiz-attempt-receipt', courseId, quizId, selectedHistoryAttemptId],
    queryFn: async () => unwrapData(await quizApiService.getAttemptReceipt(courseId, quizId, selectedHistoryAttemptId!), 'getAttemptReceipt'),
    enabled: selectedHistoryAttemptId != null && Boolean(attemptsQuery.data?.some(attempt => attempt.id === selectedHistoryAttemptId && attempt.submittedAt)),
    retry: false,
  });

  useEffect(() => {
    if (attemptQuery.data) setDrafts(toDrafts(attemptQuery.data));
    // Rehydrate only when the attempt identity changes, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptQuery.data?.id]);

  useEffect(() => {
    if (questionsQuery.isError && questionsQuery.error) {
      if (isQuizAttemptNotFound(questionsQuery.error)) {
        queryClient.setQueryData(['quiz-current-attempt', courseId, quizId], null);
      } else if (isQuizAttemptNotInProgress(questionsQuery.error)) {
        void queryClient.invalidateQueries({queryKey: ['quiz-current-attempt', courseId, quizId]});
      }
    }
  }, [questionsQuery.isError, questionsQuery.error, queryClient, courseId, quizId]);

  const startAttempt = useMutation({
    mutationFn: () => {
      const operation = `quiz-attempt-start-${courseId}-${quizId}`;
      const key = idempotency.keyFor(operation, operation);
      return quizApiService.startAttempt(courseId, quizId, key);
    },
    onSuccess: response => {
      const attempt = unwrapData(response, 'startAttempt');
      const operation = `quiz-attempt-start-${courseId}-${quizId}`;
      idempotency.completeFingerprint(operation, operation);
      queryClient.setQueryData(['quiz-current-attempt', courseId, quizId], attempt);
      setDrafts(toDrafts(attempt));
      void queryClient.invalidateQueries({queryKey: ['quiz-attempts', courseId, quizId, 'mine']});
      void queryClient.invalidateQueries({queryKey: ['course-quizzes', courseId]});
      void queryClient.invalidateQueries({queryKey: ['ai-exam-lockdown', courseId]});
    },
  });

  const saveAnswer = useMutation({
    // Each question is an independent checkpoint; changing another draft must
    // not resend or overwrite answers already acknowledged by the API.
    mutationFn: ({question, draft}: {question: QuizQuestion; draft: AnswerDraft}) =>
      quizApiService.autosaveAnswer(
        courseId,
        quizId,
        attemptQuery.data!.id,
        question.id,
        question.type === 'ShortAnswer'
          ? {textAnswer: draft.textAnswer}
          : {selectedOptionIds: draft.selectedOptionIds},
      ),
    onSuccess: (_, variables) => {
      setSavedQuestions(previous => new Set(previous).add(variables.question.id));
    },
  });

  const submitAttempt = useMutation({
    mutationFn: () => {
      const attemptId = attemptQuery.data!.id;
      const operation = `quiz-attempt-submit-${courseId}-${quizId}-${attemptId}`;
      const key = idempotency.keyFor(operation, operation);
      return quizApiService.submitAttempt(courseId, quizId, attemptId, key);
    },
    onSuccess: async () => {
      const attemptId = attemptQuery.data!.id;
      const operation = `quiz-attempt-submit-${courseId}-${quizId}-${attemptId}`;
      idempotency.completeFingerprint(operation, operation);
      setConfirmSubmit(false);
      queryClient.setQueryData(['quiz-current-attempt', courseId, quizId], null);
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['quiz-my-result', courseId, quizId]}),
        queryClient.invalidateQueries({queryKey: ['quiz-attempts', courseId, quizId, 'mine']}),
        queryClient.invalidateQueries({queryKey: ['course-quizzes', courseId]}),
        queryClient.invalidateQueries({queryKey: ['ai-exam-lockdown', courseId]}),
      ]);
    },
  });

  const changeState = useMutation({
    mutationFn: () => {
      const action = quizQuery.data?.state === 'Published' ? 'unpublish' : 'publish';
      const operation = `quiz-${action}-${courseId}-${quizId}`;
      const key = idempotency.keyFor(operation, idempotencyFingerprint({courseId, quizId, action}));
      return action === 'unpublish'
        ? quizApiService.unpublishQuiz(courseId, quizId, key)
        : quizApiService.publishQuiz(courseId, quizId, key);
    },
    onSuccess: async () => {
      const action = quizQuery.data?.state === 'Published' ? 'unpublish' : 'publish';
      const operation = `quiz-${action}-${courseId}-${quizId}`;
      const fingerprint = idempotencyFingerprint({courseId, quizId, action});
      idempotency.completeFingerprint(operation, fingerprint);
      await queryClient.invalidateQueries({queryKey: ['quiz', courseId, quizId]});
      await queryClient.invalidateQueries({queryKey: ['course-quizzes', courseId]});
    },
  });

  const updateDraft = (questionId: number, updater: (draft: AnswerDraft) => AnswerDraft) => {
    setSavedQuestions(previous => {
      const next = new Set(previous);
      next.delete(questionId);
      return next;
    });
    setDrafts(previous => ({
      ...previous,
      [questionId]: updater(previous[questionId] ?? emptyAnswer()),
    }));
  };

  if (!valid || quizQuery.isError || (questionsQuery.isError && isStaff)) {
    return <main className={styles.page}><div className={styles.error} role="alert">{questionsQuery.isError ? quizQuestionErrorMessage(questionsQuery.error) : 'This quiz could not be loaded.'}</div></main>;
  }

  const quiz = quizQuery.data;
  const questions = questionsQuery.data ?? [];
  const attempt = attemptQuery.data;
  const result = resultQuery.data;
  const visibleResultScore = result?.totalScore
    ?? (quiz?.resultVisibility === 'InstantAutoScore' ? result?.autoScore ?? null : null);
  const attempts = attemptsQuery.data ?? [];
  const attemptsRemaining = Math.max(0, (quiz?.attemptsAllowed ?? 0) - attempts.length);
  const windowStatus = quiz ? quizWindowStatus(quiz) : 'draft';
  const canStart = windowStatus === 'open';
  const startLabel = startAttempt.isPending
    ? 'Starting…'
    : windowStatus === 'upcoming' && quiz
      ? `Opens ${formatQuizInstant(quiz.opensAtLocal, quiz.timezone)}`
      : windowStatus === 'closed'
        ? 'Quiz closed'
        : windowStatus !== 'open'
          ? 'Quiz is not open'
          : 'Start attempt';

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <Link to={`/course/${courseId}`} className={styles.backLink} aria-label="Back to course"><ArrowLeft size={22}/></Link>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>
            {quiz ? (isStaff ? `${quiz.state} · ${quizWindowStatusLabel(windowStatus)}` : quizWindowStatusLabel(windowStatus)) : 'Quiz'}
          </p>
          <h1>{quiz?.title || 'Loading quiz…'}</h1>
        </div>
        {quiz && isStaff ? (
          <div className={styles.headerActions}>
            <Link className={styles.secondaryButton} to={`/course/${courseId}/quizzes/${quizId}/edit`}><Pencil size={16}/> Edit</Link>
            {access.canGrade ? <Link className={styles.secondaryButton} to={`/course/${courseId}/quizzes/${quizId}/grading`}><ShieldCheck size={16}/> Grade</Link> : null}
            <button type="button" className={styles.primaryButton} onClick={() => changeState.mutate()} disabled={changeState.isPending}>
              {quiz.state === 'Published' ? 'Unpublish' : 'Publish quiz'}
            </button>
          </div>
        ) : null}
      </div>

      {quiz ? (
        <section className={styles.summaryCard}>
          {quiz.instructions ? (
            <MarkdownMessage className={styles.instructions} content={quiz.instructions}/>
          ) : null}
          <div className={styles.summaryGrid}>
            <span><Clock3 size={17}/> {quiz.timeLimitSeconds ? `${Math.round(quiz.timeLimitSeconds / 60)} minutes` : 'No time limit'}</span>
            <span>{quiz.attemptsAllowed} attempt{quiz.attemptsAllowed === 1 ? '' : 's'}</span>
            <span>{quiz.totalPoints} points</span>
            <span><CalendarClock size={17}/> Opens {formatQuizInstant(quiz.opensAtLocal, quiz.timezone)}</span>
            <span>Closes {formatQuizInstant(quiz.closesAtLocal, quiz.timezone)}</span>
            <span className={styles.availability} data-status={windowStatus}>{quizWindowStatusLabel(windowStatus)}</span>
          </div>
        </section>
      ) : null}

      {isStaff ? (
        <section className={styles.card}>
          <h2>Questions</h2>
          {questions.length ? (
            <ol className={styles.questionSummary}>
              {questions.map(question => (
                <li key={question.id}>
                  <MarkdownMessage content={question.stem}/>
                  <small>{question.type} · {question.points} pts</small>
                </li>
              ))}
            </ol>
          ) : <p className={styles.muted}>No questions yet. Add questions before publishing.</p>}
        </section>
      ) : attempt ? (
        <section className={styles.attempt}>
          <div className={styles.attemptHeader}>
            <div><h2>Attempt {attempt.attemptNumber}</h2><p>Answers are saved one question at a time.</p></div>
            {attempt.deadlineAt ? <span>Deadline {formatUtcTimestamp(attempt.deadlineAt, {hour: 'numeric', minute: '2-digit', timeZoneName: 'short'})}</span> : null}
          </div>
          {questions.map((question, index) => {
            const draft = drafts[question.id] ?? emptyAnswer();
            return (
              <article key={question.id} className={styles.questionCard}>
                <div className={styles.questionHeading}>
                  <div className={styles.questionPrompt}>
                    <strong>{index + 1}.</strong>
                    <MarkdownMessage content={question.stem}/>
                  </div>
                  <span>{question.points} pts</span>
                </div>
                {question.type === 'ShortAnswer' ? (
                  <RichTextEditor
                    variant="composer"
                    showToolbar={false}
                    content={draft.textAnswer}
                    onChange={textAnswer => updateDraft(question.id, current => ({...current, textAnswer}))}
                    placeholder="Type your answer"
                    ariaLabel={`Question ${index + 1} answer`}
                  />
                ) : (
                  <div className={styles.options}>
                    {question.options.map(option => {
                      const checked = draft.selectedOptionIds.includes(option.id);
                      const multiple = question.type === 'MultipleSelect';
                      return (
                        <label key={option.id}>
                          <input
                            type={multiple ? 'checkbox' : 'radio'}
                            name={`question-${question.id}`}
                            checked={checked}
                            onChange={() => updateDraft(question.id, current => ({
                              ...current,
                              selectedOptionIds: multiple
                                ? checked
                                  ? current.selectedOptionIds.filter(id => id !== option.id)
                                  : [...current.selectedOptionIds, option.id]
                                : [option.id],
                            }))}
                          />
                          <MarkdownMessage className={styles.optionText} content={option.label}/>
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className={styles.questionFooter}>
                  {savedQuestions.has(question.id) ? <span className={styles.saved}><CheckCircle2 size={15}/> Saved</span> : <span/>}
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => saveAnswer.mutate({question, draft})}
                    disabled={saveAnswer.isPending}
                  >Save answer</button>
                </div>
              </article>
            );
          })}
          <div className={styles.submitBar}>
            {confirmSubmit ? (
              <>
                <p>Submit this attempt? You won&apos;t be able to change answers afterward.</p>
                <button type="button" className={styles.secondaryButton} onClick={() => setConfirmSubmit(false)}>Keep working</button>
                <button type="button" className={styles.primaryButton} onClick={() => submitAttempt.mutate()} disabled={submitAttempt.isPending}>Confirm submit</button>
              </>
            ) : <button type="button" className={styles.primaryButton} onClick={() => setConfirmSubmit(true)}>Submit quiz</button>}
          </div>
        </section>
      ) : result ? (
        <section className={styles.card}>
          <div className={styles.resultHeader}><CheckCircle2 size={28}/><div><h2>Quiz submitted</h2><p>Receipt {result.receiptId || 'pending'}</p></div></div>
          <p className={styles.score}>
            {visibleResultScore === null
              ? 'Waiting for grading'
              : `${result.manualGradingPending ? 'Auto-score so far: ' : ''}${visibleResultScore} / ${quiz?.totalPoints ?? 0}`}
          </p>
          {result.releasedAt ? (
            <p className={styles.muted}>Grade released on {formatUtcTimestamp(result.releasedAt)}</p>
          ) : null}
          {result.manualGradingPending ? <p className={styles.muted}>A short-answer response still needs instructor grading.</p> : null}
          {attemptsRemaining > 0 ? (
            <div className={styles.retakeRow}>
              <p>{attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining.</p>
              <button type="button" className={styles.primaryButton} onClick={() => startAttempt.mutate()} disabled={startAttempt.isPending || !canStart}><RotateCcw size={16}/> {startAttempt.isPending ? 'Starting…' : canStart ? 'Start another attempt' : startLabel}</button>
            </div>
          ) : <p className={styles.muted}>You have used all available attempts.</p>}
          {startAttempt.isError ? <p className={styles.error} role="alert">{startAttemptErrorMessage(startAttempt.error, quiz)}</p> : null}
        </section>
      ) : (
        <section className={styles.card}>
          <h2>Ready to begin?</h2>
          {windowStatus === 'upcoming' && quiz ? (
            <p className={styles.muted}>This quiz opens {formatQuizInstant(quiz.opensAtLocal, quiz.timezone)}.</p>
          ) : windowStatus === 'closed' && quiz ? (
            <p className={styles.muted}>This quiz closed {formatQuizInstant(quiz.closesAtLocal, quiz.timezone)}.</p>
          ) : null}
          <button type="button" className={styles.primaryButton} onClick={() => startAttempt.mutate()} disabled={startAttempt.isPending || !canStart}>
            {startLabel}
          </button>
          {startAttempt.isError ? <p className={styles.error} role="alert">{startAttemptErrorMessage(startAttempt.error, quiz)}</p> : null}
          {attemptQuery.isError ? <p className={styles.error} role="alert">Your current attempt could not be loaded.</p> : null}
          {resultQuery.isError ? <p className={styles.error} role="alert">Your latest result could not be loaded.</p> : null}
        </section>
      )}

      {!isStaff && attempts.length ? (
        <section className={styles.card} aria-labelledby="attempt-history-title">
          <div className={styles.historyHeader}><div className={styles.resultHeader}><History size={24}/><div><h2 id="attempt-history-title">Attempt history</h2><p>{attempts.length} of {quiz?.attemptsAllowed ?? attempts.length} used</p></div></div></div>
          <ol className={styles.historyList}>
            {attempts.map(item => (
              <li key={item.id}>
                <div><strong>Attempt {item.attemptNumber}</strong><span>{formatUtcTimestamp(item.submittedAt || item.startedAt)}</span></div>
                <span className={styles.statusBadge} data-status={item.status}>{item.status}</span>
                <button type="button" className={styles.secondaryButton} onClick={() => setSelectedHistoryAttemptId(current => current === item.id ? null : item.id)} aria-expanded={selectedHistoryAttemptId === item.id}>{selectedHistoryAttemptId === item.id ? 'Hide result' : 'View result'}</button>
              </li>
            ))}
          </ol>
          {selectedHistoryAttemptId !== null ? (
            <div className={styles.historyResult} aria-live="polite">
              {historyReceiptQuery.data ? <span>Receipt {historyReceiptQuery.data.receiptId} · {formatUtcTimestamp(historyReceiptQuery.data.submittedAt)}</span> : null}
              {historyReceiptQuery.isError ? <p className={styles.error} role="alert">The submission receipt could not be loaded.</p> : null}
              {historyResultQuery.isPending ? <p>Loading attempt result…</p> : historyResultQuery.isError ? <p className={styles.error} role="alert">This attempt result could not be loaded.</p> : historyResultQuery.data ? <><strong>{historyResultQuery.data.totalScore === null ? 'Score pending or not released' : `${historyResultQuery.data.totalScore} / ${quiz?.totalPoints ?? 0}`}</strong></> : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
};

export default QuizPage;
