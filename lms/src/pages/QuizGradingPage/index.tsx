import { formatNumber } from "@/i18n/formatting";
import { statusLabel } from "@/i18n/presentation";
import { useTranslation } from "react-i18next";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  CheckSquare2,
  Eye,
  RotateCcw,
  Search,
  Send,
  Square,
  Users,
  X,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { QuizAttemptSummary } from "@/apis";
import { unwrapData } from "@/apis";
import { quizApiService } from "@/apis/services/quiz-api";
import { courseApiService } from "@/apis/services/course-api";
import MarkdownMessage from "@/components/MarkdownMessage";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import {
  idempotencyFingerprint,
  useIdempotencyCheckpoint,
} from "@/hooks/useIdempotencyCheckpoint";
import { formatUtcTimestamp } from "@/utils/datetime";
import styles from "./index.module.scss";

interface GradeDraft {
  score: string;
  feedback: string;
}

interface ReviewTarget {
  userId: number;
  attemptId: number;
}

type OwnedQuizAttemptSummary = QuizAttemptSummary & { userId: number };

interface AttemptRosterData {
  attempts: OwnedQuizAttemptSummary[];
  failedUserIds: number[];
}

const loadCourseStudents = async (courseId: number) => {
  const size = 100;
  const first = unwrapData(
    await courseApiService.listCourseMembers(courseId, {
      courseRole: "Student",
      active: true,
      page: 0,
      size,
    }),
    "listCourseMembers page 0",
  );
  const pageCount = Math.ceil(first.total / size);
  if (pageCount <= 1) return first.items;
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, async (_, index) =>
      unwrapData(
        await courseApiService.listCourseMembers(courseId, {
          courseRole: "Student",
          active: true,
          page: index + 1,
          size,
        }),
        `listCourseMembers page ${index + 1}`,
      ),
    ),
  );
  return [first.items, ...rest.map((page) => page.items)].flat();
};

const loadStudentQuizAttempts = async (
  courseId: number,
  quizId: number,
  userId: number,
) => {
  const pageSize = 100;
  const attempts: OwnedQuizAttemptSummary[] = [];
  let page = 1;
  while (true) {
    const batch = unwrapData(
      await quizApiService.listAttempts(courseId, quizId, {
        userId,
        page,
        pageSize,
      }),
      `listAttempts for user ${userId}, page ${page}`,
    );
    attempts.push(...batch.map((attempt) => ({ ...attempt, userId })));
    if (batch.length < pageSize) return attempts;
    page += 1;
  }
};

/**
 * Builds the grading roster from per-student attempt endpoints without letting
 * one unavailable student hide every successful result. Concurrency is capped
 * to keep large courses from issuing an unbounded burst of browser requests.
 */
const loadAllQuizAttempts = async (
  courseId: number,
  quizId: number,
  userIds: number[],
): Promise<AttemptRosterData> => {
  const attempts: OwnedQuizAttemptSummary[] = [];
  const failedUserIds: number[] = [];
  const concurrency = 12;

  for (let start = 0; start < userIds.length; start += concurrency) {
    const batchUserIds = userIds.slice(start, start + concurrency);
    const results = await Promise.allSettled(
      batchUserIds.map((userId) =>
        loadStudentQuizAttempts(courseId, quizId, userId),
      ),
    );
    results.forEach((result, index) => {
      if (result.status === "fulfilled") attempts.push(...result.value);
      else failedUserIds.push(batchUserIds[index]);
    });
  }

  return { attempts, failedUserIds };
};

const QuizGradingPage = () => {
  const { t: translate } = useTranslation();
  const { courseId: courseIdParam, quizId: quizIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const quizId = Number(quizIdParam);
  const valid =
    Number.isInteger(courseId) &&
    courseId > 0 &&
    Number.isInteger(quizId) &&
    quizId > 0;
  const access = useCourseAccess(valid ? courseId : null);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(
    null,
  );
  const [drafts, setDrafts] = useState<Record<number, GradeDraft>>({});
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(
    new Set(),
  );
  const [studentSearch, setStudentSearch] = useState("");
  const deferredStudentSearch = useDeferredValue(studentSearch);
  const [message, setMessage] = useState<{
    key: string;
    tone: "success" | "error";
    count?: number;
  } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const reviewDialogRef = useRef<HTMLElement>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const reviewOpen = reviewTarget !== null;

  useEffect(() => {
    if (!reviewOpen) return;

    const trigger = reviewTriggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(
      () => reviewDialogRef.current?.focus(),
      0,
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setReviewTarget(null);
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = reviewDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [reviewOpen]);

  const quizQuery = useQuery({
    queryKey: ["quiz", courseId, quizId],
    queryFn: async () =>
      unwrapData(await quizApiService.getQuiz(courseId, quizId), "getQuiz"),
    enabled: valid,
  });
  const summaryQuery = useQuery({
    queryKey: ["quiz-grading-summary", courseId, quizId],
    queryFn: async () =>
      unwrapData(
        await quizApiService.getGradingSummary(courseId, quizId),
        "getGradingSummary",
      ),
    enabled: valid && access.canGrade,
  });
  const questionsQuery = useQuery({
    queryKey: ["quiz-questions", courseId, quizId],
    queryFn: async () =>
      unwrapData(
        await quizApiService.listQuestions(courseId, quizId),
        "listQuestions",
      ),
    enabled: valid && access.canGrade,
  });
  const studentsQuery = useQuery({
    queryKey: ["course-students", courseId],
    queryFn: () => loadCourseStudents(courseId),
    enabled: valid && access.canGrade,
  });
  const studentUserIds = useMemo(
    () => (studentsQuery.data ?? []).map((student) => student.userId),
    [studentsQuery.data],
  );
  const attemptsQuery = useQuery({
    queryKey: [
      "quiz-attempts",
      courseId,
      quizId,
      "grading-roster",
      studentUserIds,
    ],
    queryFn: () => loadAllQuizAttempts(courseId, quizId, studentUserIds),
    enabled: valid && access.canGrade && studentsQuery.isSuccess,
    staleTime: 30_000,
  });
  const shortQuestions = useMemo(
    () =>
      (questionsQuery.data ?? []).filter(
        (question) => question.type === "ShortAnswer",
      ),
    [questionsQuery.data],
  );
  const firstShortQuestionId = shortQuestions[0]?.id ?? null;

  useEffect(() => {
    if (selectedQuestionId === null && firstShortQuestionId !== null)
      setSelectedQuestionId(firstShortQuestionId);
  }, [firstShortQuestionId, selectedQuestionId]);

  const answersQuery = useQuery({
    queryKey: ["quiz-short-answers", courseId, quizId, selectedQuestionId],
    queryFn: async () =>
      unwrapData(
        await quizApiService.listShortAnswers(
          courseId,
          quizId,
          selectedQuestionId!,
        ),
        "listShortAnswers",
      ),
    enabled: access.canGrade && selectedQuestionId !== null,
  });

  const reviewResultQuery = useQuery({
    queryKey: [
      "quiz-attempt-result",
      courseId,
      quizId,
      reviewTarget?.attemptId,
    ],
    queryFn: async () =>
      unwrapData(
        await quizApiService.getAttemptResult(
          courseId,
          quizId,
          reviewTarget!.attemptId,
        ),
        "getAttemptResult for grading",
      ),
    enabled: valid && access.canGrade && reviewTarget !== null,
  });
  const reviewAttemptQuery = useQuery({
    queryKey: [
      "quiz-attempt-detail",
      courseId,
      quizId,
      reviewTarget?.attemptId,
    ],
    queryFn: async () =>
      unwrapData(
        await quizApiService.getAttempt(
          courseId,
          quizId,
          reviewTarget!.attemptId,
        ),
        "getAttempt for grading",
      ),
    enabled: valid && access.canGrade && reviewTarget !== null,
  });

  useEffect(() => {
    if (!answersQuery.data) return;
    setDrafts(
      Object.fromEntries(
        answersQuery.data.map((answer) => [
          answer.attemptId,
          {
            score: answer.score === null ? "" : String(answer.score),
            feedback: answer.feedback ?? "",
          },
        ]),
      ),
    );
  }, [answersQuery.data]);

  const gradeAnswer = useMutation({
    mutationFn: ({
      attemptId,
      questionId,
      draft,
    }: {
      attemptId: number;
      questionId: number;
      draft: GradeDraft;
    }) => {
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
    onSuccess: async (_, { attemptId, questionId, draft }) => {
      const request = {
        score: Number(draft.score),
        feedback: draft.feedback.trim() || undefined,
      };
      const operation = `quiz-grade-${courseId}-${quizId}-${attemptId}-${questionId}`;
      idempotency.completeFingerprint(
        operation,
        idempotencyFingerprint(request),
      );
      setMessage({ key: "assessment:quizGrading.saved", tone: "success" });
      await queryClient.invalidateQueries({
        queryKey: ["quiz-short-answers", courseId, quizId, selectedQuestionId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["quiz-grading-summary", courseId, quizId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["quiz-attempt-result", courseId, quizId, attemptId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["quiz-attempt-detail", courseId, quizId, attemptId],
      });
    },
    onError: () =>
      setMessage({ key: "assessment:quizGrading.saveFailed", tone: "error" }),
  });

  const updateRelease = useMutation({
    mutationFn: ({
      action,
      userIds,
    }: {
      action: "release" | "retract";
      userIds?: number[];
    }) => {
      const operation = `quiz-grades-${action}-${courseId}-${quizId}`;
      const fingerprint = idempotencyFingerprint({
        action,
        userIds: userIds ?? [],
      });
      const key = idempotency.keyFor(operation, fingerprint);
      return action === "release"
        ? quizApiService.releaseGrades(courseId, quizId, userIds, key)
        : quizApiService.retractGrades(courseId, quizId, userIds, key);
    },
    onSuccess: async (_, { action, userIds }) => {
      const operation = `quiz-grades-${action}-${courseId}-${quizId}`;
      const fingerprint = idempotencyFingerprint({
        action,
        userIds: userIds ?? [],
      });
      idempotency.completeFingerprint(operation, fingerprint);
      setMessage({
        key:
          action === "release"
            ? userIds
              ? "assessment:quizGrading.releasedSelected"
              : "assessment:quizGrading.released"
            : userIds
              ? "assessment:quizGrading.retractedSelected"
              : "assessment:quizGrading.retracted",
        tone: "success",
        count: userIds?.length,
      });
      setSelectedUserIds(new Set());
      await queryClient.invalidateQueries({
        queryKey: ["quiz-grading-summary", courseId, quizId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["quiz-attempt-result", courseId, quizId],
      });
    },
    onError: () =>
      setMessage({
        key: "assessment:quizGrading.releaseFailed",
        tone: "error",
      }),
  });

  const selectedQuestion = shortQuestions.find(
    (question) => question.id === selectedQuestionId,
  );
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
  const studentRows = useMemo(
    () =>
      (studentsQuery.data ?? []).map((student) => {
        const attempts = attemptsByUserId.get(student.userId) ?? [];
        const finalizedAttempts = attempts.filter(
          (attempt) => attempt.status === "Submitted",
        );
        return {
          student,
          attempts,
          finalizedAttempts,
          latest: finalizedAttempts[0] ?? attempts[0],
        };
      }),
    [attemptsByUserId, studentsQuery.data],
  );
  const visibleStudentRows = useMemo(() => {
    const normalizedSearch = deferredStudentSearch.trim().toLowerCase();
    return normalizedSearch
      ? studentRows.filter(({ student }) =>
          `${student.userName ?? ""} ${student.userEmail ?? ""} ${student.userId}`
            .toLowerCase()
            .includes(normalizedSearch),
        )
      : studentRows;
  }, [deferredStudentSearch, studentRows]);
  const allSelectableUserIds = useMemo(
    () =>
      studentRows
        .filter((row) => row.finalizedAttempts.length > 0)
        .map((row) => row.student.userId),
    [studentRows],
  );
  const allEligibleSelected =
    allSelectableUserIds.length > 0 &&
    allSelectableUserIds.every((userId) => selectedUserIds.has(userId));
  const reviewStudentRow = reviewTarget
    ? studentRows.find((row) => row.student.userId === reviewTarget.userId)
    : undefined;
  const reviewedAttempt = reviewStudentRow?.finalizedAttempts.find(
    (attempt) => attempt.id === reviewTarget?.attemptId,
  );

  if (access.isResolved && !access.canGrade) {
    return (
      <main className={styles.page}>
        <p className={styles.error} role="alert">
          {translate("assessment:quizGrading.noPermission")}
        </p>
      </main>
    );
  }

  const toggleStudent = (userId: number) =>
    setSelectedUserIds((current) => {
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
        <div>
          <p className={styles.eyebrow}>
            {translate("assessment:quizGrading.title")}
          </p>
          <h1>
            {quizQuery.data?.title || translate("assessment:attempt.loading")}
          </h1>
        </div>
        <div className={styles.headerActions}>
          {access.canReleaseGrades ? (
            <>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => updateRelease.mutate({ action: "retract" })}
                disabled={updateRelease.isPending}
              >
                <RotateCcw size={16} />{" "}
                {translate("assessment:quizGrading.retractAll")}
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => updateRelease.mutate({ action: "release" })}
                disabled={
                  updateRelease.isPending ||
                  Boolean(summaryQuery.data?.manualIncompleteAttemptCount)
                }
              >
                <Send size={16} />{" "}
                {translate("assessment:quizGrading.releaseAll")}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <section className={styles.summaryGrid}>
        <div>
          <strong>
            {summaryQuery.data?.submittedAttemptCount != null
              ? formatNumber(summaryQuery.data?.submittedAttemptCount)
              : "—"}
          </strong>
          <span>{translate("assessment:quizGrading.submittedAttempts")}</span>
        </div>
        <div>
          <strong>
            {summaryQuery.data?.pendingShortAnswerCount != null
              ? formatNumber(summaryQuery.data?.pendingShortAnswerCount)
              : "—"}
          </strong>
          <span>{translate("assessment:quizGrading.pendingAnswers")}</span>
        </div>
        <div>
          <strong>
            {summaryQuery.data?.manualIncompleteAttemptCount != null
              ? formatNumber(summaryQuery.data?.manualIncompleteAttemptCount)
              : "—"}
          </strong>
          <span>{translate("assessment:quizGrading.incomplete")}</span>
        </div>
        <div>
          <strong>
            {summaryQuery.data?.releasedUserCount != null
              ? formatNumber(summaryQuery.data?.releasedUserCount)
              : "—"}
          </strong>
          <span>{translate("assessment:quizGrading.releasedUsers")}</span>
        </div>
      </section>

      {message ? (
        <p
          className={message.tone === "error" ? styles.error : styles.success}
          role="status"
        >
          {translate(message.key, {
            count: message.count,
            number:
              message.count == null ? undefined : formatNumber(message.count),
          })}
        </p>
      ) : null}

      {access.canGrade ? (
        <section
          className={styles.card}
          aria-labelledby="student-release-title"
        >
          <div className={styles.cardHeader}>
            <div>
              <h2 id="student-release-title">
                {translate("assessment:quizGrading.resultsTitle")}
              </h2>
              <p>{translate("assessment:quizGrading.resultsHelp")}</p>
            </div>
            {access.canReleaseGrades ? (
              <div className={styles.selectionActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() =>
                    updateRelease.mutate({
                      action: "retract",
                      userIds: [...selectedUserIds],
                    })
                  }
                  disabled={
                    updateRelease.isPending || selectedUserIds.size === 0
                  }
                >
                  <RotateCcw size={16} />{" "}
                  {translate("assessment:grading.retractSelected")}
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() =>
                    updateRelease.mutate({
                      action: "release",
                      userIds: [...selectedUserIds],
                    })
                  }
                  disabled={
                    updateRelease.isPending || selectedUserIds.size === 0
                  }
                >
                  <Send size={16} />{" "}
                  {translate("assessment:grading.releaseSelected")}
                </button>
              </div>
            ) : null}
          </div>
          <div className={styles.rosterToolbar}>
            <label className={styles.searchBox}>
              <Search size={17} />
              <span className={styles.srOnly}>
                {translate("assessment:quizGrading.searchStudents")}
              </span>
              <input
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder={translate("assessment:quizGrading.searchStudents")}
              />
            </label>
            {access.canReleaseGrades ? (
              <>
                <div
                  className={styles.bulkSelection}
                  aria-label={translate("assessment:quizGrading.bulkSelect")}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedUserIds(new Set(allSelectableUserIds))
                    }
                    disabled={
                      allSelectableUserIds.length === 0 || allEligibleSelected
                    }
                  >
                    <CheckSquare2 size={16} />{" "}
                    {translate("assessment:quizGrading.selectEligible", {
                      number: formatNumber(allSelectableUserIds.length),
                    })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUserIds(new Set())}
                    disabled={selectedUserIds.size === 0}
                  >
                    <Square size={16} />{" "}
                    {translate("assessment:quizGrading.clearAll")}
                  </button>
                </div>
                <span className={styles.selectedCount}>
                  <Users size={16} />{" "}
                  {translate("assessment:quizGrading.selected", {
                    number: formatNumber(selectedUserIds.size),
                  })}
                </span>
              </>
            ) : null}
          </div>
          {studentsQuery.isPending || attemptsQuery.isPending ? (
            <p className={styles.empty}>
              {translate("assessment:quizGrading.loadingResults")}
            </p>
          ) : studentsQuery.isError || attemptsQuery.isError ? (
            <div className={styles.inlineError} role="alert">
              <p>{translate("assessment:quizGrading.resultsFailed")}</p>
              <button
                type="button"
                onClick={() => {
                  void studentsQuery.refetch();
                  void attemptsQuery.refetch();
                }}
              >
                {translate("common:actions.tryAgain")}
              </button>
            </div>
          ) : visibleStudentRows.length === 0 ? (
            <p className={styles.empty}>
              {translate("assessment:quizGrading.noStudents")}
            </p>
          ) : (
            <ul className={styles.studentList}>
              {visibleStudentRows.map((row) => {
                const selectable = row.finalizedAttempts.length > 0;
                const studentName =
                  row.student.userName ||
                  translate("common:people.userFallback", {
                    id: row.student.userId,
                  });
                return (
                  <li key={row.student.userId}>
                    <div className={styles.studentIdentity}>
                      {access.canReleaseGrades ? (
                        <input
                          type="checkbox"
                          aria-label={translate(
                            "assessment:grading.selectName",
                            { name: studentName },
                          )}
                          checked={selectedUserIds.has(row.student.userId)}
                          disabled={!selectable}
                          onChange={() => toggleStudent(row.student.userId)}
                        />
                      ) : null}
                      <span>
                        <strong>{studentName}</strong>
                        <small>
                          {row.student.userEmail ||
                            translate("common:records.user", {
                              id: row.student.userId,
                            })}
                        </small>
                      </span>
                    </div>
                    <div className={styles.studentResultActions}>
                      <span className={styles.attemptStatus}>
                        {row.latest
                          ? translate("assessment:quizGrading.finalized", {
                              number: formatNumber(
                                row.finalizedAttempts.length,
                              ),
                              status: statusLabel(row.latest.status),
                            })
                          : translate("assessment:quizGrading.noAttempts")}
                      </span>
                      {row.finalizedAttempts[0] ? (
                        <button
                          type="button"
                          className={styles.reviewButton}
                          onClick={(event) => {
                            reviewTriggerRef.current = event.currentTarget;
                            setReviewTarget({
                              userId: row.student.userId,
                              attemptId: row.finalizedAttempts[0].id,
                            });
                          }}
                          aria-label={translate(
                            "assessment:quizGrading.reviewName",
                            { name: studentName },
                          )}
                          aria-haspopup="dialog"
                          aria-expanded={
                            reviewTarget?.userId === row.student.userId
                          }
                        >
                          <Eye size={16} />{" "}
                          {translate("assessment:quizGrading.review")}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {attemptsQuery.data?.failedUserIds.length ? (
            <div className={styles.inlineError} role="alert">
              <p>
                {translate("assessment:quizGrading.historiesFailed", {
                  count: attemptsQuery.data.failedUserIds.length,
                  number: formatNumber(attemptsQuery.data.failedUserIds.length),
                })}
              </p>
              <button
                type="button"
                onClick={() => void attemptsQuery.refetch()}
              >
                {translate("common:actions.tryAgain")}
              </button>
            </div>
          ) : null}

          {reviewTarget && reviewStudentRow && typeof document !== "undefined"
            ? createPortal(
                <div
                  className={styles.reviewBackdrop}
                  role="presentation"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget)
                      setReviewTarget(null);
                  }}
                >
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
                        <p>{translate("assessment:quizGrading.reviewTitle")}</p>
                        <h3 id="attempt-review-title">
                          {reviewStudentRow.student.userName ||
                            translate("common:people.userFallback", {
                              id: reviewStudentRow.student.userId,
                            })}
                        </h3>
                        <small id="attempt-review-student">
                          {reviewStudentRow.student.userEmail ||
                            translate("common:records.user", {
                              id: reviewStudentRow.student.userId,
                            })}
                        </small>
                      </div>
                      <div className={styles.reviewHeaderActions}>
                        <label>
                          <span>
                            {translate(
                              "detailWorkspace:assignmentSubmit.attempt",
                            )}
                          </span>
                          <select
                            value={reviewTarget.attemptId}
                            onChange={(event) =>
                              setReviewTarget({
                                ...reviewTarget,
                                attemptId: Number(event.target.value),
                              })
                            }
                          >
                            {reviewStudentRow.finalizedAttempts.map(
                              (attempt) => (
                                <option key={attempt.id} value={attempt.id}>
                                  {translate("common:records.attempt", {
                                    number: formatNumber(attempt.attemptNumber),
                                  })}{" "}
                                  · {statusLabel(attempt.status)}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <button
                          type="button"
                          className={styles.closeReviewButton}
                          onClick={() => setReviewTarget(null)}
                          aria-label={translate(
                            "assessment:quizGrading.closeReview",
                          )}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>

                    {reviewResultQuery.isPending ||
                    reviewAttemptQuery.isPending ? (
                      <p className={styles.empty}>
                        {translate("assessment:attempt.loadingResult")}
                      </p>
                    ) : reviewResultQuery.isError ||
                      reviewAttemptQuery.isError ? (
                      <div className={styles.inlineError} role="alert">
                        <p>
                          {translate("assessment:attempt.historyResultFailed")}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            void reviewResultQuery.refetch();
                            void reviewAttemptQuery.refetch();
                          }}
                        >
                          {translate("common:actions.tryAgain")}
                        </button>
                      </div>
                    ) : reviewResultQuery.data && reviewAttemptQuery.data ? (
                      <>
                        <div className={styles.resultSummary}>
                          <div>
                            <span>
                              {translate("assessment:quizGrading.totalScore")}
                            </span>
                            <strong>
                              {reviewAttemptQuery.data.totalScore != null
                                ? formatNumber(
                                    reviewAttemptQuery.data.totalScore,
                                  )
                                : "—"}{" "}
                              /{" "}
                              {quizQuery.data?.totalPoints != null
                                ? formatNumber(quizQuery.data?.totalPoints)
                                : "—"}
                            </strong>
                          </div>
                          <div>
                            <span>
                              {translate("assessment:quizGrading.autoScore")}
                            </span>
                            <strong>
                              {reviewAttemptQuery.data.autoScore != null
                                ? formatNumber(
                                    reviewAttemptQuery.data.autoScore,
                                  )
                                : "—"}
                            </strong>
                          </div>
                          <div>
                            <span>
                              {translate("assessment:quizGrading.manualScore")}
                            </span>
                            <strong>
                              {reviewAttemptQuery.data.manualScore != null
                                ? formatNumber(
                                    reviewAttemptQuery.data.manualScore,
                                  )
                                : "—"}
                            </strong>
                          </div>
                          <div>
                            <span>
                              {translate("assessment:grading.status")}
                            </span>
                            <strong>
                              {reviewResultQuery.data.gradeStatus
                                ? statusLabel(
                                    reviewResultQuery.data.gradeStatus,
                                  )
                                : translate("course:learning.notReleased")}
                            </strong>
                          </div>
                        </div>
                        {!reviewAttemptQuery.data.manualGradingComplete ? (
                          <p className={styles.pendingNotice}>
                            {translate("assessment:quizGrading.incompleteHelp")}
                          </p>
                        ) : null}
                        {reviewedAttempt?.submittedAt ? (
                          <p className={styles.reviewTimestamp}>
                            {translate("common:records.submittedAt", {
                              date: formatUtcTimestamp(
                                reviewedAttempt.submittedAt,
                              ),
                            })}
                          </p>
                        ) : null}
                        <ol className={styles.resultQuestions}>
                          {reviewResultQuery.data.questions.map(
                            (resultQuestion, index) => {
                              const question = questionsQuery.data?.find(
                                (item) => item.id === resultQuestion.questionId,
                              );
                              const selectedOptions = new Set(
                                resultQuestion.selectedOptionIds ?? [],
                              );
                              const correctOptions = new Set(
                                resultQuestion.correctOptionIds ??
                                  question?.options
                                    .filter((option) => option.isCorrect)
                                    .map((option) => option.id) ??
                                  [],
                              );
                              return (
                                <li key={resultQuestion.questionId}>
                                  <div className={styles.resultQuestionHeader}>
                                    <div>
                                      <span>
                                        {translate("common:records.question", {
                                          number: formatNumber(
                                            question?.position ?? index + 1,
                                          ),
                                        })}
                                      </span>
                                      <MarkdownMessage
                                        content={
                                          question?.stem ||
                                          translate("common:records.question", {
                                            number: formatNumber(index + 1),
                                          })
                                        }
                                      />
                                    </div>
                                    <strong>
                                      {resultQuestion.score != null
                                        ? formatNumber(resultQuestion.score)
                                        : "—"}{" "}
                                      / {formatNumber(resultQuestion.points)}
                                    </strong>
                                  </div>
                                  {resultQuestion.type === "ShortAnswer" ? (
                                    <div className={styles.shortAnswerResult}>
                                      <span>
                                        {translate(
                                          "assessment:quizGrading.studentAnswer",
                                        )}
                                      </span>
                                      {resultQuestion.textAnswer ? (
                                        <MarkdownMessage
                                          content={resultQuestion.textAnswer}
                                        />
                                      ) : (
                                        <p>
                                          {translate(
                                            "assessment:quizGrading.noAnswer",
                                          )}
                                        </p>
                                      )}
                                    </div>
                                  ) : question?.options.length ? (
                                    <ul className={styles.resultOptions}>
                                      {question.options.map((option) => {
                                        const selected = selectedOptions.has(
                                          option.id,
                                        );
                                        const correct = correctOptions.has(
                                          option.id,
                                        );
                                        return (
                                          <li
                                            key={option.id}
                                            data-selected={selected}
                                            data-correct={correct}
                                          >
                                            <span
                                              className={styles.optionIndicator}
                                              aria-hidden="true"
                                            >
                                              {selected ? "●" : "○"}
                                            </span>
                                            <MarkdownMessage
                                              content={option.label}
                                            />
                                            <span
                                              className={styles.optionLabels}
                                            >
                                              {selected ? (
                                                <em>
                                                  {translate(
                                                    "assessment:quizGrading.studentAnswer",
                                                  )}
                                                </em>
                                              ) : null}
                                              {correct ? (
                                                <em>
                                                  {translate(
                                                    "common:admin.examFields.correctAnswer",
                                                  )}
                                                </em>
                                              ) : null}
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : (
                                    <p className={styles.empty}>
                                      {translate(
                                        "assessment:quizGrading.answerUnavailable",
                                      )}
                                    </p>
                                  )}
                                </li>
                              );
                            },
                          )}
                        </ol>
                      </>
                    ) : null}
                  </section>
                </div>,
                document.body,
              )
            : null}
        </section>
      ) : null}

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2>{translate("assessment:quizGrading.shortTitle")}</h2>
            <p>{translate("assessment:quizGrading.autoGradingHelp")}</p>
          </div>
          {shortQuestions.length ? (
            <label>
              <span>{translate("assessment:quiz.question")}</span>
              <select
                value={selectedQuestionId ?? ""}
                onChange={(event) =>
                  setSelectedQuestionId(Number(event.target.value))
                }
              >
                {shortQuestions.map((question) => (
                  <option key={question.id} value={question.id}>
                    {formatNumber(question.position)}. {question.stem}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {!shortQuestions.length ? (
          <p className={styles.empty}>
            {translate("assessment:quizGrading.noShortQuestions")}
          </p>
        ) : answersQuery.isError ? (
          <p className={styles.error} role="alert">
            {translate("assessment:quizGrading.shortFailed")}
          </p>
        ) : (answersQuery.data ?? []).length === 0 ? (
          <p className={styles.empty}>
            {translate("assessment:quizGrading.noShortAnswers")}
          </p>
        ) : (
          <div className={styles.answerList}>
            {answersQuery.data?.map((answer) => {
              const draft = drafts[answer.attemptId] ?? {
                score: "",
                feedback: "",
              };
              return (
                <article key={answer.attemptId} className={styles.answerCard}>
                  <div className={styles.answerHeading}>
                    <div>
                      <strong>
                        {translate("common:records.user", {
                          id: answer.userId,
                        })}
                      </strong>
                      <span>
                        {translate("common:records.attempt", {
                          number: formatNumber(answer.attemptId),
                        })}
                      </span>
                    </div>
                    {answer.pendingManual ? (
                      <span className={styles.pending}>
                        {translate("dashboard:queue.needsGrading")}
                      </span>
                    ) : (
                      <span className={styles.graded}>
                        <CheckCircle2 size={15} />{" "}
                        {translate("common:status.GRADED")}
                      </span>
                    )}
                  </div>
                  <blockquote>
                    {answer.textAnswer ||
                      translate("assessment:quizGrading.noText")}
                  </blockquote>
                  <div className={styles.gradeControls}>
                    <label>
                      <span>
                        {translate("assessment:quizGrading.scoreOutOf", {
                          maximum: formatNumber(selectedQuestion?.points ?? 0),
                        })}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max={selectedQuestion?.points ?? undefined}
                        step="0.5"
                        value={draft.score}
                        onChange={(event) =>
                          setDrafts((previous) => ({
                            ...previous,
                            [answer.attemptId]: {
                              ...draft,
                              score: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>
                        {translate(
                          "course:assignmentSubmissionDetail.feedback",
                        )}
                      </span>
                      <input
                        value={draft.feedback}
                        onChange={(event) =>
                          setDrafts((previous) => ({
                            ...previous,
                            [answer.attemptId]: {
                              ...draft,
                              feedback: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={
                        gradeAnswer.isPending ||
                        draft.score === "" ||
                        Number(draft.score) < 0 ||
                        Number(draft.score) > (selectedQuestion?.points ?? 0)
                      }
                      onClick={() =>
                        gradeAnswer.mutate({
                          attemptId: answer.attemptId,
                          questionId: answer.questionId,
                          draft,
                        })
                      }
                    >
                      {translate("assessment:grading.save")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};

export default QuizGradingPage;
