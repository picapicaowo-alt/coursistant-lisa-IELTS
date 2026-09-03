import {openSection} from './disclosure-helpers';
import {expect, test} from '@playwright/test';

test('Week 1 grading queue opens the registered grading page despite an incompatible backend link', async ({page}) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({id: 901, userId: 901, email: 'instructor@example.test', role: 'USER', level: 'INSTRUCTOR', accessToken: 'grading-link-test'}));
    localStorage.setItem('accToken', 'grading-link-test');
  });
  await page.route('**/v2/**', route => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    let data: unknown = [];
    if (path.endsWith('/me/courses')) data = {items: [{id: 37, courseId: 37, courseCode: 'HVW101', title: 'Academic Writing Studio', courseRole: 'Instructor', status: 'Published'}], page: 0, size: 100, total: 1};
    if (path.endsWith('/notifications/unread-count')) data = {unreadCount: 0};
    if (path.endsWith('/teaching/courses')) data = [{id: 37, courseCode: 'HVW101', title: 'Academic Writing Studio'}];
    if (path.endsWith('/teaching/grading-items')) data = [{courseId: 37, assignmentId: 12, studentUserId: 45, studentFirstName: 'Emily', studentLastName: 'Wong', title: 'Week 1 Diagnostic Essay', gradingDeepLink: '/instructor/courses/37/assignments/12/submissions/45'}];
    if (path.endsWith('/assignments/12/grading-roster')) data = {assignmentId: 12, assignmentTitle: 'Week 1 Diagnostic Essay', courseId: 37, gradingWritable: true, totalCount: 0, enteredCount: 0, releasedCount: 0, items: []};
    return route.fulfill({json: {status: 200, code: 'SUCCESS', data}});
  });
  await page.goto('/my-operations');
  await openSection(page, 'My teaching courses');
  await expect(page.getByRole('link', {name: /Academic Writing Studio/})).toHaveAttribute('href', '/course/37');
  await openSection(page, 'Grading queue');
  const assignment = page.getByRole('link', {name: /Week 1 Diagnostic Essay/});
  await expect(assignment).toHaveAttribute('href', '/course/37/assignments/12/grading');
  await assignment.click();
  await expect(page.getByRole('heading', {name: 'Week 1 Diagnostic Essay'})).toBeVisible();
  await expect(page.getByText('Page not found', {exact: true})).toHaveCount(0);
  expect(requests.some(path => path.endsWith('/courses/37/assignments/12/grading-roster'))).toBe(true);
  expect(errors).toEqual([]);
});

test('Advisor reads paginated conversations and searches instructors through Advisor APIs', async ({page}, testInfo) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({id: 902, userId: 902, email: 'advisor@example.test', role: 'USER', level: 'ADVISOR', accessToken: 'advisor-page-test'}));
    localStorage.setItem('accToken', 'advisor-page-test');
  });
  await page.route('**/v2/**', route => {
    const url = new URL(route.request().url());
    requests.push(url.pathname);
    let data: unknown = {items: [], page: 0, size: 20, total: 0};
    if (url.pathname.endsWith('/unread-count')) data = {unreadCount: 0};
    if (url.pathname.endsWith('/advisor/action-tasks')) data = {items: [{taskId: 61, description: 'Review attendance', status: 'PENDING', priority: 'HIGH', version: 2}], page: 0, size: 20, total: 1};
    if (url.pathname.endsWith('/advisor/action-tasks/61')) data = {taskId: 61, description: 'Review attendance details', status: 'PENDING', priority: 'HIGH', version: 2};
    if (url.pathname.endsWith('/advisor/dashboard')) data = {assignedStudentCount: 21};
    if (url.pathname.endsWith('/advisor/conversations')) {
      const pageIndex = Number(url.searchParams.get('page'));
      data = {page: pageIndex, size: 20, total: 21, items: [{studentUserId: pageIndex ? 42 : 41, studentFirstName: pageIndex ? 'Second' : 'First', studentLastName: 'Student', unreadCount: 2, threadId: 3}]};
    }
    if (url.pathname.endsWith('/advisor/instructors')) data = {page: 0, size: 20, total: 1, items: [{instructorUserId: 11, firstName: 'Ivy', lastName: 'Instructor', email: 'ivy@example.test', level: 'INSTRUCTOR'}]};
    return route.fulfill({json: {status: 200, code: 'SUCCESS', data}});
  });
  await page.goto('/advisor/operations');
  await page.getByRole('link', {name: 'Action tasks', exact: true}).first().click();
  await page.getByRole('button', {name: 'Details', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Review attendance details'})).toBeVisible();
  await page.getByRole('link', {name: 'Messages', exact: true}).first().click();
  await expect(page.getByRole('complementary', {name: 'Student conversations', exact: true}).getByText('First Student', {exact: true})).toBeVisible();
  await page.getByRole('navigation', {name: 'Conversation pages'}).getByRole('button', {name: 'Next'}).click();
  await expect(page.getByRole('complementary', {name: 'Student conversations', exact: true}).getByText('Second Student', {exact: true})).toBeVisible();
  await page.getByRole('link', {name: 'Scheduling', exact: true}).first().click();
  await expect(page.getByRole('option', {name: 'Ivy Instructor · ivy@example.test'}).first()).toBeAttached();
  expect(requests.some(path => path.includes('/tenant/users'))).toBe(false);
  await page.screenshot({path: testInfo.outputPath('advisor-updated-operations.png'), fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
