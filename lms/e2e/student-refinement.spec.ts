import {expect, test, type Page} from '@playwright/test';
import {course, fixture, reply, tasks} from './workspace-fixtures';

const courses = [course, {...course, id: 72, courseCode: 'ENG201', title: 'Argument & Rhetoric', primaryInstructor: {userId: 52, name: 'Michael Lee'}}, {...course, id: 73, courseCode: 'RES301', title: 'Research Methods', primaryInstructor: {userId: 53, name: 'Sophia Patel'}}];
const posts = [{id: 201, authorFirstName: 'Sarah', authorLastName: 'Lim', authorRole: 'Instructor', createdAt: '2026-09-03T12:00:00Z', body: 'Welcome to Week 1. Please post one sentence that states your essay position on the role of automated writing aids before Monday’s live session.', attachments: [{id: 211}]}, {id: 202, authorFirstName: 'James', authorLastName: 'Park', authorRole: 'Student', createdAt: '2026-09-03T14:00:00Z', body: 'Does anybody have a reference for the academic integrity handbook? The study guide references chapter 4.'}];
async function refinedFixture(page: Page) {
  await fixture(page);
  await page.clock.setFixedTime(new Date('2026-09-03T12:00:00'));
  await page.route('**/v2/**', route => {
    const endpoint = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    let data: unknown;
    if (endpoint === '/v2/me/courses') data = {items: courses, total: courses.length, page: 0, size: 100};
    else if (endpoint === '/v2/me/progress') data = {completedAssignmentCount: 11, totalAssignmentCount: 20, courses: courses.map((item, index) => ({courseId: item.id, courseTitle: item.title, completedAssignmentCount: [6, 3, 2][index], totalAssignmentCount: [10, 6, 4][index]})), checkpoints: [{checkpointId: 91, title: 'Submit a diagnostic essay and agree on two recurring error patterns.', status: 'REACHED_COMPLETED', dueDate: '2026-09-21'}]};
    else if (/\/courses\/\d+\/sessions$/.test(endpoint)) data = [{id: 91, dayOfWeek: 'MON', startTime: '10:00:00', endTime: '11:30:00'}];
    else if (endpoint === '/v2/student/study-plan') data = {profileContext: {}, plan: {checkpoints: [{id: 91, description: 'Build your academic writing foundations', tasks: [...tasks, {id: 103, title: 'Read chapters 1–2', dueDate: '2026-09-02', status: 'NOT_STARTED'}, {id: 104, title: 'Research proposal outline', dueDate: '2026-09-25', status: 'IN_PROGRESS'}]}]}};
    else if (endpoint === '/v2/me/events/upcoming') data = [7, 14, 21].map((day, index) => ({courseId: 71, courseCode: 'WR101', title: 'Academic Writing Studio', date: `2026-09-${String(day).padStart(2, '0')}`, startTime: '10:00:00', endTime: '11:30:00', source: 'SESSION', sourceId: 91 + index, timezone: 'America/Los_Angeles'}));
    else if (endpoint === '/v2/me/attendance') data = {presentCount: 3, absentCount: 0, approvedAbsenceCount: 1, items: [{occurrenceId: 91, courseId: 71, courseTitle: course.title, occurrenceDate: '2026-09-01', effectiveStatus: 'PRESENT'}, {occurrenceId: 92, courseId: 71, courseTitle: course.title, occurrenceDate: '2026-08-28', effectiveStatus: 'APPROVED_ABSENCE'}]};
    else if (endpoint === '/v2/me/work-queue') data = [{id: 81, title: 'Review advisor feedback', courseId: 71, checkpointId: 91, taskId: 102, status: 'IN_PROGRESS', dueAt: '2026-09-07T12:00:00Z'}];
    else if (endpoint === '/v2/me/schedule-requests') data = [{id: 101, courseId: 71, courseTitle: course.title, requestType: 'ABSENCE', status: 'PENDING', reason: 'School activity', createdAt: '2026-09-01T12:00:00Z'}];
    else if (endpoint === '/v2/me/courses/71/hours') data = {purchasedMinutes: 1800, usedMinutes: 450, remainingMinutes: 1350};
    else if (endpoint === '/v2/courses/71/student-reports/published/me') data = {items: [{id: 301, title: 'September learning review', reportType: 'MID_TERM', publishedAt: '2026-09-02T12:00:00Z'}], total: 1, page: 1, size: 10};
    else if (endpoint === '/v2/courses/71/student-reports/published/me/301') data = {id: 301, title: 'September learning review', publishedAt: '2026-09-02T12:00:00Z', overallSummary: 'You are making steady progress in developing clear academic arguments.', strengths: 'Well-selected evidence and a clear position.', weaknesses: 'Paragraph transitions need more variety.', improvementSuggestions: 'Write a short outline before each timed response.', performanceSnapshot: {completedSessionCount: 4, presentCount: 3, submittedCount: 2}};
    else if (endpoint === '/v2/me/calendar') data = [{occurrenceId: 91, courseId: 71, title: 'Academic writing workshop', occurrenceDate: '2026-09-07', startTime: '10:00:00', endTime: '11:30:00', timezone: 'America/Los_Angeles'}];
    else if (endpoint === '/v2/courses/71/session-occurrences/91/attendance/me') data = {effectiveStatus: 'UNRECORDED'};
    else if (endpoint === '/v2/courses/71/discussion/posts') data = {items: posts, total: 2, page: 0, size: 10};
    else if (endpoint === '/v2/courses/71/discussion/posts/201/replies') data = {items: [{id: 203, authorFirstName: 'Alex', authorLastName: 'Chen', authorRole: 'Student', createdAt: '2026-09-03T13:00:00Z', body: 'I will argue that writing tools can help with translation, while students still need to evaluate the evidence.'}], total: 1, page: 0, size: 10};
    else if (endpoint === '/v2/courses/71/discussion/posts/201/attachments') data = [{id: 211, originalFilename: 'Writing reference.pdf', previewAvailable: true}];
    else if (endpoint === '/v2/courses/71/my-grades') data = [{assignmentId: 111, assignmentTitle: 'Writing Task 1', released: true, pointsEarned: 8.5, pointsPossible: 10}, {assignmentId: 112, assignmentTitle: 'Grammar assessment', released: true, pointsEarned: 45, pointsPossible: 50}, {assignmentId: 113, assignmentTitle: 'Peer argument review', released: false}];
    else return route.fallback();
    return route.fulfill({json: reply(data)});
  });
}

async function responsiveSnapshot(page: Page, name: string) {
  for (const width of [390, 1440, 1920]) {
    await page.setViewportSize({width, height: 1100});
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.evaluate(() => {document.querySelectorAll<HTMLElement>('main, [class*="scroll"]').forEach(element => element.scrollTop = 0); window.scrollTo(0, 0);});
    await page.screenshot({path: `../docs/evidence/student-refinement-20260903/${name}-${width}.png`, fullPage: false});
  }
}

test('student dashboard, learning overview, and discussion retain their reference composition', async ({page}) => {
  await refinedFixture(page);
  await page.goto('/');
  await expect(page.getByRole('region', {name: 'Advisor Tasks'}).getByText('Overdue', {exact: true})).toBeVisible();
  await expect(page.getByRole('link', {name: /Academic Writing Studio: View course/})).toBeVisible();
  await responsiveSnapshot(page, 'dashboard');
  const assistant = page.getByRole('heading', {name: 'New Chat'});
  const coursesRegion = page.getByRole('region', {name: 'My courses', exact: true});
  expect((await assistant.boundingBox())!.x).toBeLessThan((await coursesRegion.boundingBox())!.x);
  const card = coursesRegion.locator('article').first();
  const before = await card.boundingBox();
  await card.hover();
  await expect.poll(() => card.evaluate(element => getComputedStyle(element, '::before').opacity)).toBe('1');
  expect((await card.boundingBox())!.height).toEqual(before!.height);
  await page.getByRole('button', {name: 'Monday, September 7, 2026', exact: true}).click();
  await expect(page.getByRole('link', {name: 'Open WR101: Academic Writing Studio'})).toHaveCount(1);
  await page.getByRole('button', {name: 'Show upcoming classes', exact: true}).click();
  await expect(page.getByRole('link', {name: 'Open WR101: Academic Writing Studio'})).toHaveCount(3);
  await page.setViewportSize({width: 390, height: 1100});
  await page.getByRole('button', {name: 'Next courses', exact: true}).click();
  await expect(page.getByRole('link', {name: 'Argument & Rhetoric: View course'})).toBeInViewport();
  await page.goto('/my-plan?view=learning');
  await expect(page.getByRole('progressbar', {name: 'Assignment completion', exact: true}).first()).toHaveAttribute('aria-valuenow', '55');
  await responsiveSnapshot(page, 'learning');
  await page.getByRole('region', {name: 'Attendance', exact: true}).scrollIntoViewIfNeeded();
  await page.screenshot({path: '../docs/evidence/student-refinement-20260903/learning-lower-1920.png'});
  await page.goto('/course/71');
  await page.getByRole('button', {name: 'Discussion', exact: true}).click();
  await expect(page.getByText(posts[0].body)).toBeVisible();
  await page.getByRole('button', {name: 'View replies & attachments'}).first().click();
  await expect(page.getByRole('heading', {name: 'Replies (1)'})).toBeVisible();
  await responsiveSnapshot(page, 'discussion');
});

test('learning details use course filters, published reports, and dated schedule requests', async ({page}) => {
  await refinedFixture(page);
  const attendanceQueries: string[] = [];
  const reportPages: string[] = [];
  page.on('request', request => {const url = new URL(request.url()); if (url.pathname.endsWith('/me/attendance')) attendanceQueries.push(url.search); if (url.pathname.endsWith('/student-reports/published/me')) reportPages.push(url.search);});
  const writes: Array<{body: Record<string, unknown>; key?: string}> = [];
  await page.route('**/v2/courses/71/session-occurrences/91/schedule-requests', route => {writes.push({body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']}); return route.fulfill({json: reply({id: 911, status: 'PENDING'})});});
  await page.goto('/my-plan?view=learning');
  await page.getByRole('combobox', {name: 'Learning course', exact: true}).selectOption('71');
  await expect.poll(() => attendanceQueries.some(search => search.includes('courseId=71'))).toBe(true);
  await expect(page.getByRole('progressbar', {name: 'Assignment completion', exact: true}).first()).toHaveAttribute('aria-valuenow', '60');
  await page.getByRole('button', {name: 'View details', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Course hours', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'View report', exact: true}).click();
  await expect(page.getByText('Well-selected evidence and a clear position.')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Performance at publication'})).toBeVisible();
  expect(reportPages[0]).toContain('page=1');
  await page.getByRole('button', {name: 'Back to reports'}).click();
  await page.getByRole('button', {name: 'Schedule changes', exact: true}).click();
  await page.getByRole('button', {name: /Academic writing workshop/}).click();
  await page.getByLabel('Proposed date', {exact: true}).fill('09/10/2026');
  await page.keyboard.press('Escape');
  await page.getByLabel('Proposed start', {exact: true}).fill('10:00 AM');
  await page.keyboard.press('Escape');
  await page.getByLabel('Proposed end', {exact: true}).fill('11:30 AM');
  await page.keyboard.press('Escape');
  await page.getByLabel('Reason', {exact: true}).fill('School activity');
  await page.getByRole('button', {name: 'Submit request', exact: true}).click();
  await expect(page.getByText('Your request has been submitted.')).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual({requestType: 'SCHEDULE_CHANGE', reason: 'School activity', proposedOccurrenceDate: '2026-09-10', proposedStartTime: '10:00:00', proposedEndTime: '11:30:00'});
  expect(writes[0].key).toBeTruthy();
  await expect(page.getByText('Approved', {exact: true})).toHaveCount(0);
});

test('discussion preserves a failed draft and submits reply attachments without a nested thread', async ({page}) => {
  await refinedFixture(page);
  const writes: Array<{body: string; type?: string; key?: string}> = [];
  await page.route('**/v2/courses/71/discussion/posts/201/replies', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    writes.push({body: route.request().postData() ?? '', type: route.request().headers()['content-type'], key: route.request().headers()['idempotency-key']});
    return writes.length === 1 ? route.fulfill({status: 503, json: {status: 503, code: 'UNAVAILABLE', message: 'Please try again'}}) : route.fulfill({json: reply({id: 204})});
  });
  await page.route('**/v2/courses/71/discussion/posts/201/attachments/211/*', route => route.fulfill({contentType: 'application/pdf', body: '%PDF-1.4 fixture'}));
  await page.goto('/course/71');
  await page.getByRole('button', {name: 'Discussion', exact: true}).click();
  await page.getByRole('button', {name: 'View replies & attachments'}).first().click();
  const thread = page.getByRole('region', {name: 'Discussion thread'});
  const downloadPromise = page.waitForEvent('download');
  await thread.getByRole('button', {name: 'Download', exact: true}).click();
  expect((await downloadPromise).suggestedFilename()).toBe('Writing reference.pdf');
  const previewResponse = page.waitForResponse(response => response.url().endsWith('/attachments/211/preview'));
  const popupPromise = page.waitForEvent('popup');
  await thread.getByRole('button', {name: 'Preview Writing reference.pdf'}).click();
  const popup = await popupPromise;
  expect((await previewResponse).ok()).toBe(true);
  await expect(thread.getByRole('button', {name: 'Download', exact: true})).toBeEnabled();
  await expect(thread.getByRole('alert')).toHaveCount(0);
  await popup.close();
  await thread.getByRole('textbox', {name: 'Reply to this post'}).fill('Here is the reference for our discussion.');
  await thread.getByLabel('Reply attachments').setInputFiles({name: 'reference.txt', mimeType: 'text/plain', buffer: Buffer.from('Academic writing reference')});
  await expect(thread.getByText('reference.txt', {exact: true})).toBeVisible();
  await thread.getByRole('button', {name: 'Reply', exact: true}).click();
  await expect(thread.getByRole('alert')).toBeVisible();
  await expect(thread.getByRole('textbox')).toHaveValue('Here is the reference for our discussion.');
  await expect(thread.getByText('reference.txt', {exact: true})).toBeVisible();
  await thread.getByRole('button', {name: 'Reply', exact: true}).click();
  await expect(thread.getByRole('textbox')).toHaveValue('');
  expect(writes).toHaveLength(2);
  expect(writes[1].type).toContain('multipart/form-data');
  expect(writes[1].body).toContain('reference.txt');
  expect(writes[1].body).toContain('Here is the reference');
  expect(writes[0].key).toBeTruthy();
  expect(writes[0].key).toBe(writes[1].key);
  await expect(thread.getByRole('button', {name: 'View replies & attachments'})).toHaveCount(0);
});
