import {expect, it} from 'vitest';
import {formatInstructorName} from './personName';
it('uses structured course Instructor names with display-only legacy compatibility', () => {
  expect(formatInstructorName({instructorFirstName: 'Sarah', instructorLastName: 'Lim', name: 'Outdated display'})).toBe('Sarah Lim');
  expect(formatInstructorName({name: 'Legacy Instructor'})).toBe('Legacy Instructor');
  expect(formatInstructorName(null, 'Not assigned')).toBe('Not assigned');
});
