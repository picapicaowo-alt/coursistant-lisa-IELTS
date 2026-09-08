import {expect, test} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

for (const section of ['reading', 'listening', 'writing'] as const) {
  test(`${section} recovers a paused answer after reload and keeps it after failed submission`, async ({page}) => {
    await fixture(page);
    let failSubmission = true;
    const questions = [{kind: 'shortAnswer', title: 'Question', questionStart: 11, questionEnd: 11, payload: {questions: [{id: 11, prompt: 'Answer here'}]}}];
    const paper = section === 'writing'
      ? {id: 77, totalMinutes: 60, tasks: [{seq: 1, taskKey: 'TASK1', title: 'Writing Task 1', prompt: 'Original prompt.', minWords: 10}]}
      : section === 'reading'
        ? {id: 77, totalMinutes: 60, passages: [{id: 4, title: 'Practice', paragraphs: ['Practice text.'], questionNumbers: [11], questions}]}
        : {id: 77, totalMinutes: 60, parts: [{id: 4, seq: 1, label: 'Part 1', questionNumbers: [11], sections: questions}]};
    await page.route('**/v2/student/mock-exams/77**', route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() === 'POST') {
        if (path.endsWith('/attempts')) return route.fulfill({json: reply({attemptId: 81})});
        if (failSubmission) return route.fulfill({status: 503, json: {code: 'INTERNAL_SERVER_ERROR'}});
        return route.fulfill({json: reply(section === 'writing'
          ? {submissionId: 91, tasks: [{taskKey: 'TASK1', wordCount: 4, contentLength: 24}]}
          : {submissionId: 91, totalQuestions: 1, correctCount: 1, results: [{questionNumber: 11, submitted: 'recover this answer', correct: true, blank: false}]})});
      }
      return route.fulfill({json: reply(path.endsWith(`/${section}`) ? paper : {id: 77, title: 'Recovery practice', status: 'READY', readingSelected: true, listeningSelected: true, writingSelected: true})});
    });
    await page.goto(`/mock-exams/77/${section}`);
    const answer = page.getByRole('textbox').first();
    await answer.fill('recover this answer');
    await page.getByRole('button', {name: 'Pause', exact: true}).click();
    await page.reload();
    await expect(answer).toHaveValue('recover this answer');
    await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
    await page.getByRole('button', {name: 'Finish section', exact: true}).click();
    await page.getByRole('button', {name: 'Submit section', exact: true}).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
    await page.reload();
    await expect(answer).toHaveValue('recover this answer');
    failSubmission = false;
    await page.getByRole('button', {name: 'Finish section', exact: true}).click();
    await page.getByRole('button', {name: 'Submit section', exact: true}).click();
    await expect(page.getByRole('button', {name: 'View results', exact: true})).toBeVisible();
    expect(await page.evaluate(suffix => Object.keys(sessionStorage).filter(key => key.startsWith('coursistant:mock-exam:') && key.endsWith(`:${suffix}`)), section)).toEqual([]);
  });
}
