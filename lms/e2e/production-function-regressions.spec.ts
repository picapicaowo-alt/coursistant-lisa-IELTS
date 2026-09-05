import {expect, test, type Page} from '@playwright/test';
import en from '../src/i18n/resources/en/advising.json' with {type: 'json'};
import cn from '../src/i18n/resources/zh-CN/advising.json' with {type: 'json'};
import tw from '../src/i18n/resources/zh-TW/advising.json' with {type: 'json'};

const response = (data: unknown) => ({status: 200, code: 'SUCCESS', data});
async function fixtureSession(page: Page, level: string, locale = 'en') {
  await page.addInitScript(({level, locale}) => {
    localStorage.setItem('coursistant.locale', locale);
    localStorage.setItem('accToken', 'isolated-function-audit-fixture');
    localStorage.setItem('user', JSON.stringify({id: 901, userId: 901, name: 'Function audit', email: 'function-audit@example.test', level, role: 'USER', accessToken: 'isolated-function-audit-fixture'}));
  }, {level, locale});
}

for (const [locale, copy] of [['en', en], ['zh-CN', cn], ['zh-TW', tw]] as const) {
  test(`availability retry, selection isolation and reload preserve ${locale}`, async ({page}, testInfo) => {
    await fixtureSession(page, 'ADVISOR', locale);
    const requests: number[] = [];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/v2/**', route => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
      const id = path.match(/\/instructors\/(\d+)\/availability$/)?.[1];
      if (id) {
        requests.push(Number(id));
        if (requests.length === 1 || id === '16') return route.fulfill({status: 404, json: {status: 404, code: 'USER_NOT_FOUND', message: 'User Does Not Exist'}});
        return route.fulfill({json: response({instructorUserId: 15, version: 1, windows: [{dayOfWeek: 'MON', startTime: '09:00:00', endTime: '17:00:00', timezone: 'Asia/Taipei'}], exceptions: []})});
      }
      let data: unknown = {items: [], total: 0, page: 0, size: 20};
      if (path.endsWith('/unread-count')) data = {unreadCount: 0};
      else if (path === '/v2/advisor/instructors') data = {items: [{instructorUserId: 15, firstName: 'Emily', lastName: 'Ward'}, {instructorUserId: 16, firstName: 'James', lastName: 'Chen'}], total: 2, page: 0, size: 20};
      return route.fulfill({json: response(data)});
    });
    await page.goto('/advisor/schedule');
    const section = page.getByRole('region', {name: copy.availability.title});
    const picker = section.getByRole('combobox');
    const check = section.getByRole('button', {name: copy.availability.check, exact: true});
    await picker.click();
    await page.getByRole('option', {name: /Emily Ward/}).click();
    await check.click();
    await expect(section.getByRole('alert')).toHaveText(copy.availability.instructorUnavailable);
    await expect(section.getByText(copy.availability.empty)).toHaveCount(0);
    await check.click();
    await expect(section.getByText('Asia/Taipei')).toBeVisible();
    expect(requests).toEqual([15, 15]);
    await picker.click();
    await page.getByRole('option', {name: /James Chen/}).click();
    await expect(section.getByText('Asia/Taipei')).toHaveCount(0);
    await check.click();
    await expect(section.getByRole('alert')).toBeVisible();
    await page.setViewportSize({width: 390, height: 844});
    await expect(check).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({path: testInfo.outputPath(`availability-${locale}-390.png`), fullPage: true});
    await page.reload();
    await expect(section).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(check).toBeDisabled();
    await expect(section.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const code of ['USER_NOT_FOUND', 'NOT_FOUND', 'STUDY_PLAN_NOT_FOUND']) {
  test(`student dashboard classifies study-plan 404 ${code}`, async ({page}) => {
    await fixtureSession(page, 'STUDENT');
    await page.route('**/v2/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/student/study-plan')) return route.fulfill({status: 404, json: {status: 404, code, message: 'Plan lookup unavailable'}});
      return route.fulfill({json: response(path.endsWith('/unread-count') ? {unreadCount: 0} : {items: [], total: 0, page: 0, size: 20})});
    });
    await page.goto('/');
    const tasks = page.getByRole('region', {name: 'Advisor Tasks', exact: true});
    if (code === 'STUDY_PLAN_NOT_FOUND') {
      await expect(tasks.getByText('No advisor tasks right now', {exact: true})).toBeVisible();
      await expect(tasks.getByRole('alert')).toHaveCount(0);
    } else {
      await expect(tasks.getByRole('alert')).toBeVisible();
      await expect(tasks.getByText('No advisor tasks right now', {exact: true})).toHaveCount(0);
    }
  });
}

test('student messages expose read and attachment failures without unhandled errors', async ({page}) => {
  await fixtureSession(page, 'STUDENT');
  const errors: string[] = [];
  const attachmentRequests: string[] = [];
  let messageReads = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/v2/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/advisor-conversation/attachments/')) {
      attachmentRequests.push(path);
      return route.fulfill({status: 503, json: {status: 503, code: 'UNAVAILABLE', message: 'Internal server error'}});
    }
    if (path.endsWith('/advisor-conversation/messages')) {
      messageReads++;
      if (messageReads === 1) return route.fulfill({status: 503, json: {status: 503, code: 'UNAVAILABLE'}});
      return route.fulfill({json: response({items: [{messageId: 100, body: 'Review this attachment', attachments: [{attachmentId: 51, originalName: 'review.pdf', previewAvailable: true}]}], hasMore: false})});
    }
    return route.fulfill({json: response(path.endsWith('/unread-count') ? {unreadCount: 0} : {})});
  });
  await page.goto('/my-plan?view=messages');
  await expect(page.getByRole('alert').filter({hasText: en.conversation.loadError})).toBeVisible();
  await expect(page.getByText(en.conversation.empty, {exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: en.conversation.retry}).click();
  await expect(page.getByText('review.pdf')).toBeVisible();
  await page.getByRole('button', {name: en.attachments.download, exact: true}).click();
  await expect(page.getByRole('alert').filter({hasText: en.attachments.loadError})).toBeVisible();
  await page.getByRole('button', {name: en.attachments.preview, exact: true}).click();
  await expect.poll(() => attachmentRequests.length).toBe(2);
  await expect(page.getByRole('button', {name: en.attachments.preview, exact: true})).toBeEnabled();
  expect(errors).toEqual([]);
});

test('course enrollment recovers missing launch versions through the delivery read', async ({page}) => {
  await fixtureSession(page, 'ADVISOR');
  let configReads = 0;
  let readyVersion: unknown;
  let ready = false;
  await page.route('**/v2/**', route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    const method = route.request().method();
    if (path.endsWith('/delivery-config')) {
      configReads += 1;
      if (configReads === 1) return route.fulfill({status: 503, json: {status: 503, code: 'SERVICE_UNAVAILABLE'}});
      return route.fulfill({json: response({courseId: 42, deliveryMode: 'ONE_ON_ONE', launchState: ready ? 'READY' : 'DRAFT', courseLaunchVersion: ready ? 1 : 0})});
    }
    if (path.endsWith('/launch/ready') && method === 'POST') {
      readyVersion = route.request().postDataJSON().expectedCourseLaunchVersion;
      ready = true;
      return route.fulfill({json: response({courseId: 42, launchState: 'READY', courseLaunchVersion: 1})});
    }
    let data: unknown = {items: [], total: 0, page: 0, size: 20};
    if (path.endsWith('/unread-count')) data = {unreadCount: 0};
    if (path.endsWith('/hub')) data = {studentUserId: 901, firstName: 'Audit', lastName: 'Learner'};
    if (path.endsWith('/profile')) data = {studentUserId: 901, profileVersion: 0, skills: []};
    if (path.endsWith('/study-plan')) data = {studentUserId: 901, profileContext: {currentProfileVersion: 0}, plan: {studyPlanVersion: 0, checkpoints: []}};
    if (path === '/v2/advisor/students/901/courses') data = [{courseId: 42, title: 'Test planning course', deliveryMode: 'ONE_ON_ONE', launchState: ready ? 'READY' : 'DRAFT', courseLaunchVersion: null, courseLinkVersion: 0, completionVersion: 0, status: 'ACTIVE', schedule: []}];
    return route.fulfill({json: response(data)});
  });
  await page.goto('/advisor/students/901/courses');
  await page.getByRole('button', {name: 'Manage enrollment'}).click();
  await expect(page.getByRole('alert')).toHaveText(en.records.courseActionsLoadError);
  await expect(page.getByRole('button', {name: 'Manage enrollment'})).toBeEnabled();
  await page.getByRole('button', {name: 'Manage enrollment'}).click();
  const dialog = page.getByRole('dialog', {name: 'Manage enrollment'});
  await expect(dialog.getByRole('button', {name: 'Ready', exact: true})).toBeEnabled();
  await dialog.getByRole('button', {name: 'Ready', exact: true}).click();
  await expect(dialog).toHaveCount(0);
  expect(readyVersion).toBe(0);
  await page.getByRole('button', {name: 'Manage enrollment'}).click();
  await expect(dialog.getByRole('button', {name: 'Publish', exact: true})).toBeEnabled();
  expect(configReads).toBe(3);
});

test('student quiz history reads attempt metadata and opens the matching result and receipt', async ({page}) => {
  await fixtureSession(page, 'STUDENT');
  const reads: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/v2/**', route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    reads.push(path);
    const result = {quizId: 1, countedAttemptId: 9, gradeStatus: 'Released', releasedAt: '2026-09-05T01:15:21Z', receiptId: 'qa-receipt', totalScore: 1, manualGradingPending: false};
    let data: unknown = [];
    if (path === '/v2/me/courses') data = {items: [{courseId: 42, role: 'Student'}], total: 1, page: 0, size: 100};
    if (path.endsWith('/unread-count')) data = {unreadCount: 0};
    if (path === '/v2/courses/42/quizzes/1') data = {id: 1, courseId: 42, title: 'QA objective quiz', state: 'Published', windowOpen: true, opensAtLocal: '2026-09-01T09:00:00', closesAtLocal: '2026-09-30T17:00:00', timezone: 'Asia/Shanghai', attemptsAllowed: 1, totalPoints: 1, resultVisibility: 'AfterRelease'};
    if (path.endsWith('/attempts/current')) return route.fulfill({status: 404, json: {status: 404, code: 'QUIZ_ATTEMPT_NOT_FOUND'}});
    if (path.endsWith('/my-attempts')) data = [{...result, totalScore: null}];
    if (path.endsWith('/attempts')) data = [{id: 9, attemptNumber: 1, status: 'Submitted', startedAt: '2026-09-05T01:14:13.634', submittedAt: '2026-09-05T01:14:53Z', receiptId: 'qa-receipt'}];
    if (path.endsWith('/my-result') || path.endsWith('/attempts/9/result')) data = result;
    if (path.endsWith('/attempts/9/receipt')) data = {attemptId: 9, receiptId: 'qa-receipt', submittedAt: '2026-09-05T01:14:53Z'};
    return route.fulfill({json: response(data)});
  });
  await page.goto('/course/42/quizzes/1');
  await expect(page.getByRole('heading', {name: 'Quiz submitted'})).toBeVisible();
  const history = page.getByRole('region', {name: 'Attempt history'});
  await expect(history.getByText('Attempt 1', {exact: true})).toBeVisible();
  await history.getByRole('button', {name: 'View result', exact: true}).click();
  await expect(history.getByText('1 / 1', {exact: true})).toBeVisible();
  await expect(history.getByText(/Receipt qa-receipt/)).toBeVisible();
  expect(reads).toContain('/v2/courses/42/quizzes/1/attempts/9/receipt');
  expect(reads.some(path => path.endsWith('/my-attempts'))).toBe(false);
  expect(errors).toEqual([]);
});
