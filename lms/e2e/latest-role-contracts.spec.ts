import {expect, test} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

test('Student message pagination follows the server cursor and stops at hasMore false', async ({page}) => {
  await fixture(page);
  const cursors: (string | null)[] = [];
  await page.route('**/v2/student/advisor-conversation/messages**', route => {
    const cursor = new URL(route.request().url()).searchParams.get('beforeId');
    cursors.push(cursor);
    return route.fulfill({json: reply({items: [{messageId: cursor ? 4 : 10, body: cursor ? 'Earlier study update' : 'Current study update'}], hasMore: !cursor, nextBeforeId: cursor ? 3 : 7})});
  });
  await page.goto('/my-plan?view=messages');
  await expect(page.getByText('Current study update')).toBeVisible();
  await page.getByRole('button', {name: 'Load older messages'}).click();
  await expect(page.getByText('Earlier study update')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Load older messages'})).toHaveCount(0);
  expect(cursors).toEqual([null, '7']);
});

test('Parent calendar uses the date-window contract and displays UTC session times', async ({page}) => {
  await fixture(page, 'PARENT');
  await page.route('**/v2/parent/linked-students**', route => route.fulfill({json: reply({items: [{studentUserId: 302, firstName: 'Emily', lastName: 'Wong'}], total: 1, page: 0, size: 20})}));
  await page.route('**/v2/parent/students/302/calendar**', route => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.has('limit')).toBe(false);
    expect(params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.get('timezone')).toBeTruthy();
    return route.fulfill({json: reply({timezone: 'Asia/Singapore', fromUtc: '2026-09-13T16:00:00Z', toUtc: '2026-09-15T16:00:00Z', items: [{eventType: 'SESSION', sourceId: 'SESSION:51', occurrenceId: 51, courseId: 71, courseTitle: 'Writing studio', startsAtUtc: '2026-09-14T02:00:00Z', endsAtUtc: '2026-09-14T03:30:00Z', timezone: 'Asia/Singapore', instructorFirstName: 'Sarah', instructorLastName: 'Lim'}, {eventType: 'ASSIGNMENT_DEADLINE', sourceId: 'ASSIGNMENT:91', assignmentId: 91, title: 'Essay deadline', startsAtUtc: '2026-09-14T02:00:00Z', endsAtUtc: '2026-09-14T02:00:00Z', timezone: 'Asia/Singapore'}]})});
  });
  await page.goto('/parent?section=schedule&studentUserId=302');
  await expect(page.getByText('10:00 AM – 11:30 AM')).toBeVisible();
  await expect(page.getByText('Instructor: Sarah Lim')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Request change', exact: true})).toHaveCount(1);
  for (const width of [390, 1440]) {
    await page.setViewportSize({width, height: 960});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
