import {expect, test, type Page} from '@playwright/test';

const response = (data: unknown) => ({status: 200, code: 'SUCCESS', data});
const student = {firstName: 'Emily', lastName: 'Wong', email: 'emily@example.test'};
const course = {courseId: 71, title: 'Academic Writing Studio', courseCode: 'WR101', instructorFirstName: 'Sarah', instructorLastName: 'Lim', lifecycleStatus: 'PUBLISHED', termStartDate: '2026-09-14', termEndDate: '2026-10-12', publishedAssignmentCount: 4, submittedAssignmentCount: 3, progressPercent: 75, schedule: [{dayOfWeek: 'MON', startTime: '10:00:00', endTime: '11:30:00', location: 'Room 3A'}]};
const report = {reportId: 51, reportType: 'MID_TERM', overallSummary: 'The diagnostic is complete. Paragraph structure is the next focus.', strengths: 'Clear main ideas and strong reading comprehension.', weaknesses: 'Supporting paragraphs need more specific examples.', skillEvaluation: 'Writing structure is developing while reading comprehension remains strong.', improvementSuggestions: 'Draft two supporting paragraphs before the next class.', publishedAt: '2026-09-03T10:00:00Z'};
const exam = {id: 71, title: 'September diagnostic', status: 'COMPLETED', createdAt: '2026-09-14T10:00:00Z', attempt: {status: 'SUBMITTED', submittedAt: '2026-09-14T11:30:00Z'}, listeningSelected: true, listeningCorrect: 32, listeningTotal: 40, readingSelected: true, readingCorrect: 35, readingTotal: 40, writingSelected: true, writingScore: 6.5, writingGradeStatus: 'GRADED'};

async function setup(page: Page) {
  const reads: string[] = [];
  await page.addInitScript(() => {
    const user = {id: 901, userId: 901, role: 'USER', level: 'PARENT', name: 'Parent review', accessToken: 'isolated-parent-navigation-fixture'};
    localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('accToken', user.accessToken);
  });
  await page.route('**/v2/**', route => {
    const url = new URL(route.request().url());
    reads.push(url.pathname);
    let data: unknown = [];
    if (url.pathname.endsWith('/linked-students')) data = {items: [{studentUserId: 301}, {studentUserId: 302}], page: 0, size: 20, total: 2};
    else if (url.pathname.endsWith('/dashboard')) data = {student, currentCourses: [course], hours: {purchasedMinutes: 720, usedMinutes: 180, remainingMinutes: 540}, attendance: {attended: 3, total: 4}};
    else if (url.pathname.endsWith('/profile')) data = {student, intakeBackground: 'Stronger in reading than writing.', targetGoal: 'Reach IELTS Academic Writing 6.5 with clearer task response and cohesion.', targetMetric: 'IELTS Writing', targetValue: '6.5', targetDate: '2026-10-12', advisorInterpretation: 'Ready for a focused term with weekly written practice.'};
    else if (url.pathname.endsWith('/study-plan')) data = {strategySummary: 'Weekly timed essays, model-answer deconstruction and targeted grammar practice.', startDate: '2026-09-14', planEndDate: '2026-10-12', checkpoints: [{description: 'Build a clear and supported argument', goal: 'Complete the diagnostic', dueDate: '2026-09-21', derivedStatus: 'REACHED_COMPLETED', tasks: [{title: 'Complete the writing diagnostic', status: 'COMPLETED', completedAt: '2026-09-03T09:24:32'}]}, {description: 'Develop supporting paragraphs', dueDate: '2026-09-28', tasks: [{title: 'Draft two supporting paragraphs', status: 'NOT_STARTED'}]}]};
    else if (url.pathname.endsWith('/courses')) data = [course];
    else if (url.pathname.endsWith('/assignments')) data = [{title: 'A well-supported argument', status: 'SUBMITTED'}];
    else if (url.pathname.endsWith('/risk')) data = {riskStatus: 'ON_TRACK'};
    else if (url.pathname.endsWith('/hours')) data = {purchasedMinutes: 720, usedMinutes: 180, remainingMinutes: 540};
    else if (url.pathname.endsWith('/attendance')) data = [{courseTitle: course.title, attendanceStatus: 'PRESENT', occurrenceDate: '2026-09-14'}];
    else if (url.pathname.endsWith('/calendar')) data = [{courseId: 71, occurrenceId: 81, courseTitle: course.title, occurrenceDate: '2026-09-21', startTime: '10:00:00', endTime: '11:30:00', location: 'Room 3A'}];
    else if (url.pathname.endsWith('/reports/51')) data = report;
    else if (url.pathname.endsWith('/reports')) data = {items: [report], page: 0, size: 20, total: 1};
    else if (url.pathname.endsWith('/mock-exams/71')) data = exam;
    else if (url.pathname.endsWith('/mock-exams')) data = [exam];
    else if (url.pathname.endsWith('/notifications')) data = {items: [{notificationId: 31, message: 'A new learning report is available.'}], page: 0, size: 20, total: 1};
    else if (url.pathname.endsWith('/conversation/messages')) data = {items: [{messageId: 41, body: 'The diagnostic is complete. We will focus on paragraph structure next.'}], hasMore: false};
    else if (url.pathname.endsWith('/unread-count')) data = {unreadCount: 1};
    return route.fulfill({json: response(data)});
  });
  return reads;
}

test('Parent areas and focused subviews keep student context across navigation and history', async ({page}) => {
  const reads = await setup(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/parent?studentUserId=302');
  await expect(page.getByRole('heading', {name: 'Student progress', exact: true})).toBeVisible();
  await expect(page.getByRole('progressbar', {name: /Academic Writing Studio/})).toHaveAttribute('value', '75');
  await expect(page.getByRole('navigation', {name: 'Parent portal sections'})).toHaveCount(0);
  await page.getByRole('link', {name: 'Learning', exact: true}).click();
  await expect(page).toHaveURL(/section=learning&studentUserId=302/);
  await expect(page.getByText('Complete the writing diagnostic', {exact: true})).toBeVisible();
  expect(reads.some(path => path.endsWith('/assignments'))).toBe(false);
  await page.getByRole('link', {name: 'Courses & assignments', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Assignments', exact: true})).toBeVisible();
  await expect(page.getByRole('region', {name: 'Study plan', exact: true})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('link', {name: 'Courses & assignments', exact: true})).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', {name: 'Schedule', exact: true}).click();
  await expect(page).toHaveURL(/section=schedule&studentUserId=302$/);
  await page.getByRole('link', {name: 'Request history', exact: true}).click();
  await expect(page.getByText(/No schedule requests yet/)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', {name: 'Scheduled classes', exact: true})).toHaveAttribute('aria-current', 'page');
  await page.goto('/parent?section=notifications&studentUserId=302');
  await expect(page.getByRole('link', {name: 'Messages', exact: true})).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', {name: 'Notifications', exact: true})).toHaveAttribute('aria-current', 'page');
  expect(errors).toEqual([]);
});

test('Parent navigation and content fit desktop, tablet and mobile', async ({page}, info) => {
  await setup(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height: width === 1440 ? 1000 : 844});
    for (const area of ['dashboard', 'learning', 'schedule', 'reports', 'exams', 'messages']) {
      await page.goto(`/parent?section=${area}&studentUserId=301`);
      await expect(page.getByRole('combobox', {name: 'Student'})).toHaveValue('301');
      if (area === 'learning') await expect(page.getByText('Complete the writing diagnostic', {exact: true})).toBeVisible();
      if (area === 'schedule') {
        await page.getByRole('button', {name: 'Request change', exact: true}).click();
        await expect(page.getByRole('combobox', {name: 'Request type'})).toBeVisible();
      }
      if (area === 'reports') await expect(page.getByText('The diagnostic is complete. Paragraph structure is the next focus.')).toBeVisible();
      if (area === 'exams') await expect(page.getByRole('progressbar', {name: 'Listening score'})).toHaveAttribute('value', '80');
      if (area === 'messages') await expect(page.getByText('The diagnostic is complete. We will focus on paragraph structure next.')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      // The app scrolls its main workspace, not the document. Reset that actual scroller for top-of-page evidence.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByRole('main').evaluate(element => element.scrollTo(0, 0));
      await page.screenshot({path: info.outputPath(`parent-${area}-${width}.png`), fullPage: true});
      if (width === 390 && (area === 'schedule' || area === 'learning')) {
        const target = area === 'schedule' ? page.getByRole('button', {name: 'Submit request', exact: true}) : page.getByRole('region', {name: 'Learning profile', exact: true});
        await target.scrollIntoViewIfNeeded();
        await page.screenshot({path: info.outputPath(`parent-${area}-detail-${width}.png`), fullPage: true});
      }
    }
  }
  await page.getByRole('button', {name: 'More', exact: true}).click();
  await page.getByRole('navigation', {name: 'More navigation'}).getByRole('link', {name: 'Mock exams', exact: true}).click();
  await expect(page.getByRole('navigation', {name: 'More navigation'})).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Assigned mock exams', exact: true})).toBeVisible();
  for (const width of [320, 768, 2048, 2560]) {
    await page.setViewportSize({width, height: 1000});
    await page.goto('/parent?section=learning&tab=courses&studentUserId=301');
    await expect(page.getByRole('region', {name: 'Courses', exact: true})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test('a schedule change uses the selected student and preserves contracted wall-clock values', async ({page}) => {
  await setup(page);
  let request: Record<string, unknown> | undefined;
  await page.route('**/v2/parent/students/302/schedule-requests', route => {
    if (route.request().method() === 'POST') request = route.request().postDataJSON();
    return route.fulfill({json: response([])});
  });
  await page.goto('/parent?section=schedule&studentUserId=302');
  await page.getByRole('button', {name: 'Request change', exact: true}).click();
  await page.getByLabel('Proposed date', {exact: true}).fill('2026-09-22');
  await page.getByLabel('Starts', {exact: true}).fill('10:00');
  await page.getByLabel('Ends', {exact: true}).fill('11:30');
  await page.getByLabel('Reason', {exact: true}).fill('School event');
  await page.getByRole('button', {name: 'Submit request', exact: true}).click();
  await expect(page.getByRole('status')).toContainText('Request submitted');
  expect(request).toEqual({courseId: 71, occurrenceId: 81, requestType: 'SCHEDULE_CHANGE', proposedOccurrenceDate: '2026-09-22', proposedStartTime: '10:00', proposedEndTime: '11:30', reason: 'School event'});
});
