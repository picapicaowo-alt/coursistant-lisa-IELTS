import {expect, test} from '@playwright/test';
import {course, fixture, reply} from './workspace-fixtures';

for (const level of ['STUDENT', 'INSTRUCTOR']) {
  test(`${level} coursework and calendar never request legacy Quiz data`, async ({page}) => {
    await fixture(page, level, level === 'INSTRUCTOR' ? 'Instructor' : 'Student');
    const quizRequests: string[] = [];
    const errors: string[] = [];
    page.on('request', request => {
      if (/\/quizzes(?:\/|\?|$)/.test(request.url())) quizRequests.push(request.url());
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/v2/courses/71', route => route.fulfill({json: reply({...course, role: level === 'INSTRUCTOR' ? 'Instructor' : 'Student'})}));
    await page.goto('/course/71');
    await expect(page.getByRole('heading', {name: course.title, exact: true})).toBeVisible();
    await page.getByRole('button', {name: 'Assignments', exact: true}).click();
    await expect(page.getByRole('heading', {name: 'Homework / Problem Set', exact: true})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Quizzes'})).toHaveCount(0);
    await expect(page.locator('a[href*="/quizzes"]')).toHaveCount(0);
    if (level === 'STUDENT') {
      await page.goto('/course/71/grades');
      await expect(page.getByRole('link', {name: /First academic essay/})).toBeVisible();
      await expect(page.getByRole('heading', {name: 'Quizzes'})).toHaveCount(0);
    }
    if (level === 'INSTRUCTOR') await expect(page.locator('a[href="/course/71/grades"]')).toHaveCount(0);
    const calendarAssignments = page.waitForResponse(response => /\/v2\/courses\/71\/assignments(?:[/?]|$)/.test(response.url()));
    await page.goto('/calendar');
    await expect(page.getByRole('heading', {name: 'Calendar', exact: true})).toBeVisible();
    await expect(page.getByRole('combobox', {name: 'Calendar view'})).toBeVisible();
    await calendarAssignments;
    expect(quizRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('legacy Quiz deadlines and grading buckets do not become IELTS tasks', async ({page}) => {
  await fixture(page, 'INSTRUCTOR', 'Instructor');
  const context = {courseId: 71, courseCode: 'WR101', timezone: 'America/Los_Angeles'};
  await page.route('**/v2/me/teaching/deadlines/upcoming**', route => route.fulfill({json: reply([
    {...context, kind: 'Assignment', title: 'IELTS writing deadline', assignmentId: 81, quizId: null, atLocal: '2026-09-14T17:00:00', submittedCount: 1, totalStudents: 2},
    {...context, kind: 'Quiz', title: 'Legacy quiz deadline', assignmentId: null, quizId: 91, atLocal: '2026-09-14T17:00:00', submittedCount: 1, totalStudents: 2},
  ])}));
  await page.route('**/v2/me/teaching/grading-queue**', route => route.fulfill({json: reply([
    {...context, kind: 'AssignmentUngraded', title: 'IELTS writing to grade', assignmentId: 81, quizId: null, pendingCount: 2},
    {...context, kind: 'QuizManualPending', title: 'Legacy quiz to grade', assignmentId: null, quizId: 91, pendingCount: 9},
  ])}));
  await page.goto('/');
  await expect(page.getByRole('link', {name: /IELTS writing deadline/})).toBeVisible();
  await expect(page.getByRole('link', {name: /IELTS writing to grade/})).toBeVisible();
  await expect(page.getByText(/Legacy quiz/)).toHaveCount(0);
  await expect(page.locator('a[href*="/quizzes"]')).toHaveCount(0);
  await page.goto('/my-operations');
  await expect(page.getByRole('link', {name: /IELTS writing to grade/})).toBeVisible();
  await expect(page.getByText('2 pending', {exact: true})).toBeVisible();
  await expect(page.getByText(/Legacy quiz/)).toHaveCount(0);
});

for (const path of ['/course/71/quizzes/new', '/course/71/quizzes/91', '/course/71/quizzes/91/edit', '/course/71/quizzes/91/grading']) {
  test(`retired route ${path} opens the normal missing-page state`, async ({page}) => {
    await fixture(page, 'INSTRUCTOR', 'Instructor');
    const quizRequests: string[] = [];
    page.on('request', request => {
      if (/\/v2\/courses\/\d+\/quizzes/.test(request.url())) quizRequests.push(request.url());
    });
    await page.goto(path);
    await expect(page.getByText('Page not found', {exact: true})).toBeVisible();
    expect(quizRequests).toEqual([]);
  });
}
