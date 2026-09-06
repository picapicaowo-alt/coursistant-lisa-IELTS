import i18n from "@/i18n";
import { statusLabel } from "@/i18n/presentation";
import type { ApiError, QuizResponse } from "@/apis";
import { formatDeadline } from "@/utils/datetime";

export type QuizWindowStatus = "draft" | "upcoming" | "open" | "closed";

type QuizWindowFields = Pick<
  QuizResponse,
  "state" | "opensAtUtc" | "closesAtUtc"
> & {
  windowOpen?: boolean;
};

const apiErrorCode = (error: unknown): string | undefined => {
  const details = (error as ApiError | undefined)?.details;
  return details &&
    typeof details === "object" &&
    typeof details.code === "string"
    ? details.code
    : undefined;
};

export const isMissingCurrentAttempt = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const apiError = error as ApiError;
  if (apiError.code !== 404) return false;
  const code = apiErrorCode(error);
  return code === "QUIZ_ATTEMPT_NOT_FOUND" || code === undefined;
};

export const isQuizAttemptNotFound = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const apiError = error as ApiError;
  return (
    apiError.code === 404 && apiErrorCode(error) === "QUIZ_ATTEMPT_NOT_FOUND"
  );
};

export const isQuizAttemptNotInProgress = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const apiError = error as ApiError;
  return (
    apiError.code === 409 &&
    apiErrorCode(error) === "QUIZ_ATTEMPT_NOT_IN_PROGRESS"
  );
};

export const isQuizWindowClosed = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const apiError = error as ApiError;
  return apiError.code === 409 && apiErrorCode(error) === "QUIZ_WINDOW_CLOSED";
};

export const isQuizNotFound = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const apiError = error as ApiError;
  return (
    apiError.code === 404 &&
    (apiErrorCode(error) === "QUIZ_NOT_FOUND" ||
      apiErrorCode(error) === "NOT_FOUND")
  );
};

export const quizQuestionErrorMessage = (error: unknown): string => {
  const code = apiErrorCode(error);
  if (code === "QUIZ_ATTEMPT_NOT_FOUND") {
    return i18n.t("assessment:attempt.notStarted");
  }
  if (code === "QUIZ_ATTEMPT_NOT_IN_PROGRESS") {
    return i18n.t("assessment:attempt.notInProgress");
  }
  if (code === "QUIZ_WINDOW_CLOSED") {
    return i18n.t("assessment:attempt.windowClosed");
  }
  if (code === "QUIZ_NOT_FOUND") {
    return i18n.t("assessment:attempt.unavailable");
  }
  return i18n.t("assessment:attempt.loadFailed");
};

export const isMissingQuizResult = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const apiError = error as ApiError;
  const code = apiErrorCode(error);
  return (
    apiError.code === 404 &&
    (code === "QUIZ_ATTEMPT_NOT_FOUND" ||
      code === "NOT_FOUND" ||
      code === undefined)
  );
};

export const quizWindowStatus = (
  quiz: QuizWindowFields,
  nowMs: number = Date.now(),
): QuizWindowStatus => {
  if (quiz.state !== "Published") return "draft";
  const opens = Date.parse(quiz.opensAtUtc);
  const closes = Date.parse(quiz.closesAtUtc);
  if (quiz.windowOpen === true) return "open";
  if (Number.isFinite(opens) && nowMs < opens) return "upcoming";
  if (Number.isFinite(closes) && nowMs >= closes) return "closed";
  if (quiz.windowOpen === false) return "closed";
  if (
    Number.isFinite(opens) &&
    Number.isFinite(closes) &&
    nowMs >= opens &&
    nowMs < closes
  ) {
    return "open";
  }
  return "closed";
};

export const quizWindowStatusLabel = (status: QuizWindowStatus): string => {
  switch (status) {
    case "draft":
      return statusLabel("Draft");
    case "upcoming":
      return statusLabel("Upcoming");
    case "open":
      return statusLabel("Open");
    case "closed":
      return statusLabel("Closed");
  }
};

export const formatQuizInstant = (atLocal: string, timezone: string): string =>
  formatDeadline(atLocal, timezone);

export const startAttemptErrorMessage = (
  error: unknown,
  quiz:
    | Pick<
        QuizResponse,
        | "opensAtLocal"
        | "closesAtLocal"
        | "timezone"
        | "state"
        | "opensAtUtc"
        | "closesAtUtc"
        | "windowOpen"
      >
    | undefined,
): string => {
  const code = apiErrorCode(error);
  if (code === "QUIZ_ATTEMPTS_EXCEEDED")
    return i18n.t("assessment:attempt.exhausted");
  if (code === "QUIZ_NOT_PUBLISHED")
    return i18n.t("assessment:attempt.notPublished");
  if (code === "QUIZ_WINDOW_CLOSED") {
    const status = quiz ? quizWindowStatus(quiz) : undefined;
    if (status === "upcoming" && quiz) {
      return i18n.t("assessment:attempt.startUpcoming", {
        date: formatQuizInstant(quiz.opensAtLocal, quiz.timezone),
      });
    }
    if (status === "closed" && quiz) {
      return i18n.t("assessment:attempt.startClosed", {
        date: formatQuizInstant(quiz.closesAtLocal, quiz.timezone),
      });
    }
    return i18n.t("assessment:attempt.outsideWindow");
  }
  return i18n.t("assessment:attempt.startFailed");
};
