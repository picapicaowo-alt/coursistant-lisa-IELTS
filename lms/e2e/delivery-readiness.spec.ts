import {expect, test, type Page} from '@playwright/test';

const success = (data: unknown) => ({status: 200, code: 'SUCCESS', data});
async function student(page: Page, level = 'STUDENT') {
  await page.addInitScript(level => {
    localStorage.setItem('user', JSON.stringify({id: 901, userId: 901, email: 'readiness@example.test', name: '', role: 'USER', level, accessToken: 'isolated-readiness-fixture'}));
    localStorage.setItem('accToken', 'isolated-readiness-fixture');
  }, level);
  await page.route('**/v2/**', route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    let data: unknown = [];
    if (path === '/v2/me/profile') data = {userId: 901, firstName: 'Alex', middleName: 'J', lastName: 'Chen', avatarUrl: null};
    else if (path === '/v2/me/courses') data = {items: [{id: 71, courseCode: 'WR101', title: 'Academic Writing Studio', role: 'Student', state: 'Active'}], total: 1, page: 0, size: 100};
    else if (path === '/v2/me/attendance') data = {presentCount: 0, absentCount: 0, approvedAbsenceCount: 0, items: []};
    else if (path === '/v2/me/progress') data = {courses: []};
    else if (path === '/v2/student/study-plan') data = {plan: {checkpoints: []}};
    else if (path.endsWith('/unread-count')) data = {unreadCount: 0};
    return route.fulfill({json: success(data)});
  });
}

test('reports use the student-wide zero-based feed and explicit report course identity', async ({page}, info) => {
  await student(page);
  const requests: URLSearchParams[] = [];
  let fail = false;
  await page.route('**/v2/me/student-reports?*', route => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(params);
    if (fail) return route.fulfill({status: 503, json: {code: 'UNAVAILABLE', message: 'Unavailable'}});
    const pageNumber = Number(params.get('page'));
    return route.fulfill({json: success({items: [{id: pageNumber ? 302 : 301, courseId: 88, title: pageNumber ? 'Final review' : 'Earlier course review', courseTitle: 'Previous writing course', reportType: 'FINAL', publishedAt: '2026-09-01T12:00:00Z'}], page: pageNumber, size: 10, total: 11})});
  });
  await page.route('**/v2/courses/88/student-reports/published/me/301', route => route.fulfill({json: success({id: 301, courseId: 88, title: 'Earlier course review', overallSummary: 'A clear improvement in argument structure.', performanceSnapshot: {presentCount: 0, releasedScoreAverage: 82}})}));
  await page.goto('/my-plan?view=learning');
  await page.getByRole('button', {name: 'View published reports', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Earlier course review'})).toBeVisible();
  expect(requests[0].get('page')).toBe('0');
  expect(requests[0].get('size')).toBe('10');
  expect(requests[0].has('courseId')).toBe(false);
  await page.getByRole('button', {name: 'View report', exact: true}).click();
  await expect(page.getByText('A clear improvement in argument structure.')).toBeVisible();
  await expect(page.getByText('82', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Back to reports'}).click();
  await page.getByRole('navigation', {name: 'Published reports pages'}).getByRole('button', {name: 'Next'}).click();
  await expect(page.getByRole('heading', {name: 'Final review'})).toBeVisible();
  expect(requests.at(-1)?.get('page')).toBe('1');
  await page.getByRole('combobox', {name: 'Report type'}).selectOption('FINAL');
  await expect.poll(() => requests.at(-1)?.get('reportType')).toBe('FINAL');
  expect(requests.at(-1)?.get('page')).toBe('0');
  await page.getByRole('combobox', {name: 'Learning course'}).selectOption('71');
  await expect.poll(() => requests.at(-1)?.get('courseId')).toBe('71');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width, height: 960});
    await expect(page.getByRole('button', {name: 'View report', exact: true})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path: info.outputPath(`reports-${width}.png`), fullPage: true});
  }
  fail = true;
  await page.getByRole('combobox', {name: 'Report type'}).selectOption('MID_TERM');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('No published reports.', {exact: true})).toHaveCount(0);
});

test('login without a display name resolves the structured profile and compact dashboard uses its width', async ({page}, info) => {
  await student(page);
  await page.setViewportSize({width: 1155, height: 900});
  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Welcome back, Alex J Chen!'})).toBeVisible();
  await expect(page.getByText('Your profile', {exact: true})).toHaveCount(0);
  const strip = page.getByLabel('Active courses');
  const card = strip.locator('article');
  const bounds = await strip.boundingBox();
  expect((await card.boundingBox())!.width).toBeGreaterThan(bounds!.width * 0.9);
  const side = await page.getByRole('complementary', {name: 'Schedule and alerts'}).boundingBox();
  expect(side!.x).toBeGreaterThan(bounds!.x);
  await page.screenshot({path: info.outputPath('student-home-1155.png'), fullPage: true});
});

for (const path of ['/post', '/post/1', '/create/assignment']) test(`legacy ${path} opens real courses without prototype controls`, async ({page}) => {
  await student(page, path.startsWith('/create') ? 'INSTRUCTOR' : 'STUDENT');
  await page.goto(path);
  await expect(page).toHaveURL(/\/course$/);
  await expect(page.getByRole('heading', {name: /My courses/i})).toBeVisible();
  await expect(page.getByText('What is Programming?', {exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'New Post'})).toHaveCount(0);
});
