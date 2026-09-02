import {expect, test, type Page} from '@playwright/test';

type TestIdentity = {
  id: number;
  userId: number;
  email: string;
  name: string;
  username: string;
  role: 'USER' | 'TENANT_ADMIN';
  level: 'STUDENT' | 'ADVISOR' | 'INSTRUCTOR' | 'PARENT' | 'NOT_APPLICABLE' | null;
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
  await expect(page.getByRole('link', {name: 'Exams'})).toBeVisible();

  await page.goto('/vocabulary');
  await expect(page.getByRole('heading', {name: 'Vocabulary'})).toBeVisible();
  await expect(page.getByRole('link', {name: /Academic Foundations/})).toBeVisible();

  await page.goto('/advisor/operations');
  await expect(page).toHaveURL(/\/$/);
});

test('dashboard quick prompt hands structured context to Study Support', async ({page}) => {
  await installIdentity(page, identity('STUDENT'));
  await page.goto('/');
  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'pendingChat') {
        (window as Window & {capturedPendingChat?: string}).capturedPendingChat = value;
      }
      originalSetItem.call(this, key, value);
    };
  });

  await page.getByRole('button', {name: 'Explain a concept'}).click();
  await expect(page).toHaveURL('/aibot');

  const pendingChat = await page.evaluate(() => (window as Window & {capturedPendingChat?: string}).capturedPendingChat);
  expect(JSON.parse(pendingChat ?? '{}')).toEqual({text: 'Explain a concept', courseId: 0});
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

test('tenant admin never sees or requests the system course catalogue', async ({page}) => {
  await installIdentity(page, identity('NOT_APPLICABLE', {
    id: 904,
    userId: 904,
    email: 'tessa.admin@example.test',
    name: 'Tessa Admin',
    role: 'TENANT_ADMIN',
  }));
  let courseCatalogueRequests = 0;
  await page.route('**/v2/courses**', route => {
    courseCatalogueRequests += 1;
    return route.fulfill({status: 403, json: {code: 'ACCESS_DENIED'}});
  });
  await page.route('**/v2/tenant/student-intakes**', route => route.fulfill({
    json: response({items: [], page: 0, size: 20, total: 0}),
  }));

  await page.goto('/admin/intakes');
  await expect(page.getByRole('link', {name: 'Courses'})).toHaveCount(0);

  await page.goto('/course');
  await expect(page).toHaveURL(/\/admin\/intakes$/);
  await expect.poll(() => courseCatalogueRequests).toBe(0);
});

test('tenant admin can complete governance work using only the handoff routes', async ({page}, testInfo) => {
  await installIdentity(page, identity('NOT_APPLICABLE', {
    id: 904,
    userId: 904,
    email: 'tessa.admin@example.test',
    name: 'Tessa Admin',
    role: 'TENANT_ADMIN',
  }));
  const requestedPaths: string[] = [];
  let ownershipVersion = 2;
  let ownerAdvisorUserId = 51;
  let alertVersion = 3;
  let alertPutHeaders: Record<string, string> = {};

  page.on('request', request => requestedPaths.push(new URL(request.url()).pathname));
  await page.route('**/v2/tenant/users**', route => {
    const url = new URL(route.request().url());
    const userId = Number(url.pathname.split('/').at(-1));
    if (Number.isInteger(userId)) {
      return route.fulfill({json: response({id: userId, tenantId: 7, firstName: 'Ivy', lastName: 'Instructor', email: 'ivy@example.test', role: 'USER', level: 'INSTRUCTOR', status: 'ACTIVE'})});
    }
    const level = url.searchParams.get('level');
    const items = level === 'ADVISOR' ? [{id: 52, tenantId: 7, firstName: 'Ari', lastName: 'Advisor', email: 'ari@example.test', role: 'USER', level: 'ADVISOR', status: 'ACTIVE'}]
      : level === 'INSTRUCTOR_ADVISOR' ? [{id: 53, tenantId: 7, firstName: 'Indigo', lastName: 'Advisor', email: 'indigo@example.test', role: 'USER', level: 'INSTRUCTOR_ADVISOR', status: 'ACTIVE'}]
        : [{id: 41, tenantId: 7, firstName: 'Ivy', lastName: 'Instructor', email: 'ivy@example.test', role: 'USER', level: 'INSTRUCTOR', status: 'ACTIVE'}];
    return route.fulfill({json: response({items, page: 0, size: 20, total: items.length})});
  });
  await page.route('**/v2/tenant/course-ownerships**', route => route.fulfill({json: response({items: [{courseId: 71, courseCode: 'IELTS-71', title: 'Academic Writing', launchState: 'ACTIVE', lifecycleState: 'OPEN', ownerAdvisorUserId, ownerAdvisorFirstName: ownerAdvisorUserId === 52 ? 'Ari' : 'Current', ownerAdvisorLastName: 'Advisor', ownershipVersion}], page: 0, size: 20, total: 1})}));
  await page.route('**/v2/tenant/courses/71/owner', async route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as {ownerAdvisorUserId: number};
      ownerAdvisorUserId = body.ownerAdvisorUserId;
      ownershipVersion += 1;
    }
    return route.fulfill({json: response({courseId: 71, courseCode: 'IELTS-71', title: 'Academic Writing', launchState: 'ACTIVE', lifecycleState: 'OPEN', ownerAdvisorUserId, ownerAdvisorFirstName: ownerAdvisorUserId === 52 ? 'Ari' : 'Current', ownerAdvisorLastName: 'Advisor', ownershipVersion})});
  });
  await page.route('**/v2/tenant/alert-rules', async route => {
    if (route.request().method() === 'PUT') {
      alertVersion += 1;
      alertPutHeaders = route.request().headers();
      const body = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({json: response({tenantId: 7, ...body, version: alertVersion, updatedAt: '2026-09-02T02:00:00Z'})});
    }
    return route.fulfill({json: response({tenantId: 7, mode: 'SYSTEM_DEFAULT', version: alertVersion, updatedAt: '2026-09-02T01:00:00Z'})});
  });
  await page.route('**/v2/tenant/audit-events**', route => route.fulfill({json: response({items: [{eventId: 'AUTH:701', sourceType: 'AUTH', createdAt: '2026-09-02T01:30:00Z', actorUserId: 904, action: 'MANAGED_USER_CREATED', resourceType: 'USER', targetUserId: 41, before: null, after: {status: 'ACTIVE'}}], page: 0, size: 20, total: 1})}));
  await page.route('**/v2/tenant/student-intakes**', route => route.fulfill({json: response({items: [], page: 0, size: 20, total: 0})}));

  await page.goto('/admin');
  await expect(page.getByRole('heading', {name: 'Tenant governance'})).toBeVisible();
  await expect(page.getByText('Ivy Instructor')).toBeVisible();
  await page.getByLabel('Search by name or email').fill('ivy@example.test');
  await page.getByRole('button', {name: 'Apply filters'}).click();
  await expect.poll(() => requestedPaths.filter(path => path.endsWith('/v2/tenant/users')).length).toBeGreaterThan(1);
  await expect(page.getByRole('link', {name: 'Courses'})).toHaveCount(0);

  await page.getByRole('button', {name: 'Course ownership'}).click();
  await expect(page.getByText('IELTS-71 · Academic Writing')).toBeVisible();
  await page.getByRole('button', {name: /IELTS-71 · Academic Writing/}).click();
  await page.getByRole('button', {name: 'Choose eligible advisor'}).click();
  await page.getByText('Ari Advisor', {exact: true}).click();
  await page.getByRole('button', {name: 'Use selected person'}).click();
  await page.getByLabel('Reason').fill('Coverage handover');
  await page.getByRole('button', {name: 'Review transfer'}).click();
  await page.getByRole('button', {name: 'Confirm transfer'}).click();
  await expect(page.getByText(/Ownership transferred to Ari Advisor/)).toBeVisible();

  await page.getByRole('button', {name: 'Alert rules'}).click();
  await page.getByText('Tenant override', {exact: true}).click();
  await page.getByLabel('Inactivity (days)').fill('7');
  await page.getByRole('button', {name: 'Save alert rules'}).click();
  await expect(page.getByText('Alert rules saved from the latest server response.')).toBeVisible();
  expect(alertPutHeaders['idempotency-key']).toBeUndefined();

  await page.getByRole('button', {name: 'Audit'}).click();
  await expect(page.getByText('MANAGED_USER_CREATED')).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('tenant-governance.png'), fullPage: true});

  expect(requestedPaths.some(path => path.endsWith('/v2/courses'))).toBe(false);
  expect(requestedPaths.some(path => path.includes('/v2/admin/'))).toBe(false);
  expect(requestedPaths.some(path => path.includes('/v2/advisor/'))).toBe(false);
  expect(requestedPaths.some(path => path.includes('/v2/parent/'))).toBe(false);
  expect(requestedPaths.some(path => path.includes('/v2/counsellor/'))).toBe(false);
});

test('tenant admin reviews protected mock-exam media and publishes only after three-section preflight', async ({page}) => {
  await installIdentity(page, identity('NOT_APPLICABLE', {
    id: 904,
    userId: 904,
    email: 'tessa.admin@example.test',
    name: 'Tessa Admin',
    role: 'TENANT_ADMIN',
  }));
  const sectionRequests: string[] = [];
  let audioRequests = 0;
  let publishRequests = 0;
  const template = {
    id: 31,
    label: 'Academic A',
    title: 'IELTS Academic A',
    versions: [{id: 311, templateId: 31, versionNo: 1, status: 'DRAFT', hasListening: true, hasReading: true, hasWriting: true}],
  };

  await page.route('**/v2/tenant/mock-exam-templates**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/listening/parts/1/audio')) {
      audioRequests += 1;
      return route.fulfill({status: 200, contentType: 'audio/mpeg', body: 'mock-audio'});
    }
    if (path.endsWith('/publish') && route.request().method() === 'POST') {
      publishRequests += 1;
      return route.fulfill({json: response({...template.versions[0], status: 'PUBLISHED'})});
    }
    if (path.endsWith('/listening')) {
      sectionRequests.push('listening');
      return route.fulfill({json: response({id: 501, totalMinutes: 40, parts: [{id: 601, seq: 1, label: 'Part 1', audioSrc: '/protected/audio', questionNumbers: [1, 2], sections: []}]})});
    }
    if (path.endsWith('/reading')) {
      sectionRequests.push('reading');
      return route.fulfill({json: response({id: 502, totalMinutes: 60, passages: []})});
    }
    if (path.endsWith('/writing')) {
      sectionRequests.push('writing');
      return route.fulfill({json: response({id: 503, totalMinutes: 60, tasks: []})});
    }
    if (path.endsWith('/versions/311')) return route.fulfill({json: response(template.versions[0])});
    if (path.endsWith('/mock-exam-templates/31')) return route.fulfill({json: response(template)});
    return route.fulfill({json: response([template])});
  });

  await page.goto('/mock-exams');
  await expect(page.getByRole('heading', {name: 'Build and release IELTS papers'})).toBeVisible();
  await expect(page.getByRole('tab', {name: /Listening · Read only/})).toBeVisible();
  await expect(page.getByRole('button', {name: /Copy/})).toHaveCount(0);
  await page.getByRole('button', {name: 'Load audio'}).click();
  await expect(page.locator('audio')).toBeVisible();
  await expect.poll(() => audioRequests).toBe(1);

  await page.getByRole('button', {name: 'Publish complete draft'}).click();
  await expect.poll(() => publishRequests).toBe(1);
  expect(sectionRequests).toEqual(expect.arrayContaining(['listening', 'reading', 'writing']));
});
