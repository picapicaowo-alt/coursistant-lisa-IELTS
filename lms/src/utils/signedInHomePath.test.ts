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

  it('sends parents to the parent portal', () => {
    expect(isParentLevel('PARENT')).toBe(true);
    expect(getSignedInHomePath({role: 'USER', level: 'PARENT'})).toBe('/parent');
  });
});
