import {expect, test, type Locator, type Page} from '@playwright/test';
import {course, fixture, reply} from './workspace-fixtures';

const assigned = {courseId: 71, courseCode: 'WR101', title: course.title, instructorFirstName: 'Ivy', instructorLastName: 'Lee', deliveryMode: 'GROUP', launchState: 'PUBLISHED', lifecycleStatus: 'ONGOING', courseLinkVersion: 1, lectureCompleted: 4, lectureTotal: 10, schedule: [{dayOfWeek: 'MONDAY', startTime: '10:00:00', endTime: '11:30:00', location: 'Room 3A'}]};
const owned = {courseId: 71, courseCode: 'WR101', title: course.title, lifecycleState: 'Active', launchState: 'PUBLISHED', activeStudents: 8, capacity: 12, termStartDate: '2026-09-01', termEndDate: '2026-12-01', primaryInstructor: {instructorFirstName: 'Ivy', instructorLastName: 'Lee'}};

async function setup(page: Page, level: string, role = 'USER') {
  await fixture(page, level, level === 'STUDENT' ? 'Student' : 'Instructor', role);
  const requests: Array<{path: string; method: string}> = [];
  page.on('request', request => {if (request.url().includes('/v2/')) requests.push({path: new URL(request.url()).pathname, method: request.method()});});
  await page.route('**/v2/courses/*/sessions', route => route.fulfill({json: reply([{dayOfWeek: 'MON', startTime: '10:00:00', location: 'Room 3A'}])}));
  await page.route('**/v2/advisor/courses?*', route => {
    const state = new URL(route.request().url()).searchParams.get('launchState');
    const items = !state || state === owned.launchState ? [owned] : [];
    return route.fulfill({json: reply({items, total: items.length, page: 0, size: 20})});
  });
  await page.route('**/v2/advisor/students/301/courses', route => route.fulfill({json: reply([assigned])}));
  await page.route('**/v2/advisor/students/301/study-plan', route => route.fulfill({json: reply({plan: {studyPlanId: 81, studyPlanVersion: 1, checkpoints: []}})}));
  await page.route('**/v2/parent/linked-students*', route => route.fulfill({json: reply({items: [{studentUserId: 301}], total: 1, page: 0, size: 20})}));
  await page.route('**/v2/parent/students/301/dashboard', route => route.fulfill({json: reply({student: {firstName: 'Alex', lastName: 'Chen'}, currentCourses: [{...assigned, progressPercent: 40}]})}));
  await page.route('**/v2/courses?*', route => route.fulfill({json: reply({items: [course], total: 1, page: 0, size: 20})}));
  return requests;
}

async function assertAccent(page: Page, card: Locator) {
  await card.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect.poll(() => card.evaluate(element => getComputedStyle(element, '::before').opacity)).toBe('0');
  const before = await card.boundingBox();
  await card.hover();
  await expect.poll(() => card.evaluate(element => getComputedStyle(element, '::before').opacity)).toBe('1');
  const after = await card.boundingBox();
  expect(after!.width).toBe(before!.width);
  expect(after!.height).toBe(before!.height);
  const control = card.locator('button, a, summary').first();
  if (await control.count()) {
    await page.mouse.move(0, 0);
    await control.focus();
    await expect(control).toBeFocused();
    await expect.poll(() => card.evaluate(element => getComputedStyle(element, '::before').opacity)).toBe('1');
  }
}

const surfaces = [
  {name: 'student', level: 'STUDENT', path: '/course'},
  {name: 'instructor', level: 'INSTRUCTOR', path: '/course'},
  {name: 'advisor-owned', level: 'ADVISOR', path: '/advisor/courses'},
  {name: 'advisor-student', level: 'ADVISOR', path: '/advisor/students/301/courses'},
  {name: 'parent', level: 'PARENT', path: '/parent?studentUserId=301'},
];

for (const surface of surfaces) {
  test(`${surface.name} reuses the course card at desktop, tablet and mobile widths`, async ({page}, info) => {
    const requests = await setup(page, surface.level);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({width: 1600, height: 1050});
    await page.goto(surface.path);
    const card = page.locator('[data-course-card="71"]').first();
    await expect(card).toBeVisible();
    await assertAccent(page, card);
    for (const width of [1600, 1024, 390, 320]) {
      await page.setViewportSize({width, height: width < 700 ? 900 : 1050});
      await card.scrollIntoViewIfNeeded();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const box = await card.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(await card.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({path: info.outputPath(`${surface.name}-${width}.png`)});
    }
    if (surface.name === 'student') {
      await expect(card.getByRole('progressbar', {name: 'Assignment completion'})).toHaveAttribute('value', '4');
      await expect(card.getByRole('link', {name: 'Course operations'})).toHaveCount(0);
      await expect(card.getByRole('button', {name: 'More actions'})).toHaveCount(0);
    }
    if (surface.name === 'instructor') {
      await expect(card.getByRole('link', {name: 'Course operations'})).toBeVisible();
      await expect(card.getByRole('progressbar')).toHaveCount(0);
    }
    if (surface.name === 'advisor-owned') await expect(card.getByRole('link', {name: 'Manage delivery'})).toHaveAttribute('href', '/advisor/courses/71/delivery?view=delivery');
    if (surface.name === 'advisor-student') {
      await expect(card.getByRole('progressbar')).toHaveAttribute('value', '4');
      await expect(card.getByRole('progressbar')).toHaveCSS('border-radius', '9999px');
      await expect(card.getByRole('progressbar')).toHaveCSS('background-color', 'rgb(237, 242, 247)');
      await card.getByRole('button', {name: 'View Course', exact: true}).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
    if (surface.name === 'parent') {
      await expect(card.getByRole('progressbar')).toHaveAttribute('value', '40');
      await expect(card.getByRole('button')).toHaveCount(0);
      await expect(card.getByRole('link')).toHaveCount(0);
      expect(requests.some(request => /\/v2\/courses\//.test(request.path))).toBe(false);
    }
    expect(requests.filter(request => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('course filtering, pagination, list view and details follow Student lifecycle filters', async ({page}) => {
  await setup(page, 'STUDENT');
  const queries: URLSearchParams[] = [];
  await page.route('**/v2/me/courses?*', route => {
    const query = new URL(route.request().url()).searchParams;
    queries.push(query);
    return route.fulfill({json: reply({items: query.get('courseView') === 'COMPLETED' ? [] : [{...course, id: query.get('page') === '1' ? 72 : 71}], page: Number(query.get('page')), size: 20, total: 21})});
  });
  await page.goto('/course');
  await expect(page.locator('[data-course-card="71"]')).toBeVisible();
  expect(queries.at(-1)?.get('courseView')).toBe('CURRENT');
  expect(queries.at(-1)?.has('state')).toBe(false);
  await page.getByRole('button', {name: 'Next course page'}).click();
  await expect(page.locator('[data-course-card="72"]')).toBeVisible();
  await page.getByRole('button', {name: 'Completed', exact: true}).click();
  await expect.poll(() => queries.at(-1)?.get('courseView')).toBe('COMPLETED');
  await expect(page.locator('[data-course-card]')).toHaveCount(0);
  await expect(page.getByText('You have no completed courses yet.', {exact: true})).toBeVisible();
  expect(queries.at(-1)?.get('page')).toBe('0');
  await page.getByRole('button', {name: 'Current', exact: true}).click();
  await expect(page.locator('[data-course-card="71"]')).toBeVisible();
  await page.getByRole('button', {name: 'List view'}).click();
  await expect(page.locator('[data-view="list"]')).toBeVisible();
  // Returning to Current can reuse its fresh cache without a second request.
  await expect(page.getByRole('button', {name: 'Current', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', {name: 'View details', exact: true}).click();
  await expect(page).toHaveURL(/\/course\/71$/);
});

test('system admin retains course actions without student progress', async ({page}) => {
  await setup(page, 'NOT_APPLICABLE', 'SYSTEM_ADMIN');
  await page.goto('/course');
  const card = page.locator('[data-course-card="71"]');
  await expect(card.getByRole('link', {name: 'Course operations'})).toBeVisible();
  await expect(card.getByRole('progressbar')).toHaveCount(0);
  await card.getByRole('button', {name: 'More actions'}).click();
  await expect(page.getByRole('menuitem', {name: 'Archive course'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(card.getByRole('button', {name: 'More actions'})).toBeFocused();
});

test('instructor-advisor preserves both staff destinations', async ({page}) => {
  await setup(page, 'INSTRUCTOR_ADVISOR');
  await page.goto('/course');
  const card = page.locator('[data-course-card="71"]');
  await expect(card.getByRole('link', {name: 'Course operations'})).toBeVisible();
  await expect(card.getByRole('link', {name: 'Delivery setup'})).toBeVisible();
  await expect(card.getByRole('progressbar')).toHaveCount(0);
});

test('schedule failure stays retryable and reduced motion keeps the accent instant', async ({page}) => {
  await setup(page, 'STUDENT');
  await page.emulateMedia({reducedMotion: 'reduce'});
  let fail = true;
  await page.route('**/v2/courses/71/sessions', route => fail
    ? route.fulfill({status: 503, json: {code: 'UNAVAILABLE'}})
    : route.fulfill({json: reply([{dayOfWeek: 'MON', startTime: '10:00:00', location: 'Room 3A'}])}));
  await page.goto('/course');
  const card = page.locator('[data-course-card="71"]');
  await expect(card.getByRole('button', {name: 'Retry schedule'})).toBeVisible();
  fail = false;
  await card.getByRole('button', {name: 'Retry schedule'}).click();
  await expect(card.getByText('Weekly class, Mon 10:00')).toBeVisible();
  // The app-wide reduced-motion rule uses 0.01ms !important, overriding local none.
  expect(await card.evaluate(element => parseFloat(getComputedStyle(element, '::before').transitionDuration))).toBeLessThanOrEqual(.001);
});

test('missing schedule data is an error, not an empty schedule', async ({page}) => {
  await setup(page, 'STUDENT');
  await page.route('**/v2/courses/71/sessions', route => route.fulfill({json: reply(null)}));
  await page.goto('/course');
  await expect(page.getByRole('button', {name: 'Retry schedule'})).toBeVisible();
  await expect(page.getByText('No schedule published')).toHaveCount(0);
});

test('manager archive, restore and confirmed delete preserve API methods and failures', async ({page}) => {
  await setup(page, 'NOT_APPLICABLE', 'SYSTEM_ADMIN');
  let state = 'Active';
  const writes: Array<{method: string; path: string; key?: string}> = [];
  await page.route('**/v2/courses?*', route => route.fulfill({json: reply({items: [{...course, state}], total: 1, page: 0, size: 20})}));
  await page.route('**/v2/courses/71/archive', route => {
    writes.push({method: route.request().method(), path: '/archive', key: route.request().headers()['idempotency-key']});
    state = 'Archived';
    return route.fulfill({json: reply({...course, state})});
  });
  await page.route('**/v2/courses/71/unarchive', route => {
    writes.push({method: route.request().method(), path: '/unarchive', key: route.request().headers()['idempotency-key']});
    state = 'Active';
    return route.fulfill({json: reply({...course, state})});
  });
  await page.route('**/v2/courses/71', route => {
    writes.push({method: route.request().method(), path: '/71'});
    return route.fulfill({status: 409, json: {code: 'CONFLICT', data: null}});
  });
  await page.goto('/course');
  const card = page.locator('[data-course-card="71"]');
  const menu = card.getByRole('button', {name: 'More actions'});
  await menu.click();
  await expect(page.getByRole('menuitem', {name: 'Archive course'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card.getByText('Archived', {exact: true})).toBeVisible();
  await menu.click();
  await page.getByRole('menuitem', {name: 'Restore course'}).click();
  await expect(card.getByText('Active', {exact: true})).toBeVisible();
  await menu.click();
  await page.getByRole('menuitem', {name: 'Archive course'}).click();
  await expect(card.getByText('Archived', {exact: true})).toBeVisible();
  await menu.click();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', {name: 'Delete permanently'})).toBeFocused();
  await page.keyboard.press('Enter');
  expect(writes.filter(write => write.method === 'DELETE')).toHaveLength(0);
  await page.getByRole('menuitem', {name: 'Cancel', exact: true}).click();
  expect(writes.filter(write => write.method === 'DELETE')).toHaveLength(0);
  await page.getByRole('menuitem', {name: 'Delete permanently'}).click();
  await page.getByRole('menuitem', {name: 'Confirm', exact: true}).click();
  await expect(card.getByRole('alert')).toContainText('could not be deleted');
  expect(writes.map(({method, path}) => ({method, path}))).toEqual([
    {method: 'POST', path: '/archive'}, {method: 'POST', path: '/unarchive'},
    {method: 'POST', path: '/archive'}, {method: 'DELETE', path: '/71'},
  ]);
  expect(writes.filter(write => write.method === 'POST').every(write => Boolean(write.key))).toBe(true);
});

test('long course data, open enrollment controls and touch targets fit a narrow screen', async ({page}) => {
  await setup(page, 'ADVISOR');
  await page.route('**/v2/advisor/students/301/courses', route => route.fulfill({json: reply([{
    ...assigned, title: 'AcademicWritingStudio'.repeat(8), courseCode: 'WR'.repeat(32),
    instructorFirstName: 'Alexandra'.repeat(8), schedule: [{...assigned.schedule[0], location: 'Building'.repeat(30)}],
  }])}));
  await page.setViewportSize({width: 320, height: 900});
  await page.goto('/advisor/students/301/courses');
  const card = page.locator('[data-course-card="71"]');
  await card.getByText('Manage enrollment', {exact: true}).click();
  await expect(card.getByRole('textbox', {name: 'Reason for withdrawal'})).toBeVisible();
  expect(await card.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const control of [card.getByRole('button', {name: 'View Course', exact: true}), card.locator('summary')]) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(card.getByRole('button', {name: 'Withdraw', exact: true})).toBeDisabled();
});
