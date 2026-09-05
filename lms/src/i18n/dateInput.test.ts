import {afterEach, describe, expect, it} from 'vitest';
import i18n from './index';
import {formatInputDate, formatInputDateTime, formatInputTime, inputPattern, parseInputDate, parseInputDateTime, parseInputTime} from './dateInput';

afterEach(async () => {await i18n.changeLanguage('en');});

describe('canonical date input boundary', () => {
  for (const locale of ['en', 'zh-CN', 'zh-TW'] as const) {
    it(`round-trips date and time in ${locale} without shifting the wall-clock value`, async () => {
      await i18n.changeLanguage(locale);
      for (const time of ['00:05', '12:00', '22:19']) {
        const value = `2026-08-03T${time}`;
        expect(parseInputDateTime(formatInputDateTime(value))).toBe(value);
        expect(parseInputTime(formatInputTime(time))).toBe(time);
        expect(new RegExp(`^(?:${inputPattern('datetime')})$`, 'u').test(formatInputDateTime(value))).toBe(true);
      }
      expect(parseInputDate(formatInputDate('2028-02-29'))).toBe('2028-02-29');
      expect(formatInputDateTime('2026-08-03T22:19:45')).toBe(formatInputDateTime('2026-08-03T22:19'));
    });
  }

  it('rejects invalid calendar dates and out-of-range times', () => {
    expect(parseInputDate('2027/02/29')).toBeNull();
    expect(parseInputDate('02/30/2028')).toBeNull();
    expect(parseInputTime('24:00')).toBeNull();
    expect(parseInputTime('12:60 PM')).toBeNull();
  });
});
