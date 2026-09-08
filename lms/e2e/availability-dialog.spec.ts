import {readFileSync, readdirSync} from 'node:fs';
import {expect, test, type Page, type Route} from '@playwright/test';
import {createInstance, type Resource, type TOptions} from 'i18next';
import {fixture, reply} from './workspace-fixtures';

const locales = ['en', 'zh-CN', 'zh-TW'] as const;
const engine = createInstance();
const resources: Resource = Object.fromEntries(locales.map(locale => [locale, Object.fromEntries(readdirSync(new URL(`../src/i18n/resources/${locale}/`, import.meta.url)).map(file => [file.slice(0, -5), JSON.parse(readFileSync(new URL(`../src/i18n/resources/${locale}/${file}`, import.meta.url), 'utf8'))]))]));
test.beforeAll(async () => {await engine.init({resources, lng: 'en', fallbackLng: 'en', interpolation: {escapeValue: false}});});
const t = (locale: string, key: string, options?: TOptions) => engine.getFixedT(locale)(key, options ?? {});
const windows = [{dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00', effectiveFrom: '2030-09-01', effectiveTo: '2030-12-01', timezone: 'America/Los_Angeles'}, {dayOfWeek: 'WEDNESDAY', startTime: '10:00', endTime: '15:00', timezone: 'America/Los_Angeles'}];
const exceptions = [{exceptionDate: '2030-09-09', startTime: '12:00', endTime: '17:00', timezone: 'America/Los_Angeles'}];
async function setup(page: Page, locale: string, handler: (route: Route, path: string) => Promise<boolean>, level = 'INSTRUCTOR') {
  await fixture(page, level, 'Instructor');
  await page.addInitScript(value => {if (!localStorage.getItem('coursistant.locale')) localStorage.setItem('coursistant.locale', value);}, locale);
  await page.route('**/v2/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (await handler(route, path)) return;
    let data: unknown;
    if (path.endsWith('/teaching/availability')) data = {version: 3, windows, exceptions};
    else if (path.endsWith('/teaching/grading-queue')) data = [{courseId: 37, assignmentId: 12, pendingCount: 1200, title: 'Authored assignment', courseCode: 'AUTH-37', kind: 'AssignmentAwaitingRelease'}];
    else if (path.endsWith('/teaching/today-classes')) data = [{courseId: 37, courseTitle: 'Authored course', occurrenceId: 12, startTime: '10:00', endTime: '11:00', timezone: 'America/Los_Angeles'}];
    else if (path.endsWith('/teaching/alerts')) data = [{type: 'SCHEDULE_CONFLICT', message: 'Opaque diagnostic'}];
    else if (path.endsWith('/teaching/students-needing-support')) data = [{courseId: 37, studentUserId: 901, reasons: ['REPEATED_ABSENCE']}];
    else {await route.fallback(); return;}
    await route.fulfill({json: reply(data)});
  });
}
async function changeLocale(page: Page, locale: string) {
  await page.evaluate(value => {localStorage.setItem('coursistant.locale', value); window.dispatchEvent(new StorageEvent('storage', {key: 'coursistant.locale', newValue: value}));}, locale);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}
async function fits(page: Page) {
  const size = await page.evaluate(() => ({viewport: innerWidth, document: document.documentElement.scrollWidth})); expect(size.document).toBeLessThanOrEqual(size.viewport);
  await expect(page.locator('main').last()).not.toContainText(/operations:|common:|Opaque diagnostic/);
}
for (const locale of locales) for (const width of [390, 1440]) {
  test(`teaching availability opens a header dialog and commits only confirmed drafts: ${locale} ${width}`, async ({page}, info) => {
    await page.setViewportSize({width, height: 900});
    const writes: unknown[] = [];
    await setup(page, locale, async (route, path) => {
      if (!path.endsWith('/teaching/availability')) return false;
      if (route.request().method() !== 'GET') writes.push(route.request().postDataJSON());
      await route.fulfill({json: reply({version: 3, windows: [], exceptions})});
      return true;
    });
    await page.goto('/my-operations?view=availability');
    const trigger = page.getByRole('region', {name: t(locale, 'operations:availability.title'), exact: true}).locator('header').getByRole('button', {name: t(locale, 'operations:availability.addTitle'), exact: true});
    await expect(trigger).toBeVisible();
    await expect(page.getByRole('textbox', {name: t(locale, 'operations:availability.effectiveFrom'), exact: true})).toHaveCount(0);
    await trigger.click();
    const dialog = page.getByRole('dialog', {name: t(locale, 'operations:availability.addTitle'), exact: true});
    await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox', {name: t(locale, 'course:scheduleModal.dayLabel'), exact: true}).selectOption('FRIDAY');
    await dialog.getByRole('button', {name: t(locale, 'common:actions.cancel'), exact: true}).click();
    await expect(trigger).toBeFocused();
    await expect(page.getByText(t(locale, 'operations:availability.empty'), {exact: true})).toBeVisible();
    expect(writes).toEqual([]);
    await trigger.click();
    await expect(dialog.getByRole('combobox', {name: t(locale, 'course:scheduleModal.dayLabel'), exact: true})).toHaveValue('MONDAY');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await fits(page);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({path: info.outputPath('availability-add-dialog.png'), fullPage: true});
    await dialog.getByRole('button', {name: t(locale, 'operations:availability.add'), exact: true}).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', {name: t(locale, 'common:actions.edit'), exact: true})).toHaveCount(1);
    expect(writes).toEqual([]);
    await page.getByRole('button', {name: t(locale, 'operations:availability.save'), exact: true}).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({expectedVersion: 3, windows: [{dayOfWeek: 'MON', startTime: '09:00', endTime: '17:00'}], exceptions});
    await page.reload();
    await expect(trigger).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await page.screenshot({path: info.outputPath('availability-header.png'), fullPage: true});
  });

  test(`teaching availability keeps raw weekdays, dates and retries: ${locale} ${width}`, async ({page}, info) => {
    await page.setViewportSize({width, height: 900}); const writes: Array<{body: unknown; key: string}> = [];
    await setup(page, locale, async (route, path) => {
      if (!path.endsWith('/teaching/availability') || route.request().method() === 'GET') return false;
      writes.push({body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']}); await route.fulfill({status: 503, json: {message: 'Opaque diagnostic'}}); return true;
    });
    await page.goto('/my-operations?view=availability');
    await page.getByRole('button', {name: t(locale, 'common:actions.edit'), exact: true}).first().click();
    await page.getByRole('textbox', {name: t(locale, 'operations:availability.effectiveFrom'), exact: true}).fill('2030-10-01');
    await page.getByRole('combobox', {name: t(locale, 'course:scheduleModal.dayLabel'), exact: true}).selectOption('FRIDAY');
    for (const language of locales) {
      await changeLocale(page, language);
      await expect(page.getByRole('combobox', {name: t(language, 'course:scheduleModal.dayLabel'), exact: true})).toHaveValue('FRIDAY');
      const expectedDate = language === 'en' ? '10/01/2030' : '2030/10/01';
      await expect(page.getByRole('textbox', {name: t(language, 'operations:availability.effectiveFrom'), exact: true})).toHaveValue(expectedDate);
      await fits(page);
    }
    await page.getByRole('button', {name: t('zh-TW', 'operations:availability.apply'), exact: true}).click();
    for (const language of locales) {
      await changeLocale(page, language); await page.getByRole('button', {name: t(language, 'operations:availability.save'), exact: true}).click();
      await expect(page.getByText(t(language, 'operations:availability.saveFailed'), {exact: true})).toBeVisible();
      await expect(page.getByText(t(language, 'operations:availability.exceptions', {count: 1, number: '1'}), {exact: true})).toBeVisible(); await fits(page);
    }
    expect(writes).toHaveLength(3); expect(writes.every(write => JSON.stringify(write) === JSON.stringify(writes[0]))).toBe(true);
    expect(writes[0].body).toEqual({expectedVersion: 3, windows: [{...windows[0], dayOfWeek: 'FRI', effectiveFrom: '2030-10-01'}, {...windows[1], dayOfWeek: 'WED'}], exceptions});
    await page.screenshot({path: info.outputPath('teacher-availability.png'), fullPage: true});
  });

  test(`teaching availability conflict reload preserves local drafts: ${locale} ${width}`, async ({page}, info) => {
    await page.setViewportSize({width, height: 900}); const writes: Array<{body: unknown; key: string}> = []; let reads = 0;
    await setup(page, locale, async (route, path) => {
      if (!path.endsWith('/teaching/availability')) return false;
      if (route.request().method() === 'GET') {reads++; await route.fulfill({json: reply({version: reads === 1 ? 3 : 4, windows: reads === 1 ? windows : [], exceptions: reads === 1 ? exceptions : []})});}
      else {writes.push({body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']}); await route.fulfill({status: writes.length === 1 ? 409 : 503, json: writes.length === 1 ? {code: 'TEACHING_AVAILABILITY_VERSION_CONFLICT', message: 'Opaque diagnostic'} : {message: 'Opaque diagnostic'}});}
      return true;
    });
    await page.goto('/my-operations?view=availability');
    await page.getByRole('button', {name: t(locale, 'common:actions.edit'), exact: true}).first().click();
    await page.getByRole('textbox', {name: t(locale, 'operations:availability.effectiveFrom'), exact: true}).fill('2030/02/');
    await page.getByRole('button', {name: t(locale, 'operations:availability.apply'), exact: true}).click();
    await expect(page.getByText(t(locale, 'operations:availability.invalidDate'), {exact: true})).toBeVisible();
    for (const language of locales) {
      await changeLocale(page, language);
      await expect(page.getByRole('textbox', {name: t(language, 'operations:availability.effectiveFrom'), exact: true})).toHaveValue('2030/02/');
      await expect(page.getByText(t(language, 'operations:availability.invalidDate'), {exact: true})).toBeVisible();
    }
    await page.getByRole('button', {name: t('zh-TW', 'common:actions.cancel'), exact: true}).click();
    await page.getByRole('button', {name: t('zh-TW', 'operations:availability.save'), exact: true}).click();
    await expect(page.getByText(t('zh-TW', 'operations:availability.conflict'), {exact: true})).toBeVisible();
    for (const language of locales) {await changeLocale(page, language); await expect(page.getByRole('button', {name: t(language, 'operations:availability.save'), exact: true})).toBeDisabled(); await fits(page);}
    expect(reads).toBe(1); expect(writes).toHaveLength(1);
    await page.getByRole('button', {name: t('zh-TW', 'operations:availability.reload'), exact: true}).click();
    await page.getByRole('button', {name: t('zh-TW', 'operations:availability.save'), exact: true}).click();
    await expect(page.getByText(t('zh-TW', 'operations:availability.saveFailed'), {exact: true})).toBeVisible();
    expect(writes[1].body).toEqual({expectedVersion: 4, windows: windows.map(window => ({...window, dayOfWeek: window.dayOfWeek.slice(0, 3)})), exceptions}); expect(writes[1].key).not.toBe(writes[0].key);
    await page.screenshot({path: info.outputPath('teacher-availability-conflict.png'), fullPage: true});
  });

}
