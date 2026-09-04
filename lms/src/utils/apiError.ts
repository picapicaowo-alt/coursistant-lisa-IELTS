import {ApiResponseDataError, type ApiError} from '@/apis/types/common';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isApiError = (error: unknown): error is ApiError => {
  if (!isRecord(error)) return false;
  return typeof error.code === 'number';
};

export const getApiErrorCode = (error: unknown): string | undefined => {
  if (!isApiError(error) || !isRecord(error.details)) return undefined;
  return typeof error.details.code === 'string' ? error.details.code : undefined;
};

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  // Transport/server diagnostics do not tell a learner or staff member what
  // failed. Keep the original error for diagnostics; show the caller's context.
  if (isTransportOrServerFailure(error) || error instanceof ApiResponseDataError || error instanceof TypeError || error instanceof SyntaxError) return fallback;
  if (!isApiError(error)) {
    return error instanceof Error ? presentErrorMessage(error.message, fallback) : fallback;
  }
  if (isRecord(error.details)) {
    if (typeof error.details.message === 'string' && error.details.message.trim()) {
      return presentErrorMessage(error.details.message, fallback);
    }
    if (typeof error.details.messageEn === 'string' && error.details.messageEn.trim()) {
      return presentErrorMessage(error.details.messageEn, fallback);
    }
  }
  return presentErrorMessage(error.message, fallback);
};

// Some legacy callers pass Error without the HTTP status. Recognize only
// generic transport diagnostics; preserve useful validation and domain copy.
const presentErrorMessage = (message: string | undefined, fallback: string): string => {
  if (!message?.trim()) return fallback;
  return /^(?:internal server error|network error|failed to fetch|load failed|request failed with status code \d{3})(?:[.!:]|$)/i.test(message.trim()) ? fallback : message;
};

export const isHttpStatus = (error: unknown, status: number): boolean =>
  isApiError(error) && error.code === status;

export const isNotFound = (error: unknown): boolean =>
  isHttpStatus(error, 404);

export const isMethodNotAllowed = (error: unknown): boolean =>
  isHttpStatus(error, 405);

export const isConflict = (error: unknown): boolean =>
  isHttpStatus(error, 409);

export const isTransportOrServerFailure = (error: unknown): boolean =>
  isApiError(error) && (error.code === 0 || error.code >= 500);

export const getHttpStatusDescription = (error: unknown): string | undefined => {
  if (!isApiError(error)) return undefined;
  switch (error.code) {
    case 404:
      return 'The requested resource was not found or is not available.';
    case 405:
      return 'The requested action is not supported for this resource.';
    case 409:
      return 'A conflict occurred. The resource may have been updated by another user.';
    case 500:
      return 'An unexpected server error occurred. Please try again later.';
    default:
      return undefined;
  }
};
