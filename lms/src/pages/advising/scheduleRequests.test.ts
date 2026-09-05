import {expect, it} from 'vitest';
import {isAdvisorSchedulePending} from './scheduleRequests';

it('admits Advisor pending requests and excludes Instructor pending and processed requests', () => {
  expect(isAdvisorSchedulePending('PENDING_ADVISOR')).toBe(true);
  expect(isAdvisorSchedulePending('PENDING')).toBe(true);
  for (const status of [undefined, '', 'UNKNOWN', 'PENDING_INSTRUCTOR', 'APPROVED', 'REJECTED', 'CANCELLED']) expect(isAdvisorSchedulePending(status)).toBe(false);
});
