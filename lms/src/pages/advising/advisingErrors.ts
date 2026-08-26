import {ADVISING_ERROR_CODES} from '@/apis';
import {getApiErrorCode, getApiErrorMessage} from '@/utils/apiError';

const CODE_COPY: Record<string, string> = {
  [ADVISING_ERROR_CODES.featureDisabled]: 'Writes are not enabled in this environment.',
  [ADVISING_ERROR_CODES.idempotencyMismatch]: 'Retry the same request body, or start a new action with a new key.',
  [ADVISING_ERROR_CODES.userAlreadyExists]: 'A user with this email already exists.',
  [ADVISING_ERROR_CODES.intakeNotFound]: 'This intake is no longer available. If it was just assigned, that is expected.',
  [ADVISING_ERROR_CODES.intakeVersionConflict]: 'Someone else updated this intake. Reload and try again.',
  [ADVISING_ERROR_CODES.alreadyAssigned]: 'This student is already assigned. They have left the unassigned queue.',
  [ADVISING_ERROR_CODES.advisorNotEligible]: 'That advisor is not available. Refresh the advisor list.',
  [ADVISING_ERROR_CODES.intakeNotCancellable]: 'This intake cannot be cancelled.',
  [ADVISING_ERROR_CODES.assignmentVersionConflict]: 'The advisor assignment changed. Reload and try again.',
  [ADVISING_ERROR_CODES.profileAlreadyExists]: 'This student already has a profile. Reload it instead of creating another.',
  [ADVISING_ERROR_CODES.profileRequired]: 'Create a student profile before the study plan.',
  [ADVISING_ERROR_CODES.profileNotFound]: 'No profile yet for this student.',
  [ADVISING_ERROR_CODES.profileVersionConflict]: 'The profile changed. Reload the current version and save again.',
  [ADVISING_ERROR_CODES.intakeRequired]: 'This student has no intake the current advisor can read.',
  [ADVISING_ERROR_CODES.studyPlanAlreadyExists]: 'This student already has a study plan. Reload it instead of creating another.',
  [ADVISING_ERROR_CODES.studyPlanNotFound]: 'No study plan yet for this student.',
  [ADVISING_ERROR_CODES.studyPlanVersionConflict]: 'The study plan changed. Reload the current version and save again.',
  [ADVISING_ERROR_CODES.studyPlanInvalidTimeline]: 'Check the plan start and end dates.',
  [ADVISING_ERROR_CODES.studyPlanChildInvalid]: 'Check checkpoint and task fields, including positions.',
};

export const advisingErrorMessage = (error: unknown, fallback: string): string => {
  const code = getApiErrorCode(error);
  if (code && CODE_COPY[code]) return CODE_COPY[code];
  return getApiErrorMessage(error, fallback);
};
