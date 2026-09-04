import {expect, test} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

const priorities = ['HIGH', 'MEDIUM', 'LOW'] as const;
const students = priorities.map((priority, index) => ({studentUserId: 401 + index, firstName: ['Alex', 'Emily', 'Lucas'][index], lastName: 'Review', email: `review-${index}@example.test`, studentType: 'STANDARD', assignmentVersion: 1, targetGoal: 'Develop clear academic writing', riskStatus: 'AT_RISK', highestPriority: priority, riskReasons: ['LOW_ASSIGNMENT_COMPLETION', 'Two assignments awaiting review']}));

test('advisor priority, task transitions and dated schedule use the supplied API fields', async ({page}) => {
  await fixture(page, 'ADVISOR');
  await page.clock.setFixedTime(new Date('2026-09-03T12:00:00Z'));
  let task = {taskId: 921, studentUserId: 401, description: 'Review written response', category: 'REVIEW', priority: 'HIGH', status: 'PENDING', version: 4};
  const writes: {path: string; body: unknown; key?: string}[] = [];
  await page.route('**/v2/advisor/students?*', route => route.fulfill({json: reply({items: students, page: 0, size: 20, total: 3})}));
  await page.route('**/v2/advisor/action-tasks?*', route => route.fulfill({json: reply({items: [task], page: 0, size: 20, total: 1})}));
  await page.route('**/v2/advisor/action-tasks/921/*', route => {
    writes.push({path: new URL(route.request().url()).pathname, body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']});
    task = {...task, status: route.request().url().endsWith('/start') ? 'IN_PROGRESS' : 'RESOLVED', version: task.version + 1};
    return route.fulfill({json: reply(task)});
  });
  await page.route('**/v2/advisor/courses?*', route => route.fulfill({json: reply({items: [{courseId: 71, courseCode: 'WR101', title: 'Academic writing'}], page: 0, size: 20, total: 1})}));
  await page.route('**/v2/courses/71/session-occurrences?*', route => route.fulfill({json: reply([{occurrenceId: 861, occurrenceDate: '2026-09-03', startTime: '10:00:00', endTime: '11:00:00', status: 'SCHEDULED'}])}));
  await page.setViewportSize({width: 1920, height: 1080});
  await page.goto('/advisor/operations');
  const attention = page.getByRole('region', {name: 'Need Attention'});
  for (const [label, background] of [['High', 'rgb(255, 187, 194)'], ['Medium', 'rgb(252, 197, 169)'], ['Low', 'rgb(195, 237, 195)']]) {
    const badge = attention.getByText(label, {exact: true});
    await expect(badge).toHaveCSS('background-color', background);
    await expect(badge).toHaveCSS('border-radius', '9999px');
  }
  await expect(attention.getByRole('link', {name: 'View all'})).toHaveCSS('color', 'rgb(72, 53, 235)');
  await expect(page.getByRole('region', {name: 'Tasks Due Today'})).toBeVisible();
  await expect(page.getByRole('combobox', {name: 'Progress time period'})).toHaveValue('week');
  await expect(page.getByText('9:00 am')).toHaveCount(0);
  await expect(page.getByRole('region', {name: 'Learning Schedule'}).getByRole('link', {name: /Academic writing/})).toHaveAttribute('href', '/advisor/courses/71/delivery');
  await page.getByRole('checkbox', {name: 'Start: Review written response'}).click();
  await expect(page.getByRole('checkbox', {name: 'Resolve: Review written response'})).toBeEnabled();
  await page.getByRole('checkbox', {name: 'Resolve: Review written response'}).click();
  await expect(page.getByRole('checkbox', {name: 'Completed: Review written response'})).toBeChecked();
  expect(writes.map(write => write.body)).toEqual([{expectedVersion: 4}, {expectedVersion: 5}]);
  expect(writes.every(write => Boolean(write.key))).toBeTruthy();
  await expect(page.getByRole('textbox', {name: 'Ask the advising assistant'})).toHaveCount(0);
  await page.getByRole('heading', {name: 'Need Attention', exact: true}).click();
  for (const width of [1920, 1440, 768, 390]) {
    await page.setViewportSize({width, height: width < 800 ? 900 : 1080});
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width);
    await page.screenshot({path: `/tmp/xlearn-final-dashboard/advisor-${width}.png`, fullPage: true});
  }
  await page.setViewportSize({width: 1920, height: 1080});
  await page.getByRole('region', {name: 'Learning Schedule'}).getByRole('button', {name: 'Friday, September 4, 2026'}).click();
  await expect(page.getByText('No course sessions on this day.')).toBeVisible();
  await page.getByRole('region', {name: 'Learning Schedule'}).getByRole('button', {name: 'Friday, September 4, 2026'}).click();
  await expect(page.getByRole('region', {name: 'Learning Schedule'}).getByText('Academic writing')).toBeVisible();
});


test('system exam record and every protected section preview have actual read consumers', async ({page}) => {
  await fixture(page, 'NOT_APPLICABLE', 'Student', 'SYSTEM_ADMIN');
  const reads: string[] = [];
  await page.route('**/v2/system/mock-exams**', route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    reads.push(path);
    if (path.endsWith('/audio')) return route.fulfill({contentType: 'audio/wav', body: 'fixture-audio'});
    if (path.endsWith('/image')) return route.fulfill({contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="blue"/></svg>'});
    if (path.endsWith('/listening')) return route.fulfill({json: reply({parts: [{seq: 7, label: 'Campus conversation', hasAudio: true}]})});
    if (path.endsWith('/reading')) return route.fulfill({json: reply({passages: [{seq: 4, questions: [{sortOrder: 9, hasImage: true}]}]})});
    if (path.endsWith('/writing')) return route.fulfill({json: reply({tasks: [{seq: 3, hasImage: true}]})});
    return route.fulfill({json: reply(path.endsWith('/mock-exams') ? [{testId: 74, title: 'Academic assessment', status: 'PUBLISHED'}] : {testId: 74, title: 'Academic assessment'})});
  });
  await page.goto('/mock-exams');
  await page.getByRole('button', {name: /Academic assessment/}).click();
  await page.getByRole('button', {name: 'Load audio', exact: true}).click();
  await expect(page.locator('audio')).toBeVisible();
  await page.getByRole('button', {name: 'Reading', exact: true}).click();
  await page.getByRole('button', {name: 'Load image', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Reading protected media'}).locator('img')).toBeVisible();
  await page.getByRole('button', {name: 'Writing', exact: true}).click();
  await page.getByRole('button', {name: 'Load image', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Writing protected media'}).locator('img')).toBeVisible();
  expect(reads).toEqual(expect.arrayContaining([
    '/v2/system/mock-exams/74', '/v2/system/mock-exams/74/listening', '/v2/system/mock-exams/74/listening/parts/7/audio',
    '/v2/system/mock-exams/74/reading', '/v2/system/mock-exams/74/reading/passages/4/questions/9/image',
    '/v2/system/mock-exams/74/writing', '/v2/system/mock-exams/74/writing/tasks/3/image',
  ]));
});
