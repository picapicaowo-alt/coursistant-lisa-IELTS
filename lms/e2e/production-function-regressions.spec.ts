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
