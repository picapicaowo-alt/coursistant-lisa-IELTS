import {expect, test} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';
import {tx} from './i18n-fixture';

for (const scenario of [
  {zone: 'America/Los_Angeles', locale: 'en', text: 'Sep 5, 12:36 AM PDT'},
  {zone: 'Asia/Shanghai', locale: 'zh-CN', text: '9月5日 GMT+8 15:36'},
  {zone: 'Asia/Taipei', locale: 'zh-TW', text: '9月5日 下午3:36 [GMT+8]'},
]) {
  test.describe(`${scenario.locale} activity time in ${scenario.zone}`, () => {
    test.use({timezoneId: scenario.zone});
    test('course-local and offset timestamps represent the same past event after reload', async ({page}) => {
      await fixture(page, 'INSTRUCTOR', 'Instructor');
      await page.addInitScript(locale => localStorage.setItem('coursistant.locale', locale), scenario.locale);
      await page.clock.setFixedTime(new Date('2026-09-05T08:00:00Z'));
      await page.route('**/v2/me/teaching/activity/recent**', route => route.fulfill({json: reply([
        {kind: 'GroupMembershipChange', courseId: 71, courseCode: 'WR101', summary: 'Course local event', occurredAt: '2026-09-05T15:36:24', timezone: 'Asia/Shanghai', groupSetId: 81},
        {kind: 'GroupMembershipChange', courseId: 71, courseCode: 'WR101', summary: 'Offset event', occurredAt: '2026-09-05T07:36:24Z', timezone: 'Asia/Shanghai', groupSetId: 81},
      ])}));
      await page.goto('/');
      const activity = page.getByRole('region', {name: tx(scenario.locale, 'dashboard:recentActivity'), exact: true});
      await expect(activity.getByRole('link').first()).toContainText(scenario.text);
      await expect(activity.locator('time')).toHaveCount(2);
      for (const item of await activity.locator('time').all()) {
        await expect(item).toHaveAttribute('dateTime', '2026-09-05T07:36:24.000Z');
        await expect(item).toHaveText(scenario.text);
      }
      await page.reload();
      await expect(activity.getByRole('link').first()).toContainText(scenario.text);
    });
  });
}
