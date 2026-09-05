import {expect, test, type Page} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

const files = [
  {id: 121, displayName: 'Reading workshop.pdf', originalFilename: 'reading.pdf', extension: 'pdf', sizeBytes: 619, previewAvailable: true},
  {id: 122, displayName: 'Extended reading and reflection workbook for independent practice with instructor feedback.docx', originalFilename: 'workbook.docx', extension: 'docx', sizeBytes: 2520000, previewAvailable: false},
  {id: 123, displayName: 'Listening practice.mp3', originalFilename: 'listening.mp3', extension: 'mp3', sizeBytes: 3240981, previewAvailable: true},
].map(file => ({...file, materialType: 'FILE', weekId: 81, courseId: 71}));

async function materialFixture(page: Page, single = false) {
  await fixture(page);
  await page.route('**/v2/courses/71/weeks', route => route.fulfill({json: reply([
    {id: 81, courseId: 71, title: 'Reading workshop', state: 'Published', materials: single ? files.slice(0, 1) : files},
    ...single ? [] : [{id: 82, courseId: 71, title: 'Reflection seminar', state: 'Published', materials: [{id: 124, courseId: 71, weekId: 82, displayName: 'Reflection resource', materialType: 'LINK', linkUrl: 'https://example.test/reflection', previewAvailable: false}]}],
  ])}));
}

async function noOverflow(page: Page, width: number) {
  await page.setViewportSize({width, height: 1000});
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

test('student materials are expanded, aligned, and independently collapsible', async ({page}, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await materialFixture(page);
  await page.goto('/course/71');
  const first = page.locator('#week-81');
  const second = page.locator('#week-82');
  await expect(first.getByRole('button', {name: /3 materials/})).toHaveAttribute('aria-expanded', 'true');
  await expect(second.getByRole('button', {name: /1 material/})).toHaveAttribute('aria-expanded', 'true');
  await expect(first.getByRole('listitem')).toHaveCount(3);
  await expect(first.getByRole('heading', {name: 'Reading workshop', exact: true})).toHaveCount(0);

  for (const width of [1920, 1440, 1024, 768, 390, 320]) {
    await noOverflow(page, width);
    const rows = first.getByRole('listitem');
    const names = await rows.getByRole('button', {name: /^Open /}).all();
    const nameBoxes = await Promise.all(names.map(name => name.boundingBox()));
    expect(Math.max(...nameBoxes.map(box => box!.x)) - Math.min(...nameBoxes.map(box => box!.x))).toBeLessThan(1);
    for (const name of names) expect(await name.evaluate(element => getComputedStyle(element).textAlign)).toBe('left');
    const downloads = await rows.getByRole('button', {name: /^Download /}).all();
    const boxes = await Promise.all(downloads.map(button => button.boundingBox()));
    if (width >= 1920) expect(Math.max(...boxes.map(box => box!.x)) - Math.min(...boxes.map(box => box!.x))).toBeLessThan(1);
    for (const box of boxes) expect(box!.height).toBeGreaterThanOrEqual(44);
    if (width <= 1024) await first.getByRole('list').scrollIntoViewIfNeeded();
    await page.screenshot({path: info.outputPath(`materials-${width}.png`), fullPage: true});
  }
  const toggle = first.getByRole('button', {name: /3 materials/});
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(first.getByRole('listitem')).toHaveCount(0);
  await expect(second.getByRole('link', {name: /Open Reflection resource/})).toBeVisible();
  await page.getByRole('link', {name: 'Open learning materials', exact: true}).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await first.getByRole('button', {name: 'Open Reading workshop.pdf', exact: true}).click();
  await expect(page).toHaveURL(/materialId=121/);
  expect(errors).toEqual([]);
});

test('single material opens immediately and download actions use the existing file and ZIP routes', async ({page}, info) => {
  await materialFixture(page, true);
  let zipCalls = 0;
  let fileCalls = 0;
  await page.route('**/v2/courses/71/weeks/81/download.zip', route => {zipCalls++; return route.fulfill({contentType: 'application/zip', body: 'PK fixture archive'});});
  await page.route('**/v2/courses/71/weeks/81/materials/121/download', route => {fileCalls++; return route.fulfill({contentType: 'application/pdf', body: '%PDF fixture bytes'});});
  await page.goto('/course/71');
  await page.setViewportSize({width: 1920, height: 1080});
  await expect(page.getByRole('button', {name: 'Open Reading workshop.pdf', exact: true})).toBeVisible();
  await expect(page.getByRole('searchbox', {name: 'Find materials', exact: true})).toHaveCount(0);
  await page.screenshot({path: info.outputPath('single-material.png'), fullPage: true});
  let downloading = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download Reading workshop.pdf', exact: true}).click();
  expect((await downloading).suggestedFilename()).toBe('reading.pdf');
  downloading = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download all', exact: true}).click();
  expect((await downloading).suggestedFilename()).toBe('Reading-workshop-materials.zip');
  expect([fileCalls, zipCalls]).toEqual([1, 1]);
});

test('unit selection and material search combine, persist and recover from no results', async ({page}, info) => {
  await materialFixture(page);
  await page.goto('/course/71');
  const unit = page.getByRole('combobox', {name: 'Learning unit', exact: true});
  const search = page.getByRole('searchbox', {name: 'Find materials', exact: true});
  await unit.selectOption('82');
  await expect(page.locator('#week-81')).toHaveCount(0);
  await expect(page.locator('#week-82')).toBeVisible();
  await expect(page.getByRole('link', {name: 'Open learning materials', exact: true})).toHaveAttribute('href', '#week-82');
  await unit.selectOption('');
  await search.fill('listening');
  await expect(page.locator('#week-81').getByRole('listitem')).toHaveCount(1);
  await expect(page.locator('#week-82')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Download all', exact: true})).toHaveCount(0);
  await page.reload();
  await expect(search).toHaveValue('listening');
  await expect(page.getByRole('button', {name: 'Open Listening practice.mp3', exact: true})).toBeVisible();
  await search.fill('Reflection seminar');
  await expect(page.locator('#week-82')).toBeVisible();
  await expect(page.getByRole('link', {name: 'Open learning materials', exact: true})).toHaveAttribute('href', '#week-82');
  await unit.selectOption('81');
  await expect(page.getByText('No materials match these filters. Try another name or learning unit.')).toBeVisible();
  await page.getByRole('button', {name: 'Clear filters', exact: true}).click();
  await expect(search).toHaveValue('');
  await expect(unit).toHaveValue('');
  await expect(page.locator('#week-81').getByRole('listitem')).toHaveCount(3);
  await expect(page.locator('#week-82')).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await noOverflow(page, width);
    await search.scrollIntoViewIfNeeded();
    await page.screenshot({path: info.outputPath(`material-filters-${width}.png`), fullPage: true});
  }
});

test('material errors follow the selected locale and allow download retry', async ({page}) => {
  await materialFixture(page, true);
  let calls = 0;
  await page.route('**/v2/courses/71/weeks/81/materials/121/download', route => {
    calls++;
    return calls === 1
      ? route.fulfill({status: 503, json: {message: 'Temporarily unavailable'}})
      : route.fulfill({contentType: 'application/pdf', body: '%PDF fixture bytes'});
  });
  await page.goto('/course/71');
  await page.getByRole('button', {name: 'Download Reading workshop.pdf', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('Could not download Reading workshop.pdf');
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', {key: 'coursistant.locale', newValue: 'zh-TW'})));
  await expect(page.getByRole('alert')).toContainText('暫時無法下載');
  await expect(page.getByRole('alert')).not.toContainText('Could not download');
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: '下載「Reading workshop.pdf」', exact: true}).click();
  expect((await download).suggestedFilename()).toBe('reading.pdf');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

const taskRecords = [
  {taskId: 11, status: 'RESOLVED', priority: 'MEDIUM', description: 'Schedule change pending Advisor decision', category: 'APPROVAL'},
  {taskId: 12, status: 'IN_PROGRESS', priority: 'LOW', description: 'Published course report ready for review', category: 'REVIEW'},
  {taskId: 13, status: 'PENDING', priority: 'HIGH', description: 'Review the long student progress record and follow up on the next checkpoint', category: 'FOLLOW_UP'},
].map(task => ({...task, version: 2, createdAt: '2026-09-05T08:17:45Z', target: task.taskId === 13 ? null : {resourceType: 'STUDENT', studentUserId: 301}}));

async function taskFixture(page: Page) {
  await fixture(page, 'ADVISOR');
  await page.route('**/v2/advisor/action-tasks**', route => {
    const url = new URL(route.request().url());
    const id = Number(url.pathname.split('/').at(-1));
    const data = id ? taskRecords.find(task => task.taskId === id) : {items: taskRecords.filter(task => !url.searchParams.get('status') || task.status === url.searchParams.get('status')), total: 3, page: 0, size: 20};
    return route.fulfill({json: reply(data)});
  });
}

test('advisor status, priority and action columns remain aligned when actions differ', async ({page}, info) => {
  await taskFixture(page);
  await page.goto('/advisor/tasks');
  const rows = page.locator('#action-tasks article');
  await expect(rows).toHaveCount(3);
  for (const width of [1920, 1440, 1024, 768, 390, 320]) {
    await noOverflow(page, width);
    for (const selector of ['[data-kind="status"]', '[data-kind="priority"]']) {
      const badges = await rows.locator(selector).all();
      const boxes = await Promise.all(badges.map(badge => badge.boundingBox()));
      expect(Math.max(...boxes.map(box => box!.x)) - Math.min(...boxes.map(box => box!.x))).toBeLessThan(1);
    }
    const buttons = await rows.getByRole('button', {name: 'Details', exact: true}).all();
    const boxes = await Promise.all(buttons.map(button => button.boundingBox()));
    expect(Math.max(...boxes.map(box => box!.x)) - Math.min(...boxes.map(box => box!.x))).toBeLessThan(1);
    for (const box of boxes) expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({path: info.outputPath(`tasks-${width}.png`), fullPage: true});
  }
  const details = rows.nth(1).getByRole('button', {name: 'Details', exact: true});
  await details.click();
  await expect(page).toHaveURL(/taskId=12/);
  const panel = page.getByRole('region', {name: 'Task details', exact: true});
  await expect(panel.locator('[data-kind="status"]')).toHaveText('In progress');
  await panel.getByRole('button', {name: 'Close', exact: true}).click();
  await expect(details).toBeFocused();
  await expect(page).not.toHaveURL(/taskId=/);
  await page.getByRole('combobox', {name: 'Status', exact: true}).selectOption('RESOLVED');
  await expect(rows).toHaveCount(1);
});

test('advisor dashboard task tags share columns and keyboard targets remain visible', async ({page}, info) => {
  await taskFixture(page);
  await page.goto('/advisor/operations');
  const tasks = page.getByRole('region', {name: 'Tasks Due Today', exact: true});
  await expect(tasks.locator('[data-kind="category"]')).toHaveCount(3);
  for (const width of [1920, 1440, 390, 320]) {
    await noOverflow(page, width);
    const tags = await tasks.locator('[data-kind="category"]').all();
    if (width >= 1920) {
      const boxes = await Promise.all(tags.map(tag => tag.boundingBox()));
      expect(Math.max(...boxes.map(box => box!.x)) - Math.min(...boxes.map(box => box!.x))).toBeLessThan(1);
    }
    await tasks.getByRole('link', {name: /Schedule change/}).focus();
    await expect(tasks.getByRole('link', {name: /Schedule change/})).toBeFocused();
    await page.screenshot({path: info.outputPath(`dashboard-tasks-${width}.png`), fullPage: true});
  }
});

test('course materials and action tasks switch locale and retain it after reload', async ({page}) => {
  await materialFixture(page);
  await page.goto('/course/71');
  for (const [locale, label] of [['zh-CN', '学习资料'], ['zh-TW', '學習資料'], ['en', 'Learning materials']]) {
    await page.evaluate(locale => window.dispatchEvent(new StorageEvent('storage', {key: 'coursistant.locale', newValue: locale})), locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('#week-81').getByRole('heading', {name: label, exact: true})).toBeVisible();
    await page.reload();
    await expect(page.locator('#week-81').getByRole('heading', {name: label, exact: true})).toBeVisible();
    if (locale !== 'en') await expect(page.locator('#week-81')).not.toContainText(/Learning materials|Download all|Preview/);
  }
  await taskFixture(page);
  await page.goto('/advisor/tasks');
  for (const [locale, label] of [['zh-CN', '全部状态'], ['zh-TW', '全部狀態'], ['en', 'All statuses']]) {
    await page.evaluate(locale => window.dispatchEvent(new StorageEvent('storage', {key: 'coursistant.locale', newValue: locale})), locale);
    await expect(page.getByRole('option', {name: label, exact: true})).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole('option', {name: label, exact: true})).toHaveCount(1);
    if (locale !== 'en') await expect(page.locator('#action-tasks')).not.toContainText(/In progress|Open task record|Details/);
  }
});
