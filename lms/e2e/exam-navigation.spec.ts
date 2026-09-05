import {expect, test} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';
import en from '../src/i18n/resources/en/course.json' with {type: 'json'};
import cn from '../src/i18n/resources/zh-CN/course.json' with {type: 'json'};
import tw from '../src/i18n/resources/zh-TW/course.json' with {type: 'json'};

for (const [locale, completed] of [['en', 'Completed'], ['zh-CN', '已完成'], ['zh-TW', '已完成']] as const) {
  test(`graded exam status and its filter agree in ${locale}`, async ({page}) => {
    await fixture(page);
    await page.addInitScript(locale => localStorage.setItem('coursistant.locale', locale), locale);
    await page.route('**/v2/student/mock-exams?*', route => route.fulfill({json: reply({items: [{
      id: 77, title: 'Graded practice', status: 'COMPLETED', attemptStatus: 'SUBMITTED',
      readingSelected: true, readingCorrect: 12, readingTotal: 40,
    }], total: 1, page: 0, size: 100})}));
    await page.goto('/mock-exams');
    await expect(page.getByRole('article').getByText(completed, {exact: true})).toBeVisible();
    await expect(page.getByRole('article').getByText('SUBMITTED', {exact: true})).toHaveCount(0);
    await page.getByRole('combobox', {name: 'Exam status'}).selectOption({label: completed});
    await expect(page.getByRole('combobox', {name: 'Exam status'})).toHaveValue('COMPLETED');
    await expect(page.getByRole('heading', {name: 'Graded practice', exact: true})).toBeVisible();
  });
}

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

for (const section of ['reading', 'listening'] as const) {
  test(`${section} submits unanswered questions with empty values`, async ({page}) => {
    await fixture(page);
    let submittedAnswers: unknown;
    const questions = [{kind: 'shortAnswer', title: 'Questions', instruction: 'Write one word.', questionStart: 11, questionEnd: 12, payload: {questions: [{id: 11, prompt: 'First question'}, {id: 12, prompt: 'Second question'}]}}];
    const paper = section === 'reading'
      ? {id: 77, totalMinutes: 60, passages: [{id: 4, title: 'Practice', shortLabel: 'Passage 1', intro: 'Answer the questions.', paragraphs: ['Practice text.'], questionNumbers: [11, 12], questions}]}
      : {id: 77, totalMinutes: 40, parts: [{id: 4, seq: 1, label: 'Part 1', questionNumbers: [11, 12], sections: questions}]};
    await page.route('**/v2/student/mock-exams/77**', route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() === 'POST') {
        if (path.endsWith('/attempts')) return route.fulfill({json: reply({attemptId: 81})});
        submittedAnswers = route.request().postDataJSON().answers;
        return route.fulfill({json: reply({submissionId: 91, readingId: 77, listeningId: 77, totalQuestions: 2, correctCount: 0, results: [{questionNumber: 11, submitted: section === 'reading' ? 'practice' : '', correct: false, blank: section === 'listening'}, {questionNumber: 12, submitted: '', correct: false, blank: true}]})});
      }
      return route.fulfill({json: reply(path.endsWith(`/${section}`) ? paper : {id: 77, title: 'Practice', status: 'READY', readingSelected: true, listeningSelected: true})});
    });
    await page.goto(`/mock-exams/77/${section}`);
    await expect(page.getByRole('textbox')).toHaveCount(2);
    if (section === 'reading') await page.getByRole('textbox').first().fill('practice');
    await page.getByRole('button', {name: 'Finish section', exact: true}).click();
    await page.getByRole('button', {name: 'Submit section', exact: true}).click();
    await expect(page.getByRole('button', {name: 'View results', exact: true})).toBeVisible();
    expect(submittedAnswers).toEqual({'11': section === 'reading' ? 'practice' : '', '12': ''});
  });
}

for (const [locale, copy] of [['en', en.mockResults], ['zh-CN', cn.mockResults], ['zh-TW', tw.mockResults]] as const) {
  test(`submitted writing opens saved responses and feedback in ${locale}`, async ({page}, testInfo) => {
    await fixture(page);
    await page.addInitScript(locale => localStorage.setItem('coursistant.locale', locale), locale);
    const unexpected: string[] = [];
    await page.route('**/v2/student/mock-exams/77**', route => {
      const path = new URL(route.request().url()).pathname;
      if (!path.endsWith('/mock-exams/77') || route.request().method() !== 'GET') unexpected.push(path);
      return route.fulfill({json: reply({id: 77, title: 'Saved writing audit', status: 'COMPLETED', writingScore: 6.5, writingGradeStatus: 'GRADED', writingFeedback: 'QA feedback', writingTasks: [{taskKey: 'TASK1', seq: 1, content: 'QA submitted response', wordCount: 3}]})});
    });
    await page.goto('/mock-exams/77/writing');
    await expect(page.getByRole('heading', {name: copy.sections.writing, exact: true})).toBeVisible();
    await expect(page.getByText('QA submitted response', {exact: true})).toBeVisible();
    await expect(page.getByText('QA feedback', {exact: true})).toBeVisible();
    await expect(page.getByText('6.5', {exact: true})).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Finish section', exact: true})).toHaveCount(0);
    await page.setViewportSize({width: 390, height: 844});
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({path: testInfo.outputPath(`submitted-writing-${locale}-390.png`), fullPage: true});
    await page.reload();
    await expect(page.getByText('QA submitted response', {exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: copy.back, exact: true})).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    expect(unexpected).toEqual([]);
  });
}

for (const section of ['reading', 'listening'] as const) {
  test(`an already-submitted ${section} section cannot start again during an active exam`, async ({page}) => {
    await fixture(page);
    const unexpected: string[] = [];
    await page.route('**/v2/student/mock-exams/77**', route => {
      const path = new URL(route.request().url()).pathname;
      if (!path.endsWith('/mock-exams/77') || route.request().method() !== 'GET') unexpected.push(path);
      return route.fulfill({json: reply({id: 77, title: 'Partial exam', status: 'IN_PROGRESS', [`${section}Correct`]: 0, [`${section}Total`]: 40})});
    });
    await page.goto(`/mock-exams/77/${section}`);
    await expect(page.getByText('0 / 40 correct', {exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Finish section', exact: true})).toHaveCount(0);
    expect(unexpected).toEqual([]);
  });
}
