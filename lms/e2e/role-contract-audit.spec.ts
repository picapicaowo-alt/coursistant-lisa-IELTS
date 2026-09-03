import {openSection} from './disclosure-helpers';
import {expect, test, type Page} from '@playwright/test';

const response = (data: unknown) => ({status: 200, code: 'SUCCESS', data});
const signInFixture = async (page: Page, level: string, role = 'USER') => {
  await page.addInitScript(user => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accToken', user.accessToken);
  }, {id: 901, userId: 901, name: 'Role audit', email: 'role-audit@example.test', level, role, accessToken: 'isolated-e2e-fixture'});
};

test('parent can request absence, read exam results, load older messages, and retry without duplicate messages', async ({page}, testInfo) => {
  await signInFixture(page, 'PARENT');
  const pageErrors: string[] = [];
  const attempts: Array<{key: string | undefined; body: string | null}> = [];
  const cursors: string[] = [];
  let requested: Record<string, unknown> | undefined;
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/v2/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    let data: unknown = [];
    if (path.endsWith('/unread-count')) data = {unreadCount: 0};
    else if (path === '/v2/parent/linked-students') data = {items: [{studentUserId: 41}], page: 0, size: 20, total: 1};
    else if (path.endsWith('/calendar')) data = [{courseId: 31, occurrenceId: 51, title: 'Writing workshop', occurrenceDate: '2026-09-10', startTime: '10:00:00'}];
    else if (path.endsWith('/schedule-requests') && request.method() === 'POST') {
      requested = request.postDataJSON(); data = {id: 61, status: 'PENDING'};
    } else if (path.endsWith('/mock-exams')) data = [{id: 71, title: 'September diagnostic'}];
    else if (path.endsWith('/mock-exams/71')) data = {id: 71, title: 'September diagnostic', status: 'COMPLETED', listeningSelected: true, listeningCorrect: 32, listeningTotal: 40, readingSelected: true, readingCorrect: 35, readingTotal: 40, writingSelected: true, writingScore: 6.5};
    else if (path.endsWith('/conversation/messages')) {
      if (request.method() === 'POST') {
        attempts.push({key: request.headers()['idempotency-key'], body: request.postData()});
        if (attempts.length === 1) return route.fulfill({status: 503, json: {status: 503, code: 'STORAGE_FAILURE', message: 'Delivery unavailable'}});
        data = {messageId: 101};
      } else {
        const cursor = url.searchParams.get('beforeId');
        if (cursor) cursors.push(cursor);
        expect(url.searchParams.has('page')).toBe(false);
        data = cursor ? [] : [{messageId: 100, body: 'This week’s learning update', senderUserId: 52}];
      }
    }
    await route.fulfill({json: response(data)});
  });
  await page.goto('/parent');
  await page.getByRole('link', {name: 'Schedule', exact: true}).click();
  await openSection(page, 'Request a schedule change');
  await page.getByRole('button', {name: 'Request change', exact: true}).click();
  await page.getByRole('combobox', {name: /Request type/}).selectOption('ABSENCE');
  await page.getByRole('button', {name: 'Submit request', exact: true}).click();
  await expect.poll(() => requested?.requestType).toBe('ABSENCE');
  expect(requested).toMatchObject({courseId: 31, occurrenceId: 51});
  await page.getByRole('link', {name: 'Mock exams', exact: true}).click();
  await openSection(page, 'Assigned mock exams');
  await page.getByRole('button', {name: /September diagnostic/}).click();
  await expect(page.getByRole('progressbar', {name: 'Listening score'})).toHaveAttribute('value', '80');
  await expect(page.getByText('6.5', {exact: true})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('parent-results-desktop.png'), fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: testInfo.outputPath('parent-results-mobile.png'), fullPage: true});
  await page.getByRole('button', {name: 'Close results', exact: true}).click();
  await page.getByRole('button', {name: 'More', exact: true}).click();
  await page.getByRole('link', {name: 'Messages', exact: true}).click();
  await openSection(page, 'Conversation');
  await expect(page.getByText('This week’s learning update')).toBeVisible();
  await page.getByRole('button', {name: 'Load older messages'}).click();
  await expect.poll(() => cursors).toContain('100');
  await page.getByLabel('Message', {exact: true}).fill('Thank you for the update');
  await page.getByRole('button', {name: 'Send message', exact: true}).click();
  await expect(page.getByRole('alert').filter({hasText: /Delivery unavailable|Message could not/})).toBeVisible();
  await page.getByRole('button', {name: 'Send message', exact: true}).click();
  await expect.poll(() => attempts.length).toBe(2);
  expect(attempts[0].key).toBeTruthy();
  expect(attempts[0].key).toBe(attempts[1].key);
  const messageId = (body: string | null) => body?.match(/name="clientMessageId"\r\n\r\n([^\r]+)/)?.[1];
  expect(messageId(attempts[0].body)).toBeTruthy();
  expect(messageId(attempts[0].body)).toBe(messageId(attempts[1].body));
  expect(pageErrors).toEqual([]);
});

test('student operations distinguish unavailable alerts and preserve event detail version across a retry', async ({page}) => {
  await signInFixture(page, 'STUDENT');
  const writes: Array<{key?: string; body: Record<string, unknown>}> = [];
  const reads: string[] = [];
  await page.route('**/v2/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    reads.push(path);
    let data: unknown = [];
    if (path.endsWith('/unread-count')) data = {unreadCount: 0};
    else if (path.endsWith('/me/courses')) data = {items: [], page: 0, size: 20, total: 0};
    else if (path.endsWith('/me/alerts')) return route.fulfill({status: 503, json: {status: 503, code: 'UNAVAILABLE', message: 'Alerts temporarily unavailable'}});
    else if (path.endsWith('/personal-events')) data = [{eventId: 71, title: 'Study session', version: 1}];
    else if (path.endsWith('/personal-events/71') && request.method() === 'GET') data = {eventId: 71, title: 'Study session', startsAtLocal: '2026-09-10T10:00:00', endsAtLocal: '2026-09-10T11:00:00', timezone: 'Asia/Singapore', version: 4};
    else if (path.endsWith('/personal-events/71') && request.method() === 'PATCH') {
      writes.push({key: request.headers()['idempotency-key'], body: request.postDataJSON()});
      if (writes.length === 1) return route.fulfill({status: 503, json: {status: 503, code: 'UNAVAILABLE', message: 'Event update unavailable'}});
      data = {eventId: 71, version: 5};
    }
    await route.fulfill({json: response(data)});
  });
  await page.goto('/my-operations');
  await expect(page.getByRole('alert').filter({hasText: 'Alerts temporarily unavailable'})).toBeVisible();
  await expect(page.getByText('No active alerts.', {exact: true})).toHaveCount(0);
  await page.getByRole('navigation', {name: 'Operations sections'}).getByRole('button', {name: 'calendar', exact: true}).click();
  await openSection(page, 'Personal events');
  await page.getByRole('button', {name: 'Edit', exact: true}).click();
  await expect(page.getByRole('textbox', {name: 'Title', exact: true})).toHaveValue('Study session');
  expect(reads.some(path => path.endsWith('/personal-events/71'))).toBe(true);
  await page.getByRole('textbox', {name: 'Title', exact: true}).fill('Revised study session');
  await page.getByRole('button', {name: 'Save changes', exact: true}).click();
  await expect(page.getByRole('alert').filter({hasText: 'Event update unavailable'})).toBeVisible();
  await page.getByRole('button', {name: 'Save changes', exact: true}).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[0].body).toMatchObject({expectedVersion: 4, title: 'Revised study session'});
  expect(writes[0].key).toBeTruthy();
  expect(writes[0]).toEqual(writes[1]);
});

for (const scenario of [
  {level: 'STUDENT', denied: '/advisor/operations', home: '/'},
  {level: 'INSTRUCTOR', denied: '/advisor/operations', home: '/'},
  {level: 'ADVISOR', denied: '/admin', home: '/advisor/students'},
  {level: 'COUNSELLOR', denied: '/advisor/operations', home: '/counsellor'},
  {level: 'PARENT', denied: '/course/31/assignments/21/grading', home: '/parent'},
  {level: 'NOT_APPLICABLE', role: 'TENANT_ADMIN', denied: '/advisor/students/41/profile', home: '/admin/intakes'},
]) {
  test(`${scenario.level} cannot enter another role's workspace or call its APIs`, async ({page}) => {
    await signInFixture(page, scenario.level, scenario.role);
    const requests: string[] = [];
    await page.route('**/v2/**', route => {
      const path = new URL(route.request().url()).pathname;
      requests.push(path);
      let data: unknown = [];
      if (path.endsWith('/unread-count')) data = {unreadCount: 0};
      else if (path.endsWith('/dashboard')) data = {createdCount: 0, assignedCount: 0, unassignedCount: 0};
      else if (path.endsWith('/me/courses') || path.endsWith('/users') || path.endsWith('/students') || path.endsWith('/linked-students')) data = {items: [], page: 0, size: 20, total: 0};
      return route.fulfill({json: response(data)});
    });
    await page.goto(scenario.denied);
    await expect(page).toHaveURL(new RegExp(`${scenario.home.replaceAll('/', '\\/')}$`));
    await expect(page.getByText('Page not found', {exact: true})).toHaveCount(0);
    const deniedPrefix = scenario.denied.startsWith('/advisor') ? '/v2/advisor/' : scenario.denied.startsWith('/admin') ? '/v2/tenant/' : '/v2/courses/';
    expect(requests.filter(path => path.includes(deniedPrefix))).toEqual([]);
  });
}
