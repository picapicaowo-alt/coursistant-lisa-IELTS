import {expect, test, type Page} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

const ownedCourses = [
  {courseId: 71, courseCode: 'IELTS-201', catalogCode: 'HV-SPEAK', title: 'IELTS Speaking Clinic', termStartDate: '2026-09-02', termEndDate: '2026-12-09', lifecycleState: 'Active', launchState: 'READY', courseLaunchVersion: 3, activeStudents: 12, capacity: 16, remainingCapacity: 4, primaryInstructor: {userId: 51, instructorFirstName: 'Sarah', instructorLastName: 'Chen', email: 'sarah@example.test'}},
  {courseId: 72, courseCode: 'GRE-110', catalogCode: 'GRE-WRITE', title: 'Academic Writing Studio', termStartDate: '2026-09-04', termEndDate: '2026-12-11', lifecycleState: 'Active', launchState: 'PUBLISHED', courseLaunchVersion: 5, activeStudents: 9, capacity: 16, remainingCapacity: 7, primaryInstructor: {userId: 52, instructorFirstName: 'James', instructorLastName: 'Liu', email: 'james@example.test'}},
];

async function assertNoOverflow(page: Page, width: number) {
  await page.setViewportSize({width, height: width < 700 ? 900 : 1024});
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

test.beforeEach(async ({page}) => {
  await fixture(page, 'ADVISOR');
  await page.route('**/v2/advisor/courses?*', route => {
    const state = new URL(route.request().url()).searchParams.get('launchState');
    const items = state ? ownedCourses.filter(course => course.launchState === state) : ownedCourses;
    return route.fulfill({json: reply({items, page: 0, size: 20, total: items.length})});
  });
});

test('owned-course workspace fills the desktop canvas and filters real records', async ({page}, info) => {
  await page.goto('/advisor/courses');
  await expect(page.getByRole('complementary', {name: 'Primary navigation'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Course management', level: 1})).toBeVisible();
  await expect(page.getByRole('region', {name: 'Courses you own'}).getByRole('article')).toHaveCount(2);
  await assertNoOverflow(page, 1440);
  await page.screenshot({path: info.outputPath('course-grid-1440.png'), fullPage: true});
  await page.getByLabel('Status').selectOption('READY');
  await expect(page.getByRole('region', {name: 'Courses you own'}).getByRole('article')).toHaveCount(1);
  await page.getByRole('button', {name: 'List view'}).click();
  await expect(page.getByRole('button', {name: 'List view'})).toHaveAttribute('aria-pressed', 'true');
  for (const width of [1920, 1440, 768, 390]) {
    await assertNoOverflow(page, width);
    await page.screenshot({path: info.outputPath(`course-list-${width}.png`), fullPage: true});
  }
});

test('delivery workspace keeps its 8+4 hierarchy and uses versioned launch actions', async ({page}, info) => {
  const writes: Array<{path: string; key?: string; body?: unknown}> = [];
  let launchState = 'DRAFT';
  let launchVersion = 2;
  await page.route('**/v2/courses/71', route => route.fulfill({json: reply({id: 71, courseId: 71, courseCode: 'IELTS-201', title: 'IELTS Speaking Clinic', termStartDate: '2026-09-02', termEndDate: '2026-12-09', state: 'Active', primaryInstructor: {userId: 51, name: 'Sarah Chen', email: 'sarah@example.test'}})}));
  await page.route('**/v2/advisor/courses/71/delivery-config', route => {
    if (route.request().method() === 'PUT') {launchVersion += 1; writes.push({path: 'delivery-config', key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON()});}
    return route.fulfill({json: reply({courseId: 71, deliveryMode: 'GROUP', catalogCode: 'HV-SPEAK', capacity: 16, launchState, courseLaunchVersion: launchVersion, blockers: []})});
  });
  await page.route('**/v2/advisor/courses/71/launch/*', route => {
    launchState = route.request().url().endsWith('/ready') ? 'READY' : 'PUBLISHED';
    launchVersion += 1;
    writes.push({path: launchState.toLowerCase(), key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON()});
    return route.fulfill({json: reply({courseId: 71, deliveryMode: 'GROUP', catalogCode: 'HV-SPEAK', capacity: 16, launchState, courseLaunchVersion: launchVersion, blockers: []})});
  });
  await page.route('**/v2/courses/71/sessions', route => route.fulfill({json: reply([
    {id: 31, courseId: 71, type: 'Lecture', dayOfWeek: 'WED', startTime: '14:00:00', endTime: '15:30:00', location: 'Room 302', timezone: 'Asia/Singapore'},
    {id: 32, courseId: 71, type: 'Tutorial', dayOfWeek: 'FRI', startTime: '10:00:00', endTime: '11:00:00', location: 'Room 118', timezone: 'Asia/Singapore'},
  ])}));
  await page.route('**/v2/courses/71/session-occurrences?*', route => route.fulfill({json: reply([
    {occurrenceId: 91, occurrenceDate: '2026-09-09', startTime: '14:00:00', endTime: '15:30:00', location: 'Room 302', status: 'SCHEDULED'},
    {occurrenceId: 92, occurrenceDate: '2026-09-11', startTime: '10:00:00', endTime: '11:00:00', location: 'Room 118', status: 'SCHEDULED'},
    {occurrenceId: 93, occurrenceDate: '2026-09-16', startTime: '14:00:00', endTime: '15:30:00', location: 'Room 302', status: 'SCHEDULED'},
  ])}));

  await page.goto('/advisor/courses/71/delivery');
  await expect(page.getByRole('complementary', {name: 'Primary navigation'})).toBeVisible();
  const main = page.locator('[class*="mainColumn"]');
  const side = page.getByRole('complementary', {name: 'Course readiness'});
  await assertNoOverflow(page, 1440);
  const [mainBox, sideBox] = await Promise.all([main.boundingBox(), side.boundingBox()]);
  expect(sideBox!.x).toBeGreaterThan(mainBox!.x + mainBox!.width);
  expect(mainBox!.width / sideBox!.width).toBeGreaterThan(1.7);
  await page.screenshot({path: info.outputPath('course-delivery-1440.png'), fullPage: true, animations: 'disabled'});
  await expect(page.getByRole('heading', {name: 'Delivery details'})).toBeVisible();

  await page.getByRole('tab', {name: 'Schedule'}).click();
  await page.getByRole('button', {name: 'View class dates'}).click();
  await expect(page.getByRole('heading', {name: 'Course occurrences'})).toBeVisible();
  await expect(page.getByRole('complementary', {name: 'Course readiness'})).toHaveCount(0);
  await page.screenshot({path: info.outputPath('course-schedule-1440.png'), fullPage: true});
  await page.getByRole('tab', {name: 'Delivery'}).click();

  await page.getByRole('button', {name: 'Validate readiness'}).first().click();
  await expect(page.getByText('Ready to publish').first()).toBeVisible();
  await page.getByRole('button', {name: 'Publish course'}).first().click();
  await expect(page.getByText('Published').first()).toBeVisible();
  expect(writes.map(write => write.body)).toEqual([{expectedCourseLaunchVersion: 2}, {expectedCourseLaunchVersion: 3}]);
  expect(writes.every(write => Boolean(write.key))).toBeTruthy();

  await page.getByRole('tab', {name: 'Schedule'}).click();
  await assertNoOverflow(page, 390);
  await page.screenshot({path: info.outputPath('course-schedule-390.png'), fullPage: true});
});
