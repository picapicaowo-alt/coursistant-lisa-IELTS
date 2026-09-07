import {readFileSync} from 'node:fs';
import {expect, test} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';
import {productLocales, tx} from './i18n-fixture';

test('reading diagrams use the contracted passage sequence and question sort order', async ({page}) => {
  await fixture(page);
  const imagePaths: string[] = [];
  await page.route('**/v2/student/mock-exams/77**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/image')) {
      imagePaths.push(path);
      return path.endsWith('/passages/3/questions/7/image')
        ? route.fulfill({body: readFileSync(new URL('../public/icons/default_avatar.jpg', import.meta.url)), contentType: 'image/jpeg'})
        : route.fulfill({status: 404, json: {code: 'MOCK_EXAM_MEDIA_NOT_FOUND'}});
    }
    return route.fulfill({json: reply(path.endsWith('/reading') ? {
      id: 77, totalMinutes: 60, passages: [{id: 103, seq: 3, title: 'Diagram sequence audit', paragraphs: ['Original paper content.'], questions: [{
        sortOrder: 7, kind: 'diagram', title: 'Question 11', questionStart: 11, questionEnd: 11,
        payload: {caption: 'Original diagram', imageAlt: 'Original diagram', labels: [{id: 11, prompt: 'Label the diagram'}]},
      }]}],
    } : {id: 77, status: 'ASSIGNED', readingSelected: true})});
  });
  await page.goto('/mock-exams/77/reading');
  await expect(page.getByRole('textbox')).toBeVisible();
  await expect(page.getByRole('img', {name: 'Original diagram'})).toBeVisible();
  expect(imagePaths).toEqual(['/api/v2/student/mock-exams/77/reading/passages/3/questions/7/image']);
});

test('an active writing response survives stale-query focus and reconnect events', async ({page}) => {
  await fixture(page);
  await page.clock.install();
  const reads: string[] = [];
  let failReads = false;
  await page.route('**/v2/student/mock-exams/77**', route => {
    const path = new URL(route.request().url()).pathname;
    reads.push(path);
    if (failReads) return route.fulfill({status: 503, json: {code: 'INTERNAL_SERVER_ERROR'}});
    return route.fulfill({json: reply(path.endsWith('/writing') ? {
      id: 77, totalMinutes: 60, tasks: [{seq: 1, taskKey: 'TASK1', title: 'Writing Task 1', prompt: 'Original prompt.', minWords: 150}],
    } : {id: 77, status: 'ASSIGNED', writingSelected: true})});
  });
  await page.goto('/mock-exams/77/writing');
  const answer = page.getByRole('textbox', {name: 'Your response'});
  await answer.fill('This unsent answer must survive a background connection failure.');
  failReads = true;
  await page.clock.setFixedTime(new Date(Date.now() + 6 * 60 * 1000));
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(1000);
  await expect(answer).toHaveValue('This unsent answer must survive a background connection failure.');
  expect(reads).toHaveLength(2);
});

test('a partially failed media load allocates no orphaned blob URLs and can be retried', async ({page}) => {
  await fixture(page);
  await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      sessionStorage.setItem('qa:exam-object-urls', String(Number(sessionStorage.getItem('qa:exam-object-urls') ?? 0) + 1));
      return original(blob);
    };
  });
  let fail = true;
  await page.route('**/v2/student/mock-exams/77**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/image')) {
      if (path.includes('/tasks/2/') && fail) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return route.fulfill({status: 503, json: {code: 'INTERNAL_SERVER_ERROR'}});
      }
      return route.fulfill({body: readFileSync(new URL('../public/icons/default_avatar.jpg', import.meta.url)), contentType: 'image/jpeg'});
    }
    return route.fulfill({json: reply(path.endsWith('/writing') ? {
      id: 77, totalMinutes: 60, tasks: [1, 2].map(seq => ({seq, taskKey: `TASK${seq}`, title: `Writing Task ${seq}`, prompt: 'Original prompt.', minWords: 150, hasImage: true})),
    } : {id: 77, status: 'ASSIGNED', writingSelected: true})});
  });
  await page.goto('/mock-exams/77/writing');
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => Number(sessionStorage.getItem('qa:exam-object-urls') ?? 0))).toBe(0);
  fail = false;
  await page.getByRole('button', {name: 'Try again', exact: true}).click();
  await expect(page.getByRole('textbox', {name: 'Your response'})).toBeVisible();
  expect(await page.evaluate(() => Number(sessionStorage.getItem('qa:exam-object-urls') ?? 0))).toBe(2);
});

for (const locale of productLocales) test(`first assignment upload, submission and read-only recovery work in ${locale}`, async ({page}, info) => {
  await fixture(page);
  await page.addInitScript(value => localStorage.setItem('coursistant.locale', value), locale);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let releaseUpload: () => void = () => {};
  const pendingUpload = new Promise<void>(resolve => {releaseUpload = resolve;});
  let uploaded = false, saved = false, failStatus = false;
  const writes: unknown[] = [];
  const file = {id: 89, assignmentId: 81, originalName: 'new.pdf', contentType: 'application/pdf', sizeBytes: 4, createdAt: '2026-09-05T12:00:00Z'};
  await page.route('**/v2/courses/71/assignments/81**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path.endsWith('/submission-staging-files')) {
      if (request.method() === 'POST') {await pendingUpload; uploaded = true;}
      return route.fulfill({json: reply(uploaded ? [file] : [])});
    }
    if (path.endsWith('/submissions') && request.method() === 'POST') {
      writes.push(request.postDataJSON()); saved = true; failStatus = true;
      return route.fulfill({json: reply({submissionId: 99, totalVersions: 1, stagingFiles: []})});
    }
    if (path.endsWith('/submission')) {
      if (failStatus) return route.fulfill({status: 503, json: {code: 'INTERNAL_SERVER_ERROR'}});
      return saved ? route.fulfill({json: reply({assignmentId: 81, submissionStatus: 'Submitted', totalVersions: 1, stagingFiles: [], acceptingSubmissions: true})})
        : route.fulfill({status: 404, json: {code: 'NOT_FOUND', message: 'No formal submission yet'}});
    }
    if (path.includes('/rubric')) return route.fulfill({status: 404, json: {code: 'RUBRIC_NOT_FOUND'}});
    return route.fulfill({json: reply({id: 81, courseId: 71, title: 'Original assignment', state: 'Published', submissionType: 'Individual', allowedFileTypes: ['pdf'], attachments: [], stagedFileCount: 0, acceptingSubmissions: true, windowOpen: true, submissionStatus: 'NotSubmitted', totalVersions: 0, timezone: 'UTC', dueAtLocal: '2030-09-01T12:00:00', description: ''})});
  });
  await page.goto('/course/71/assignments/81');
  await page.getByRole('button', {name: tx(locale, 'assessment:submission.submitAssignment'), exact: true}).click();
  const dialog = page.getByRole('dialog', {name: tx(locale, 'course:assignmentStudentModal.title')});
  const submit = dialog.getByRole('button', {name: tx(locale, 'assessment:submission.submitFiles'), exact: true});
  const uploadStarted = page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/submission-staging-files'));
  await dialog.locator('input[type=file]').setInputFiles({name: 'new.pdf', mimeType: 'application/pdf', buffer: Buffer.from('work')});
  await uploadStarted;
  await expect(submit).toBeDisabled();
  releaseUpload();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog.getByRole('alert')).toContainText(tx(locale, 'assessment:submission.submittedRefreshFailed'));
  expect(writes).toEqual([{stagingFileIds: [89]}]);
  await page.setViewportSize({width: 390, height: 844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path: info.outputPath(`assignment-read-recovery-${locale}-390.png`), fullPage: true});
  failStatus = false;
  await dialog.getByRole('button', {name: tx(locale, 'common:actions.retry'), exact: true}).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(1);
  expect(errors).toEqual([]);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.getByRole('heading', {name: 'Original assignment'})).toBeVisible();
});
