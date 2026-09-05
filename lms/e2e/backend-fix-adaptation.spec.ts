import {readFileSync, readdirSync} from 'node:fs';
import {expect, test, type Page} from '@playwright/test';
import {createInstance, type Resource, type TOptions} from 'i18next';
import {fixture, reply} from './workspace-fixtures';

const locales = ['en', 'zh-CN', 'zh-TW'] as const;
const engine = createInstance();
const resources: Resource = Object.fromEntries(locales.map(locale => [locale, Object.fromEntries(readdirSync(new URL(`../src/i18n/resources/${locale}/`, import.meta.url)).map(file => [file.slice(0, -5), JSON.parse(readFileSync(new URL(`../src/i18n/resources/${locale}/${file}`, import.meta.url), 'utf8'))]))]));
test.beforeAll(async () => {await engine.init({resources, lng: 'en', fallbackLng: 'en', interpolation: {escapeValue: false}});});
const t = (locale: string, key: string, options?: TOptions) => engine.getFixedT(locale)(key, options ?? {});
async function localeSetup(page: Page, locale: string) {
  await page.addInitScript(value => localStorage.setItem('coursistant.locale', value), locale);
  await page.setViewportSize({width: locale === 'zh-TW' ? 390 : 1440, height: 1000});
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('main').last()).not.toContainText(/exams:|learning:|Opaque diagnostic/);
}
const group = {id: 999, sortOrder: 7, kind: 'shortAnswer', title: 'Question 9', instruction: 'Answer the question.', questionStart: 9, questionEnd: 9, payload: {questions: [{id: 9, prompt: 'Where?', answer: 'New York'}], metadata: {retain: true}}, imagePreviewUrl: 'response-only'};
const content = {
  reading: {totalMinutes: 60, passages: [{id: 100, seq: 3, shortLabel: 'Authored passage', title: 'City', intro: '', paragraphs: ['A city library.'], questions: [group]}]},
  listening: {totalMinutes: 40, parts: [{id: 101, seq: 2, label: 'Authored part', audioMediaId: 19, audioPreviewUrl: 'response-only', sections: [group]}]},
  writing: {totalMinutes: 60, tasks: [{id: 102, seq: 2, taskKey: 'essay-b', title: 'Authored task', prompt: 'Discuss libraries.', minWords: 250, imagePreviewUrl: 'response-only'}]},
};
for (const locale of locales) {
  for (const section of ['reading', 'listening', 'writing'] as const) test(`C1 ${section} replaces saved content and advances revision in ${locale}`, async ({page}, info) => {
    await fixture(page, 'STUDENT', 'Student', 'TENANT_ADMIN');
    await localeSetup(page, locale);
    let revision = 0;
    let authoringReads = 0;
    const writes: {body: Record<string, unknown>; key?: string}[] = [];
    const version = {id: 480, versionNo: 1, status: 'DRAFT', hasReading: true, hasListening: true, hasWriting: true};
    await page.route('**/v2/tenant/mock-exam-templates**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/authoring')) {authoringReads++; return route.fulfill({json: reply({...content[section], id: 400, contentRevision: revision})});}
      if (request.method() === 'PUT') {
        const body = request.postDataJSON(); writes.push({body, key: request.headers()['idempotency-key']});
        revision++; return route.fulfill({json: reply({contentRevision: revision})});
      }
      if (path.endsWith('/media')) return route.fulfill({json: reply([{mediaId: 19, kind: 'LISTENING_AUDIO', status: 'UPLOADED', fileName: 'part.mp3'}])});
      if (path.endsWith('/480')) return route.fulfill({json: reply(version)});
      return route.fulfill({json: reply({id: 48, title: 'Authored exam', versions: [version]})});
    });
    await page.goto(`/mock-exams?template=48&version=480&section=${section}`);
    const review = () => page.getByRole('button', {name: t(locale, 'exams:authoring.reviewSave'), exact: true});
    await expect(review()).toBeVisible();
    // Save twice: the second write must use the revision returned by the first.
    for (let expectedRevision = 0; expectedRevision < 2; expectedRevision++) {
      await review().click();
      await page.getByRole('button', {name: t(locale, 'exams:editing.confirmSave'), exact: true}).click();
      await expect(page.getByText(t(locale, 'exams:editing.saved'), {exact: true})).toBeVisible();
      await expect(review()).toBeEnabled();
      expect(writes[expectedRevision].body.expectedContentRevision).toBe(expectedRevision);
      expect(writes[expectedRevision].key).toBeUndefined();
      expect(writes[expectedRevision].body).not.toHaveProperty('id');
      expect(writes[expectedRevision].body).not.toHaveProperty('contentRevision');
      expect(JSON.stringify(writes[expectedRevision].body)).not.toContain('PreviewUrl');
    }
    expect(authoringReads).toBeGreaterThanOrEqual(3);
    if (section !== 'writing') expect(JSON.stringify(writes[0].body)).toContain('"id":9');
    else expect(JSON.stringify(writes[0].body)).toContain('"taskKey":"essay-b"');
    await fits(page);
    if (locale === 'zh-TW') await page.screenshot({path: info.outputPath(`${section}-traditional-mobile.png`), fullPage: true});
  });

  test(`C3 file-only completion uses uploaded taskVersion in ${locale}`, async ({page}, info) => {
    await fixture(page);
    await localeSetup(page, locale);
    let version = 7;
    let submitted = false;
    let attached: Record<string, unknown> | undefined;
    const completeBodies: unknown[] = [];
    await page.route('**/v2/student/study-plan**', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.pathname.endsWith('/submission-file')) {
        expect(request.method()).toBe('PUT');
        expect(url.searchParams.get('expectedVersion')).toBe('7');
        expect(request.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/);
        expect(request.postData()).toContain('name="file"');
        expect(request.postData()).not.toContain('name="fileObjectKey"');
        version = 8;
        attached = {taskId: 24, originalName: 'work.pdf', contentType: 'application/pdf', sizeBytes: 4, previewAvailable: true};
        return route.fulfill({json: reply({...attached, taskVersion: version})});
      }
      if (url.pathname.endsWith('/complete')) {
        completeBodies.push(request.postDataJSON()); submitted = true; version = 9;
        return route.fulfill({json: reply({id: 24, version, status: 'COMPLETED', submissionFile: attached})});
      }
      return route.fulfill({json: reply({studentUserId: 301, profileContext: {}, plan: {checkpoints: [{id: 23, description: 'Authored checkpoint', tasks: [{id: 24, title: 'Authored task', status: submitted ? 'COMPLETED' : 'IN_PROGRESS', version, submissionFile: attached}]}]}})});
    });
    await page.goto('/my-plan?checkpoint=23&task=24');
    const complete = page.getByRole('button', {name: t(locale, 'learning:checkpoint.complete'), exact: true});
    await expect(complete).toBeDisabled();
    await page.locator('input[type=file]').setInputFiles({name: 'work.pdf', mimeType: 'application/pdf', buffer: Buffer.from('work')});
    await expect(page.getByText(t(locale, 'learning:taskFile.attached', {name: 'work.pdf'}), {exact: true})).toBeVisible();
    await expect(complete).toBeEnabled();
    await fits(page);
    if (locale === 'zh-TW') await page.screenshot({path: info.outputPath('task-upload-traditional-mobile.png'), fullPage: true});
    await complete.click();
    await expect(complete).toHaveCount(0);
    expect(completeBodies).toEqual([{expectedVersion: 8}]);
    await fits(page);
    if (locale === 'zh-TW') await page.screenshot({path: info.outputPath('task-file-traditional-mobile.png'), fullPage: true});
  });

  test(`C4 displays all paginated student identities before visiting them in ${locale}`, async ({page}) => {
    await fixture(page, 'PARENT');
    await localeSetup(page, locale);
    const pages: string[] = [];
    await page.route('**/v2/parent/linked-students**', route => {
      const current = new URL(route.request().url()).searchParams.get('page') ?? '0'; pages.push(current);
      return route.fulfill({json: reply({items: [{studentUserId: current === '0' ? 301 : 302, firstName: current === '0' ? 'Alex' : 'Jamie', middleName: null, lastName: 'Lee', email: `student${current}@example.test`, avatarUrl: null, parentFirstName: 'Wrong Parent'}], page: Number(current), size: 1, total: 2})});
    });
    await page.goto('/parent');
    const select = page.getByRole('combobox', {name: t(locale, 'common:roles.STUDENT'), exact: true});
    await expect(select.locator('option')).toHaveText(['Alex Lee', 'Jamie Lee']);
    expect(pages).toEqual(['0', '1']);
    await expect(page.locator('main').last()).not.toContainText('Wrong Parent');
    await select.selectOption('302');
    await expect(page).toHaveURL(/studentUserId=302/);
    await page.reload();
    await expect(select).toHaveValue('302');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await fits(page);
  });
}

test('C1 conflict reloads authoring without retrying a stale PUT or overwriting the draft', async ({page}) => {
  await fixture(page, 'STUDENT', 'Student', 'TENANT_ADMIN');
  let revision = 1; let writes = 0; let reads = 0;
  await page.route('**/v2/tenant/mock-exam-templates**', route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const version = {id: 480, versionNo: 1, status: 'DRAFT', hasReading: false, hasListening: false, hasWriting: true};
    if (path.endsWith('/authoring')) {reads++; return route.fulfill({json: reply({...content.writing, contentRevision: revision})});}
    if (request.method() === 'PUT') {
      writes++;
      if (writes === 1) {revision = 2; return route.fulfill({status: 409, json: {code: 'MOCK_EXAM_CONTENT_VERSION_CONFLICT', message: 'Opaque diagnostic'}});}
      expect(request.postDataJSON().expectedContentRevision).toBe(2);
      revision = 3; return route.fulfill({json: reply({contentRevision: 3})});
    }
    if (path.endsWith('/media')) return route.fulfill({json: reply([])});
    return route.fulfill({json: reply(path.endsWith('/480') ? version : {id: 48, versions: [version]})});
  });
  await page.goto('/mock-exams?template=48&version=480&section=writing');
  await page.getByRole('textbox', {name: 'Writing prompt', exact: true}).fill('My local draft');
  await page.getByRole('button', {name: 'Review & save', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm and save changes', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Load latest content and replace this draft'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Confirm and save changes'})).toBeDisabled();
  expect(writes).toBe(1); expect(reads).toBeGreaterThan(1);
  await page.getByRole('button', {name: 'Load latest content and replace this draft'}).click();
  await expect(page.getByRole('textbox', {name: 'Writing prompt', exact: true})).toHaveValue('Discuss libraries.');
  await page.getByRole('button', {name: 'Review & save', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm and save changes', exact: true}).click();
  await expect(page.getByText('Changes saved.', {exact: true})).toBeVisible();
  expect(writes).toBe(2);
});

test('N1 shows the backend pending count independently of active tasks and refreshes both reads after approval', async ({page}) => {
  await fixture(page, 'ADVISOR');
  let pending = true; let hubReads = 0; let queueReads = 0;
  await page.route('**/v2/advisor/**', route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname.endsWith('/hub')) {
      hubReads++;
      return route.fulfill({json: reply({studentUserId: 301, firstName: 'Alex', lastName: 'Lee', pendingRequestCount: pending ? 1 : 0, activeTasks: [{taskId: 12, taskType: 'REPORT_REVIEW'}, {taskId: 13, taskType: 'REPORT_REVIEW'}]})});
    }
    if (url.pathname.endsWith('/decision')) {pending = false; return route.fulfill({json: reply({})});}
    if (url.pathname.endsWith('/schedule-requests')) {
      queueReads++;
      expect(url.searchParams.get('studentUserId')).toBe('301');
      return route.fulfill({json: reply({items: pending ? [{id: 91, version: 0, status: 'PENDING_ADVISOR', courseId: 71, requestType: 'RESCHEDULE', reason: 'Authored request'}] : [], page: 0, size: 10, total: pending ? 1 : 0})});
    }
    if (url.pathname.endsWith('/study-plan')) return route.fulfill({json: reply({studentUserId: 301, profileContext: {}, plan: {studyPlanId: 1, studyPlanVersion: 0, checkpoints: []}})});
    if (url.pathname.endsWith('/profile')) return route.fulfill({json: reply({profileId: 1, studentUserId: 301, profileVersion: 0})});
    return route.fallback();
  });
  await page.goto('/advisor/students/301/study-plan');
  const count = page.locator('dt').filter({hasText: /^Pending requests$/}).locator('..').locator('dd');
  await expect(count).toHaveText('1');
  await page.getByRole('button', {name: 'Approve', exact: true}).click();
  await expect(count).toHaveText('0');
  await expect(page.getByText('No pending requests', {exact: false})).toBeVisible();
  expect(hubReads).toBeGreaterThanOrEqual(2); expect(queueReads).toBeGreaterThanOrEqual(2);
});
