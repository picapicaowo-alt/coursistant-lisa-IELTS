import {expect, test} from '@playwright/test';
import {fixture, reply, course} from './workspace-fixtures';

const pageOf = (items: unknown[], page = 0, total = items.length) => ({items, page, size: 20, total});

test('owner Advisor creates, reschedules and cancels dated classes using returned versions', async ({page}) => {
  await fixture(page, 'ADVISOR');
  let record: {id: number; courseId: number; occurrenceDate: string; startTime: string; endTime: string; version: number; current: boolean; status: string; timezone: string} | undefined;
  const writes: Array<{path: string; body: Record<string, unknown>}> = [];
  await page.route('**/v2/advisor/courses/71/delivery-config', route => route.fulfill({json: reply({courseId: 71, deliveryMode: 'ONE_ON_ONE', launchState: 'PUBLISHED', courseLaunchVersion: 2})}));
  await page.route('**/v2/courses/71/session-occurrences**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); writes.push({path, body});
      if (path.endsWith('/cancel') && record) record = {...record, version: record.version + 1, status: 'CANCELLED', current: false};
      else if (path.endsWith('/reschedule') && record) record = {...record, ...body, version: record.version + 1};
      else record = {id: 51, courseId: 71, occurrenceDate: body.occurrenceDate, startTime: body.startTime, endTime: body.endTime, version: 0, current: true, status: 'SCHEDULED', timezone: 'America/Los_Angeles'};
      return route.fulfill({json: reply(record)});
    }
    return route.fulfill({json: reply(record ? [record] : [])});
  });
  await page.goto('/advisor/courses/71/delivery');
  const region = page.getByRole('region', {name: 'Dated classes'});
  await region.getByRole('button', {name: 'Add dated class'}).click();
  await region.getByRole('textbox', {name: /^Date /}).fill('09/10/2026');
  await region.getByRole('textbox', {name: /^Start /}).fill('09:00 AM');
  await region.getByRole('textbox', {name: /^End /}).fill('10:00 AM');
  await region.getByRole('button', {name: 'Save class'}).click();
  await region.getByRole('button', {name: 'Reschedule', exact: true}).click();
  await region.getByRole('textbox', {name: /^Date /}).fill('09/11/2026');
  await region.getByRole('button', {name: 'Save class'}).click();
  await expect(region.getByText(/2026-09-11 · 09:00/)).toBeVisible();
  await region.getByRole('button', {name: 'Cancel class', exact: true}).click();
  await region.getByRole('button', {name: 'Confirm cancellation'}).click();
  await expect(region.getByText(/CANCELLED/)).toBeVisible();
  expect(writes.map(write => write.body.expectedVersion)).toEqual([undefined, 0, 1]);
  await expect(region.getByRole('button', {name: 'Reschedule', exact: true})).toHaveCount(0);
});

test('instructor page two opens group grading using the exact group identity', async ({page}) => {
  await fixture(page, 'INSTRUCTOR', 'Instructor');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/v2/me/teaching/grading-items**', route => {
    const index = Number(new URL(route.request().url()).searchParams.get('page'));
    return route.fulfill({json: reply(pageOf(index ? [{courseId: 71, assignmentId: 12, submissionType: 'Group', groupId: 8, groupName: 'Writing partners', studentUserId: null, title: 'Group argument', status: 'PENDING', dueAtUtc: '2026-09-10T02:00:00Z', timezone: 'America/Los_Angeles', gradingDeepLink: '/courses/71/assignments/12/groups/8/grading'}] : [{courseId: 71, assignmentId: 13, submissionType: 'Individual', studentUserId: 301, title: 'Individual essay', gradingDeepLink: '/courses/71/assignments/13/grading/301'}], index, 21))});
  });
  await page.route('**/v2/courses/71/assignments/12/grading-roster', route => route.fulfill({json: reply({assignmentId: 12, assignmentTitle: 'Group argument', gradingWritable: true, items: [{groupId: 8, groupName: 'Writing partners', memberCount: 2, gradeStatus: 'Ungraded', submissionStatus: 'NotSubmitted'}]})}));
  await page.route('**/v2/courses/71/assignments/12/groups/8/grading-view', route => route.fulfill({json: reply({grade: null})}));
  await page.goto('/my-operations');
  await expect(page.getByRole('link', {name: /Individual essay/})).toHaveAttribute('href', '/course/71/assignments/13/grading/301');
  await page.getByRole('navigation', {name: 'Grading queue pages'}).getByRole('button', {name: 'Next'}).click();
  const target = page.getByRole('link', {name: /Group argument/});
  await expect(target).toContainText('Writing partners');
  await expect(target).toContainText('Sep 9');
  await target.click();
  await expect(page).toHaveURL(/\/course\/71\/assignments\/12\/groups\/8\/grading$/);
  await expect(page.getByRole('dialog').getByRole('heading', {name: 'Writing partners'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('instructor reviews a contextual request with its version and cannot finalize scheduling', async ({page}) => {
  await fixture(page, 'INSTRUCTOR', 'Instructor');
  const writes: Array<{body: unknown; key?: string}> = [];
  await page.route('**/v2/me/teaching/schedule-requests**', route => route.fulfill({json: reply(pageOf(writes.length ? [] : [{id: 51, courseId: 71, courseTitle: course.title, studentFirstName: 'Alex', studentLastName: 'Chen', requestType: 'SCHEDULE_CHANGE', status: 'PENDING_INSTRUCTOR', version: 0, occurrenceDate: '2026-09-04', occurrenceStartTime: {hour: 9, minute: 0}, occurrenceEndTime: {hour: 10, minute: 0}, proposedOccurrenceDate: '2026-09-05', proposedStartTime: {hour: 14, minute: 30}, proposedEndTime: {hour: 15, minute: 30}, timezone: 'America/Los_Angeles', reason: 'Medical appointment'}]))}));
  await page.route('**/v2/courses/71/schedule-requests/51/instructor-review', route => {writes.push({body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']}); return route.fulfill({json: reply({id: 51, version: 1, status: 'PENDING_ADVISOR'})});});
  await page.goto('/my-operations');
  await expect(page.getByText(/Requested: 2026-09-05 14:30/)).toBeVisible();
  await expect(page.getByRole('button', {name: 'Reject request'})).toBeDisabled();
  await page.getByRole('button', {name: 'Approve for advisor review'}).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toEqual({decision: 'APPROVE', expectedVersion: 0});
  expect(writes[0].key).toBeTruthy();
  await expect(page.getByText('No schedule requests.', {exact: true})).toBeVisible();
  await page.goto('/course/71/operations');
  for (const name of ['Create occurrence', 'Generate', 'Reschedule', 'Cancel occurrence']) await expect(page.getByRole('button', {name, exact: true})).toHaveCount(0);
});

test('student work queue, requests and cross-course reports consume pages and server filters', async ({page}) => {
  await fixture(page);
  const urls: string[] = [];
  await page.route('**/v2/me/work-queue**', route => {
    const url = new URL(route.request().url()); urls.push(url.href);
    const index = Number(url.searchParams.get('page'));
    return route.fulfill({json: reply(pageOf(index ? [{title: 'Second-page task', taskId: 9, deepLink: '/my-plan?task=9'}] : [{title: 'First urgent task', taskId: 81, urgency: 'HIGH'}, {title: 'Later task', taskId: 80, urgency: 'LOW'}], index, 21))});
  });
  await page.route('**/v2/me/schedule-requests**', route => {urls.push(route.request().url()); return route.fulfill({json: reply(pageOf([{id: 65, courseId: 71, courseTitle: course.title, requestType: 'SCHEDULE_CHANGE', status: 'PENDING_ADVISOR', occurrenceDate: '2026-09-05', startTime: {hour: 14, minute: 30}, endTime: {hour: 15, minute: 30}, timezone: 'America/Los_Angeles'}]))});});
  await page.route('**/v2/me/student-reports**', route => {
    const url = new URL(route.request().url()); urls.push(url.href);
    const index = Number(url.searchParams.get('page'));
    return route.fulfill({json: reply(pageOf([{id: index ? 92 : 91, courseId: index ? 82 : 71, title: index ? 'Reading final report' : 'Writing progress report', reportType: 'FINAL', courseTitle: index ? 'Reading studio' : course.title}], index, 21))});
  });
  await page.route('**/v2/courses/82/student-reports/published/me/92', route => {urls.push(route.request().url()); return route.fulfill({json: reply({overallSummary: 'Your inference accuracy has improved.'})});});
  await page.goto('/my-plan?view=learning');
  await expect(page.getByText('First urgent task')).toBeVisible();
  const queue = page.getByRole('region', {name: 'Work queue', exact: true});
  await expect(queue.locator('article strong')).toHaveText(['First urgent task', 'Later task']);
  await queue.getByRole('button', {name: 'Next'}).click();
  await expect(page.getByRole('link', {name: /Second-page task/})).toHaveAttribute('href', '/my-plan?task=9');
  await page.getByRole('combobox', {name: 'Request status', exact: true}).selectOption('PENDING_ADVISOR');
  await expect.poll(() => urls.some(url => url.includes('status=PENDING_ADVISOR'))).toBe(true);
  await page.getByRole('navigation', {name: 'Published report pages'}).getByRole('button', {name: 'Next'}).click();
  await page.getByRole('button', {name: 'Open report', exact: true}).click();
  await expect(page.getByText('Your inference accuracy has improved.')).toBeVisible();
  expect(urls.some(url => url.includes('/courses/82/student-reports/published/me/92'))).toBe(true);
  await page.getByRole('combobox', {name: 'Report type', exact: true}).selectOption('FINAL');
  await expect.poll(() => urls.some(url => url.includes('reportType=FINAL') && url.includes('page=0'))).toBe(true);
  await page.setViewportSize({width: 390, height: 844});
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({path: '/tmp/xlearn-cutover-validation/student-learning-390.png', fullPage: true});
});

test('student current/completed courses, exam pages and non-monotonic conversation cursors', async ({page}) => {
  await fixture(page);
  const reads: string[] = [];
  await page.route('**/v2/me/courses**', route => {const url = new URL(route.request().url()); reads.push(url.href); return route.fulfill({json: reply(pageOf([{id: 71, courseId: 71, title: url.searchParams.get('courseView') === 'COMPLETED' ? 'Completed writing' : 'Current writing', courseCode: 'WR101', courseRole: 'Student', lifecycleStatus: url.searchParams.get('courseView') === 'COMPLETED' ? 'COMPLETED' : 'ONGOING', lectureTotal: 10, lectureCompleted: 4}]))});});
  await page.route('**/v2/student/mock-exams**', route => {const url = new URL(route.request().url()); reads.push(url.href); const index = Number(url.searchParams.get('page')); return route.fulfill({json: reply(pageOf([{id: index ? 81 : 80, title: index ? 'Second assigned exam' : 'First assigned exam', status: 'READY', listeningSelected: true}], index, 21))});});
  await page.route('**/v2/student/advisor-conversation/messages**', route => {const url = new URL(route.request().url()); reads.push(url.href); return route.fulfill({json: reply(url.searchParams.has('beforeId') ? {items: [{messageId: 800, body: 'Earlier student message', createdAt: '2026-09-01T10:00:00Z'}], nextBeforeId: 999, hasMore: false} : {items: [{messageId: 10, body: 'Latest student message', createdAt: '2026-09-02T10:00:00Z'}], nextBeforeId: 700, hasMore: true})});});
  await page.goto('/');
  await expect(page.getByText('First assigned exam', {exact: true})).toBeVisible();
  await expect.poll(() => reads.some(url => url.includes('/v2/student/mock-exams') && url.includes('page=0') && url.includes('size=20'))).toBe(true);
  await page.goto('/course');
  await expect(page.getByText('Current writing', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Completed', exact: true}).click();
  await expect(page.getByText('Completed writing', {exact: true})).toBeVisible();
  await page.goto('/mock-exams');
  await page.getByRole('navigation', {name: 'Mock exam pages'}).getByRole('button', {name: 'Next'}).click();
  await expect(page.getByRole('heading', {name: 'Second assigned exam'})).toBeVisible();
  await page.getByLabel('Exam status', {exact: true}).selectOption('COMPLETED');
  await expect.poll(() => reads.some(url => url.includes('status=COMPLETED') && url.includes('page=0'))).toBe(true);
  await page.goto('/my-plan?view=messages');
  await expect(page.getByText('Latest student message')).toBeVisible();
  await page.getByRole('button', {name: /Load older/}).click();
  await expect(page.getByText('Earlier student message')).toBeVisible();
  expect(reads.some(url => url.includes('beforeId=700'))).toBe(true);
  await expect(page.getByRole('button', {name: /Load older/})).toHaveCount(0);
});

test('parent calendar uses local date windows, timezone, names and server cursor', async ({page}) => {
  await fixture(page, 'PARENT');
  const urls: string[] = [];
  await page.route('**/v2/parent/linked-students**', route => route.fulfill({json: reply(pageOf([{studentUserId: 301, firstName: 'Alex', middleName: 'Ming', lastName: 'Chen'}, {studentUserId: 302, firstName: 'Sam', lastName: 'Lee'}]))}));
  await page.route('**/v2/parent/students/301/calendar**', route => {urls.push(route.request().url()); return route.fulfill({json: reply({timezone: 'America/Los_Angeles', fromUtc: '2026-09-01T07:00:00Z', toUtc: '2026-09-15T07:00:00Z', items: [{eventType: 'SESSION', sourceId: 'session-51', occurrenceId: 51, courseId: 71, title: 'Evening writing', startsAtUtc: '2026-09-04T02:00:00Z', endsAtUtc: '2026-09-04T03:00:00Z', timezone: 'America/Los_Angeles'}, {eventType: 'ASSIGNMENT_DEADLINE', sourceId: 'assignment-81', assignmentId: 81, courseId: 71, title: 'Essay deadline', startsAtUtc: '2026-09-04T02:00:00Z', endsAtUtc: '2026-09-04T02:00:00Z', timezone: 'America/Los_Angeles'}]})});});
  await page.route('**/v2/parent/students/301/schedule-requests', route => route.fulfill({status: 403, json: {status: 403, code: 'FORBIDDEN', message: 'Schedule requests are unavailable.'}}));
  await page.route('**/v2/parent/students/301/conversation/messages**', route => {const url = new URL(route.request().url()); urls.push(url.href); return route.fulfill({json: reply(url.searchParams.has('beforeId') ? {items: [{messageId: 999, body: 'Earlier parent message', createdAt: '2026-09-01T10:00:00Z'}], nextBeforeId: 501, hasMore: false} : {items: [{messageId: 5, body: 'Latest parent message', createdAt: '2026-09-02T10:00:00Z'}], nextBeforeId: 700, hasMore: true})});});
  await page.goto('/parent?section=schedule');
  await expect(page.getByRole('option', {name: 'Alex Ming Chen', exact: true})).toBeAttached();
  const calendar = page.getByRole('region', {name: 'Request a schedule change'});
  await expect(calendar.getByText(/Sep 3/).first()).toBeVisible();
  await expect(calendar.getByRole('alert')).toContainText('Schedule requests are unavailable.');
  await expect(calendar.getByRole('button', {name: 'Retry', exact: true})).toHaveCount(0);
  await expect(calendar.getByRole('button', {name: 'Request change', exact: true})).toHaveCount(1);
  await calendar.getByRole('textbox', {name: /^From/}).fill('09/01/2026');
  await calendar.getByRole('textbox', {name: /^To \(exclusive\)/}).fill('09/30/2026');
  await calendar.getByRole('textbox', {name: 'Timezone'}).fill('America/Los_Angeles');
  await calendar.getByRole('button', {name: 'Apply dates'}).click();
  await expect.poll(() => urls.some(value => {const url = new URL(value); return url.searchParams.get('from') === '2026-09-01' && url.searchParams.get('to') === '2026-09-30' && url.searchParams.get('timezone') === 'America/Los_Angeles';})).toBe(true);
  expect(urls.some(value => new URL(value).searchParams.has('limit'))).toBe(false);
  await page.getByRole('button', {name: 'Messages', exact: true}).click();
  await page.getByRole('button', {name: 'Load older messages'}).click();
  await expect(page.getByText('Earlier parent message')).toBeVisible();
  expect(urls.some(url => url.includes('beforeId=700'))).toBe(true);
  await expect(page.getByRole('button', {name: 'Load older messages'})).toHaveCount(0);
  await page.setViewportSize({width: 390, height: 844});
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});

test('writing queue paginates, enforces band steps and closes on already-graded conflict', async ({page}) => {
  await fixture(page, 'INSTRUCTOR', 'Instructor');
  let submitted = false;
  await page.route('**/v2/instructor/mock-exams/writing-grades**', route => {
    const url = new URL(route.request().url());
    if (/\/writing-grades\/\d+$/.test(url.pathname)) {
      if (route.request().method() === 'POST') {submitted = true; return route.fulfill({status: 409, json: {status: 409, code: 'MOCK_EXAM_WRITING_ALREADY_GRADED', message: 'This script has already been graded.'}});}
      return route.fulfill({json: reply({id: Number(url.pathname.split('/').at(-1)), status: submitted ? 'GRADED' : 'PENDING', tasks: [{seq: 1, content: 'A complete writing response.'}]})});
    }
    const index = Number(url.searchParams.get('page'));
    return route.fulfill({json: reply(pageOf([{id: index ? 82 : 81, studentFirstName: index ? 'Second' : 'First', studentLastName: 'Candidate', templateTitle: 'Academic Writing', versionNo: 2, status: 'PENDING'}], index, 21))});
  });
  await page.goto('/mock-exams');
  await page.getByRole('navigation', {name: 'Mock exam pages'}).getByRole('button', {name: 'Next'}).click();
  await expect(page.getByRole('button', {name: /Second Candidate/})).toBeVisible();
  const score = page.getByLabel('Score', {exact: true});
  await score.fill('9.5');
  await expect(page.getByRole('button', {name: 'Submit result'})).toBeDisabled();
  await score.fill('6.3');
  await expect(page.getByRole('button', {name: 'Submit result'})).toBeDisabled();
  await score.fill('6.5');
  await page.getByRole('button', {name: 'Submit result'}).click();
  await expect(page.getByText('This script has already been graded.')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Submit result'})).toBeDisabled();
  await page.screenshot({path: '/tmp/xlearn-cutover-validation/writing-conflict.png', fullPage: true});
});


test('availability conflict reload preserves newly added server windows', async ({page}) => {
  await fixture(page, 'INSTRUCTOR', 'Instructor');
  let conflict = false;
  let writes = 0;
  let saved: {expectedVersion?: number; windows?: unknown[]} | undefined;
  const original = {dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00', timezone: 'UTC'};
  const added = {dayOfWeek: 'FRIDAY', startTime: '14:00', endTime: '15:00', timezone: 'UTC'};
  await page.route('**/v2/me/teaching/availability', route => {
    if (route.request().method() === 'PUT') {
      writes++;
      if (!conflict) {
        conflict = true;
        return route.fulfill({status: 409, json: {status: 409, code: 'VERSION_CONFLICT', message: 'Availability was updated.'}});
      }
      saved = route.request().postDataJSON();
    }
    return route.fulfill({json: reply({version: conflict ? 5 : 4, windows: conflict ? [original, added] : [original], exceptions: []})});
  });
  await page.goto('/my-operations');
  await page.getByRole('button', {name: 'availability', exact: true}).click();
  await page.getByRole('button', {name: 'Save all availability', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Save all availability', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: 'Discard draft and reload', exact: true}).click();
  await expect(page.getByText('Friday', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Save all availability', exact: true}).click();
  await expect.poll(() => writes).toBe(2);
  expect(saved).toMatchObject({expectedVersion: 5, windows: [original, added]});
});
