import {expect, test} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

test('exam navigation preserves answers and displays only released results', async ({page}) => {
  await fixture(page);
  const writes: {path: string; body: unknown}[] = [];
  const passages = [
    {id: 4, title: 'Practice', shortLabel: 'Passage 1', intro: 'Answer the question.', paragraphs: ['Learning improves with practice.'], questionNumbers: [11], questions: [{kind: 'shortAnswer', title: 'Question 11', instruction: 'Write one word.', questionStart: 11, questionEnd: 11, payload: {questions: [{id: 11, prompt: 'What improves learning?'}]}}]},
    {id: 9, title: 'Feedback', shortLabel: 'Passage 2', intro: 'Answer the question.', paragraphs: ['Feedback guides reflection.'], questionNumbers: [21], questions: [{kind: 'shortAnswer', title: 'Question 21', instruction: 'Write one word.', questionStart: 21, questionEnd: 21, payload: {questions: [{id: 21, prompt: 'What guides reflection?'}]}}]},
  ];
  await page.route('**/v2/student/mock-exams/77**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST') {
      writes.push({path, body: route.request().postDataJSON()});
      return route.fulfill({json: reply(path.endsWith('/attempts') ? {attemptId: 81} : {submissionId: 91, readingId: 77, totalQuestions: 2, correctCount: 1, results: [{questionNumber: 11, submitted: 'practice', correct: true, blank: false}, {questionNumber: 21, submitted: 'time', correct: false, blank: false}]})});
    }
    return route.fulfill({json: reply(path.endsWith('/reading') ? {id: 77, totalMinutes: 60, passages} : {id: 77, title: 'Reading practice', status: 'ASSIGNED', readingSelected: true})});
  });
  await page.setViewportSize({width: 1440, height: 1024});
  await page.goto('/mock-exams/77/reading');
  await page.getByRole('textbox').fill('practice');
  await expect(page.getByLabel('Answer progress')).toContainText('Answered 1');
  await page.getByRole('button', {name: 'Passage 2 (0 of 1)', exact: true}).click();
  await expect(page.getByLabel('Answer progress')).toContainText('Unanswered 1');
  await page.getByRole('textbox').fill('time');
  await page.getByRole('button', {name: 'Passage 1 (1 of 1)', exact: true}).click();
  await page.getByRole('button', {name: 'Go to question 11', exact: true}).click();
  await expect(page.getByRole('textbox')).toHaveValue('practice');
  const [content, navigation] = await Promise.all([page.locator('main').boundingBox(), page.locator('footer').boundingBox()]);
  expect(navigation!.x).toBeGreaterThan(content!.x + content!.width);
  await page.setViewportSize({width: 390, height: 844});
  await expect(page.getByRole('textbox')).toHaveValue('practice');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', {name: 'Finish section', exact: true}).click();
  await expect(page.getByRole('dialog', {name: 'Ready to submit?'})).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByRole('button', {name: 'Submit section', exact: true}).click();
  await page.getByRole('button', {name: 'View results', exact: true}).click();
  expect(writes.at(-1)?.path).toMatch(/\/v2\/student\/mock-exams\/77\/attempts\/81\/reading-submissions$/);
  expect(writes.at(-1)?.body).toEqual({answers: {'11': 'practice', '21': 'time'}});
  await expect(page.getByLabel('Released question results')).toContainText('Correct 1');
  await page.getByRole('button', {name: 'Passage 2', exact: true}).click();
  await expect(page.getByLabel('Released question results')).toContainText('Incorrect 1');
  await expect(page.getByRole('button', {name: 'Submitted', exact: true})).toBeDisabled();
});
