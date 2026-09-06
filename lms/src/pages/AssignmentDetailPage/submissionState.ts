import i18n from "@/i18n";
import { statusLabel } from "@/i18n/presentation";
import type {
  ApiError,
  AssignmentDetail,
  StagingFile,
  SubmissionState,
} from "@/apis";

/**
 * The live 8081 API currently answers the submission-detail route with this
 * 404 when a student has never submitted. That is an empty state, not an
 * unavailable service. Keep this check narrow so real 404s still surface.
 */
export const isNoFormalSubmissionError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const apiError = error as ApiError;
  const responseCode = apiError.details?.code;
  const responseMessage = apiError.details?.message;

  return (
    apiError.code === 404 &&
    responseCode === "NOT_FOUND" &&
    typeof responseMessage === "string" &&
    responseMessage.toLowerCase().includes("no formal submission yet")
  );
};

export const buildEmptySubmissionState = (
  assignment: AssignmentDetail,
  ownerUserId: number,
  stagingFiles: StagingFile[] = [],
): SubmissionState => ({
  assignmentId: assignment.id,
  ownerUserId,
  submissionEligibility: assignment.submissionEligibility,
  submissionStatus:
    assignment.submissionStatus ??
    (assignment.acceptingSubmissions ? "NotSubmitted" : "NotSubmittedClosed"),
  dueAtUtc: assignment.dueAtUtc,
  lateUntilUtc: assignment.lateUntilUtc,
  dueAtLocal: assignment.dueAtLocal,
  lateUntilLocal: assignment.lateUntilLocal,
  timezone: assignment.timezone,
  windowOpen: assignment.windowOpen ?? false,
  acceptingSubmissions: assignment.acceptingSubmissions ?? false,
  graceWindowActive: false,
  submitFrozen: assignment.submissionEligibility === "Frozen",
  maxFileCount: assignment.maxFileCount,
  maxFileSizeBytes: assignment.maxFileSizeBytes,
  allowedFileTypes: assignment.allowedFileTypes,
  totalVersions: 0,
  stagingFiles,
});

export const formatSubmissionStatus = (status?: string): string => {
  switch (status) {
    case "NotSubmittedClosed":
      return i18n.t("assessment:submission.closed");
    case "NotSubmitted":
      return i18n.t("common:status.NOT_SUBMITTED");
    case "SubmittedLate":
      return i18n.t("assessment:submission.submittedLate");
    default:
      return status
        ? statusLabel(status)
        : i18n.t("assessment:submission.loadingStatus");
  }
};
