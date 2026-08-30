import {expect, test, type Page} from '@playwright/test';

const STUDENT = {
  userId: 901,
  id: 901,
  email: 'vocabulary.student@example.test',
  name: 'Vocabulary Student',
  username: 'vocabulary.student',
  role: 'USER',
  level: 'STUDENT',
  avatar: null,
  accessToken: 'e2e-token',
};

const LIST_ID = '10000000-0000-4000-8000-000000000001';
const UNIT_ID = '11000000-0000-4000-8000-000000000001';
const SESSION_ID = '12000000-0000-4000-8000-000000000001';
const WORD_ID = '13000000-0000-4000-8000-000000000001';

const installSession = async (page: Page): Promise<void> => {
  await page.addInitScript(user => {
    window.localStorage.setItem('user', JSON.stringify(user));
    window.localStorage.setItem('accToken', user.accessToken);
  }, STUDENT);
};

const library = {
  items: [{
    id: LIST_ID,
    name: 'Academic Foundations',
    description: 'Core words for explaining evidence and change.',
    totalWords: 20,
    theme: 'Academic English',
    skillFocus: 'Reading & Writing',
    difficulty: 'B1–B2',
    progress: {clearedWords: 4, totalWords: 20, completionCount: 1},
  }],
  filters: {themes: ['Academic English'], skillFocuses: ['Reading & Writing'], difficulties: ['B1–B2']},
  continue: null,
};

const unit = {
  id: UNIT_ID,
  number: 1,
  name: 'Evidence and Change',
  wordCount: 20,
  progress: {clearedWords: 4, totalWords: 20, completionCount: 1, readyForReview: 2},
  activeSessionId: SESSION_ID,
  listId: LIST_ID,
  listName: 'Academic Foundations',
};

const hiddenCard = {
  id: SESSION_ID,
  unitId: UNIT_ID,
  mode: 'TEST',
  status: 'ACTIVE',
  position: 0,
  totalScheduled: 20,
  revealed: false,
  canGoPrevious: false,
  currentCard: {wordId: WORD_ID, word: 'analyse', partOfSpeech: 'verb', answer: null},
  summary: null,
};

const revealedCard = {
  ...hiddenCard,
  totalScheduled: 21,
  revealed: true,
  currentCard: {
    ...hiddenCard.currentCard,
    answer: {
      ukPhonetic: '/ˈænəlaɪz/',
      usPhonetic: '/ˈænəlaɪz/',
      audioUrl: null,
      primaryMeaningZh: '分析',
      secondaryMeaningsZh: [],
      exampleEn: 'Researchers analyse the results before drawing a conclusion.',
      exampleZh: '研究人员在得出结论前会分析结果。',
    },
  },
};

test('library remains usable without horizontal overflow on mobile', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await installSession(page);
  await page.route('**/vocabulary-api/v1/vocabulary/lists', route => route.fulfill({json: library}));
  await page.goto('/vocabulary');

  await expect(page.getByRole('heading', {name: 'Vocabulary'})).toBeVisible();
  await expect(page.getByRole('link', {name: /Academic Foundations/})).toBeVisible();
  await expect(page.getByRole('navigation')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test('test mode requires a rating, reveals once, and hides the LMS shell', async ({page}) => {
  await installSession(page);
  await page.route(`**/vocabulary-api/v1/vocabulary/units/${UNIT_ID}`, route => route.fulfill({json: unit}));
  await page.route(`**/vocabulary-api/v1/vocabulary/sessions/${SESSION_ID}`, route => {
    if (route.request().method() === 'GET') return route.fulfill({json: hiddenCard});
    if (route.request().url().endsWith('/ratings')) return route.fulfill({json: revealedCard});
    return route.fallback();
  });
  await page.route(`**/vocabulary-api/v1/vocabulary/sessions/${SESSION_ID}/ratings`, route => route.fulfill({json: revealedCard}));
  await page.goto(`/vocabulary/units/${UNIT_ID}/sessions/${SESSION_ID}`);

  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'analyse'})).toBeVisible();
  await expect(page.getByText('分析', {exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: /Don't remember/}).click();
  await expect(page.getByText('分析', {exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Next card'})).toBeVisible();
  await expect(page.getByRole('button', {name: /Know well/})).toHaveCount(0);
});
