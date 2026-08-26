import {describe, expect, it} from 'vitest';
import {advisingErrorMessage} from './advisingErrors';

describe('advisingErrorMessage', () => {
  it('maps feature-disabled and version conflicts', () => {
    expect(advisingErrorMessage({code: 409, details: {code: 'ADVISING_FEATURE_DISABLED'}}, 'fallback'))
      .toBe('Writes are not enabled in this environment.');
    expect(advisingErrorMessage({code: 409, details: {code: 'STUDENT_INTAKE_VERSION_CONFLICT'}}, 'fallback'))
      .toBe('Someone else updated this intake. Reload and try again.');
  });
});
