import {readFileSync, readdirSync} from 'node:fs';
import {expect, test, type Page} from '@playwright/test';
import {createInstance, type Resource, type TOptions} from 'i18next';
import {fixture, reply} from './workspace-fixtures';

const locales = ['en', 'zh-CN', 'zh-TW'] as const;
const engine = createInstance();
const resources: Resource = Object.fromEntries(locales.map(locale => [locale, Object.fromEntries(readdirSync(new URL(`../src/i18n/resources/${locale}/`, import.meta.url)).map(file => [file.slice(0, -5), JSON.parse(readFileSync(new URL(`../src/i18n/resources/${locale}/${file}`, import.meta.url), 'utf8'))]))]));
test.beforeAll(async () => {await engine.init({resources, lng: 'en', fallbackLng: 'en', interpolation: {escapeValue: false}});});
const t = (locale: string, key: string, options?: TOptions) => engine.getFixedT(locale)(key, options ?? {});
const reading = {id: 77, totalMinutes: 60, passages: [{seq: 1, title: 'Original IELTS passage', shortLabel: 'Passage 1', intro: 'Read carefully.', paragraphs: ['Libraries serve their communities.'], questions: [
  {kind: 'tfng', title: 'Questions 1–1', instruction: 'Choose True, False or Not Given.', questionStart: 1, questionEnd: 1, payload: {questions: [{id: 1, statement: 'Libraries serve communities.'}], options: ['True', 'False', 'Not Given']}},
  {kind: 'shortAnswer', title: 'Questions 9–9', instruction: 'Write ONE WORD ONLY.', questionStart: 9, questionEnd: 9, payload: {questions: [{id: 9, prompt: 'What serves communities?'}]}},
]}]};
const listening = {id: 77, totalMinutes: 30, parts: [{seq: 1, label: 'Part 1', sections: [
  {kind: 'notesCompletion', title: 'Questions 11–11', instruction: 'Write ONE WORD ONLY.', questionStart: 11, questionEnd: 11, payload: {heading: 'Public library', blanks: [{id: 11, before: 'Opening day:', after: ''}]}},
  {kind: 'mcq', title: 'Questions 19–19', instruction: 'Choose the correct letter, A or B.', questionStart: 19, questionEnd: 19, payload: {questions: [{id: 19, prompt: 'What is the main purpose?', options: ['A. Studying', 'B. Shopping']}]}}
]}]};
const writing = {id: 77, totalMinutes: 60, tasks: [{id: 4, seq: 3, taskKey: 'original-task-key', title: 'Writing Task 3', prompt: 'Discuss the role of public libraries.', minWords: 250, hasImage: true}]};
function silentAudio() {
  const audio = Buffer.alloc(16044); audio.write('RIFF'); audio.writeUInt32LE(16036, 4); audio.write('WAVEfmt ', 8); audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22); audio.writeUInt32LE(8000, 24); audio.writeUInt32LE(16000, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write('data', 36); audio.writeUInt32LE(16000, 40); return audio;
}
async function changeLocale(page: Page, locale: string) {
  await page.evaluate(value => {localStorage.setItem('coursistant.locale', value); window.dispatchEvent(new StorageEvent('storage', {key: 'coursistant.locale', newValue: value}));}, locale);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.exam-shell')).not.toContainText(/exams:|common:|Opaque diagnostic/);
}
async function setup(page: Page, locale: string, section: 'reading' | 'listening' | 'writing') {
  await fixture(page); await page.addInitScript(value => {if (!localStorage.getItem('coursistant.locale')) localStorage.setItem('coursistant.locale', value);}, locale);
  const state = {mediaReads: 0, attempts: 0, writes: [] as unknown[], succeed: false};
  await page.route('**/v2/student/mock-exams/77**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path.endsWith('/audio')) {state.mediaReads++; await route.fulfill({body: silentAudio(), contentType: 'audio/wav'}); return;}
    if (path.endsWith('/image')) {state.mediaReads++; await route.fulfill({body: readFileSync(new URL('../public/icons/default_avatar.jpg', import.meta.url)), contentType: 'image/jpeg'}); return;}
    if (path.endsWith('/attempts')) {state.attempts++; await route.fulfill({json: reply({attemptId: 81})}); return;}
    if (request.method() === 'POST') {
      state.writes.push(request.postDataJSON()); await route.fulfill(state.succeed ? {json: reply({submissionId: 91, totalQuestions: 2, correctCount: 1, results: []})} : {status: 503, json: {code: 'INTERNAL_SERVER_ERROR', message: 'Opaque diagnostic'}}); return;
    }
    await route.fulfill({json: reply(path.endsWith(`/${section}`) ? {reading, listening, writing}[section] : {id: 77, title: 'Original IELTS paper', status: 'ASSIGNED', readingSelected: true, listeningSelected: true, writingSelected: true})});
  });
  await page.goto(`/mock-exams/77/${section}`); return state;
}
async function cancelExit(page: Page, locale: string) {
  await page.getByRole('button', {name: t(locale, 'exams:runner.exit'), exact: true}).click();
  for (const language of locales) {await changeLocale(page, language); await expect(page.getByRole('dialog', {name: t(language, 'exams:runner.exit'), exact: true})).toContainText(t(language, 'exams:runner.exitConfirm')); await fits(page);}
  await page.getByRole('button', {name: t('zh-TW', 'common:actions.cancel'), exact: true}).click();
}
async function failAndRetry(page: Page, state: Awaited<ReturnType<typeof setup>>) {
  await page.getByRole('button', {name: t('zh-TW', 'exams:runner.finishSection'), exact: true}).click(); await page.getByRole('button', {name: t('zh-TW', 'exams:runner.submitSection'), exact: true}).click();
  for (const language of locales) {await changeLocale(page, language); await expect(page.getByRole('alert')).toContainText(t(language, 'exams:submission.failed')); await fits(page);}
  state.succeed = true; await page.getByRole('button', {name: t('zh-TW', 'exams:runner.submitSection'), exact: true}).click();
  await expect(page.getByRole('dialog', {name: t('zh-TW', 'exams:runner.sectionSubmitted'), exact: true})).toBeVisible();
  expect(state.writes).toHaveLength(2); expect(state.writes[1]).toEqual(state.writes[0]); expect(state.attempts).toBe(1);
  await page.getByRole('button', {name: t('zh-TW', 'exams:viewResults'), exact: true}).click();
}
for (const locale of locales) for (const width of [390, 1440]) {
  test(`reading keeps original TFNG content, English answers and note drafts: ${locale} ${width}`, async ({page}, info) => {
    await page.setViewportSize({width, height: 1000}); const state = await setup(page, locale, 'reading');
    await page.getByRole('radio', {name: 'True', exact: true}).check(); await page.getByRole('textbox', {name: t(locale, 'common:records.question', {number: '9'}), exact: true}).fill('libraries');
    await page.getByRole('button', {name: t(locale, 'exams:schema.notes'), exact: true}).click(); await page.getByRole('textbox', {name: t(locale, 'exams:schema.notes'), exact: true}).fill('Original note draft');
    await cancelExit(page, locale);
    for (const language of locales) {
      await changeLocale(page, language); await expect(page.getByRole('radio', {name: 'True', exact: true})).toBeChecked(); await expect(page.getByRole('textbox', {name: t(language, 'common:records.question', {number: '9'}), exact: true})).toHaveValue('libraries');
      await expect(page.getByRole('textbox', {name: t(language, 'exams:schema.notes'), exact: true})).toHaveValue('Original note draft'); await expect(page.getByText('Choose True, False or Not Given.', {exact: true})).toBeVisible(); await fits(page);
    }
    await page.getByRole('button', {name: t('zh-TW', 'exams:runner.closeNotes'), exact: true}).click(); await failAndRetry(page, state);
    expect(state.writes[0]).toEqual({answers: {'1': 'True', '9': 'libraries'}}); await page.screenshot({path: info.outputPath('reading-original-content.png'), fullPage: true});
  });
  test(`listening keeps original question text, selected answers and playback speed: ${locale} ${width}`, async ({page}, info) => {
    await page.setViewportSize({width, height: 1000}); const state = await setup(page, locale, 'listening');
    await page.getByRole('textbox', {name: t(locale, 'common:records.question', {number: '11'}), exact: true}).fill('Monday'); await page.getByRole('radio', {name: 'A. Studying', exact: true}).check();
    await page.getByRole('combobox', {name: t(locale, 'exams:audio.playbackSpeed'), exact: true}).selectOption('1.2'); const mediaReads = state.mediaReads;
    await cancelExit(page, locale);
    for (const language of locales) {
      await changeLocale(page, language); await expect(page.getByRole('textbox', {name: t(language, 'common:records.question', {number: '11'}), exact: true})).toHaveValue('Monday'); await expect(page.getByRole('radio', {name: 'A. Studying', exact: true})).toBeChecked();
      await expect(page.getByRole('combobox', {name: t(language, 'exams:audio.playbackSpeed'), exact: true})).toHaveValue('1.2'); await expect(page.getByText('Choose the correct letter, A or B.', {exact: true})).toBeVisible(); await fits(page);
    }
    expect(state.mediaReads).toBe(mediaReads); await failAndRetry(page, state); expect(state.writes[0]).toEqual({answers: {'11': 'Monday', '19': 'A'}}); await page.screenshot({path: info.outputPath('listening-original-content.png'), fullPage: true});
  });
  test(`writing keeps the prompt, original image and response through failed submission: ${locale} ${width}`, async ({page}, info) => {
    await page.setViewportSize({width, height: 1000}); const state = await setup(page, locale, 'writing');
    await page.getByRole('textbox', {name: t(locale, 'exams:runner.writingAnswer'), exact: true}).fill('Libraries are important to the community.');
    const originalImage = await page.getByRole('img', {name: t(locale, 'exams:runner.taskImage', {task: 'Writing Task 3'}), exact: true}).getAttribute('src'); await cancelExit(page, locale);
    for (const language of locales) {
      await changeLocale(page, language); await expect(page.getByRole('textbox', {name: t(language, 'exams:runner.writingAnswer'), exact: true})).toHaveValue('Libraries are important to the community.');
      await expect(page.getByRole('img', {name: t(language, 'exams:runner.taskImage', {task: 'Writing Task 3'}), exact: true})).toHaveAttribute('src', originalImage!); await expect(page.getByText('Discuss the role of public libraries.', {exact: true})).toBeVisible(); await expect(page.getByText(`${t(language, 'common:status.WRITING')} · ${t(language, 'assessment:attempt.duration', {count: 60, number: '60'})}`, {exact: true})).toBeVisible(); await fits(page);
    }
    expect(state.mediaReads).toBe(1); await failAndRetry(page, state); expect(state.writes[0]).toEqual({tasks: [{taskKey: 'original-task-key', content: 'Libraries are important to the community.'}]});
    await expect(page.getByRole('textbox')).toHaveAttribute('readonly', ''); await page.screenshot({path: info.outputPath('writing-original-content.png'), fullPage: true});
  });
}
