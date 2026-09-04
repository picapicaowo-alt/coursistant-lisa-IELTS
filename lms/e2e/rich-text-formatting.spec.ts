import {expect, test} from '@playwright/test';

const apiResponse = (data: unknown) => ({
  status: 200,
  code: 'SUCCESS',
  message: 'Success',
  timestamp: '2026-08-24T12:00:00Z',
  data,
});

test('teacher can remove bold formatting and a newly selected annotated file', async ({page}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({
      id: 900,
      userId: 900,
      email: 'teacher@example.com',
      name: 'Course Teacher',
      username: 'teacher',
      role: 'USER',
      level: 'INSTRUCTOR',
      avatar: null,
      accessToken: 'browser-test-token',
    }));
    localStorage.setItem('accToken', 'browser-test-token');
  });

  await page.route('**/v2/**', async route => {
    const url = new URL(route.request().url());
    const apiPathStart = url.pathname.indexOf('/v2/');
    const path = apiPathStart >= 0 ? url.pathname.slice(apiPathStart) : url.pathname;
    let data: unknown;

    if (path === '/v2/me/courses') {
      data = {items: [{
        id: 34,
        courseId: 34,
        courseCode: 'LAW-101',
        title: 'University Law',
        name: 'University Law',
        description: null,
        tenantId: 1,
        state: 'Active',
        status: 'Active',
        courseRole: 'Instructor',
        role: 'Instructor',
        canGrade: null,
        canPostAnnouncements: null,
        canManageGroups: null,
        canManageCourseEvents: null,
        primaryInstructor: null,
        createdAt: '2026-08-01T10:00:00',
        updatedAt: '2026-08-24T10:00:00',
        archivedAt: null,
      }], page: 0, size: 100, total: 1};
    } else if (path === '/v2/me/notifications/unread-count') {
      data = {unreadCount: 0};
    } else if (path === '/v2/courses/34/assignments/48/grading-roster') {
      data = {
        assignmentId: 48,
        assignmentTitle: 'Testing Assignment',
        pointsPossible: 10,
        dueAtUtc: '2026-08-24T18:00:00Z',
        dueAtLocal: '2026-08-24T11:00:00',
        timezone: 'America/Los_Angeles',
        totalStudents: 1,
        submittedCount: 1,
        lateCount: 0,
        notSubmittedCount: 0,
        ungradedCount: 0,
        enteredCount: 1,
        releasedCount: 0,
        gradingWritable: true,
        items: [{
          studentUserId: 389,
          studentName: 'Eden Brooks',
          studentEmail: 'eden@example.com',
          submissionStatus: 'Submitted',
          gradeStatus: 'Entered',
          score: 10,
          fileCount: 0,
        }],
      };
    } else if (path === '/v2/courses/34/assignments/48/students/389/grading') {
      data = {
        assignmentId: 48,
        grade: {
          id: 1,
          assignmentId: 48,
          studentUserId: 389,
          score: 10,
          feedbackHtml: '<p><strong>Bold feedback</strong></p>',
          status: 'Entered',
        },
      };
    } else {
      data = [];
    }

    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse(data))});
  });

  await page.goto('/course/34/assignments/48/grading');
  await page.getByRole('button', {name: 'Grade Eden Brooks'}).click();

  const editor = page.locator('[contenteditable="true"][aria-label="Feedback for the learner"]');
  await expect(editor).toContainText('Bold feedback');
  await expect(editor.locator('strong')).toHaveCount(1);

  const boldButton = page.getByRole('button', {name: 'Bold'});
  await editor.locator('strong').click();
  await page.keyboard.press('End');
  await expect(boldButton).toHaveAttribute('aria-pressed', 'true');
  await boldButton.click();

  await expect(editor).toContainText('Bold feedback');
  await expect(editor.locator('strong')).toHaveCount(0);
  await expect(boldButton).toHaveAttribute('aria-pressed', 'false');

  await editor.selectText();
  await boldButton.click();
  await expect(editor.locator('strong')).toHaveCount(1);

  await editor.locator('strong').selectText();
  await expect.poll(async () => page.evaluate(() => window.getSelection()?.toString())).toBe('Bold feedback');
  await boldButton.click();

  await expect(editor).toContainText('Bold feedback');
  await expect(editor.locator('strong')).toHaveCount(0);

  const annotatedFileInput = page.getByLabel('Choose annotated feedback file');
  await annotatedFileInput.setInputFiles({
    name: 'marked-feedback.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('browser regression fixture'),
  });
  await expect(page.getByText('marked-feedback.pdf')).toBeVisible();
  await page.getByRole('button', {name: 'Remove selected file marked-feedback.pdf'}).click();
  await expect(page.getByText('marked-feedback.pdf')).toHaveCount(0);
  await expect(page.getByRole('button', {name: /Upload annotated file/})).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
