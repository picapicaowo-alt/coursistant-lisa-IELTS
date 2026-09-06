import {expect, test} from '@playwright/test';
import {productLocales, tx} from './i18n-fixture';

test('browser-native constraints follow the product locale and retain input values', async ({page}) => {
  let writes = 0;
  await page.route('**/v2/**', route => {writes++; return route.abort();});
  await page.goto('/login');
  const email = page.locator('#login-email');
  const password = page.locator('#login-password');
  for (const locale of productLocales) {
    await page.getByRole('combobox').selectOption(locale);
    await page.getByRole('button', {name: tx(locale, 'auth:login.logIn'), exact: true}).click();
    expect(await email.evaluate((field: HTMLInputElement) => field.validationMessage)).toBe(tx(locale, 'common:validation.requiredField'));
    await email.fill('not-an-email');
    await password.fill('UnsubmittedDraft1');
    await page.getByRole('button', {name: tx(locale, 'auth:login.logIn'), exact: true}).click();
    expect(await email.evaluate((field: HTMLInputElement) => field.validationMessage)).toBe(tx(locale, 'auth:signupErrors.emailInvalid'));
    await expect(password).toHaveValue('UnsubmittedDraft1');
    await email.fill('');
  }
  expect(writes).toBe(0);
});
