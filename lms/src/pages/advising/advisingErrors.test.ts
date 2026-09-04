import {describe, expect, it} from 'vitest';
import {advisingErrorMessage} from './advisingErrors';

describe('advisingErrorMessage', () => {
  it('maps feature-disabled and version conflicts', () => {
    expect(advisingErrorMessage({code: 409, details: {code: 'ADVISING_FEATURE_DISABLED'}}, 'fallback'))
      .toBe('This action is not available yet.');
    expect(advisingErrorMessage({code: 409, details: {code: 'STUDENT_INTAKE_VERSION_CONFLICT'}}, 'fallback'))
      .toBe('Someone else updated this intake. Reload and try again.');
  });

  it.each(['FORBIDDEN', 'ACCESS_DENIED'])('maps %s to explicit permission copy', code => {
    expect(advisingErrorMessage({code: 403, details: {code}}, 'fallback'))
      .toBe('You do not have permission to use this feature.');
  });

  it('maps an invalid token to an explicit sign-in instruction', () => {
    expect(advisingErrorMessage({code: 401, details: {code: 'INVALID_TOKEN'}}, 'fallback'))
      .toBe('Your session has expired. Sign in again.');
  });

  it.each([0, 500, 502])('uses the contextual message for transport/server failure %s', status => {
    expect(advisingErrorMessage({code: status, details: {message: 'Internal exception: course does not exist'}}, 'Class dates could not be loaded.'))
      .toBe('Class dates could not be loaded.');
  });

  it('keeps actionable field validation returned for a rejected write', () => {
    expect(advisingErrorMessage({code: 400, details: {message: 'End date must follow start date.'}}, 'Could not save.'))
      .toBe('End date must follow start date.');
  });
});
