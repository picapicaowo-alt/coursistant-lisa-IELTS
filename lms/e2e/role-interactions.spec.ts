import {expect, test, type Page} from '@playwright/test';

type TestIdentity = {
  id: number;
  userId: number;
  email: string;
  name: string;
  username: string;
  role: 'USER' | 'TENANT_ADMIN';
  level: 'STUDENT' | 'ADVISOR' | 'INSTRUCTOR' | 'PARENT' | null;
  avatar: null;
  accessToken: string;
};

const response = (data: unknown) => ({
  status: 200,
  code: 'SUCCESS',
  message: 'Success',
  timestamp: '2026-08-29T12:00:00Z',
  data,
});

const identity = (
  level: TestIdentity['level'],
  overrides: Partial<TestIdentity> = {},
): TestIdentity => ({
  id: 901,
  userId: 901,
  email: `${level?.toLowerCase() ?? 'admin'}@example.test`,
  name: `${level ?? 'Tenant'} Test User`,
  username: `${level?.toLowerCase() ?? 'admin'}.test`,
  role: 'USER',
  level,
  avatar: null,
  accessToken: 'role-interaction-token',
  ...overrides,
});

const installIdentity = async (page: Page, user: TestIdentity): Promise<void> => {
  await page.addInitScript(currentUser => {
    window.localStorage.setItem('user', JSON.stringify(currentUser));
    window.localStorage.setItem('accToken', currentUser.accessToken);
  }, user);
  await page.route('**/v2/me/notifications/unread-count', route => route.fulfill({
    json: response({unreadCount: 0}),
  }));
};

test('student can enter both learning products but not advisor operations', async ({page}) => {
  await installIdentity(page, identity('STUDENT'));
  await page.route('**/v2/student/mock-exams**', route => route.fulfill({
    json: response([{studentMockExamId: 71, title: 'IELTS Academic Practice', label: 'Practice A', status: 'Assigned', listeningSelected: true}]),
  }));
  await page.route('**/vocabulary-api/v1/vocabulary/lists', route => route.fulfill({
    json: {
      items: [{
        id: '10000000-0000-4000-8000-000000000001',
        name: 'Academic Foundations',
        description: 'Core academic vocabulary.',
        totalWords: 20,
        theme: 'Academic English',
        skillFocus: 'Reading & Writing',
        difficulty: 'B1–B2',
        progress: {clearedWords: 4, totalWords: 20, completionCount: 1},
      }],
      filters: {themes: [], skillFocuses: [], difficulties: []},
      continue: null,
    },
  }));

  await page.goto('/mock-exams');
  await expect(page.getByRole('heading', {name: 'Choose a paper. Enter exam mode.'})).toBeVisible();
  await expect(page.getByRole('link', {name: /Listening/})).toHaveAttribute('href', '/mock-exams/71/listening');
  await expect(page.getByRole('link', {name: 'Mock exams'})).toBeVisible();

  await page.goto('/vocabulary');
  await expect(page.getByRole('heading', {name: 'Vocabulary'})).toBeVisible();
  await expect(page.getByRole('link', {name: /Academic Foundations/})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Vocabulary', exact: true})).toBeVisible();

  await page.goto('/advisor/operations');
  await expect(page).toHaveURL(/\/$/);
});

test('advisor can assign a published mock exam and cannot enter Vocabulary', async ({page}) => {
  await installIdentity(page, identity('ADVISOR', {id: 902, userId: 902}));
  let assignmentRequests = 0;

  await page.route('**/v2/advisor/mock-exam-templates**', route => route.fulfill({
    json: response([{
      id: 45,
      label: 'IELTS Academic',
      title: 'Advisor Practice Paper',
      publishedVersionId: 451,
      publishedVersionNo: 3,
      versions: [{id: 451, versionNo: 3, status: 'PUBLISHED'}],
    }]),
  }));
  await page.route('**/v2/advisor/students**', route => route.fulfill({
    json: response([{studentUserId: 301, name: 'Assigned Student', email: 'student@example.test'}]),
  }));
  await page.route('**/v2/advisor/students/301/mock-exams**', route => {
    if (route.request().method() === 'POST') assignmentRequests += 1;
    return route.fulfill({json: response([])});
  });

  await page.goto('/mock-exams');
  await expect(page.getByRole('heading', {name: 'Match students to published papers'})).toBeVisible();
  await page.getByLabel('Student').selectOption('301');
  await page.getByLabel('Published template').selectOption('45');
  await page.getByRole('button', {name: 'Assign exam'}).click();
  await expect.poll(() => assignmentRequests).toBe(1);
  await expect(page.getByRole('link', {name: 'Vocabulary'})).toHaveCount(0);

  await page.goto('/vocabulary');
  await expect(page).toHaveURL(/\/advisor\/students$/);
});

test('non-student roles remain outside Vocabulary and parent stays outside standalone mock exams', async ({page}) => {
  await installIdentity(page, identity('PARENT', {id: 903, userId: 903}));

  await page.goto('/vocabulary');
  await expect(page).toHaveURL(/\/parent$/);

  await page.goto('/mock-exams');
  await expect(page).toHaveURL(/\/parent$/);
});
