import {expect, test, type Page} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

const members = [
  {id: 1, courseId: 71, userId: 51, userFirstName: 'Ivy', userLastName: 'Lee', userEmail: 'ivy@example.test', courseRole: 'Instructor', active: true},
  {id: 2, courseId: 71, userId: 301, userFirstName: 'Alex', userMiddleName: 'Mei', userLastName: 'Chen', userName: 'Outdated name', userEmail: 'alex@example.test', courseRole: 'Student', active: true, level: 'STUDENT'},
  {id: 3, courseId: 71, userId: 302, userName: '王小明', userEmail: 'legacy@example.test', courseRole: 'Student', active: true, level: 'STUDENT'},
  ...Array.from({length: 18}, (_, index) => ({id: index + 4, courseId: 71, userId: index + 303, userFirstName: 'Learner', userLastName: String(index + 1), userEmail: `learner-${index + 1}@example.test`, courseRole: 'Student', active: true, level: 'STUDENT'})),
];

async function instructorFixture(page: Page, courseRole = 'Instructor') {
  await fixture(page, 'INSTRUCTOR', courseRole);
  const memberRequests: URL[] = [];
  await page.route('**/v2/courses/71/members?*', route => {
    const url = new URL(route.request().url());
    memberRequests.push(url);
    const query = url.searchParams.get('q')?.toLowerCase();
    const role = url.searchParams.get('courseRole');
    const filtered = members.filter(member => (!role || member.courseRole === role) && (!query || JSON.stringify(member).toLowerCase().includes(query)));
    const currentPage = Number(url.searchParams.get('page'));
    const size = Number(url.searchParams.get('size'));
    return route.fulfill({json: reply({items: filtered.slice(currentPage * size, (currentPage + 1) * size), total: filtered.length, page: currentPage, size})});
  });
  return memberRequests;
}

test('instructor opens the learner roster, reads names, filters and returns to the course list', async ({page}) => {
  const requests = await instructorFixture(page);
  await page.goto('/course');
  await page.getByRole('link', {name: 'Course operations', exact: true}).click();
  await expect(page).toHaveURL(/\/course\/71\/operations$/);
  await page.getByRole('link', {name: 'Learner roster', exact: true}).click();
  await expect(page).toHaveURL(/\/roster\/71$/);
  await expect(page.getByRole('cell', {name: 'Alex Mei Chen', exact: true})).toBeVisible();
  await expect(page.getByRole('cell', {name: '王小明', exact: true})).toBeVisible();
  await expect(page.getByText('Outdated name', {exact: true})).toHaveCount(0);
  await expect(page.getByText('21 members', {exact: true})).toBeVisible();

  const pagination = page.getByRole('navigation', {name: 'Roster pages'});
  await pagination.getByRole('button', {name: 'Next'}).click();
  await expect(page.getByRole('cell', {name: 'Learner 18', exact: true})).toBeVisible();
  await expect.poll(() => requests.at(-1)?.searchParams.get('page')).toBe('1');
  await page.getByRole('button', {name: 'Student', exact: true}).click();
  await expect.poll(() => requests.at(-1)?.searchParams.get('page')).toBe('0');
  await page.getByRole('textbox', {name: 'Search roster'}).fill('alex');
  await page.getByRole('button', {name: 'Search', exact: true}).click();
  await expect(page.getByText('1 member', {exact: true})).toBeVisible();
  expect(Object.fromEntries(requests.at(-1)!.searchParams)).toEqual({page: '0', size: '20', q: 'alex', courseRole: 'Student', active: 'true'});
  await page.getByRole('checkbox', {name: 'Show withdrawn'}).check();
  await expect.poll(() => requests.at(-1)?.searchParams.has('active')).toBe(false);

  await page.getByRole('link', {name: 'Back to course operations'}).click();
  await expect(page).toHaveURL(/\/course\/71\/operations$/);
  await page.getByRole('link', {name: 'Back to courses', exact: true}).click();
  await expect(page).toHaveURL(/\/course$/);
  await expect(page.getByRole('link', {name: 'Course operations', exact: true})).toBeVisible();
});

test('a roster opened from course overview returns there, then back to the catalogue', async ({page}) => {
  await instructorFixture(page);
  await page.goto('/course/71');
  await page.getByRole('button', {name: 'Schedule & Groups', exact: true}).click();
  await page.getByRole('link', {name: 'Manage roster', exact: true}).click();
  await expect(page.getByRole('cell', {name: 'Alex Mei Chen', exact: true})).toBeVisible();
  await page.getByRole('link', {name: 'Back to course', exact: false}).click();
  await expect(page).toHaveURL(/\/course\/71$/);
  await page.getByRole('button', {name: 'Back to courses', exact: true}).click();
  await expect(page).toHaveURL(/\/course$/);
});

test('mobile roster deep links display structured names and keep a usable parent route', async ({page}, info) => {
  await page.setViewportSize({width: 390, height: 844});
  await instructorFixture(page);
  await page.goto('/roster/71');
  await expect(page.getByRole('cell', {name: 'Name Alex Mei Chen', exact: true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: info.outputPath('roster-mobile.png')});
  await page.getByRole('link', {name: 'Back to course operations'}).click();
  await expect(page).toHaveURL(/\/course\/71\/operations$/);
});

test('course TAs do not receive an instructor-only learner roster shortcut', async ({page}) => {
  const requests = await instructorFixture(page, 'TA');
  await page.goto('/course/71/operations');
  await expect(page.getByRole('navigation', {name: 'Course workspace shortcuts'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Learner roster', exact: true})).toHaveCount(0);
  expect(requests).toHaveLength(0);
});
