import {describe, expect, it} from 'vitest';
import {advisingErrorMessage} from './advisingErrors';

describe('advisingErrorMessage', () => {
  it('maps feature-disabled and version conflicts', () => {
    expect(advisingErrorMessage({code: 409, details: {code: 'ADVISING_FEATURE_DISABLED'}}, 'fallback'))
      .toBe('Writes are not enabled in this environment.');
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
});
