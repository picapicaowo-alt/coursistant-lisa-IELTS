import {describe, expect, it} from 'vitest';
import {formatCourseTime} from './courseTime';

describe('course wall-clock time', () => {
  it.each([
    ['00:00:00', '12:00 AM'],
    ['09:05', '9:05 AM'],
    ['12:00:00', '12:00 PM'],
    ['23:59:00', '11:59 PM'],
    ['25:00', '25:00'],
    ['invalid', 'invalid'],
    [undefined, 'Not provided'],
  ])('formats %s without a timezone conversion', (input, expected) => {
    expect(formatCourseTime(input)).toBe(expected);
  });
});
