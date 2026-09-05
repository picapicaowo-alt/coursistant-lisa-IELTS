import {readFileSync, readdirSync} from 'node:fs';
import {expect, test, type Page, type Route} from '@playwright/test';
import {createInstance, type Resource, type TOptions} from 'i18next';

const locales = ['en', 'zh-CN', 'zh-TW'] as const;
const engine = createInstance();
const resources: Resource = Object.fromEntries(locales.map(locale => [locale, Object.fromEntries(
  readdirSync(new URL(`../src/i18n/resources/${locale}/`, import.meta.url)).map(file => [file.slice(0, -5), JSON.parse(readFileSync(new URL(`../src/i18n/resources/${locale}/${file}`, import.meta.url), 'utf8'))]),
)]));
test.beforeAll(async () => {await engine.init({resources, lng: 'en', fallbackLng: 'en', interpolation: {escapeValue: false}});});
const t = (locale: string, key: string, options?: TOptions) => engine.getFixedT(locale)(key, options ?? {});
const reply = (data: unknown) => ({status: 200, code: 'SUCCESS', data});
const report = {id: 51, reportId: 51, reportType: 'MID_TERM', overallSummary: 'Authored summary', strengths: 'Authored strength', weaknesses: 'Authored challenge', skillEvaluation: 'Authored evaluation', improvementSuggestions: 'Authored next step', publishedAt: '2026-09-03T10:00:00Z', performanceSnapshot: {presentCount: 1, absentCount: 0, releasedScoreAverage: 6.75}};
const course = {id: 71, courseId: 71, title: 'Authored course', courseCode: 'WR101', courseRole: 'Student', lifecycleStatus: 'PUBLISHED', progressPercent: 75, submittedAssignmentCount: 3, publishedAssignmentCount: 4};
const occurrence = {courseId: 71, occurrenceId: 81, courseTitle: 'Authored course', occurrenceDate: '2026-09-21', startTime: '10:00:00', endTime: '11:30:00', location: 'Authored location', timezone: 'Asia/Shanghai'};
async function changeLocale(page: Page, locale: string) {
  await page.evaluate(value => {localStorage.setItem('coursistant.locale', value); window.dispatchEvent(new StorageEvent('storage', {key: 'coursistant.locale', newValue: value}));}, locale);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}
async function setup(page: Page, locale: string, role: 'PARENT' | 'STUDENT', handler?: (route: Route, path: string) => Promise<boolean>) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({locale: value, role: level}) => {
    if (!localStorage.getItem('coursistant.locale')) localStorage.setItem('coursistant.locale', value);
    localStorage.setItem('user', JSON.stringify({id: 901, userId: 901, role: 'USER', level, accessToken: 'isolated-learning-i18n-fixture'}));
    localStorage.setItem('accToken', 'isolated-learning-i18n-fixture');
  }, {locale, role});
  await page.route('**/v2/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (await handler?.(route, path)) return;
    let data: unknown = [];
    if (path.endsWith('/linked-students')) data = {items: [{studentUserId: 301, firstName: 'Alex', middleName: null, lastName: 'Lee', email: null, avatarUrl: null}], total: 1};
    else if (path.endsWith('/dashboard')) data = {student: {firstName: 'Alex', lastName: 'Lee'}, currentCourses: [course], hours: {purchasedMinutes: 12000, usedMinutes: 3000, remainingMinutes: 9000}, attendance: {attended: 3, total: 4}};
    else if (path.endsWith('/profile')) data = role === 'PARENT' ? {targetValue: 0, targetDate: '2026-09-22', intakeBackground: 'Authored background'} : {profileId: 1, profileVersion: 0, studentUserId: 301, targetValue: '0', targetDate: '2026-09-22'};
    else if (path.endsWith('/study-plan')) data = {plan: {strategySummary: 'Authored strategy', checkpoints: [{id: 23, description: 'Authored checkpoint', goal: 'Authored goal', dueDate: '2026-09-22', derivedStatus: 'REACHED_COMPLETED', tasks: [{id: 24, title: 'Authored task', status: 'COMPLETED'}]}]}};
    else if (path.endsWith('/risk')) data = {riskStatus: 'ON_TRACK'};
    else if (path.endsWith('/me/courses')) data = {items: [course], total: 1};
    else if (path.endsWith('/courses')) data = [course];
    else if (path.endsWith('/assignments')) data = [{title: 'Authored assignment', status: 'SUBMITTED'}];
    else if (path.endsWith('/hours')) data = {purchasedMinutes: 12000, usedMinutes: 3000, remainingMinutes: 9000};
    else if (path.endsWith('/attendance/me')) data = {effectiveStatus: 'PRESENT'};
    else if (path.endsWith('/attendance')) data = {items: [{courseId: 71, rawStatus: 'PRESENT', occurrenceDate: '2026-09-21'}], presentCount: 1, absentCount: 0};
    else if (path.endsWith('/calendar')) data = [occurrence];
    else if (path.endsWith('/reports/51') || path.endsWith('/student-reports/published/me/51')) data = report;
    else if (path.endsWith('/reports') || path.endsWith('/student-reports/published/me')) data = {items: [report], total: 1};
    else if (path.endsWith('/progress')) data = {totalAssignmentCount: 4, completedAssignmentCount: 3, courses: [{courseId: 71, courseTitle: 'Authored course', totalAssignmentCount: 4, completedAssignmentCount: 3}]};
    else if (path.endsWith('/alerts')) data = [];
    else if (path.endsWith('/work-queue')) data = [{title: 'Authored assignment', courseId: 71, assignmentId: 42, status: 'NOT_SUBMITTED'}];
    else if (path.endsWith('/conversation/messages')) data = {items: [{messageId: 1, senderUserId: 45, body: 'Authored incoming message', createdAt: '2026-09-03T10:00:00Z'}], hasMore: false};
    else if (path.endsWith('/notifications')) data = {items: [{notificationId: 31, notificationType: 'REPORT_PUBLISHED'}], total: 1};
    else if (path.endsWith('/unread-count')) data = {unreadCount: 0};
    await route.fulfill({json: reply(data)});
  });
  return errors;
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
}
async function singleLocale(page: Page, locale: string) {
  const text = await page.getByRole('main').innerText();
  expect(text).not.toMatch(/(?:learning|records|operations|common|assessment):[a-zA-Z]/);
  if (locale !== 'en') {
    const withoutAuthored = text.replace(/Authored (?:course|assignment|summary|strength|challenge|evaluation|next step|background|strategy|checkpoint|goal|task|location|incoming message)/g, '').replace(/Alex Lee|WR101|Asia\/Shanghai|GMT|UTC|AM|PM/g, '');
    expect(withoutAuthored).not.toMatch(/[A-Za-z]{2}/);
  }
}

for (const locale of locales) for (const width of [390, 1440]) {
  test(`student checkpoint and advising message retries: ${locale} ${width}`, async ({page}, info) => {
    await page.setViewportSize({width, height: 900});
    const taskWrites: Array<{body: unknown; key: string}> = [];
    const messageWrites: Array<{body: string; key: string}> = [];
    const errors = await setup(page, locale, 'STUDENT', async (route, path) => {
      if (path.endsWith('/student/study-plan')) {
        await route.fulfill({json: reply({plan: {checkpoints: [{id: 23, description: 'Authored checkpoint', tasks: Array.from({length: 12}, (_, i) => ({id: i + 24, title: `Authored task ${i + 1}`, dueDate: '2026-09-22', status: 'IN_PROGRESS', version: 7}))}]}})}); return true;
      }
      if (path.endsWith('/tasks/30/complete')) {
        taskWrites.push({body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']});
        await route.fulfill({status: 503, json: {message: 'Opaque task diagnostic'}}); return true;
      }
      if (path.endsWith('/advisor-conversation/messages')) {
        if (route.request().method() === 'POST') {
          messageWrites.push({body: route.request().postData() ?? '', key: route.request().headers()['idempotency-key']});
          await route.fulfill({status: 503, json: {message: 'Opaque message diagnostic'}});
        } else await route.fulfill({json: reply([])});
        return true;
      }
      return false;
    });
    await page.goto('/my-plan');
    await expect(page.getByRole('heading', {name: t(locale, 'learning:plan.goal'), exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: /Authored checkpoint/})).toBeVisible();
    await singleLocale(page, locale); await fits(page);
    await page.getByRole('button', {name: /Authored checkpoint/}).click();
    await page.getByRole('button', {name: t(locale, 'common:navigationControls.nextTaskPage'), exact: true}).click();
    await page.getByRole('button', {name: t(locale, 'learning:checkpoint.viewTask', {task: 'Authored task 7'}), exact: true}).click();
    await page.getByRole('textbox', {name: t(locale, 'learning:checkpoint.note'), exact: true}).fill('My unchanged task submission');
    for (const language of locales) {
      await changeLocale(page, language);
      await expect(page).toHaveURL(/checkpoint=23&task=30/);
      // The list intentionally hides behind the detail view on compact layouts.
      await expect(page.getByRole('combobox', {includeHidden: true})).toHaveValue('5');
      await expect(page.getByText(t(language, 'common:pagination.pageOf', {page: '2', total: '3'}), {exact: true})).toHaveCount(1);
      await expect(page.getByRole('textbox', {name: t(language, 'learning:checkpoint.note'), exact: true})).toHaveValue('My unchanged task submission');
      await page.getByRole('button', {name: t(language, 'learning:checkpoint.complete'), exact: true}).click();
      await expect(page.getByRole('alert')).toHaveText(t(language, 'learning:plan.taskUpdateRetry'));
      await fits(page);
    }
    expect(taskWrites).toHaveLength(3);
    expect(taskWrites[0].body).toEqual({expectedVersion: 7, submissionText: 'My unchanged task submission'});
    expect(taskWrites[0].key).toBeTruthy(); expect(taskWrites.every(write => JSON.stringify(write) === JSON.stringify(taskWrites[0]))).toBe(true);
    await page.screenshot({path: info.outputPath('student-checkpoint-draft.png'), fullPage: true});
    await page.getByRole('button', {name: t('zh-TW', 'learning:checkpoint.close'), exact: true}).click();
    await expect(page.getByText(t('zh-TW', 'common:pagination.pageOf', {page: '2', total: '3'}), {exact: true})).toBeVisible();
    await page.goto('/my-plan?view=messages');
    await expect(page.getByText(t('zh-TW', 'learning:messages.none'), {exact: true})).toBeVisible();
    await page.getByRole('textbox', {name: t('zh-TW', 'operations:message'), exact: true}).fill('My unchanged advisor message');
    await page.locator('input[type=file]').setInputFiles({name: 'Original-note.txt', mimeType: 'text/plain', buffer: Buffer.from('Original note')});
    for (const language of locales) {
      await changeLocale(page, language);
      await expect(page.getByRole('textbox', {name: t(language, 'operations:message'), exact: true})).toHaveValue('My unchanged advisor message');
      await expect(page.getByRole('button', {name: t(language, 'common:actions.removeItem', {item: 'Original-note.txt'})})).toBeVisible();
      await page.getByRole('button', {name: t(language, 'assistant:send'), exact: true}).click();
      await expect(page.getByRole('alert')).toHaveText(t(language, 'learning:messages.sendFailed'));
      await fits(page);
    }
    expect(messageWrites).toHaveLength(3);
    expect(messageWrites[0].key).toBeTruthy(); expect(new Set(messageWrites.map(write => write.key)).size).toBe(1);
    const ids = messageWrites.map(write => /name="clientMessageId"\r\n\r\n([^\r]+)/.exec(write.body)?.[1]);
    expect(ids[0]).toBeTruthy(); expect(new Set(ids).size).toBe(1);
    expect(messageWrites.every(write => write.body.includes('My unchanged advisor message') && write.body.includes('Original-note.txt'))).toBe(true);
    expect(errors).toEqual([]);
  });

  test(`parent academic views and schedule retry: ${locale} ${width}`, async ({page}, info) => {
    await page.setViewportSize({width, height: 900});
    const writes: Array<{body: unknown; key: string}> = [];
    const errors = await setup(page, locale, 'PARENT', async (route, path) => {
      if (path.endsWith('/schedule-requests') && route.request().method() === 'POST') {
        writes.push({body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']});
        await route.fulfill({status: 503, json: {message: 'Opaque write diagnostic'}}); return true;
      }
      return false;
    });
    for (const section of ['dashboard', 'learning', 'learning&tab=courses', 'learning&tab=attendance', 'reports', 'notifications']) {
      await page.goto(`/parent?studentUserId=301&section=${section}`);
      await expect(page.getByText('Alex Lee', {exact: true})).toBeVisible();
      if (section === 'dashboard') await expect(page.getByRole('progressbar')).toHaveAttribute('value', '75');
      if (section === 'learning') await expect(page.getByText('Authored task', {exact: true})).toBeVisible();
      if (section === 'learning&tab=courses') await expect(page.getByText('Authored assignment', {exact: true})).toBeVisible();
      if (section === 'reports') await expect(page.getByText('Authored summary', {exact: true})).toBeVisible();
      if (section === 'notifications') await expect(page.getByText(t(locale, 'notification:types.REPORT_PUBLISHED'), {exact: true})).toBeVisible();
      await fits(page); await singleLocale(page, locale);
    }
    await page.goto('/parent?studentUserId=301&section=schedule');
    await page.getByRole('button', {name: t(locale, 'learning:schedule.requestChange'), exact: true}).click();
    await page.getByRole('button', {name: t(locale, 'operations:submitRequest'), exact: true}).click();
    await expect(page.getByRole('alert')).toHaveText(t(locale, 'learning:schedule.invalidRange'));
    expect(writes).toHaveLength(0);
    await page.getByRole('textbox', {name: t(locale, 'operations:proposedDate'), exact: true}).fill('2026-09-22');
    await page.getByRole('textbox', {name: t(locale, 'calendar:editor.starts'), exact: true}).fill('10:00');
    await page.getByRole('textbox', {name: t(locale, 'calendar:editor.ends'), exact: true}).fill('11:30');
    await page.getByRole('textbox', {name: t(locale, 'common:fields.reason'), exact: true}).fill('My unchanged schedule reason');
    for (const language of locales) {
      await changeLocale(page, language);
      await expect(page.getByRole('textbox', {name: t(language, 'common:fields.reason'), exact: true})).toHaveValue('My unchanged schedule reason');
      await expect(page.getByRole('combobox', {name: t(language, 'operations:requestType')})).toHaveValue('SCHEDULE_CHANGE');
      await page.getByRole('button', {name: t(language, 'operations:submitRequest'), exact: true}).click();
      await expect(page.getByRole('alert')).toHaveText(t(language, 'learning:schedule.failed'));
      await fits(page);
    }
    expect(writes).toHaveLength(3);
    expect(writes.every(write => JSON.stringify(write) === JSON.stringify(writes[0]))).toBe(true);
    expect(writes[0].key).toBeTruthy();
    expect(writes[0].body).toEqual({courseId: 71, occurrenceId: 81, requestType: 'SCHEDULE_CHANGE', proposedOccurrenceDate: '2026-09-22', proposedStartTime: '10:00', proposedEndTime: '11:30', reason: 'My unchanged schedule reason'});
    await page.screenshot({path: info.outputPath('parent-schedule-draft.png'), fullPage: true});
    expect(errors).toEqual([]);
  });

  test(`parent message draft and attachment retry: ${locale} ${width}`, async ({page}, info) => {
    await page.setViewportSize({width, height: 900});
    const writes: Array<{key: string; body: string}> = [];
    const errors = await setup(page, locale, 'PARENT', async (route, path) => {
      if (path.endsWith('/conversation/messages') && route.request().method() === 'POST') {
        writes.push({key: route.request().headers()['idempotency-key'], body: route.request().postData() ?? ''});
        await route.fulfill({status: 503, json: {message: 'Opaque message diagnostic'}}); return true;
      }
      return false;
    });
    await page.goto('/parent?studentUserId=301&section=messages');
    await expect(page.getByText('Authored incoming message')).toBeVisible();
    await page.getByRole('textbox', {name: t(locale, 'operations:message'), exact: true}).fill('My unchanged message draft');
    await page.locator('input[type=file]').setInputFiles({name: 'Original-note.txt', mimeType: 'text/plain', buffer: Buffer.from('Original authored attachment')});
    for (const language of locales) {
      await changeLocale(page, language);
      await expect(page.getByRole('textbox', {name: t(language, 'operations:message'), exact: true})).toHaveValue('My unchanged message draft');
      await expect(page.getByRole('button', {name: t(language, 'common:actions.removeItem', {item: 'Original-note.txt'})})).toBeVisible();
      await page.getByRole('button', {name: t(language, 'assistant:send'), exact: true}).click();
      await expect(page.getByRole('alert')).toHaveText(t(language, 'learning:messages.sendFailed'));
      await fits(page);
    }
    expect(writes).toHaveLength(3);
    expect(writes[0].key).toBeTruthy();
    expect(writes.every(write => write.key === writes[0].key && write.body.includes('My unchanged message draft') && write.body.includes('Original-note.txt'))).toBe(true);
    const clientIds = writes.map(write => /name="clientMessageId"\r\n\r\n([^\r]+)/.exec(write.body)?.[1]);
    expect(clientIds[0]).toBeTruthy(); expect(new Set(clientIds).size).toBe(1);
    await page.screenshot({path: info.outputPath('parent-message-draft.png'), fullPage: true});
    expect(errors).toEqual([]);
  });

  test(`student learning reports and schedule retry: ${locale} ${width}`, async ({page}, info) => {
    await page.setViewportSize({width, height: 900});
    const writes: Array<{key: string; body: unknown}> = [];
    const errors = await setup(page, locale, 'STUDENT', async (route, path) => {
      if (path.endsWith('/schedule-requests') && route.request().method() === 'POST') {
        writes.push({key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON()});
        await route.fulfill({status: 503, json: {message: 'Opaque schedule diagnostic'}}); return true;
      }
      return false;
    });
    await page.goto('/my-plan?view=learning');
    await expect(page.getByRole('link', {name: 'Authored assignment', exact: true})).toHaveAttribute('href', '/course/71/assignments/42');
    await fits(page); await singleLocale(page, locale);
    await page.getByRole('combobox', {name: t(locale, 'learning:overview.detailsPicker')}).selectOption('71');
    await page.getByRole('button', {name: t(locale, 'common:actions.viewDetails'), exact: true}).click();
    await page.getByRole('button', {name: t(locale, 'common:navigationControls.viewReport'), exact: true}).click();
    await expect(page.getByText('Authored summary', {exact: true})).toBeVisible();
    for (const language of locales) {await changeLocale(page, language); await fits(page); await singleLocale(page, language);}
    await page.getByRole('button', {name: t('zh-TW', 'common:navigationControls.backToReports'), exact: true}).click();
    await page.getByRole('button', {name: t('zh-TW', 'learning:schedule.changes'), exact: true}).click();
    await page.getByRole('button', {name: /Authored course/}).click();
    await page.getByRole('button', {name: t('zh-TW', 'operations:submitRequest'), exact: true}).click();
    await expect(page.getByRole('alert')).toHaveText(t('zh-TW', 'learning:schedule.invalidRange'));
    await page.getByRole('textbox', {name: t('zh-TW', 'operations:proposedDate'), exact: true}).fill('2026-09-22');
    await page.getByRole('textbox', {name: t('zh-TW', 'operations:proposedStart'), exact: true}).fill('10:00');
    await page.getByRole('textbox', {name: t('zh-TW', 'operations:proposedEnd'), exact: true}).fill('11:30');
    await page.getByRole('textbox', {name: t('zh-TW', 'common:fields.reason'), exact: true}).fill('My unchanged student reason');
    for (const language of locales) {
      await changeLocale(page, language);
      await expect(page.getByRole('textbox', {name: t(language, 'common:fields.reason'), exact: true})).toHaveValue('My unchanged student reason');
      await page.getByRole('button', {name: t(language, 'operations:submitRequest'), exact: true}).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText('Opaque schedule diagnostic')).toHaveCount(0);
      await fits(page);
    }
    expect(writes).toHaveLength(3);
    expect(writes[0].key).toBeTruthy(); expect(writes.every(write => JSON.stringify(write) === JSON.stringify(writes[0]))).toBe(true);
    expect(writes[0].body).toEqual({requestType: 'SCHEDULE_CHANGE', proposedOccurrenceDate: '2026-09-22', proposedStartTime: '10:00:00', proposedEndTime: '11:30:00', reason: 'My unchanged student reason'});
    await page.screenshot({path: info.outputPath('student-schedule-draft.png'), fullPage: true});
    expect(errors).toEqual([]);
  });
}
