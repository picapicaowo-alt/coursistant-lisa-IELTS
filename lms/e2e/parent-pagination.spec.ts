import {test, expect} from '@playwright/test';
import {openSection} from './disclosure-helpers';

test('parent cursor messages and paginated notifications remain usable after switching sections', async ({page}) => {
  const response = (data: unknown) => ({status: 200, code: 'SUCCESS', data});
  const errors: string[] = [];
  const cursors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const user = {id: 901, userId: 901, role: 'USER', level: 'PARENT', accessToken: 'parent-pagination-fixture'};
    localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('accToken', user.accessToken);
  });
  await page.route('**/v2/**', route => {
    const url = new URL(route.request().url());
    let data: unknown = [];
    if (url.pathname.endsWith('/linked-students')) data = {items: [{studentUserId: 301}], page: 0, size: 20, total: 1};
    else if (url.pathname.endsWith('/conversation/messages')) {
      const before = url.searchParams.get('beforeId');
      if (before) cursors.push(before);
      data = before ? {items: [{messageId: 9, body: 'Earlier advising message'}], nextBeforeId: null, hasMore: false} : {items: [{messageId: 10, body: 'Latest advising message'}], nextBeforeId: 10, hasMore: true};
    } else if (url.pathname.endsWith('/notifications')) data = {items: [{notificationId: 31, message: url.searchParams.get('page') === '1' ? 'Earlier notification' : 'New academic update'}], page: Number(url.searchParams.get('page') ?? 0), size: 20, total: 21};
    else if (url.pathname.endsWith('/unread-count')) data = {unreadCount: 1};
    return route.fulfill({json: response(data)});
  });
  await page.goto('/parent');
  await page.getByRole('button', {name: 'Messages', exact: true}).click();
  await openSection(page, 'Conversation');
  await expect(page.getByText('Latest advising message')).toBeVisible();
  await page.getByRole('button', {name: 'Load older messages'}).click();
  await expect(page.getByText('Earlier advising message')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Load older messages'})).toHaveCount(0);
  expect(cursors).toEqual(['10']);
  await page.getByRole('button', {name: 'Overview', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Student progress'})).toBeVisible();
  await page.getByRole('button', {name: 'Notifications', exact: true}).last().click();
  await openSection(page, 'Notifications');
  await expect(page.getByText('New academic update')).toBeVisible();
  await page.getByRole('navigation', {name: 'Notification pages'}).getByRole('button', {name: 'Next'}).click();
  await expect(page.getByText('Earlier notification')).toBeVisible();
  expect(errors).toEqual([]);
});
