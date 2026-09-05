import {expect, test} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

const initialProfile = {userId: 301, firstName: 'Alex', middleName: '', lastName: 'Chen', phone: '', email: 'review@example.test', role: 'USER', level: 'STUDENT', emailNotifications: true};

test('saving notifications preserves an unsaved account draft through failure and retry', async ({page}) => {
  await fixture(page);
  let profile = {...initialProfile};
  let fail = true;
  const writes: Record<string, unknown>[] = [];
  await page.route('**/v2/me/profile', route => {
    if (route.request().method() !== 'GET') {
      const changes = route.request().postDataJSON();
      writes.push(changes);
      if (fail) return route.fulfill({status: 503, json: {code: 'SERVICE_UNAVAILABLE'}});
      profile = {...profile, ...changes};
    }
    return route.fulfill({json: reply(profile)});
  });
  await page.goto('/settings');
  await page.getByRole('textbox', {name: 'First name', exact: true}).fill('Unsent account draft');
  await page.getByRole('tab', {name: 'Notifications', exact: true}).click();
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button', {name: 'Save notifications', exact: true}).click();
  await expect(page.getByRole('status')).toContainText('Could not save settings.');
  fail = false;
  await page.getByRole('button', {name: 'Save notifications', exact: true}).click();
  await expect(page.getByRole('status')).toContainText('Settings saved.');
  expect(writes).toEqual([{emailNotifications: false}, {emailNotifications: false}]);
  await page.getByRole('tab', {name: 'Account', exact: true}).click();
  await expect(page.getByRole('textbox', {name: 'First name', exact: true})).toHaveValue('Unsent account draft');
  await page.getByRole('button', {name: 'Save account', exact: true}).click();
  await expect.poll(() => profile.firstName).toBe('Unsent account draft');
  await page.reload();
  await expect(page.getByRole('textbox', {name: 'First name', exact: true})).toHaveValue('Unsent account draft');
  await page.getByRole('tab', {name: 'Notifications', exact: true}).click();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
});

test('an account save preserves later edits and unsaved notification preferences', async ({page}) => {
  await fixture(page);
  let profile = {...initialProfile};
  let finish: (() => void) | undefined;
  const pending = new Promise<void>(resolve => {finish = resolve;});
  const writes: Record<string, unknown>[] = [];
  await page.route('**/v2/me/profile', async route => {
    if (route.request().method() !== 'GET') {
      const changes = route.request().postDataJSON();
      writes.push(changes);
      if (writes.length === 1) await pending;
      profile = {...profile, ...changes};
    }
    await route.fulfill({json: reply(profile)});
  });
  await page.goto('/settings');
  await page.getByRole('tab', {name: 'Notifications', exact: true}).click();
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('tab', {name: 'Account', exact: true}).click();
  const firstName = page.getByRole('textbox', {name: 'First name', exact: true});
  await firstName.fill('Jamie');
  await page.getByRole('button', {name: 'Save account', exact: true}).click();
  await expect.poll(() => writes.length).toBe(1);
  await firstName.fill('Jordan');
  finish?.();
  await expect(page.getByRole('status')).toContainText('Settings saved.');
  await expect(firstName).toHaveValue('Jordan');
  expect(profile.firstName).toBe('Jamie');
  await page.getByRole('button', {name: 'Save account', exact: true}).click();
  await expect.poll(() => profile.firstName).toBe('Jordan');
  await page.getByRole('tab', {name: 'Notifications', exact: true}).click();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  expect(profile.emailNotifications).toBe(true);
  await page.reload();
  await expect(firstName).toHaveValue('Jordan');
  await page.getByRole('tab', {name: 'Notifications', exact: true}).click();
  await expect(page.getByRole('checkbox')).toBeChecked();
});
