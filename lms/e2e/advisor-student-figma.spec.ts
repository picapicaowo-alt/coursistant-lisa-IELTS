import {expect, test, type Page} from '@playwright/test';
import {fixture, reply, profile, tasks} from './workspace-fixtures';

test.use({viewport: {width: 1440, height: 1024}});

test('multi-page student list stays within the smallest supported viewports', async ({page}) => {
  await fixture(page, 'ADVISOR');
  await page.route('**/v2/advisor/students?**', route => route.fulfill({json: reply({
    items: [{...profile, firstName: 'Alex', lastName: 'Chen', riskStatus: 'AT_RISK'}],
    page: 0, size: 20, total: 140,
  })}));
  await page.goto('/advisor/students');
  await expect(page.getByRole('button', {name: 'Page 7', exact: true})).toBeVisible();
  await expect(page.getByRole('columnheader', {name: /Current Level|Next Checkpoint/})).toHaveCount(0);
  for (const width of [320, 390]) {
    await page.setViewportSize({width, height: 844});
    await expectNoViewportOverflow(page);
    for (const label of ['Previous page', 'Next page']) {
      const box = await page.getByRole('button', {name: label}).boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? width) + (box?.width ?? width)).toBeLessThanOrEqual(width);
    }
  }
});

test('journey and progress reflow without exposing unknown-state request actions', async ({page}, testInfo) => {
  await fixture(page, 'ADVISOR');
  await page.route('**/v2/advisor/students/301/profile', route => route.fulfill({json: reply(profile)}));
  await page.route('**/v2/advisor/students/301/study-plan', route => route.fulfill({json: reply({
    studentUserId: 301, profileContext: {},
    plan: {studyPlanVersion: 1, strategySummary: 'Practice and reflection', checkpoints: [
      {id: 91, goal: 'Build the foundations', tasks: [tasks[1]]},
      {id: 92, goal: 'Develop clear arguments', tasks},
      {id: 93, goal: 'Prepare for assessment', tasks: []},
    ]},
  })}));
  await page.route('**/v2/advisor/schedule-requests?**', route => route.fulfill({json: reply({
    items: [{id: 901, courseId: 71, version: 1}], total: 1, page: 0, size: 10,
  })}));
  await page.goto('/advisor/students/301/study-plan');
  await expect(page.getByRole('heading', {name: 'Learning Journey'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Approve', exact: true})).toHaveCount(0);
  for (const width of [1440, 1080, 768, 390, 320]) {
    await page.setViewportSize({width, height: 1024});
    await expectNoViewportOverflow(page);
    const summary = page.getByLabel('Student profile summary');
    const circle = summary.getByRole('progressbar', {name: 'Advisor task completion'});
    const outer = await summary.boundingBox();
    const inner = await circle.boundingBox();
    expect((inner?.x ?? 0) + (inner?.width ?? 0)).toBeLessThanOrEqual((outer?.x ?? 0) + (outer?.width ?? 0));
    await page.screenshot({path: testInfo.outputPath(`journey-${width}.png`), fullPage: true});
  }
});

async function expectNoViewportOverflow(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
}

test('one-to-one creation sends contract session enums and versioned payload', async ({page}) => {
  await fixture(page, 'ADVISOR');
  await page.route('**/v2/advisor/students/301/study-plan', route => route.fulfill({json: reply({
    studentUserId: 301, profileContext: {}, plan: {studyPlanVersion: 2, checkpoints: []},
  })}));
  await page.route('**/v2/advisor/instructors?**', route => route.fulfill({json: reply({
    items: [{instructorUserId: 51, firstName: 'Ivy', lastName: 'Lee'}], total: 1, page: 0, size: 20,
  })}));
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/v2/advisor/students/301/courses/one-on-one', route => {
    submitted = route.request().postDataJSON();
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    return route.fulfill({status: 201, json: reply({courseId: 71})});
  });
  await page.goto('/advisor/students/301/courses');
  await page.getByRole('button', {name: 'Add Course', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Add Course'});
  await dialog.getByRole('button', {name: 'Create 1-on-1 Course', exact: true}).click();
  await dialog.getByRole('textbox', {name: 'Title', exact: true}).fill('Personal writing practice');
  await dialog.getByRole('combobox', {name: 'Instructor', exact: true}).selectOption('51');
  await dialog.getByRole('textbox', {name: /^Term start/}).fill('09/07/2026');
  await dialog.getByRole('textbox', {name: /^Term end/}).fill('12/07/2026');
  await dialog.getByRole('combobox', {name: 'Session type'}).selectOption('Tutorial');
  await dialog.getByRole('combobox', {name: 'Day of week'}).selectOption('TUE');
  await dialog.getByRole('textbox', {name: 'Location', exact: true}).fill('Room 2');
  await dialog.getByRole('button', {name: 'Create course', exact: true}).click();
  await expect.poll(() => submitted).toMatchObject({
    primaryInstructorUserId: 51, expectedStudyPlanVersion: 2,
    termStartDate: '2026-09-07', termEndDate: '2026-12-07',
    sessions: [{type: 'Tutorial', dayOfWeek: 'TUE', startTime: '09:00', endTime: '10:00', location: 'Room 2'}],
  });
});

test('long returned course strings do not widen the course chooser', async ({page}) => {
  await fixture(page, 'ADVISOR');
  await page.route('**/v2/advisor/students/301/course-options?**', route => route.fulfill({json: reply({
    items: [{courseId: 71, title: 'LongCourseTitle'.repeat(16), courseCode: 'CODE'.repeat(24)}],
    total: 1, page: 0, size: 20,
  })}));
  await page.goto('/advisor/students/301/courses');
  await page.getByRole('button', {name: 'Add Course', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Add Course'});
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({width, height: 844});
    await expect(dialog.getByRole('button', {name: /LongCourseTitle/})).toBeVisible();
    await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expectNoViewportOverflow(page);
  }
});

test('advisor student list keeps the Figma hierarchy across desktop and mobile', async ({page}, testInfo) => {
  await fixture(page, 'ADVISOR');
  await page.goto('/advisor/students');

  await expect(page.getByRole('heading', {name: 'Students List'})).toBeVisible();
  await expect(page.getByRole('searchbox', {name: 'Search students'})).toBeVisible();
  await expect(page.getByRole('combobox', {name: 'Student risk'})).toBeVisible();
  await expect(page.getByRole('combobox', {name: 'Student type'})).toBeVisible();
  await expect(page.getByRole('combobox', {name: 'Active task type'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Open Alex Chen'})).toHaveAttribute('href', '/advisor/students/301/study-plan');
  await expectNoViewportOverflow(page);
  await page.screenshot({path: testInfo.outputPath('students-desktop.png'), fullPage: true});

  await page.setViewportSize({width: 390, height: 844});
  await expect(page.locator('td[data-label="Target goal"]')).toBeVisible();
  await expect(page.getByRole('link', {name: 'Open Alex Chen'})).toBeVisible();
  await expect.poll(() => page.getByRole('rowheader', {name: /Alex Chen/}).evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(200);
  await expectNoViewportOverflow(page);
  await page.screenshot({path: testInfo.outputPath('students-mobile.png'), fullPage: true});
});

test('add course loads the first 20 options and course cards expose returned schedules', async ({page}, testInfo) => {
  await fixture(page, 'ADVISOR');
  const requests: Array<{page: string | null; size: string | null}> = [];
  let linkRequest: {body: unknown; idempotencyKey?: string} | undefined;
  const options = Array.from({length: 101}, (_, index) => ({
    courseId: index + 100,
    courseCode: `IELTS-${index + 1}`,
    title: `Course option ${index + 1}`,
    capacity: 12,
    activeStudents: index % 12,
    remainingCapacity: 12 - (index % 12),
  }));
  const assignedCourse = {
    courseId: 71,
    courseCode: 'WR-101',
    title: 'Academic Writing Studio',
    deliveryMode: 'GROUP',
    instructorFirstName: 'Ivy',
    instructorLastName: 'Lee',
    lifecycleStatus: 'ONGOING',
    courseLinkVersion: 1,
    lectureCompleted: 4,
    lectureTotal: 10,
    schedule: [{sessionId: 31, type: 'GROUP', dayOfWeek: 'MONDAY', startTime: '09:00:00', endTime: '10:00:00', location: 'Room 3A'}],
  };

  await page.route('**/v2/advisor/students/301/course-options**', (route) => {
    const url = new URL(route.request().url());
    const requestedPage = Number(url.searchParams.get('page'));
    const requestedSize = Number(url.searchParams.get('size'));
    requests.push({page: url.searchParams.get('page'), size: url.searchParams.get('size')});
    const items = options.slice(requestedPage * requestedSize, (requestedPage + 1) * requestedSize);
    return route.fulfill({json: reply({items, page: requestedPage, size: requestedSize, total: options.length})});
  });
  await page.route('**/v2/advisor/students/301/study-plan', (route) =>
    route.fulfill({json: reply({
      studentUserId: 301,
      profileContext: {currentProfileVersion: 1},
      plan: {studyPlanId: 81, studyPlanVersion: 1, checkpoints: []},
    })}),
  );
  await page.route('**/v2/advisor/students/301/courses/group-links', (route) => {
    linkRequest = {
      body: route.request().postDataJSON(),
      idempotencyKey: route.request().headers()['idempotency-key'],
    };
    return route.fulfill({status: 201, json: reply(assignedCourse)});
  });
  await page.route('**/v2/advisor/students/301/courses', (route) =>
    route.fulfill({json: reply([assignedCourse])}),
  );

  await page.goto('/advisor/students/301/courses');
  await expect(page.getByText('Monday · 9:00 AM – 10:00 AM')).toBeVisible();
  await expect(page.getByText('Room 3A')).toBeVisible();
  await page.getByRole('button', {name: 'Add Course', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Add Course'});
  await expect(dialog.getByText(/Showing 20 of 101 available courses/)).toBeVisible();
  await expect(dialog.getByRole('button', {name: /Course option 20\b/})).toBeVisible();
  expect(requests).toEqual([
    {page: '0', size: '20'},
  ]);
  await dialog.locator('[class*="courseOptionsList"]').evaluate(element => {element.scrollTop = 0;});
  await page.screenshot({path: testInfo.outputPath('add-course-desktop.png')});
  await page.setViewportSize({width: 390, height: 844});
  await expectNoViewportOverflow(page);
  await page.screenshot({path: testInfo.outputPath('add-course-mobile.png')});

  await dialog.getByRole('button', {name: /Course option 20\b/}).click();
  await dialog.getByRole('button', {name: 'Link selected course'}).click();
  await expect.poll(() => linkRequest).toBeDefined();
  expect(linkRequest?.body).toMatchObject({courseId: 119, expectedStudyPlanVersion: 1});
  expect(linkRequest?.idempotencyKey).toBeTruthy();
});

test('course search distinguishes an empty response from failure and can retry', async ({page}) => {
  await fixture(page, 'ADVISOR');
  let failed = true;
  await page.route('**/v2/advisor/students/301/course-options**', route =>
    failed
      ? route.fulfill({status: 404, json: {status: 404, code: 'STUDY_PLAN_NOT_FOUND', message: 'Study plan not found'}})
      : route.fulfill({json: reply({items: [], page: 0, size: 20, total: 0})}),
  );
  await page.goto('/advisor/students/301/courses');
  await page.getByRole('button', {name: 'Add Course', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Add Course'});
  await expect(dialog.getByText('Create a study plan for this student before choosing an available group course.')).toBeVisible();
  await expect(dialog.getByText(/No available group courses were returned/)).toHaveCount(0);
  failed = false;
  await dialog.getByRole('button', {name: 'Retry course search'}).click();
  await expect(dialog.getByText(/No available group courses were returned/)).toBeVisible();
  await expect(dialog.getByRole('button', {name: 'Link selected course'})).toBeDisabled();
  await dialog.getByLabel('Search available courses').fill('Writing');
  await expect(dialog.getByText(/No courses match this search/)).toBeVisible();
  await dialog.getByRole('button', {name: 'Close add course'}).click();
  await page.getByRole('button', {name: 'Add Course', exact: true}).click();
  await expect(dialog.getByLabel('Search available courses')).toHaveValue('');
  await expect(dialog.getByText(/No available group courses were returned/)).toBeVisible();
});

test('a malformed course page cannot crash the course chooser', async ({page}) => {
  await fixture(page, 'ADVISOR');
  await page.route('**/v2/advisor/students/301/course-options**', route => route.fulfill({json: reply([])}));
  await page.goto('/advisor/students/301/courses');
  await page.getByRole('button', {name: 'Add Course', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Add Course'});
  await expect(dialog.getByText('Available courses returned an invalid page. Please retry.')).toBeVisible();
  await dialog.getByRole('button', {name: 'Create 1-on-1 Course', exact: true}).click();
  await expect(dialog.getByLabel('Title', {exact: true})).toBeVisible();
});

test('advisor exam cards and assignment dialog use the supported exam contract', async ({page}, testInfo) => {
  await fixture(page, 'ADVISOR');
  let assignment: {body: unknown; idempotencyKey?: string} | undefined;
  const exam = {
    id: 71,
    title: 'IELTS Academic Practice',
    status: 'ASSIGNED',
    listeningSelected: true,
    readingSelected: true,
    writingSelected: true,
    createdAt: '2026-09-03T12:00:00Z',
  };
  await page.route('**/v2/advisor/mock-exam-templates', (route) => route.fulfill({json: reply([
    {id: 45, label: 'IELTS Academic', title: 'IELTS Full Mock Test', publishedVersionId: 451, publishedVersionNo: 3},
  ])}));
  await page.route('**/v2/advisor/instructors**', (route) => route.fulfill({json: reply({
    items: [{instructorUserId: 501, firstName: 'Sylvia', lastName: 'Reyes', level: 'INSTRUCTOR'}],
    page: 0,
    size: 20,
    total: 1,
  })}));
  await page.route('**/v2/advisor/students/301/mock-exams', (route) => {
    if (route.request().method() === 'POST') {
      assignment = {
        body: route.request().postDataJSON(),
        idempotencyKey: route.request().headers()['idempotency-key'],
      };
      return route.fulfill({status: 201, json: reply(exam)});
    }
    return route.fulfill({json: reply([exam])});
  });

  await page.goto('/advisor/students/301/exams');
  await expect(page.getByRole('heading', {name: 'All Exams'})).toBeVisible();
  await expect(page.getByText('Listening · Reading · Writing')).toBeVisible();
  await page.getByRole('button', {name: 'Assign Exam', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Assign Exam'});
  await expect(dialog.getByText(/Sitting dates|Speaking/)).toHaveCount(0);
  await page.screenshot({path: testInfo.outputPath('assign-exam-desktop.png')});
  await page.setViewportSize({width: 390, height: 844});
  await expectNoViewportOverflow(page);
  await page.screenshot({path: testInfo.outputPath('assign-exam-mobile.png')});
  await dialog.getByRole('combobox', {name: 'Exam type'}).selectOption('45');
  await dialog.getByRole('combobox', {name: 'Writing instructor'}).selectOption('501');
  await dialog.getByRole('checkbox', {name: 'Reading'}).uncheck();
  await dialog.getByRole('button', {name: 'Assign exam', exact: true}).click();

  await expect.poll(() => assignment).toBeDefined();
  expect(assignment?.body).toEqual({
    templateId: 45,
    listeningSelected: true,
    readingSelected: false,
    writingSelected: true,
    writingInstructorUserId: 501,
  });
  expect(assignment?.idempotencyKey).toBeTruthy();
});
