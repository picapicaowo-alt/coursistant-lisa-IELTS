import {getApiErrorMessage, isConflict} from '@/utils/apiError';

const MANAGED_USER_FALLBACK = 'Please try again. Your entries are preserved.';

/** Keeps privileged identity errors actionable without guessing at a backend domain code. */
export const getManagedUserCreateError = (error: unknown): string => {
  const detail = getApiErrorMessage(error, MANAGED_USER_FALLBACK);
  const conflictGuidance = isConflict(error)
    ? ' The email or generated username may already belong to an existing identity.'
    : '';

  return `Managed user was not created. ${detail}${conflictGuidance}`;
};
