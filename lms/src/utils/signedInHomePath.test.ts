import {describe, expect, it} from 'vitest';
import {getSignedInHomePath, isAdvisorLevel, isCounsellorLevel, isParentLevel} from './signedInHomePath';

describe('getSignedInHomePath', () => {
  it('sends counsellors to the intake dashboard', () => {
    expect(getSignedInHomePath({role: 'USER', level: 'COUNSELLOR'})).toBe('/counsellor');
  });

  it('treats instructor-advisors as advisors', () => {
    expect(isAdvisorLevel('INSTRUCTOR_ADVISOR')).toBe(true);
    expect(getSignedInHomePath({role: 'USER', level: 'INSTRUCTOR_ADVISOR'})).toBe('/advisor/students');
  });

  it('keeps students on the LMS home', () => {
    expect(isCounsellorLevel('STUDENT')).toBe(false);
    expect(getSignedInHomePath({role: 'USER', level: 'STUDENT'})).toBe('/');
  });

  it('sends tenant admins to intake operations', () => {
    expect(getSignedInHomePath({role: 'TENANT_ADMIN', level: 'NOT_APPLICABLE'})).toBe('/admin/intakes');
  });

  it('sends system admins to the authorized course catalogue', () => {
    expect(getSignedInHomePath({role: 'SYSTEM_ADMIN', level: null})).toBe('/course');
  });

  it('keeps unsupported account combinations on a non-business profile route', () => {
    expect(getSignedInHomePath({role: 'ADMIN', level: null})).toBe('/profile');
    expect(getSignedInHomePath({role: 'TENANT_ADMIN', level: 'STUDENT'})).toBe('/admin/intakes');
    expect(getSignedInHomePath({role: 'USER', level: 'NOT_APPLICABLE'})).toBe('/profile');
  });

  it('sends parents to the parent portal', () => {
    expect(isParentLevel('PARENT')).toBe(true);
    expect(getSignedInHomePath({role: 'USER', level: 'PARENT'})).toBe('/parent');
  });
});
