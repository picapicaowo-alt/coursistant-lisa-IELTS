import {expect, test} from '@playwright/test';
import {createInstance} from 'i18next';
import {readFileSync} from 'node:fs';
import {fixture, reply} from './workspace-fixtures';

const locales = ['en', 'zh-CN', 'zh-TW'] as const;
const engine = createInstance();
const resources = Object.fromEntries(locales.map(locale => [locale, Object.fromEntries(['dashboard', 'courseTools', 'common'].map(namespace => [namespace, JSON.parse(readFileSync(new URL(`../src/i18n/resources/${locale}/${namespace}.json`, import.meta.url), 'utf8'))]))]));
test.beforeAll(async () => {await engine.init({resources, lng: 'en', fallbackLng: 'en', interpolation: {escapeValue: false}});});
const t = (locale: string, key: string) => engine.getFixedT(locale)(key);

for (const locale of locales) for (const width of [390, 1440]) {
  test(`teacher current work and expired group recovery: ${locale} ${width}`, async ({page}, info) => {
    await page.setViewportSize({width, height: 1000});
    await fixture(page, 'INSTRUCTOR', 'Instructor');
    await page.addInitScript(value => {if (!localStorage.getItem('coursistant.locale')) localStorage.setItem('coursistant.locale', value);}, locale);
    const writes: string[] = [], errors: string[] = [], groupReads: string[] = [], historyReads: string[] = [];
    page.on('request', request => {
      if (request.method() !== 'GET') writes.push(request.url());
      if (request.url().includes('/teaching/activity/recent')) historyReads.push(request.url());
      if (/\/v2\/courses\/\d+\/group-sets\/\d+/.test(request.url())) groupReads.push(new URL(request.url()).pathname);
    });
    page.on('pageerror', error => errors.push(error.message));
    const base = {courseId: 71, courseCode: 'WR101', title: 'Original essay title', pendingCount: 4, assignmentId: 81, quizId: null};
    await page.route('**/v2/me/teaching/activity/recent**', route => route.fulfill({status: 500}));
    let empty = false;
    await page.route('**/v2/me/teaching/grading-queue**', route => route.fulfill({json: reply(empty ? [] : [
      {...base, kind: 'AssignmentUngraded'},
      {...base, kind: 'AssignmentAwaitingRelease', pendingCount: 2},
      {...base, title: 'Original quiz title', kind: 'QuizAwaitingRelease', pendingCount: 1, assignmentId: null, quizId: 81},
    ])}));
    await page.goto('/');
    const selector = page.getByRole('combobox', {name: /^(Language|语言|語言)$/}).first();
    for (const selected of [...locales, locale]) {
      await selector.selectOption(selected);
      const work = page.getByRole('region', {name: t(selected, 'dashboard:teachingWork.title')});
      await expect(work.getByText('Original essay title', {exact: true})).toHaveCount(1);
      await expect(work.getByRole('link', {name: /Original essay title/})).toHaveAttribute('href', '/course/71/assignments/81/grading');
      await expect(work.getByRole('link', {name: /Original quiz title/})).toHaveAttribute('href', '/course/71/quizzes/81/grading');
      await expect(work.getByRole('link', {name: /Original quiz title/})).toContainText(t(selected, 'dashboard:teachingWork.release'));
      await expect(work).not.toContainText(/SELF|STAFF|user=26|AssignmentAwaitingRelease|dashboard:/);
      await expect(page.getByRole('region', {name: t(selected, 'dashboard:recentActivity')})).toHaveCount(0);
      await expect(page.getByRole('region', {name: t(selected, 'dashboard:courseFilter')})).toContainText(t(selected, 'dashboard:noUpcomingWork'));
    }
    await page.reload();
    await expect(selector).toHaveValue(locale);
    const work = page.getByRole('region', {name: t(locale, 'dashboard:teachingWork.title')});
    await expect(work.getByText('Original essay title', {exact: true})).toBeVisible();
    await work.scrollIntoViewIfNeeded();
    await page.screenshot({path: info.outputPath('teacher-current-work.png'), fullPage: true});
    await page.route('**/v2/courses/71/assignments/81/grading-roster', route => route.fulfill({json: reply({assignmentId: 81, assignmentTitle: 'Original essay title', courseId: 71, gradingWritable: true, totalCount: 0, enteredCount: 0, releasedCount: 0, items: []})}));
    await work.getByRole('link', {name: /Original essay title/}).click();
    await expect(page).toHaveURL(/\/course\/71\/assignments\/81\/grading$/);
    await expect(page.getByRole('heading', {name: 'Original essay title', exact: true})).toBeVisible();
    empty = true;
    await page.goto('/');
    await expect(work.getByText(t(locale, 'dashboard:teachingWork.empty'), {exact: true})).toBeVisible();
    await expect(work.getByRole('link')).toHaveCount(1);
    await work.scrollIntoViewIfNeeded();
    await page.screenshot({path: info.outputPath('teacher-no-pending-work.png'), fullPage: true});
    expect(groupReads).toEqual([]);
    expect(historyReads).toEqual([]);

    await page.route('**/v2/courses/71/group-sets/9', route => route.fulfill({status: 404, json: {status: 404, message: 'Opaque diagnostic'}}));
    await page.goto('/course/71/group-sets/9');
    await expect(page.getByRole('heading', {name: t(locale, 'courseTools:groups.setMissing')})).toBeVisible();
    await expect(page.getByRole('status')).toContainText(t(locale, 'courseTools:groups.setMissingHelp'));
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', {name: t(locale, 'common:actions.tryAgain')})).toHaveCount(0);
    expect(groupReads).toHaveLength(1);
    await page.screenshot({path: info.outputPath('expired-group.png'), fullPage: true});
    await page.getByRole('link', {name: t(locale, 'courseTools:groups.viewCurrent'), exact: true}).click();
    await expect(page.getByText(t(locale, 'courseTools:groups.noSets'), {exact: true})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}
