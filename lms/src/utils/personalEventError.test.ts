import {describe, expect, it} from 'vitest';
import {personalEventErrorKey} from './personalEventError';

describe('personal event failure copy', () => {
  it.each([
    ['PARAM_MISSING', 'requestVersionMissing'],
    ['BAD_REQUEST', 'requestVersionInvalid'],
    ['PERSONAL_EVENT_VERSION_CONFLICT', 'versionConflict'],
  ])('distinguishes %s', (code, key) => {
    expect(personalEventErrorKey({code: code === 'PERSONAL_EVENT_VERSION_CONFLICT' ? 409 : 400, details: {code}}, true)).toBe(`calendar:editor.${key}`);
  });
  it('keeps deletion failures distinct from save failures', () => {
    expect(personalEventErrorKey({code: 500}, true)).toBe('calendar:editor.deleteFailed');
    expect(personalEventErrorKey({code: 400, details: {code: 'BAD_REQUEST'}}, false)).toBe('calendar:editor.saveFailed');
    expect(personalEventErrorKey({code: 500}, false)).toBe('calendar:editor.saveFailed');
  });
});
