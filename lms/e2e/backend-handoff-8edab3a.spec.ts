import {test, expect} from '@playwright/test';
import {LOCALE_STORAGE_KEY} from '../src/i18n/configuration';
import {openSection} from './disclosure-helpers';

for (const timezoneId of ['America/Los_Angeles', 'Asia/Shanghai']) {
  test.describe(timezoneId, () => {
    test.use({timezoneId});
    test('parent uses structured notifications and UTC calendar instants', async ({page}) => {
      const errors: string[] = [];
      const notificationPages: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(key => {
        localStorage.setItem('user', JSON.stringify({id: 901, userId: 901, role: 'USER', level: 'PARENT', accessToken: 'isolated-contract-fixture'}));
        localStorage.setItem('accToken', 'isolated-contract-fixture');
        if (!localStorage.getItem(key)) localStorage.setItem(key, 'en');
      }, LOCALE_STORAGE_KEY);
      await page.route('**/v2/**', route => {
        const url = new URL(route.request().url());
        let data: unknown = [];
        if (url.pathname.endsWith('/linked-students')) data = {items: [{studentUserId: 301}], page: 0, total: 1};
        else if (url.pathname.endsWith('/notifications')) {
          notificationPages.push(url.searchParams.get('page') ?? '');
          data = {items: [
            {notificationId: 1, notificationType: 'ASSIGNMENT_PUBLISHED', templateVars: {assignmentTitle: 'Authored essay'}, message: 'Backend English text'},
            {notificationId: 2, notificationType: 'ASSIGNMENT_PUBLISHED', templateVars: {}, message: 'Legacy notification'},
            {notificationId: 3, notificationType: 'FUTURE_TYPE', templateVars: {courseTitle: 'Course'}, message: 'Unknown type fallback'},
          ], page: 0, size: 20, total: 3};
        } else if (url.pathname.endsWith('/unread-count')) data = {unreadCount: 3};
        else if (url.pathname.endsWith('/calendar')) {
          expect(url.searchParams.get('timezone')).toBe(timezoneId);
          expect(url.searchParams.has('limit')).toBe(false);
          data = {timezone: timezoneId, fromUtc: '2026-09-01T00:00:00Z', toUtc: '2026-10-01T00:00:00Z', items: [{eventType: 'SESSION', sourceId: 81, occurrenceId: 81, courseId: 71, title: 'UTC class', courseTitle: 'UTC class', timezone: 'America/Los_Angeles', startsAtUtc: '2026-09-10T18:00:00Z', endsAtUtc: '2026-09-10T19:00:00Z'}]};
        }
        return route.fulfill({json: {status: 200, code: 'SUCCESS', data}});
      });
      await page.goto('/parent?section=notifications&studentUserId=301');
      await openSection(page, 'Notifications');
      await expect(page.getByText('Assignment published: Authored essay', {exact: true})).toBeVisible();
      for (const [locale, text] of [['zh-CN', '作业已发布：Authored essay'], ['zh-TW', '作業已發布：Authored essay'], ['en', 'Assignment published: Authored essay']]) {
        await page.evaluate(({key, value}) => {
          localStorage.setItem(key, value);
          window.dispatchEvent(new StorageEvent('storage', {key, newValue: value}));
        }, {key: LOCALE_STORAGE_KEY, value: locale});
        await expect(page.getByText(text, {exact: true})).toBeVisible();
        await expect(page.getByText('Legacy notification', {exact: true})).toBeVisible();
        await expect(page.getByText('Unknown type fallback', {exact: true})).toBeVisible();
        await expect(page.getByText('Backend English text', {exact: true})).toHaveCount(0);
        await page.reload();
        await expect(page.getByText(text, {exact: true})).toBeVisible();
      }
      expect(notificationPages.every(value => value === '0')).toBe(true);
      await page.goto('/parent?section=schedule&studentUserId=301');
      await expect(page.getByText('UTC class', {exact: true})).toBeVisible();
      const expected = timezoneId === 'Asia/Shanghai' ? '2:00 AM – 3:00 AM' : '11:00 AM – 12:00 PM';
      await expect(page.getByText(expected, {exact: true})).toBeVisible();
      await expect(page.getByText(timezoneId, {exact: true})).toBeVisible();
      await page.getByRole('button', {name: 'Request change', exact: true}).click();
      await expect(page.getByText('Timezone: America/Los_Angeles', {exact: true})).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}
