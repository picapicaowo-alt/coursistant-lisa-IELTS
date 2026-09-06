import type {ApiError} from '@/apis/types/common';
import {LocalizedError} from '@/i18n/errors';
import i18n from '@/i18n';

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
  if (error instanceof LocalizedError) return error.localizedMessage();
  // Server diagnostics have no locale guarantee. Preserve the original error
  // for status/code handling and render the caller's contextual platform copy.
  return fallback;
};

export const isHttpStatus = (error: unknown, status: number): boolean =>
  isApiError(error) && error.code === status;

export const isNotFound = (error: unknown): boolean =>
  isHttpStatus(error, 404);

/** A hidden resource or unknown 404 must not unlock a first-use creation flow. */
export const isMissingResource = (error: unknown, resourceCode: string): boolean =>
  isNotFound(error) && getApiErrorCode(error) === resourceCode;

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
      return i18n.t('common:http.notFound');
    case 405:
      return i18n.t('common:http.unsupported');
    case 409:
      return i18n.t('common:http.conflict');
    case 500:
      return i18n.t('common:http.serverError');
    default:
      return undefined;
  }
};
