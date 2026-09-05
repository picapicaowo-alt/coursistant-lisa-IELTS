import {readFileSync, readdirSync} from 'node:fs';
import {expect, test, type Page, type Route} from '@playwright/test';
import {createInstance, type Resource, type TOptions} from 'i18next';
import {fixture, reply} from './workspace-fixtures';

const locales = ['en', 'zh-CN', 'zh-TW'] as const;
const engine = createInstance();
const resources: Resource = Object.fromEntries(locales.map(locale => [locale, Object.fromEntries(readdirSync(new URL(`../src/i18n/resources/${locale}/`, import.meta.url)).map(file => [file.slice(0, -5), JSON.parse(readFileSync(new URL(`../src/i18n/resources/${locale}/${file}`, import.meta.url), 'utf8'))]))]));
test.beforeAll(async () => {await engine.init({resources, lng: 'en', fallbackLng: 'en', interpolation: {escapeValue: false}});});
const t = (locale: string, key: string, options?: TOptions) => engine.getFixedT(locale)(key, options ?? {});
const course = {courseId: 1200, title: 'Authored course', deliveryMode: 'GROUP', launchState: 'PUBLISHED', courseLinkVersion: 0, lectureCompleted: 1000, lectureTotal: 1200, alignmentNotes: 'Authored alignment', activeStudents: 1000, capacity: 1200, remainingCapacity: 200, schedule: [{dayOfWeek: 'MONDAY', startTime: '13:00:00', endTime: '14:00:00'}]};
async function setup(page: Page, locale: string, handler: (route: Route, path: string) => Promise<boolean>) {
  await fixture(page, 'ADVISOR');
  await page.addInitScript(value => {if (!localStorage.getItem('coursistant.locale')) localStorage.setItem('coursistant.locale', value);}, locale);
  await page.route('**/v2/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (await handler(route, path)) return;
    let data: unknown;
    if (path.endsWith('/students/301/profile')) data = {studentUserId: 301, profileVersion: 0, skills: []};
    else if (path.endsWith('/students/301/hub')) data = {studentUserId: 301, studentType: 'STANDARD'};
    else if (path.endsWith('/students/301/study-plan')) data = {studentUserId: 301, profileContext: {currentProfileVersion: 0}, plan: {studyPlanVersion: 0, checkpoints: []}};
    else if (path.endsWith('/students/301/courses')) data = [course];
    else if (path.endsWith('/students/301/course-options')) data = {items: [course], total: 1, size: 20, page: 0};
    else if (path.endsWith('/courses/1200/hours')) data = {purchasedMinutes: 1200, remainingMinutes: 1000, hoursVersion: 0};
    else if (path.endsWith('/student-reports')) data = {items: [], total: 0};
    else if (path.endsWith('/attendance') || path.endsWith('/conversation/messages') || path.endsWith('/mock-exams')) data = [];
    else if (path.endsWith('/advisor/instructors')) data = {items: [{instructorUserId: 47, firstName: 'Authored', lastName: 'Instructor', level: 'INSTRUCTOR'}], total: 1, page: 0, size: 20};
    else if (path.endsWith('/mock-exam-templates')) data = [{id: 8, title: 'Authored paper', publishedVersionId: 80}];
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
  await expect(page.locator('main').last()).not.toContainText(/advising:|common:|Opaque diagnostic/);
}
type Write = {path: string; body: Record<string, unknown>; key: string};
for (const locale of locales) for (const width of [390, 1440]) {
  test(`one-to-one update opens beside add, preserves the schedule and retries safely: ${locale} ${width}`, async ({page}, info) => {
    await page.setViewportSize({width, height: 960});
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const scheduled = {courseId: 1201, title: 'Speaking coaching', deliveryMode: 'ONE_ON_ONE', instructorUserId: 47, courseLaunchVersion: 0, launchState: 'DRAFT', schedule: [
      {type: 'Tutorial', dayOfWeek: 'WED', startTime: '15:30:00', endTime: '16:30:00', location: 'Studio A'},
      {type: 'Lab', dayOfWeek: 'FRI', startTime: '11:00:00', endTime: '12:00:00', location: 'Studio B'},
    ]};
    const writes: Write[] = [];
    let releaseSave: (() => void) | undefined;
    await setup(page, locale, async (route, path) => {
      if (path.endsWith('/students/301/courses')) {await route.fulfill({json: reply([course, scheduled, {...scheduled, courseId: 1202, title: 'Second coaching course'}])}); return true;}
      if (route.request().method() !== 'PUT') return false;
      writes.push({path, body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']});
      if (writes.length === 1) {await route.fulfill({status: 503, json: {message: 'Opaque diagnostic'}}); return true;}
      if (writes.length === 2) {
        await new Promise<void>(resolve => {releaseSave = resolve;});
        scheduled.courseLaunchVersion = 1;
        await route.fulfill({json: reply(scheduled)}); return true;
      }
      if (writes.length === 3) {
        scheduled.courseLaunchVersion = 2;
        await route.fulfill({status: 409, json: {code: 'COURSE_LAUNCH_VERSION_CONFLICT'}}); return true;
      }
      scheduled.courseLaunchVersion = 3;
      await route.fulfill({json: reply(scheduled)}); return true;
    });
    await page.goto('/advisor/students/301/courses');
    const trigger = page.getByRole('button', {name: t(locale, 'advising:studentCourses.updateOneToOne'), exact: true});
    await expect(trigger).toBeVisible();
    await expect(trigger.locator('..').getByRole('button', {name: t(locale, 'advising:studentCourses.add'), exact: true})).toBeVisible();
    await expect(page.locator('summary').filter({hasText: t(locale, 'advising:studentCourses.updateOneToOne')})).toHaveCount(0);
    await page.screenshot({path: info.outputPath('course-actions.png'), fullPage: true});
    await trigger.click();
    const dialog = page.getByRole('dialog', {name: t(locale, 'advising:studentCourses.updateOneToOne'), exact: true});
    await dialog.getByRole('combobox', {name: t(locale, 'advising:studentCourses.course'), exact: true}).selectOption('1201');
    await expect(dialog.getByRole('combobox', {name: t(locale, 'advising:studentCourses.weekday'), exact: true})).toHaveValue('WED');
    await expect(dialog.getByRole('textbox', {name: t(locale, 'advising:studentCourses.location'), exact: true})).toHaveValue('Studio A');
    await expect(dialog.getByRole('textbox', {name: t(locale, 'advising:studentCourses.startTime'), exact: true})).toHaveValue(locale === 'en' ? '03:30 PM' : '15:30');
    await expect(dialog).not.toContainText(/launch version|開課版本|开课版本/);
    await page.screenshot({path: info.outputPath('update-course-dialog.png')});
    await dialog.getByRole('textbox', {name: t(locale, 'advising:studentCourses.location'), exact: true}).fill('Updated studio');
    for (const language of locales) {
      await changeLocale(page, language);
      await expect(page.getByRole('dialog', {name: t(language, 'advising:studentCourses.updateOneToOne'), exact: true})).toBeVisible();
      await expect(page.getByRole('textbox', {name: t(language, 'advising:studentCourses.location'), exact: true})).toHaveValue('Updated studio');
      await fits(page);
    }
    const activeDialog = page.getByRole('dialog');
    const save = activeDialog.getByRole('button', {name: t('zh-TW', 'advising:studentCourses.replaceSessions'), exact: true});
    await save.click();
    await expect(activeDialog.getByRole('alert')).toContainText(t('zh-TW', 'advising:studentCourses.failed'));
    await save.click();
    await expect.poll(() => writes.length).toBe(2);
    await expect(save).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(activeDialog).toBeVisible();
    releaseSave?.();
    await expect(activeDialog.getByRole('status')).toHaveText(t('zh-TW', 'advising:studentCourses.saved'));
    expect(writes[0]).toEqual(writes[1]);
    expect(writes[0].body).toEqual({expectedCourseLaunchVersion: 0, sessions: [
      {...scheduled.schedule[0], startTime: '15:30', endTime: '16:30', location: 'Updated studio'}, scheduled.schedule[1],
    ]});
    const reassign = activeDialog.getByRole('button', {name: t('zh-TW', 'advising:studentCourses.reassign'), exact: true});
    await reassign.click();
    await expect(reassign).toBeDisabled();
    await activeDialog.getByRole('button', {name: t('zh-TW', 'advising:studentCourses.reload'), exact: true}).click();
    await expect(activeDialog.getByRole('textbox', {name: t('zh-TW', 'advising:studentCourses.location'), exact: true})).toHaveValue('Updated studio');
    await reassign.click();
    await expect(activeDialog.getByRole('status')).toHaveText(t('zh-TW', 'advising:studentCourses.saved'));
    expect(writes[2].body).toEqual({primaryInstructorUserId: 47, expectedCourseLaunchVersion: 1});
    expect(writes[3].body).toEqual({primaryInstructorUserId: 47, expectedCourseLaunchVersion: 2});
    await page.keyboard.press('Escape');
    await expect(activeDialog).toHaveCount(0);
    await expect(page.getByRole('button', {name: t('zh-TW', 'advising:studentCourses.updateOneToOne'), exact: true})).toBeFocused();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
    expect(errors).toEqual([]);
  });
}
