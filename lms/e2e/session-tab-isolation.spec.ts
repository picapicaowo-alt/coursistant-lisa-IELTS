import {expect, test} from '@playwright/test';
import {reply} from './workspace-fixtures';

const firstUser = {id: 301, userId: 301, email: 'first@example.test', name: 'First Student', role: 'USER', level: 'STUDENT', accessToken: 'first-fixture-token'};
const secondUser = {...firstUser, id: 302, userId: 302, name: 'Second Student', email: 'second@example.test', accessToken: 'second-fixture-token'};

test('another tab switches identity, clears the old settings draft, and follows logout', async ({page, context}) => {
  const identities: string[] = [];
  await context.route('**/v2/**', route => {
    const token = route.request().headers().authorization;
    let data: unknown = [];
    if (route.request().url().endsWith('/unread-count')) data = {unreadCount: 0};
    else if (route.request().url().endsWith('/me/profile')) {
      identities.push(token);
      const user = token === 'Bearer second-fixture-token' ? secondUser : firstUser;
      data = {...user, firstName: user.userId === 301 ? 'First' : 'Second', lastName: 'Student', emailNotifications: true};
    }
    return route.fulfill({json: reply(data)});
  });
  await context.route('**/v1/auth/logout', route => route.fulfill({json: reply(null)}));
  await page.goto('/login');
  await page.evaluate(user => {localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('accToken', user.accessToken);}, firstUser);
  await page.goto('/settings');
  const other = await context.newPage();
  await other.goto('/settings');
  await expect(other.getByRole('textbox', {name: 'First name', exact: true})).toHaveValue('First');
  await other.getByRole('textbox', {name: 'First name', exact: true}).fill('Private first-account draft');
  await page.evaluate(user => {localStorage.setItem('accToken', user.accessToken); localStorage.setItem('user', JSON.stringify(user));}, secondUser);
  await expect(other.getByRole('textbox', {name: 'First name', exact: true})).toHaveValue('Second');
  expect(identities).toContain('Bearer second-fixture-token');
  await other.getByRole('button', {name: 'Profile', exact: true}).click();
  await other.getByRole('button', {name: 'Sign out', exact: true}).click();
  await expect(other).toHaveURL(/\/login$/);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('textbox', {name: 'Email', exact: true})).toBeVisible();
});
