import i18n from '@/i18n';
import {ADVISING_ERROR_CODES} from '@/apis';
import {getApiErrorCode, getApiErrorMessage, isTransportOrServerFailure} from '@/utils/apiError';

const CODE_COPY: Record<string, string> = {
  INVALID_TOKEN: "advising:errors.sessionExpired",
  FORBIDDEN: "advising:errors.forbidden",
  ACCESS_DENIED: "advising:errors.forbidden",
  [ADVISING_ERROR_CODES.featureDisabled]: "advising:errors.featureDisabled",
  [ADVISING_ERROR_CODES.idempotencyMismatch]: "advising:errors.idempotencyMismatch",
  [ADVISING_ERROR_CODES.userAlreadyExists]: "advising:errors.userAlreadyExists",
  [ADVISING_ERROR_CODES.intakeNotFound]: "advising:errors.intakeNotFound",
  [ADVISING_ERROR_CODES.intakeVersionConflict]: "advising:errors.intakeVersionConflict",
  [ADVISING_ERROR_CODES.alreadyAssigned]: "advising:errors.alreadyAssigned",
  [ADVISING_ERROR_CODES.advisorNotEligible]: "advising:errors.advisorNotEligible",
  [ADVISING_ERROR_CODES.intakeNotCancellable]: "advising:errors.intakeNotCancellable",
  [ADVISING_ERROR_CODES.assignmentVersionConflict]: "advising:errors.assignmentVersionConflict",
  [ADVISING_ERROR_CODES.profileAlreadyExists]: "advising:errors.profileAlreadyExists",
  [ADVISING_ERROR_CODES.profileRequired]: "advising:errors.profileRequired",
  [ADVISING_ERROR_CODES.profileNotFound]: "advising:errors.profileNotFound",
  [ADVISING_ERROR_CODES.profileVersionConflict]: "advising:errors.profileVersionConflict",
  [ADVISING_ERROR_CODES.intakeRequired]: "advising:errors.intakeRequired",
  [ADVISING_ERROR_CODES.studyPlanAlreadyExists]: "advising:errors.studyPlanAlreadyExists",
  [ADVISING_ERROR_CODES.studyPlanNotFound]: "advising:errors.studyPlanNotFound",
  [ADVISING_ERROR_CODES.studyPlanVersionConflict]: "advising:errors.studyPlanVersionConflict",
  [ADVISING_ERROR_CODES.studyPlanInvalidTimeline]: "advising:errors.studyPlanInvalidTimeline",
  [ADVISING_ERROR_CODES.studyPlanChildInvalid]: "advising:errors.studyPlanChildInvalid",
};

export const advisingErrorMessage = (error: unknown, fallback: string): string => {
  const code = getApiErrorCode(error);
  if (code && CODE_COPY[code]) return i18n.t(CODE_COPY[code]);
  // Server/transport diagnostics are not reliable user instructions. Keep the
  // contextual failure message while retaining known validation/permission copy.
  if (isTransportOrServerFailure(error)) return fallback;
  return getApiErrorMessage(error, fallback);
};
