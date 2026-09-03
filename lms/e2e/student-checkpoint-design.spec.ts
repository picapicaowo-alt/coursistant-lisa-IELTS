import {expect, test, type Page} from '@playwright/test';
import {openSection} from './disclosure-helpers';

const response = (data: unknown) => ({status: 200, code: 'SUCCESS', data});
const titles = ['Build vocabulary range', 'Practise academic paraphrasing', 'Review recurring grammar patterns', 'Write a timed response', 'Reflect on advisor feedback', 'Prepare the next draft'];
const fixture = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('user', JSON.stringify({id: 301, userId: 301, role: 'USER', level: 'STUDENT', firstName: 'Alex', lastName: 'Chen', email: 'student@example.test', accessToken: 'fixture-token'}));
    window.localStorage.setItem('accToken', 'fixture-token');
  });
  const writes: {path: string; body: unknown; key?: string}[] = [];
  const tasks = titles.map((title, index) => ({id: 101 + index, position: index + 1, title, description: index === 0 ? 'Learn and use 20 advanced academic words. Apply each word in an original sentence, then review your examples with your advisor.' : `Work through the practice activity for ${title.toLowerCase()}.`, submissionRequirement: 'Add a short reflection about your practice.', dueDate: `2026-10-${String(12 - index).padStart(2, '0')}`, status: index === 2 ? 'COMPLETED' : index === 3 ? 'IN_PROGRESS' : 'NOT_STARTED', version: 0, submissionText: ''}));
  const plan = {studentUserId: 301, profileContext: {}, plan: {studyPlanVersion: 1, strategySummary: 'Build a stronger academic vocabulary through focused practice.', checkpoints: [{id: 91, position: 1, description: 'Build vocabulary range', goal: 'Expand your vocabulary for all question types.', tasks}]}};
  await page.route('**/v2/**', route => route.fulfill({json: response([])}));
  await page.route('**/v2/student/study-plan', route => route.fulfill({json: response(plan)}));
  await page.route('**/v2/student/profile', route => route.fulfill({json: response({studentUserId: 301, skills: []})}));
  await page.route('**/v2/student/study-plan/tasks/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const id = Number(url.pathname.split('/').at(-2));
    const task = tasks.find(item => item.id === id)!;
    const body = request.postDataJSON();
    writes.push({path: url.pathname + url.search, body, key: request.headers()['idempotency-key']});
    const version = url.pathname.endsWith('/start') ? Number(url.searchParams.get('expectedVersion')) : body.expectedVersion;
    expect(version).toBe(task.version);
    if (url.pathname.endsWith('/start')) { expect(url.searchParams.has('expectedVersion')).toBe(true); expect(body).toBeNull(); task.status = 'IN_PROGRESS'; }
    else { task.status = 'COMPLETED'; task.submissionText = body.submissionText; }
    task.version += 1;
    await route.fulfill({json: response(task)});
  });
  return {writes};
};

test('Figma task workspace preserves drafts, uses versioned mutations, and supports deep links', async ({page}, testInfo) => {
  const {writes} = await fixture(page);
  await page.setViewportSize({width: 1600, height: 1040});
  await page.goto('/my-plan');
  await openSection(page, 'Study plan');
  await openSection(page, 'Checkpoint 1: Build vocabulary range');
  await page.getByRole('button', {name: 'View tasks'}).click();
  await expect(page).toHaveURL(/checkpoint=91/);
  const firstView = page.getByRole('button', {name: 'View Build vocabulary range', exact: true});
  await firstView.click();
  await expect(page).toHaveURL(/task=101/);
  const panel = page.getByRole('complementary');
  await expect(panel.getByRole('heading', {level: 2, name: 'Build vocabulary range'})).toBeFocused();
  await panel.getByLabel('Submission note').fill('I used the new words in six original sentences.');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(firstView).toBeFocused();
  await firstView.click();
  await expect(panel.getByLabel('Submission note')).toHaveValue('I used the new words in six original sentences.');
  await panel.getByRole('button', {name: 'Start task', exact: true}).click();
  await expect(panel.getByText('In progress', {exact: true})).toBeVisible();
  await expect(panel.getByRole('button', {name: 'Start task', exact: true})).toHaveCount(0);
  await page.screenshot({path: testInfo.outputPath('student-checkpoint-desktop.png'), fullPage: true});
  await panel.getByRole('button', {name: 'Complete task', exact: true}).click();
  await expect(panel.getByRole('heading', {name: 'Your submission'})).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[0].path).toContain('/start?expectedVersion=0');
  expect(writes[0].key).toBeTruthy();
  expect(writes[1].body).toEqual({expectedVersion: 1, submissionText: 'I used the new words in six original sentences.'});
  await page.reload();
  await expect(page.getByRole('complementary').getByText('Completed', {exact: true})).toBeVisible();
});

test('Figma task workspace filters, sorts, paginates, and fits mobile details', async ({page}, testInfo) => {
  await fixture(page);
  await page.goto('/my-plan?checkpoint=91');
  await expect(page.getByRole('button', {name: 'View Prepare the next draft', exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Next task page'}).click();
  await expect(page.getByRole('button', {name: 'View Prepare the next draft', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Completed 1', exact: true}).click();
  await expect(page.getByRole('table').getByRole('button', {name: /^View /})).toHaveCount(1);
  await page.getByRole('button', {name: 'All tasks 6', exact: true}).click();
  await page.getByRole('button', {name: 'Deadline', exact: true}).click();
  await expect(page.getByRole('row').nth(1)).toContainText('Prepare the next draft');
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: testInfo.outputPath('student-checkpoint-mobile-list.png'), fullPage: true});
  await page.getByRole('button', {name: 'View Prepare the next draft', exact: true}).click();
  await expect(page.getByRole('heading', {level: 2, name: 'Prepare the next draft'})).toBeVisible();
  await expect(page.getByRole('table')).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: testInfo.outputPath('student-checkpoint-mobile-detail.png'), fullPage: true});
  await page.getByRole('button', {name: 'Close task details'}).click();
  await expect(page.getByRole('table')).toBeVisible();
});

test('stale task and checkpoint links recover without routing to a missing screen', async ({page}) => {
  await fixture(page);
  await page.goto('/my-plan?checkpoint=91&task=999');
  await expect(page.getByRole('heading', {name: 'Task unavailable'})).toBeVisible();
  await page.getByRole('button', {name: 'Close task details'}).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.goto('/my-plan?checkpoint=999');
  await expect(page.getByText('This checkpoint is no longer in your current study plan.')).toBeVisible();
  await page.getByRole('button', {name: 'Back to study plan'}).click();
  await expect(page).toHaveURL(/\/my-plan$/);
  await expect(page.getByRole('heading', {name: 'Learning profile'})).toBeVisible();
});

test('checkpoint layout reflows across viewport sizes without fixed page widths', async ({page}) => {
  await fixture(page);
  await page.goto('/my-plan?checkpoint=91&task=101');
  for (const width of [320, 390, 768, 1024, 1440, 1920, 2560]) {
    await page.setViewportSize({width, height: 960});
    const detail = page.getByRole('complementary', {name: 'Build vocabulary range'});
    await expect(detail).toBeVisible();
    await expect(page.getByRole('button', {name: 'Close task details'})).toBeVisible();
    await expect.poll(() => page.evaluate(() => ({width: innerWidth, scroll: document.documentElement.scrollWidth, broken: Array.from(document.images).filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src)}))).toEqual({width, scroll: width, broken: []});
    const bounds = await detail.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  }
});
