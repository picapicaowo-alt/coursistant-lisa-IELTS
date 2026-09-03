import {expect, test} from '@playwright/test';
import {instructorFixture} from './instructor-workspace-fixture';
import {reply} from './workspace-fixtures';

test('Pending report saves freeze inputs and preserve the submitted snapshot', async ({page}) => {
  await instructorFixture(page);
  let finish: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/student-reports/403', async route => {
    if (route.request().method() === 'PATCH') await gate;
    await route.fallback();
  });
  await page.goto('/course/71/operations?section=reports');
  await page.getByRole('article').filter({hasText: 'Chloe Henderson'}).getByRole('button', {name: 'Edit', exact: true}).click();
  const summary = page.getByRole('textbox', {name: 'Overall summary'});
  await summary.fill('The submitted draft remains stable.');
  await page.getByRole('button', {name: 'Save draft'}).click();
  await expect(summary).toBeDisabled();
  await expect(page.getByRole('button', {name: 'Close dialog'})).toBeDisabled();
  finish?.();
  await expect(page.getByText('Report draft saved.', {exact: true})).toBeVisible();
});

test('An unresolved grading projection never appears as an empty queue', async ({page}) => {
  await instructorFixture(page);
  let finish: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/v2/me/teaching/grading-queue', route => route.fulfill({json: reply([])}));
  await page.route('**/v2/me/teaching/grading-items', async route => {
    await gate;
    await route.fulfill({json: reply([])});
  });
  await page.goto('/my-operations');
  const queue = page.getByRole('region', {name: 'Grading queue'});
  await expect(queue.getByText('Loading…')).toBeVisible();
  await expect(queue.getByText(/All caught up/)).toHaveCount(0);
  finish?.();
  await expect(queue.getByText(/All caught up/)).toBeVisible();
});

test('Material links with ambiguous identities remain read-only', async ({page}) => {
  const {writes} = await instructorFixture(page);
  await page.route('**/v2/courses/71/materials/121/links', route => route.fulfill({json: reply({lectureLinks: [{id: 902, title: 'A relationship without a lecture ID'}]})}));
  await page.goto('/course/71/operations?section=content');
  await page.getByRole('button', {name: 'Manage links'}).first().click();
  await expect(page.getByRole('dialog').getByText('A relationship without a lecture ID')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Detach', exact: true})).toHaveCount(0);
  expect(writes).toHaveLength(0);
});

test('Instructor course workflows preserve versions, publishing rules, and protected material actions', async ({page}) => {
  const {writes, requests} = await instructorFixture(page);
  await page.goto('/course/71/operations');
  await expect(page.getByRole('region', {name: 'Session occurrences'}).getByRole('row')).toHaveCount(6);
  await page.getByRole('button', {name: 'Manage Sep 3, 2026 class'}).click();
  await expect(page.getByRole('button', {name: 'Reschedule', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: 'Take attendance'}).click();
  const alexandra = page.getByRole('group', {name: 'Attendance for Alexandra Vance'});
  await alexandra.getByRole('button', {name: 'Late', exact: true}).click();
  await page.getByRole('button', {name: 'Reports', exact: true}).click();
  await expect(page.getByRole('dialog', {name: 'Leave unsaved attendance?'})).toBeVisible();
  await page.getByRole('button', {name: 'Keep editing', exact: true}).click();
  await page.getByRole('button', {name: 'Save attendance'}).click();
  await expect(page.getByText('Attendance saved.', {exact: true})).toBeVisible();
  expect(writes.find(item => item.path.endsWith('/attendance'))?.body).toEqual({expectedAttendanceVersion: 1, entries: [{studentUserId: 301, status: 'LATE'}]});
  await page.getByRole('button', {name: 'Reports', exact: true}).click();
  const published = page.getByRole('article').filter({hasText: 'Alexandra Vance'});
  await expect(published.getByRole('button', {name: 'View', exact: true})).toBeVisible();
  await expect(published.getByRole('button', {name: 'Edit', exact: true})).toHaveCount(0);
  const draft = page.getByRole('article').filter({hasText: 'Chloe Henderson'});
  await draft.getByRole('button', {name: 'Edit', exact: true}).click();
  await page.getByRole('textbox', {name: 'Overall summary'}).fill('A clear and logically structured final essay.');
  await page.getByRole('button', {name: 'Save draft'}).click();
  await expect(page.getByText('Report draft saved.', {exact: true})).toBeVisible();
  expect(writes.find(item => item.method === 'PATCH')?.body.expectedVersion).toBe(1);
  await draft.getByRole('button', {name: 'Publish', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm publication'}).click();
  await expect(draft.getByRole('button', {name: 'Edit', exact: true})).toHaveCount(0);
  expect(writes.find(item => item.path.endsWith('/publish'))?.body.expectedVersion).toBe(2);
  expect(requests.some(url => url.pathname.endsWith('/student-reports') && url.searchParams.get('page') === '1')).toBe(true);
  await page.getByRole('button', {name: 'Discussion', exact: true}).click();
  await page.getByRole('button', {name: 'View replies'}).first().click();
  await page.getByRole('textbox', {name: 'Your reply'}).fill('Please bring a revised thesis to our next class.');
  await page.getByRole('button', {name: 'Send reply'}).click();
  await expect(page.getByRole('article').getByText('Please bring a revised thesis to our next class.')).toBeVisible();
  await page.getByRole('button', {name: 'Close dialog'}).click();
  await page.getByRole('button', {name: 'Content', exact: true}).click();
  await page.getByRole('button', {name: 'Manage links'}).first().click();
  await page.getByRole('button', {name: 'Detach', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm detach'}).click();
  await expect(page.getByText('Material link removed. The source material is kept.')).toBeVisible();
  expect(writes.filter(item => item.method === 'DELETE').map(item => item.path)).toEqual(['/v2/courses/71/materials/121/lecture-links/82']);
  expect(writes.every(item => Boolean(item.key))).toBe(true);
});

test('Attendance conflicts preserve choices and disable repeat stale writes', async ({page}) => {
  const {writes} = await instructorFixture(page, {conflictAttendance: true});
  await page.goto('/course/71/operations?section=attendance');
  const group = page.getByRole('group', {name: 'Attendance for Alexandra Vance'});
  await group.getByRole('button', {name: 'Absent', exact: true}).click();
  await page.getByRole('button', {name: 'Save attendance'}).click();
  await expect(page.getByRole('button', {name: 'Save attendance'})).toBeDisabled();
  await expect(group.getByRole('button', {name: 'Absent', exact: true})).toHaveAttribute('aria-pressed', 'true');
  expect(writes.filter(item => item.path.endsWith('/attendance'))).toHaveLength(1);
});

test('Missing attendance version never produces a write', async ({page}) => {
  const {writes} = await instructorFixture(page, {missingVersion: true});
  await page.goto('/course/71/operations?section=attendance');
  await page.getByRole('group', {name: 'Attendance for Alexandra Vance'}).getByRole('button', {name: 'Late', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Save attendance'})).toBeDisabled();
  expect(writes).toHaveLength(0);
});

test('Writing grading keeps the score and feedback workflow', async ({page}) => {
  const {writes} = await instructorFixture(page);
  await page.goto('/mock-exams');
  await page.getByRole('spinbutton', {name: 'Score'}).fill('6.5');
  await page.getByRole('textbox', {name: 'Feedback'}).fill('Clear position and useful examples. Review cohesion between paragraphs.');
  await page.getByRole('button', {name: 'Submit result'}).click();
  await expect(page.getByText('Writing result submitted.')).toBeVisible();
  expect(writes[0].body).toMatchObject({score: 6.5, feedback: 'Clear position and useful examples. Review cohesion between paragraphs.'});
});

test('Occurrence editors send course-local dates and versioned schedule actions', async ({page}) => {
  const {writes} = await instructorFixture(page);
  await page.goto('/course/71/operations');
  await page.getByRole('button', {name: 'Create occurrence', exact: true}).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', {name: 'Class date', exact: true}).fill('09/30/2026');
  await dialog.getByRole('textbox', {name: 'Start time', exact: true}).fill('10:00 AM');
  await dialog.getByRole('textbox', {name: 'End time', exact: true}).fill('11:30 AM');
  await dialog.getByRole('combobox', {name: 'Lecture (optional)'}).selectOption('81');
  await dialog.getByRole('button', {name: 'Create occurrence', exact: true}).click();
  await expect(page.getByText('Class occurrence created.')).toBeVisible();
  expect(writes[0].body).toEqual({occurrenceDate: '2026-09-30', startTime: '10:00:00', endTime: '11:30:00', weekId: 81});
  await page.getByRole('button', {name: 'Manage Sep 13, 2026 class'}).click();
  await page.getByRole('button', {name: 'Reschedule', exact: true}).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', {name: 'Class date', exact: true}).fill('09/14/2026');
  await dialog.getByRole('button', {name: 'Save new schedule'}).click();
  await expect(page.getByText('Class rescheduled.', {exact: true})).toBeVisible();
  expect(writes.find(item => item.path.endsWith('/reschedule'))?.body).toMatchObject({occurrenceDate: '2026-09-14', expectedVersion: 1});
  await page.getByRole('button', {name: 'Manage Sep 18, 2026 class'}).click();
  await page.getByRole('button', {name: 'Cancel occurrence'}).click();
  await page.getByRole('button', {name: 'Confirm cancellation'}).click();
  await expect(page.getByText('Class occurrence cancelled.')).toBeVisible();
  expect(writes.find(item => item.path.endsWith('/cancel'))?.body).toEqual({expectedVersion: 1});
  await page.getByRole('button', {name: 'Generate from schedule'}).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', {name: 'From', exact: true}).fill('10/01/2026');
  await dialog.getByRole('textbox', {name: 'To', exact: true}).fill('10/31/2026');
  await dialog.getByRole('button', {name: 'Generate occurrences'}).click();
  await expect(page.getByText('Occurrences generated from the recurring schedule.')).toBeVisible();
  expect(writes.find(item => item.path.endsWith('/generate'))?.body).toEqual({from: '2026-10-01', to: '2026-10-31'});
  expect(writes.every(item => Boolean(item.key))).toBe(true);
});

test('Course downloads, roster search and availability retain existing API flows', async ({page}) => {
  const {writes, requests} = await instructorFixture(page);
  await page.goto('/course/71');
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download Syllabus & Research Framework', exact: true}).click();
  expect((await download).suggestedFilename()).toBe('academic-writing-week1.pdf');
  await page.goto('/course/71/operations?section=reports');
  await page.getByRole('button', {name: 'Create new report'}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', {name: 'Search course students'}).fill('Chloe');
  await expect.poll(() => requests.some(url => url.pathname.endsWith('/members') && url.searchParams.get('q') === 'Chloe' && url.searchParams.get('courseRole') === 'Student')).toBe(true);
  await dialog.getByRole('button', {name: 'Chloe Henderson'}).click();
  await dialog.getByRole('textbox', {name: 'Overall summary'}).fill('A thoughtful response with clear evidence.');
  await dialog.getByRole('button', {name: 'Save draft'}).click();
  await expect(page.getByText('Report draft saved.')).toBeVisible();
  expect(writes.find(item => item.path.endsWith('/student-reports'))?.body.studentUserId).toBe(303);
  expect(requests.some(url => url.pathname.endsWith('/members') && url.searchParams.get('q') === 'Chloe' && url.searchParams.get('courseRole') === 'Student')).toBe(true);
  await page.goto('/my-operations?view=availability');
  await page.getByRole('button', {name: 'Save all availability'}).click();
  await expect(page.getByText('Availability saved.', {exact: true})).toBeVisible();
  expect(writes.find(item => item.path.endsWith('/availability'))?.body).toMatchObject({expectedVersion: 1, windows: [{dayOfWeek: 'MON', startTime: '09:00:00', endTime: '17:00:00', timezone: 'America/Los_Angeles'}], exceptions: []});
  await page.getByRole('navigation', {name: 'Operations sections'}).getByRole('button', {name: 'Calendar'}).click();
  await expect(page.getByRole('button', {name: /Today/}).first()).toBeVisible();
});

for (const width of [2560, 1920, 1600, 1440, 1024, 768, 390, 320]) {
  test(`Instructor surfaces align at ${width}px with no horizontal overflow`, async ({page}, testInfo) => {
    await page.setViewportSize({width, height: width === 390 ? 844 : 1050});
    await instructorFixture(page, {emptyMock: true});
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const surfaces = [
      ['courses', '/course', 'My Courses'],
      ['detail', '/course/71', 'Academic Writing Studio'],
      ['occurrences', '/course/71/operations', 'Academic Writing Studio'],
      ['attendance', '/course/71/operations?section=attendance', 'Academic Writing Studio'],
      ['reports', '/course/71/operations?section=reports', 'Academic Writing Studio'],
      ['discussion', '/course/71/operations?section=discussion', 'Academic Writing Studio'],
      ['content', '/course/71/operations?section=content', 'Academic Writing Studio'],
      ['teaching', '/my-operations', 'Teaching Operations'],
      ['availability', '/my-operations?view=availability', 'Teaching Operations'],
      ['calendar', '/my-operations?view=calendar', 'Teaching Operations'],
      ['mock-empty', '/mock-exams', 'Read the script. Return a clear result.'],
    ];
    for (const [name, path, title] of surfaces) {
      await page.goto(path);
      await expect(page.getByRole('heading', {name: title, exact: true, level: 1})).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), name).toBeLessThanOrEqual(1);
      if (name === 'detail') {
        await expect(page.getByRole('button', {name: 'Preview Syllabus & Research Framework'})).toBeVisible();
        await page.getByRole('button', {name: /Final Draft Editing/}).scrollIntoViewIfNeeded();
        await expect(page.getByRole('button', {name: /Final Draft Editing/})).toBeInViewport();
        await page.getByRole('heading', {name: title, exact: true, level: 1}).scrollIntoViewIfNeeded();
        await page.getByRole('main').first().evaluate(element => {element.scrollTop = 0;});
      }
      // The app shell owns scrolling, so viewport captures reflect what a user sees.
      await page.screenshot({path: testInfo.outputPath(`${name}-${width}.png`)});
      if (name === 'teaching' && width === 1600) {
        const leftTitle = await page.getByRole('heading', {name: "Today's classes", exact: true}).boundingBox();
        const rightTitle = await page.getByRole('heading', {name: 'Grading queue', exact: true}).boundingBox();
        expect(Math.abs(leftTitle!.y - rightTitle!.y)).toBeLessThanOrEqual(1);
      }
    }
    expect(errors).toEqual([]);
  });
}
