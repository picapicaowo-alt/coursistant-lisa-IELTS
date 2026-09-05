import {afterEach, describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import {teachingAlertTitle} from './teachingAlert';

afterEach(async () => {await i18n.changeLanguage('en');});
describe('live teaching alert labels', () => {
  it('renders kind and counts without missing-data labels', () => {
    expect(teachingAlertTitle({kind: 'PENDING_GRADING', pendingCount: 1})).toBe('1 submission awaiting grading');
    expect(teachingAlertTitle({kind: 'PENDING_GRADING', pendingCount: 2})).toBe('2 submissions awaiting grading');
    expect(teachingAlertTitle({kind: 'UPCOMING_CLASS', courseCode: 'QA-ONE'})).toBe('Upcoming class · QA-ONE');
  });
  it.each([['zh-CN', '即将上课'], ['zh-TW', '即將上課']] as const)('follows %s without translating course identifiers', async (locale, label) => {
    await i18n.changeLanguage(locale);
    expect(teachingAlertTitle({kind: 'UPCOMING_CLASS', courseCode: 'QA-ONE'})).toBe(`${label} · QA-ONE`);
  });
  it('preserves supplied text and has a contextual unknown-kind fallback', () => {
    expect(teachingAlertTitle({message: 'Teacher-authored note', kind: 'UPCOMING_CLASS'})).toBe('Teacher-authored note');
    expect(teachingAlertTitle({kind: 'FUTURE_SIGNAL'})).toBe('Teaching update');
  });
});
