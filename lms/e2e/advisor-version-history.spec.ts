import {expect, test} from '@playwright/test';
import {openSection} from './disclosure-helpers';

const response = (data: unknown) => ({status: 200, code: 'SUCCESS', data});

test('Advisor reads historic plan snapshots without changing the current draft or requesting unsupported profile history', async ({page}, testInfo) => {
  await page.addInitScript(() => {
    const user = {id: 902, userId: 902, firstName: 'Alex', lastName: 'Advisor', email: 'advisor@example.test', role: 'USER', level: 'ADVISOR', accessToken: 'history-browser-fixture'};
    localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('accToken', user.accessToken);
  });
  const reads: string[] = [];
  const writes: string[] = [];
  const profile = {studentUserId: 301, profileVersion: 2, firstName: 'Taylor', lastName: 'Chen', email: 'taylor@example.test', studentType: 'STANDARD', skills: []};
  await page.route('**/v2/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    reads.push(url.pathname);
    if (request.method() !== 'GET') writes.push(url.pathname);
    let data: unknown = [];
    if (url.pathname.endsWith('/unread-count')) data = {unreadCount: 0};
    else if (url.pathname.endsWith('/hub') || url.pathname.endsWith('/profile')) data = profile;
    else if (url.pathname.endsWith('/study-plan')) data = {studentUserId: 301, profileContext: {currentProfileVersion: 2}, plan: {studyPlanVersion: 3, basedOnProfileVersion: 2, strategySummary: 'Current plan strategy', startDate: '2026-09-01', planEndDate: '2026-12-01', checkpoints: []}};
    else if (url.pathname.endsWith('/study-plan/revisions')) data = {page: Number(url.searchParams.get('page')), size: 20, total: 21, items: url.searchParams.get('page') === '1' ? [{entityVersion: 0, action: 'STUDY_PLAN_CREATED', snapshot: {strategySummary: 'First plan strategy'}}] : [{entityVersion: 1, action: 'STUDY_PLAN_UPDATED', createdAt: '2026-09-01T10:00:00Z', actorId: 902, snapshot: {strategySummary: 'Earlier diagnostic strategy', startDate: '2026-08-01', checkpoints: [{description: 'Earlier checkpoint', tasks: [{title: 'Earlier timed essay', submissionRequirement: 'Upload the first response'}]}]}}, {entityVersion: 2, action: 'STUDY_PLAN_UPDATED'}]};
    return route.fulfill({json: response(data)});
  });

  await page.goto('/advisor/students/301/profile');
  await expect(page.getByText('Current version 2', {exact: true})).toBeVisible();
  await expect(page.getByText(/Earlier profile versions are not available/)).toHaveCount(0);
  expect(reads.some(path => /profile\/(revisions|history)/.test(path))).toBe(false);

  await page.goto('/advisor/students/301/study-plan');
  await page.getByRole('button', {name: 'Edit study plan', exact: true}).click();
  await openSection(page, 'Plan direction');
  const strategy = page.getByRole('textbox', {name: 'Strategy', exact: true});
  await strategy.fill('My unsaved plan changes');
  await openSection(page, 'Version history');
  await openSection(page, 'Version 1');
  await expect(page.getByText('Earlier diagnostic strategy', {exact: true})).toBeVisible();
  await expect(page.getByText('Earlier timed essay', {exact: true})).toBeVisible();
  await expect(page.getByText('Upload the first response', {exact: true})).toBeVisible();
  await expect(strategy).toHaveValue('My unsaved plan changes');
  await page.screenshot({path: testInfo.outputPath('advisor-plan-history-desktop.png'), fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  await page.getByText('Earlier diagnostic strategy', {exact: true}).scrollIntoViewIfNeeded();
  expect(await page.getByRole('main').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({path: testInfo.outputPath('advisor-plan-history-mobile.png'), fullPage: true});
  await openSection(page, 'Version 2');
  await expect(page.getByText(/saved content for this version was not included/)).toBeVisible();
  await page.getByRole('navigation', {name: 'Version history pages'}).getByRole('button', {name: 'Next'}).click();
  await openSection(page, 'Version 0');
  await expect(page.getByText('First plan strategy', {exact: true})).toBeVisible();
  await expect(strategy).toHaveValue('My unsaved plan changes');
  expect(writes).toEqual([]);
});
