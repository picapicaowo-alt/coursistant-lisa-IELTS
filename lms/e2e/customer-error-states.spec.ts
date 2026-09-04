import {expect, test} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';
import {instructorFixture} from './instructor-workspace-fixture';

const diagnostics = /Internal server error|Request failed with status code|response had no data|Network Error/;
const failed = {status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error', data: null};

for (const scenario of [
  {name: 'student', level: 'STUDENT', path: '/my-plan', endpoint: '/v2/student/study-plan', message: 'Study plan could not be loaded.'},
  {name: 'advisor', level: 'ADVISOR', path: '/advisor/students', endpoint: '/v2/advisor/students', message: 'Students could not be loaded.'},
  {name: 'counsellor', level: 'COUNSELLOR', path: '/counsellor', endpoint: '/v2/counsellor/dashboard', message: 'Dashboard counts could not be loaded.'},
  {name: 'parent', level: 'PARENT', path: '/parent', endpoint: '/v2/parent/linked-students', message: 'Linked students could not be loaded.'},
  {name: 'tenant administrator', level: 'NOT_APPLICABLE', role: 'TENANT_ADMIN', path: '/admin', endpoint: '/v2/tenant/users', message: 'The directory could not be loaded.'},
  {name: 'system administrator', level: 'NOT_APPLICABLE', role: 'SYSTEM_ADMIN', path: '/admin', endpoint: '/v2/users', message: 'Users could not be loaded.'},
]) {
  test(`${scenario.name} shows contextual API failures at desktop and mobile widths`, async ({page}) => {
    await fixture(page, scenario.level, 'Student', scenario.role ?? 'USER');
    await page.route(`**${scenario.endpoint}**`, route => route.fulfill({status: 500, json: failed}));
    await page.goto(scenario.path);
    await expect(page.getByRole('alert').filter({hasText: scenario.message})).toBeVisible();
    await expect(page.getByText(diagnostics)).toHaveCount(0);
    for (const width of [1440, 390]) {
      await page.setViewportSize({width, height: 960});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

for (const kind of ['server', 'network', 'missing payload'] as const) {
  test(`Instructor grading-items ${kind} failure preserves retry and never claims an empty queue`, async ({page}, testInfo) => {
    await instructorFixture(page);
    await page.route('**/v2/me/teaching/grading-queue', route => route.fulfill({json: reply([])}));
    let recovered = false;
    await page.route('**/v2/me/teaching/grading-items**', route => {
      if (recovered) return route.fulfill({json: reply([])});
      if (kind === 'network') return route.abort('failed');
      return route.fulfill(kind === 'server' ? {status: 500, json: failed} : {json: reply(null)});
    });
    await page.goto('/my-operations');
    const queue = page.getByRole('region', {name: 'Grading queue'});
    await expect(queue.getByRole('alert')).toContainText('Grading queue could not be loaded.');
    await expect(queue.getByText(diagnostics)).toHaveCount(0);
    await expect(queue.getByText(/0 pending|All caught up/)).toHaveCount(0);
    if (kind === 'server') {
      for (const width of [1440, 390]) {
        await page.setViewportSize({width, height: 960});
        await queue.scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({path: testInfo.outputPath(`grading-error-${width}.png`)});
      }
    }
    recovered = true;
    await queue.getByRole('button', {name: 'Try again'}).click();
    await expect(queue.getByText(/All caught up/)).toBeVisible();
    await expect(queue.getByText('0 pending')).toBeVisible();
    await expect(queue.getByRole('alert')).toHaveCount(0);
  });
}

test('Combined instructor/advisor keeps failed teaching reads distinct from empty results', async ({page}) => {
  await fixture(page, 'INSTRUCTOR_ADVISOR', 'Instructor');
  await page.route('**/v2/me/teaching/grading-items**', route => route.fulfill({status: 500, json: failed}));
  await page.goto('/my-operations');
  await expect(page.getByRole('heading', {name: 'Grading queue', exact: true})).toBeVisible();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Nothing is waiting for grading.', {exact: true})).toHaveCount(0);
  await expect(page.getByText(diagnostics)).toHaveCount(0);
});

test('Student course and calendar read failures never masquerade as empty records', async ({page}) => {
  await fixture(page);
  for (const endpoint of ['/v2/me/courses/71/hours', '/v2/courses/71/student-reports/published/me', '/v2/me/calendar']) {
    await page.route(`**${endpoint}**`, route => route.fulfill({status: 500, json: failed}));
  }
  await page.goto('/my-operations');
  await page.getByRole('combobox', {name: 'Learning course', exact: true}).selectOption('71');
  await page.getByRole('button', {name: 'View details', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Course hours', exact: true}).getByRole('alert')).toBeVisible();
  await expect(page.getByRole('region', {name: 'Published reports', exact: true}).getByRole('alert')).toBeVisible();
  await expect(page.getByText(/No purchased-hours record|No published reports\.|No selectable class occurrence/)).toHaveCount(0);
  await page.getByRole('navigation', {name: 'Learning views'}).getByRole('button', {name: 'Calendar', exact: true}).click();
  await expect(page.getByText('No calendar items are available.')).toHaveCount(0);
  await expect(page.getByRole('alert').filter({hasText: 'Course hours could not be loaded.'})).toHaveCount(0);
});

for (const code of ['COURSE_HOURS_NOT_FOUND', 'COURSE_NOT_FOUND']) {
  test(`Student distinguishes ${code} from a failed balance read`, async ({page}) => {
    await fixture(page);
    await page.route('**/v2/me/courses/71/hours', route => route.fulfill({status: 404, json: {status: 404, code, message: 'Missing record'}}));
    await page.goto('/my-operations');
    await page.getByRole('combobox', {name: 'Learning course', exact: true}).selectOption('71');
  await page.getByRole('button', {name: 'View details', exact: true}).click();
    if (code === 'COURSE_HOURS_NOT_FOUND') {
      await expect(page.getByText('No course hours have been added yet.')).toBeVisible();
      await expect(page.getByRole('region', {name: 'Course hours', exact: true}).getByRole('alert')).toHaveCount(0);
    } else {
      await expect(page.getByRole('region', {name: 'Course hours', exact: true}).getByRole('alert')).toBeVisible();
      await expect(page.getByText('No course hours have been added yet.')).toHaveCount(0);
    }
  });
}

test('Parent header opens the parent inbox without calling the forbidden learner notification API', async ({page}) => {
  await fixture(page, 'PARENT');
  await page.route('**/v2/parent/linked-students**', route => route.fulfill({json: reply({items: [{studentUserId: 301}], total: 1, page: 0, size: 20})}));
  const forbidden: string[] = [];
  const parentReads: string[] = [];
  await page.route('**/v2/me/notifications**', route => {forbidden.push(route.request().url()); return route.fulfill({status: 403, json: {code: 'FORBIDDEN'}});});
  await page.route('**/v2/parent/notifications**', route => {
    parentReads.push(route.request().url());
    return route.fulfill({json: reply(route.request().url().includes('unread-count') ? {unreadCount: 0} : {items: [], total: 0, page: 0, size: 20})});
  });
  await page.goto('/parent');
  await page.getByRole('link', {name: 'Open notifications', exact: true}).click();
  await expect(page).toHaveURL(/section=notifications/);
  await expect.poll(() => parentReads.length).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(forbidden).toEqual([]);
});
