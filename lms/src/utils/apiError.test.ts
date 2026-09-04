import {describe, expect, it} from 'vitest';
import {unwrapData} from '@/apis/types/common';
import {
  getApiErrorCode,
  getApiErrorMessage,
  getHttpStatusDescription,
  isApiError,
  isConflict,
  isHttpStatus,
  isMethodNotAllowed,
  isNotFound,
  isTransportOrServerFailure,
} from './apiError';

describe('apiError helpers', () => {
  it('reads envelope codes without treating a transport failure as a domain code', () => {
    expect(getApiErrorCode({code: 400, message: 'Bad request', details: {code: 'INVALID_VERIFICATION_CODE'}}))
      .toBe('INVALID_VERIFICATION_CODE');
    expect(getApiErrorCode(new Error('network'))).toBeUndefined();
    expect(isHttpStatus({code: 404, message: 'missing'}, 404)).toBe(true);
    expect(isNotFound({code: 404, message: 'missing'})).toBe(true);
    expect(isMethodNotAllowed({code: 405, message: 'method not allowed'})).toBe(true);
    expect(isConflict({code: 409, message: 'conflict'})).toBe(true);
    expect(isTransportOrServerFailure({code: 500, message: 'server error'})).toBe(true);
    expect(isApiError({code: 'SUCCESS'})).toBe(false);
  });

  it('prefers a safe details message and otherwise keeps the caller fallback', () => {
    expect(getApiErrorMessage({code: 400, message: 'Bad request', details: {message: 'Code expired'}}, 'Fallback'))
      .toBe('Code expired');
    expect(getApiErrorMessage({code: 0, message: 'Network Error'}, 'Could not save.')).toBe('Could not save.');
    expect(getApiErrorMessage('not-an-error', 'Could not save.')).toBe('Could not save.');
  });

  it.each([0, 500, 502, 503, 504])('keeps HTTP %s diagnostics out of user-facing messages', code => {
    const error = {code, message: 'Request failed with status code 500', details: {message: 'Internal server error', messageEn: 'Database connection failed'}};
    expect(getApiErrorMessage(error, 'Grading queue could not be loaded.')).toBe('Grading queue could not be loaded.');
    expect(error.details.message).toBe('Internal server error');
  });

  it.each([new Error('Internal server error'), new Error('Network Error'), new TypeError('Failed to fetch'), new SyntaxError('Unexpected token <')])('handles generic and browser errors without exposing diagnostics', error => {
    expect(getApiErrorMessage(error, 'Could not load.')).toBe('Could not load.');
  });

  it('keeps malformed payloads as failures while presenting the operation context', () => {
    try {
      unwrapData({status: 200, code: 'SUCCESS', data: null, message: 'OK', timestamp: ''}, 'teachingGradingItems');
      expect.fail('A required payload must not silently become an empty queue');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(getApiErrorMessage(error, 'Grading queue could not be loaded.')).toBe('Grading queue could not be loaded.');
    }
  });

  it.each([
    {code: 400, message: 'Select a course before saving.'},
    {code: 403, message: 'You do not have permission to edit this course.'},
    {code: 409, message: 'Reload the latest plan before saving.'},
  ])('preserves actionable validation, permission, and conflict messages', error => {
    expect(getApiErrorMessage(error, 'Could not save.')).toBe(error.message);
  });

  it('provides sensible human descriptions for HTTP status codes', () => {
    expect(getHttpStatusDescription({code: 404, message: 'Not found'})).toMatch(/not found/i);
    expect(getHttpStatusDescription({code: 405, message: 'Not allowed'})).toMatch(/not supported/i);
    expect(getHttpStatusDescription({code: 409, message: 'Conflict'})).toMatch(/conflict/i);
    expect(getHttpStatusDescription({code: 500, message: 'Error'})).toMatch(/unexpected server error/i);
  });
});
