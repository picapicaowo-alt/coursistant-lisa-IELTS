import {expect, test, type Page} from '@playwright/test';
import {course, fixture, profile, reply, tasks} from './workspace-fixtures';

async function noOverflow(page: Page, width: number) {
  await page.setViewportSize({width, height: 1000});
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

test('enrolments remain visible without deadlines and learning modules share the desktop canvas', async ({page}, info) => {
  await fixture(page);
  await page.goto('/');
  await expect(page.getByRole('link', {name: /Academic Writing Studio.*View course/})).toHaveAttribute('href', '/course/71');
  await expect(page.getByRole('region', {name: 'Advisor Tasks'}).getByText(tasks[0].title)).toBeVisible();
  for (const width of [390, 1440, 1920]) {await noOverflow(page, width); await page.screenshot({path: `/tmp/xlearn-final-dashboard/student-${width}.png`, fullPage: true});}
  await page.getByRole('link', {name: 'Study Plan', exact: true}).click();
  await page.getByRole('button', {name: 'Learning overview', exact: true}).click();
  const progress = page.getByRole('region', {name: 'Learning progress', exact: true});
  const alerts = page.getByRole('region', {name: 'Alerts', exact: true});
  await expect(progress).toBeVisible();
  for (const width of [320, 390, 768, 1440, 1920, 2560]) {
    await noOverflow(page, width);
    const [main, side] = await Promise.all([progress.boundingBox(), alerts.boundingBox()]);
    if (width >= 1440) {
      expect(Math.abs(main!.y - side!.y)).toBeLessThan(2);
      expect(side!.x).toBeGreaterThan(main!.x + main!.width);
      expect(main!.width / side!.width).toBeGreaterThan(1.8);
      expect(main!.width + side!.width).toBeGreaterThan(width * .65);
    }
    await page.screenshot({path: info.outputPath(`student-learning-${width}.png`), fullPage: true});
  }
  await noOverflow(page, 768);
  const attendance = page.getByRole('region', {name: 'Attendance', exact: true});
  expect(Math.abs((await attendance.boundingBox())!.width - (await alerts.boundingBox())!.width)).toBeLessThan(2);
  await page.goto('/my-operations');
  await expect(page).toHaveURL(/\/my-plan\?view=learning$/);
});

test('advisor sidebar routes operations out of the dashboard', async ({page}, info) => {
  await fixture(page, 'ADVISOR');
  await page.goto('/advisor/operations');
  await expect(page.getByRole('region', {name: 'Action tasks', exact: true})).toHaveCount(0);
  await expect(page.getByLabel('Search conversations')).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'New Chat'})).toHaveCount(0);
  await expect(page.getByRole('textbox', {name: 'Ask the advising assistant'})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Send message', exact: true})).toHaveCount(0);
  await noOverflow(page, 1440);
  await page.getByRole('heading', {name: /Welcome back/}).scrollIntoViewIfNeeded();
  await page.screenshot({path: info.outputPath('advisor-dashboard.png'), fullPage: true});
  for (const [name, url] of [['Course management', '/advisor/courses'], ['Action tasks', '/advisor/tasks'], ['Scheduling', '/advisor/schedule']]) {
    await page.getByRole('link', {name, exact: true}).first().click();
    await expect(page).toHaveURL(new RegExp(`${url}$`));
    await expect(page.getByRole('heading', {name, level: 1})).toBeVisible();
    await noOverflow(page, 1920);
    await page.screenshot({path: info.outputPath(`${name}-1920.png`), fullPage: true});
  }
  await page.goto('/advisor/operations#action-tasks');
  await expect(page).toHaveURL(/\/advisor\/tasks$/);
});

test('advisor student summary and journey follow the Figma composition with real decisions', async ({page}, info) => {
  await fixture(page, 'ADVISOR');
  const decisions: Array<{body: Record<string, unknown>; key?: string}> = [];
  let pending = true;
  const checkpoints = [{id: 91, goal: 'Build foundations', description: 'Use specific examples.', tasks: [tasks[1]]}, {id: 92, goal: 'Write with confidence', description: 'Practice a timed response.', tasks: [tasks[0]]}, {id: 93, goal: 'Review and refine', description: 'Reflect on feedback.', tasks: []}];
  await page.route('**/v2/advisor/students/301/study-plan/revisions?**', route => route.fulfill({json: reply({items: [], total: 0, page: 0, size: 20})}));
  await page.route('**/v2/advisor/students/301/profile', route => route.fulfill({json: reply({...profile, skills: ['Reading', 'Writing', 'Speaking', 'Listening'].map((name, index) => ({skillCode: name.toUpperCase(), displayName: name, currentValue: String(5 + index / 2), targetValue: '7'}))})}));
  await page.route('**/v2/advisor/students/301/study-plan', route => route.fulfill({json: reply({plan: {studyPlanVersion: 1, strategySummary: 'Practice, feedback, reflection.', checkpoints}, profileContext: {}})}));
  await page.route('**/v2/advisor/schedule-requests**', route => {
    if (route.request().method() !== 'GET') {decisions.push({body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']}); pending = false; return route.fulfill({json: reply({id: 81, status: 'APPROVED', version: 3})});}
    return route.fulfill({json: reply({items: pending ? [{id: 81, studentUserId: 301, courseId: course.id, requestType: 'SCHEDULE_CHANGE', status: 'PENDING', reason: 'School activity', proposedOccurrenceDate: '2026-09-18', proposedStartTime: '10:00', proposedEndTime: '11:00', version: 2}] : [], total: pending ? 1 : 0})});
  });
  await page.goto('/advisor/students/301/study-plan');
  const summary = page.locator('header[aria-label="Student profile summary"]');
  const journey = page.getByRole('region', {name: 'Learning Journey', exact: true});
  const requests = page.getByRole('region', {name: 'Student pending requests'});
  await expect(summary.getByRole('progressbar', {name: 'Advisor task completion'})).toHaveAttribute('aria-valuenow', '50');
  await expect(page.getByRole('navigation', {name: 'Student advising sections'}).getByRole('link').nth(2)).toHaveText('Exams');
  for (const width of [390, 768, 1440, 1920, 2560]) {
    await noOverflow(page, width);
    if (width >= 1440) {
      const [main, side] = await Promise.all([journey.boundingBox(), requests.boundingBox()]);
      expect(side!.x).toBeGreaterThan(main!.x + main!.width);
      const boxes = await Promise.all((await journey.locator('article').all()).map(phase => phase.boundingBox()));
      expect(Math.max(...boxes.map(box => box!.y)) - Math.min(...boxes.map(box => box!.y))).toBeLessThan(2);
    }
    await page.screenshot({path: info.outputPath(`advisor-student-${width}.png`), fullPage: true});
  }
  await page.getByRole('button', {name: 'View phase 2', exact: true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name: 'View', exact: true}).click();
  await expect(dialog.getByRole('region', {name: 'Task details'}).getByText(tasks[0].description!)).toBeVisible();
  await dialog.getByRole('button', {name: 'Completed: 0', exact: true}).click();
  await expect(dialog.getByRole('region', {name: 'Task details'}).getByRole('heading')).toHaveText(tasks[0].title!);
  await dialog.getByRole('button', {name: 'Close dialog'}).click();
  await requests.getByRole('button', {name: 'Approve', exact: true}).click();
  await expect.poll(() => decisions.length).toBe(1);
  expect(decisions[0].body).toMatchObject({decision: 'APPROVE', expectedVersion: 2});
  expect(decisions[0].key).toBeTruthy();
  await expect(requests.getByText('No pending requests.')).toBeVisible();
});

async function adminFixture(page: Page) {
  await fixture(page);
  await page.addInitScript(() => {const user = {id: 801, userId: 801, role: 'TENANT_ADMIN', email: 'admin@example.test', accessToken: 'isolated-workspace-fixture'}; localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('accToken', user.accessToken);});
}

test('directory refresh preserves filters and visibly updates records', async ({page}, info) => {
  await adminFixture(page);
  const queries: URLSearchParams[] = [];
  let filteredReads = 0;
  await page.route('**/v2/tenant/users?**', async route => {
    const params = new URL(route.request().url()).searchParams; queries.push(params);
    if (params.get('q')) {filteredReads++; await new Promise(resolve => setTimeout(resolve, 180));}
    return route.fulfill({json: reply({items: [{id: 21, firstName: 'Rachel', lastName: filteredReads > 1 ? 'Updated' : 'Wong', email: 'rachel@example.test', role: 'USER', level: 'PARENT', status: 'ACTIVE'}], total: 1, page: 0, size: 20})});
  });
  await page.goto('/admin');
  await expect(page.getByRole('button', {name: 'Refresh directory'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Clear filters'})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Refresh directory'})).toHaveAttribute('title', 'Refresh directory');
  await page.getByRole('textbox', {name: 'Search by name or email'}).fill('Rachel');
  await expect(page.getByRole('button', {name: 'Clear filters'})).toBeVisible();
  await page.getByRole('button', {name: 'Apply filters', exact: true}).click();
  await expect(page.getByRole('region', {name: 'User directory'}).getByText('Rachel Wong')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Refresh directory'})).toBeEnabled();
  await page.getByRole('button', {name: 'Refresh directory'}).click();
  await expect(page.getByRole('button', {name: 'Refresh directory'})).toBeDisabled();
  await expect(page.getByText('Directory refreshed.', {exact: false})).toBeVisible();
  await expect(page.getByText('Rachel Updated')).toBeVisible();
  expect(queries.at(-1)?.get('q')).toBe('Rachel');
  await page.screenshot({path: info.outputPath('directory-refreshed.png'), fullPage: true});
  await page.getByRole('button', {name: 'Clear filters'}).click();
  await expect(page.getByRole('textbox', {name: 'Search by name or email'})).toHaveValue('');
  await expect(page.getByRole('button', {name: 'Clear filters'})).toHaveCount(0);
});

test('create intake modal preserves drafts after errors and restores focus on dismissal', async ({page}, info) => {
  await adminFixture(page);
  const writes: Array<{key?: string; body: Record<string, unknown>}> = [];
  await page.route('**/v2/tenant/student-intakes**', route => {
    if (route.request().method() === 'POST') {
      writes.push({key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON()});
      if (writes.length === 1) return route.fulfill({status: 503, json: {status: 503, code: 'UNAVAILABLE', message: 'Please try again'}});
      return route.fulfill({json: reply({intakeId: 71, studentUserId: 301, firstName: 'Alex', lastName: 'Chen', studentType: 'STANDARD', assignmentStatus: 'UNASSIGNED'})});
    }
    return route.fulfill({json: reply({items: [], total: 0, page: 0, size: 20})});
  });
  await page.goto('/admin/intakes');
  const trigger = page.getByRole('button', {name: 'Create student intake', exact: true});
  const before = await page.getByRole('heading', {name: 'Student intakes', exact: true}).boundingBox();
  await trigger.click();
  const dialog = page.getByRole('dialog', {name: 'Create student intake'});
  await expect(dialog.getByLabel('First name *')).toBeFocused();
  const fieldStyle = await dialog.getByLabel('First name *').evaluate(element => {const style = getComputedStyle(element); return {border: parseFloat(style.borderTopWidth), height: element.getBoundingClientRect().height};});
  expect(fieldStyle.border).toBeGreaterThanOrEqual(1);
  expect(fieldStyle.height).toBeGreaterThanOrEqual(44);
  expect(await page.getByRole('heading', {name: 'Student intakes', exact: true}).boundingBox()).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByLabel('First name *').fill('Alex');
  await dialog.getByLabel('Last name *').fill('Chen');
  await dialog.getByLabel('Email *').fill('alex@example.test');
  await dialog.getByLabel('Course request *').fill('Improve academic writing');
  await dialog.getByRole('button', {name: 'Create intake', exact: true}).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Course request *')).toHaveValue('Improve academic writing');
  for (const width of [390, 1440, 2560]) {
    await noOverflow(page, width);
    await expect(dialog.getByRole('button', {name: 'Create intake', exact: true})).toBeInViewport();
    await page.screenshot({path: info.outputPath(`create-intake-${width}.png`)});
  }
  await dialog.getByRole('button', {name: 'Create intake', exact: true}).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(2);
  expect(writes[0].key).toBeTruthy();
  expect(writes[0].key).toBe(writes[1].key);
  expect(writes[1].body).toMatchObject({firstName: 'Alex', lastName: 'Chen', courseRequest: 'Improve academic writing'});
});

test('settings compiles real token colors and saves through the profile API', async ({page}, info) => {
  await fixture(page);
  const writes: Record<string, unknown>[] = [];
  await page.route('**/v2/me/profile', route => {
    if (route.request().method() !== 'GET') writes.push(route.request().postDataJSON());
    return route.fulfill({json: reply({firstName: writes.length ? 'Jamie' : 'Alex', lastName: 'Chen', email: 'review@example.test', role: 'USER', level: 'STUDENT', emailNotifications: true})});
  });
  await page.goto('/settings');
  await page.getByRole('textbox', {name: 'First name', exact: true}).fill('Jamie');
  const save = page.getByRole('button', {name: 'Save account', exact: true});
  const colors = await save.evaluate(element => {const style = getComputedStyle(element); return {background: style.backgroundColor, color: style.color};});
  expect(colors.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(colors.background).not.toBe(colors.color);
  await save.click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].firstName).toBe('Jamie');
  await noOverflow(page, 390);
  await page.screenshot({path: info.outputPath('settings-390.png'), fullPage: true});
});

test('course material fills the workspace with no unsupported AI controls', async ({page}, info) => {
  await fixture(page);
  let aiRequests = 0;
  page.on('request', request => { if (request.url().includes('/study-support/')) aiRequests++; });
  await page.goto('/course/71?materialId=121');
  await expect(page.getByRole('heading', {name: 'Academic writing guide'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'AI Course', exact: true})).toHaveCount(0);
  for (const width of [390, 768, 1440, 2560]) {
    await noOverflow(page, width);
    await page.screenshot({path: info.outputPath(`course-material-${width}.png`), fullPage: true});
  }
  expect(aiRequests).toBe(0);
});

test('writing exam confirms, submits actual text and shows the returned success state', async ({page}, info) => {
  await fixture(page);
  const writes: Record<string, unknown>[] = [];
  await page.route('**/v2/student/mock-exams/77**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/attempts')) return route.fulfill({json: reply({attemptId: 81})});
    if (route.request().method() === 'POST') {writes.push(route.request().postDataJSON()); return route.fulfill({json: reply({submissionId: 91, writingId: 77})});}
    return route.fulfill({json: reply(path.endsWith('/writing') ? {id: 77, totalMinutes: 60, tasks: [{id: 1, seq: 1, taskKey: 'task-1', title: 'Writing Task 1', prompt: 'Describe a useful learning strategy.', minWords: 1, hasImage: false}]} : {id: 77, title: 'Writing practice', writingSelected: true})});
  });
  await page.goto('/mock-exams/77/writing');
  await page.getByRole('textbox').fill('Regular practice and specific feedback improve learning.');
  await page.getByRole('button', {name: /Finish/}).click();
  await expect(page.getByRole('dialog', {name: 'Ready to submit?'})).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByRole('button', {name: 'Submit section', exact: true}).click();
  await expect(page.getByRole('dialog', {name: 'Section submitted'})).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({tasks: [{taskKey: 'task-1', content: 'Regular practice and specific feedback improve learning.'}]});
  await page.screenshot({path: info.outputPath('exam-submitted.png')});
  await page.getByRole('button', {name: 'View results'}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('six journey phases and long task lists remain usable on desktop and mobile', async ({page}, info) => {
  await fixture(page, 'ADVISOR');
  const checkpoints = Array.from({length: 6}, (_, index) => ({id: 91 + index, goal: `Milestone ${index + 1}`, tasks: Array.from({length: 12}, (_, task) => ({...tasks[0], id: 100 + index * 12 + task, title: `Practice task ${task + 1}`}))}));
  await page.route('**/v2/advisor/students/301/study-plan/revisions?**', route => route.fulfill({json: reply({items: [], total: 0})}));
  await page.route('**/v2/advisor/students/301/study-plan', route => route.fulfill({json: reply({plan: {studyPlanVersion: 1, checkpoints}, profileContext: {}})}));
  await page.goto('/advisor/students/301/study-plan');
  await noOverflow(page, 1440);
  const phases = page.getByRole('region', {name: 'Learning Journey', exact: true}).locator('article');
  const first = (await phases.nth(0).boundingBox())!;
  const secondRowMarker = (await phases.nth(3).locator('span[aria-hidden="true"]').first().boundingBox())!;
  expect(secondRowMarker.y).toBeGreaterThan(first.y + first.height);
  await page.screenshot({path: info.outputPath('six-phases-1440.png'), fullPage: true});
  await page.setViewportSize({width: 390, height: 720});
  await page.getByRole('button', {name: 'View phase 1', exact: true}).click();
  const dialog = page.getByRole('dialog');
  const last = dialog.getByRole('button', {name: 'View', exact: true}).last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await last.click();
  await expect(dialog.getByRole('heading', {name: 'Practice task 12'})).toBeVisible();
  await page.screenshot({path: info.outputPath('task-detail-390.png')});
});

test('schedule version conflicts stay blocked after a failed reload', async ({page}) => {
  await fixture(page, 'ADVISOR');
  let writes = 0;
  let failReload = false;
  await page.route('**/v2/advisor/students/301/study-plan', route => route.fulfill({json: reply({plan: {studyPlanVersion: 1, checkpoints: [{id: 91, goal: 'Practice writing', tasks}]}, profileContext: {}})}));
  await page.route('**/v2/advisor/students/301/study-plan/revisions?**', route => route.fulfill({json: reply({items: [], total: 0})}));
  await page.route('**/v2/advisor/schedule-requests**', route => {
    if (route.request().method() !== 'GET') {writes++; failReload = true; return route.fulfill({status: 409, json: {status: 409, message: 'This request has changed.', code: 'SCHEDULE_REQUEST_STATE_CONFLICT'}});}
    if (failReload) return route.fulfill({status: 503, json: {status: 503, message: 'Service unavailable'}});
    return route.fulfill({json: reply({items: [{id: 81, studentUserId: 301, courseId: 71, status: 'PENDING', version: 2}], total: 1})});
  });
  await page.goto('/advisor/students/301/study-plan');
  const requests = page.getByRole('region', {name: 'Student pending requests'});
  await requests.getByRole('button', {name: 'Approve', exact: true}).click();
  const reload = requests.getByRole('button', {name: 'Reload request before deciding'});
  await expect(reload).toBeVisible();
  await reload.click();
  await expect(requests.getByText('The latest request could not be loaded. Please retry before deciding.')).toBeVisible();
  await expect(requests.getByRole('button', {name: 'Approve', exact: true})).toBeDisabled();
  expect(writes).toBe(1);
});

test('public registration links are hidden and bookmarked signup returns to login', async ({page}) => {
  const registrationRequests: string[] = [];
  await page.route('**/v1/auth/**', route => {
    registrationRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto('/signup?invitation=legacy');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', {name: 'Welcome to X-Learn', exact: true})).toBeVisible();
  await expect(page.locator('a[href="/signup"]')).toHaveCount(0);
  await expect(page.getByLabel('Verification code', {exact: true})).toHaveCount(0);
  await page.getByRole('link', {name: 'Forgot password?', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Forgot password?', exact: true})).toBeVisible();
  await expect(page.locator('a[href="/signup"]')).toHaveCount(0);
  expect(registrationRequests).toEqual([]);
});

test('intake clear filters appears only for draft or applied criteria and refresh preserves them', async ({page}) => {
  await adminFixture(page);
  const reads: URLSearchParams[] = [];
  await page.route('**/v2/tenant/student-intakes?**', route => {
    reads.push(new URL(route.request().url()).searchParams);
    return route.fulfill({json: reply({items: [], total: 0, page: 0, size: 20})});
  });
  await page.goto('/admin/intakes');
  const refresh = page.getByRole('button', {name: 'Refresh intakes'});
  const clear = page.getByRole('button', {name: 'Clear filters'});
  await expect(refresh).toBeEnabled();
  await expect(refresh).toHaveAttribute('title', 'Refresh intakes');
  await expect(clear).toHaveCount(0);
  await page.getByPlaceholder('Search intakes').fill('Rachel');
  await expect(clear).toBeVisible();
  await page.getByRole('button', {name: 'Apply filters'}).click();
  await expect.poll(() => reads.at(-1)?.get('q')).toBe('Rachel');
  await expect(refresh).toBeEnabled();
  const previousReads = reads.length;
  await refresh.click();
  await expect.poll(() => reads.length).toBeGreaterThan(previousReads);
  expect(reads.at(-1)?.get('q')).toBe('Rachel');
  await page.getByPlaceholder('Search intakes').fill('');
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(clear).toHaveCount(0);
  // The unfiltered list may already be fresh in the query cache.
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(null);
  await expect(page.getByPlaceholder('Search intakes')).toHaveValue('');
});
