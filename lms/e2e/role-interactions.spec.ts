import {openSection} from './disclosure-helpers';
import {expect, test, type Page} from '@playwright/test';

type TestIdentity = {
  id: number;
  userId: number;
  email: string;
  name: string;
  username: string;
  role: 'USER' | 'TENANT_ADMIN';
  level: 'STUDENT' | 'COUNSELLOR' | 'ADVISOR' | 'INSTRUCTOR' | 'PARENT' | 'NOT_APPLICABLE' | null;
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
  // Unrelated reads must stay in this isolated browser fixture, never the live proxy.
  await page.route('**/v2/**', route => route.fulfill({json: response([])}));
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
  await expect(page.getByRole('heading', {name: 'Exams'})).toBeVisible();
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
  // Keep this interaction isolated from unrelated dashboard/AI backend state.
  // More specific routes below are registered later and therefore take precedence.
  await page.route('**/v2/**', route => route.fulfill({json: response([])}));
  await page.route('**/v1/auth/refresh-token', route => route.fulfill({json: response('role-interaction-token-refreshed')}));
  await page.route('**/v2/me/courses**', route => route.fulfill({json: response({items: [], page: 0, size: 100, total: 0})}));
  await page.route('**/v2/me/assignments/upcoming**', route => route.fulfill({json: response([])}));
  await page.route('**/v2/me/activities/upcoming**', route => route.fulfill({json: response([])}));
  await page.route('**/v2/me/work-queue', route => route.fulfill({json: response([])}));
  await page.route('**/v2/student/mock-exams**', route => route.fulfill({json: response([])}));
  await page.route('**/v2/me/alerts', route => route.fulfill({json: response([])}));
  let pendingChat: string | undefined;
  await page.exposeFunction('capturePendingChat', (value: string) => {
    pendingChat = value;
  });
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'pendingChat') {
        void (window as Window & {capturePendingChat: (capturedValue: string) => Promise<void>}).capturePendingChat(value);
      }
      originalSetItem.call(this, key, value);
    };
  });
  await page.goto('/');

  await page.getByRole('button', {name: 'Explain a concept'}).click();
  await expect(page).toHaveURL('/aibot');

  await expect.poll(() => pendingChat).toBeDefined();
  expect(JSON.parse(pendingChat ?? '{}')).toEqual({text: 'Explain a concept', courseId: 0});
});

test('instructor dashboard uses teaching data and availability edits preserve every record', async ({page}, testInfo) => {
  await installIdentity(page, identity('INSTRUCTOR', {
    id: 906,
    userId: 906,
    name: 'Sarah Instructor',
  }));
  const studentOnlyRequests: string[] = [];
  let savedAvailability: Record<string, unknown> | undefined;
  const course = {
    id: 71,
    courseId: 71,
    courseCode: 'IELTS-71',
    title: 'Academic Writing',
    name: 'Academic Writing',
    description: null,
    tenantId: 7,
    state: 'Active',
    status: 'Active',
    courseRole: 'Instructor',
    role: 'Instructor',
    canGrade: true,
    canPostAnnouncements: true,
    canManageGroups: true,
    canManageCourseEvents: true,
    primaryInstructor: null,
    createdAt: '2026-09-01T09:00:00',
    updatedAt: '2026-09-01T09:00:00',
    archivedAt: null,
  };
  const windows = [
    {dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00', effectiveFrom: '2026-09-14', effectiveTo: '2026-10-12', timezone: 'America/Los_Angeles'},
    {dayOfWeek: 'WEDNESDAY', startTime: '10:00', endTime: '15:00', effectiveFrom: '2026-09-14', effectiveTo: '2026-10-12', timezone: 'America/Los_Angeles'},
  ];
  const exceptions = [{exceptionDate: '2026-09-21', startTime: '12:00', endTime: '17:00', timezone: 'America/Los_Angeles'}];

  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/v2/me/work-queue' || pathname === '/v2/me/alerts' || pathname.startsWith('/v2/student/mock-exams')) {
      studentOnlyRequests.push(pathname);
    }
  });
  await page.route('**/v2/me/courses**', route => route.fulfill({json: response({items: [course], page: 0, size: 100, total: 1})}));
  await page.route('**/v2/me/teaching/deadlines/upcoming**', route => route.fulfill({json: response([{kind: 'Assignment', courseId: 71, courseCode: 'IELTS-71', title: 'Week 1 Essay', atLocal: '2026-09-14T17:00:00', timezone: 'America/Los_Angeles', submittedCount: 4, totalStudents: 8, assignmentId: 81, quizId: null}])}));
  await page.route('**/v2/me/teaching/activities/upcoming**', route => route.fulfill({json: response([])}));
  await page.route('**/v2/me/teaching/grading-queue**', route => route.fulfill({json: response([{kind: 'AssignmentUngraded', courseId: 71, courseCode: 'IELTS-71', title: 'Week 1 Essay', pendingCount: 4, oldestWaitingAt: '2026-09-02T08:00:00Z', waitingMinutes: 30, timezone: 'America/Los_Angeles', assignmentId: 81, quizId: null}])}));
  await page.route('**/v2/me/teaching/activity/recent**', route => route.fulfill({json: response([{kind: 'LateSubmission', courseId: 71, courseCode: 'IELTS-71', summary: 'Late submission: Week 1 Essay', occurredAt: '2026-09-02T08:00:00Z', timezone: 'America/Los_Angeles', assignmentId: 81, groupSetId: null, groupId: null, targetUserId: 301}])}));
  await page.route('**/v2/me/teaching/alerts', route => route.fulfill({json: response([])}));

  await page.goto('/');
  await expect(page.getByRole('region', {name: 'Teaching dashboard'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Welcome back, Sarah Instructor!'})).toBeVisible();
  await expect(page.getByText('Week 1 Essay').first()).toBeVisible();
  await expect(page.getByText(/your teaching today/)).toBeVisible();
  await expect.poll(() => studentOnlyRequests).toEqual([]);

  await page.route('**/v2/me/teaching/grading-items', route => route.fulfill({json: response([])}));
  await page.route('**/v2/me/teaching/schedule-requests', route => route.fulfill({json: response([])}));
  await page.route('**/v2/me/teaching/students-needing-support', route => route.fulfill({json: response([])}));
  await page.route('**/v2/me/teaching/today-classes', route => route.fulfill({json: response([])}));
  await page.route('**/v2/me/teaching/availability', async route => {
    if (route.request().method() === 'PUT') {
      savedAvailability = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({json: response({version: 5, windows, exceptions})});
    }
    return route.fulfill({json: response({version: 4, windows, exceptions})});
  });

  await page.goto('/my-operations');
  await page.getByRole('button', {name: 'availability'}).click();
  await expect(page.getByRole('heading', {name: 'Weekly availability'})).toBeVisible();
  await openSection(page, 'Weekly availability');
  await expect(page.getByText('Monday', {exact: true})).toBeVisible();
  await expect(page.getByText('Wednesday', {exact: true})).toBeVisible();
  await expect(page.getByText('1 date exception will be preserved')).toBeVisible();
  await expect(page.getByText('Record', {exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Save all availability'}).click();
  await expect.poll(() => savedAvailability).toBeDefined();
  expect(savedAvailability).toMatchObject({expectedVersion: 4, windows, exceptions});
  await expect(page.getByText('Availability saved.')).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('instructor-availability.png'), fullPage: true});

  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/my-operations');
  await page.getByRole('button', {name: 'availability'}).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path: testInfo.outputPath('instructor-availability-mobile.png'), fullPage: true});
});

test('advisor can assign a published mock exam and cannot enter Vocabulary', async ({page}, testInfo) => {
  await installIdentity(page, identity('ADVISOR', {id: 902, userId: 902}));
  let assignmentRequests = 0;
  await page.route('**/v2/advisor/instructors**', route => route.fulfill({json: response({items: [{instructorUserId: 501, firstName: 'Writing', lastName: 'Instructor', email: 'writing@example.test', level: 'INSTRUCTOR'}], page: 0, size: 20, total: 1})}));

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
    json: response({items: [{studentUserId: 301, firstName: 'Assigned', lastName: 'Student', email: 'student@example.test'}], page: 0, size: 20, total: 1}),
  }));
  await page.route('**/v2/advisor/students/301/mock-exams**', route => {
    if (route.request().method() === 'POST') assignmentRequests += 1;
    return route.fulfill({json: response([])});
  });

  await page.goto('/mock-exams');
  await expect(page.getByRole('heading', {name: 'Match students to published papers'})).toBeVisible();
  await openSection(page, 'Prepare a mock exam');
  const sectionCheckbox = page.getByRole('checkbox', {name: 'Listening'});
  const sectionCheckboxBox = await sectionCheckbox.boundingBox();
  expect(sectionCheckboxBox?.width).toBeLessThanOrEqual(22);
  expect(sectionCheckboxBox?.height).toBeLessThanOrEqual(22);
  await page.getByRole('group', {name: 'Assigned sections'}).scrollIntoViewIfNeeded();
  await page.screenshot({path: testInfo.outputPath('advisor-mock-exam-sections.png'), fullPage: true});
  await page.getByRole('combobox', {name: /^Student/}).selectOption('301');
  await page.getByLabel('Published template').selectOption('45');
  await page.getByRole('combobox', {name: 'Writing instructor'}).selectOption('501');
  await page.getByRole('button', {name: 'Assign exam'}).click();
  await expect.poll(() => assignmentRequests).toBe(1);
  await expect(page.getByRole('link', {name: 'Vocabulary'})).toHaveCount(0);

  await page.goto('/vocabulary');
  await expect(page).toHaveURL(/\/advisor\/students$/);
});

test('advisor profile and study-plan editors explain record semantics and progressively disclose detail', async ({page}, testInfo) => {
  await installIdentity(page, identity('ADVISOR', {id: 902, userId: 902}));
  const intake = {studentUserId: 301, firstName: 'Alex', lastName: 'Chen', email: 'alex@example.test', studentType: 'STANDARD', courseRequest: 'IELTS Academic', assignmentStatus: 'ASSIGNED', assignmentVersion: 2};
  const profile = {studentUserId: 301, profileVersion: 2, firstName: 'Alex', lastName: 'Chen', targetGoal: 'Reach IELTS Writing 6.5', targetMetric: 'IELTS Writing', targetValue: '6.5', targetDate: '2026-10-12', skills: [{skillCode: 'WR', displayName: 'Writing', scale: 'IELTS', currentValue: '5.5', targetValue: '6.5', gapSummary: 'Improve task response and cohesion.', position: 1}]};
  const plan = {studentUserId: 301, profileContext: {currentProfileVersion: 2}, plan: {studyPlanId: 81, studyPlanVersion: 1, basedOnProfileVersion: 2, strategySummary: 'Weekly timed essays and targeted review.', startDate: '2026-09-14', planEndDate: '2026-10-12', checkpoints: [{id: 91, position: 1, description: 'Complete the first diagnostic', goal: 'Identify recurring patterns', dueDate: '2026-09-21', tasks: [{id: 101, position: 1, title: 'Complete the week 1 diagnostic', description: 'Submit one timed response.', dueDate: '2026-09-21', status: 'NOT_STARTED', version: 0}]}, {id: 92, position: 2, description: 'Review progress', goal: 'Confirm the next focus', dueDate: '2026-10-05', tasks: []}]}};

  await page.route('**/v2/advisor/students/301/hub', route => route.fulfill({json: response({...intake, activeTasks: [], activeCourseCount: 0, publishedReportCount: 0, pendingRequestCount: 0})}));
  await page.route('**/v2/advisor/students/301/intake', route => route.fulfill({json: response(intake)}));
  await page.route('**/v2/advisor/students/301/profile', route => route.fulfill({json: response(profile)}));
  await page.route('**/v2/advisor/students/301/study-plan/revisions**', route => route.fulfill({json: response({items: [{entityVersion: 1, action: 'STUDY_PLAN_UPDATED', createdAt: '2026-09-02T07:16:57Z', actorId: 902}], page: 0, size: 20, total: 1})}));
  await page.route('**/v2/advisor/students/301/study-plan', route => route.fulfill({json: response(plan)}));

  await page.goto('/advisor/students/301/profile');
  await expect(page.getByRole('heading', {name: 'Student profile'})).toBeVisible();
  await expect(page.locator('details[open]')).toHaveCount(0);
  await openSection(page, 'Measured skills');
  await openSection(page, 'Writing');
  await expect(page.getByText(/stable record identifier/)).toBeVisible();
  await expect(page.getByText(/human-readable skill name/)).toBeVisible();
  await expect(page.getByText('Parent or guardian access')).toHaveCount(0);
  await page.screenshot({path: testInfo.outputPath('advisor-profile-polished.png'), fullPage: true});

  await page.goto('/advisor/students/301/study-plan');
  await expect(page.locator('details[open]')).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Learning journey'})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('advisor-learning-journey.png'), fullPage: true});
  await page.getByRole('button', {name: 'View phase 1', exact: true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const dialogBox = await page.getByRole('dialog').boundingBox();
  expect(dialogBox!.x).toBeGreaterThan(0);
  expect(dialogBox!.y).toBeGreaterThan(0);
  await expect(page.getByRole('dialog').getByText('Complete the week 1 diagnostic')).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('advisor-phase-dialog.png'), fullPage: true});
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', {name: 'View phase 1', exact: true})).toBeFocused();
  await page.getByRole('button', {name: 'Edit study plan', exact: true}).click();
  await openSection(page, 'Checkpoints and tasks');
  await openSection(page, 'Complete the first diagnostic');
  await expect(page.locator('summary[aria-label="Review progress"]').locator('..')).not.toHaveAttribute('open');
  await openSection(page, 'Version history');
  await openSection(page, 'Version 1');
  await expect(page.getByText(/saved content for this version was not included/)).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('advisor-study-plan-polished.png'), fullPage: true});

  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/advisor/students/301/profile');
  await expect(page.getByRole('heading', {name: 'Student profile'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path: testInfo.outputPath('advisor-profile-mobile.png'), fullPage: true});
});

test('student advising view presents profile, plan, and tasks with scannable hierarchy', async ({page}, testInfo) => {
  await installIdentity(page, identity('STUDENT', {id: 301, userId: 301}));
  const profile = {studentUserId: 301, profileVersion: 2, firstName: 'Alex', lastName: 'Chen', targetGoal: 'Reach IELTS Writing 6.5', targetMetric: 'IELTS Writing', targetValue: '6.5', targetDate: '2026-10-12', skills: [{skillCode: 'WR', displayName: 'Writing', scale: 'IELTS', currentValue: '5.5', targetValue: '6.5', gapSummary: 'Improve task response and cohesion.', position: 1}]};
  const plan = {studentUserId: 301, profileContext: {currentProfileVersion: 2}, plan: {studyPlanId: 81, studyPlanVersion: 1, basedOnProfileVersion: 2, strategySummary: 'Weekly timed essays and targeted review.', startDate: '2026-09-14', planEndDate: '2026-10-12', checkpoints: [{id: 91, position: 1, description: 'Complete the first diagnostic', goal: 'Identify recurring patterns', dueDate: '2026-09-21', tasks: [{id: 101, position: 1, title: 'Complete the week 1 diagnostic', description: 'Submit one timed response.', dueDate: '2026-09-21', status: 'NOT_STARTED', version: 0}]}]}};
  await page.route('**/v2/student/profile', route => route.fulfill({json: response(profile)}));
  await page.route('**/v2/student/study-plan', route => route.fulfill({json: response(plan)}));
  await page.route('**/v2/student/advisor-conversation/messages**', route => route.fulfill({json: response([])}));

  await page.goto('/my-plan');
  await expect(page.getByRole('heading', {name: 'My Learning Goal'})).toBeVisible();
  await page.getByRole('region', {name: 'Learning Journey', exact: true}).getByRole('button', {name: /Complete the first diagnostic/}).click();
  await page.getByRole('button', {name: 'View Complete the week 1 diagnostic', exact: true}).click();
  await expect(page.getByRole('complementary').getByText('Not started', {exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Complete task', exact: true})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('student-advising-polished.png'), fullPage: true});
});

test('non-student roles remain outside Vocabulary and parent stays outside standalone mock exams', async ({page}) => {
  await installIdentity(page, identity('PARENT', {id: 903, userId: 903}));

  await page.goto('/vocabulary');
  await expect(page).toHaveURL(/\/parent$/);

  await page.goto('/mock-exams');
  await expect(page).toHaveURL(/\/parent$/);
});

test('counsellor dashboard cards disclose their real access boundary and the create form marks contract requirements', async ({page}, testInfo) => {
  await installIdentity(page, identity('COUNSELLOR', {id: 905, userId: 905, email: 'casey.counsellor@example.test'}));
  await page.route('**/v2/counsellor/dashboard', route => route.fulfill({
    json: response({createdCount: 4, assignedCount: 2, unassignedCount: 1}),
  }));

  await page.goto('/counsellor');
  await page.getByRole('button', {name: /2 Assigned/}).click();
  await expect(page.getByText('Assigned means the handover is complete')).toBeVisible();
  await expect(page.getByRole('link', {name: /1 Unassigned/})).toHaveAttribute('href', '/counsellor/intakes');
  await page.screenshot({path: testInfo.outputPath('counsellor-dashboard.png'), fullPage: true});

  await page.getByRole('link', {name: 'Create student'}).click();
  await expect(page.getByRole('heading', {name: 'Create student intake'})).toBeVisible();
  await expect(page.getByLabel('First name *')).toHaveAttribute('required', '');
  await expect(page.getByLabel('Middle name Optional')).not.toHaveAttribute('required');
  await expect(page.getByRole('button', {name: 'Create intake'})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('counsellor-create-student.png'), fullPage: true});
});

test('counsellor completes intake, parent link, edit, and first advisor handover as one workflow', async ({page}, testInfo) => {
  await installIdentity(page, identity('COUNSELLOR', {
    id: 905,
    userId: 905,
    email: 'casey.counsellor@example.test',
  }));
  let created = false;
  let assigned = false;
  let intakeVersion = 0;
  let parentLinks: Array<Record<string, unknown>> = [];
  let createBody: Record<string, unknown> | undefined;
  let patchBody: Record<string, unknown> | undefined;
  let parentBody: Record<string, unknown> | undefined;
  let assignmentBody: Record<string, unknown> | undefined;
  const idempotencyHeaders: string[] = [];
  const intake = () => ({
    intakeId: 99,
    studentUserId: 399,
    firstName: 'Alex',
    middleName: null,
    lastName: 'Chen',
    email: 'alex.chen@example.test',
    studentType: 'STANDARD',
    courseRequest: 'IELTS writing support',
    contactPhone: '+1 555 0199',
    basicBackground: 'Preparing for university admission.',
    lifecycleStatus: 'OPEN',
    assignmentStatus: assigned ? 'ASSIGNED' : 'UNASSIGNED',
    intakeVersion,
    activationMethod: 'PASSWORD_RESET',
    advisorUserId: assigned ? 52 : null,
    assignmentVersion: assigned ? 0 : null,
  });

  await page.route('**/v2/counsellor/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const idempotencyKey = request.headers()['idempotency-key'];
    if (idempotencyKey) idempotencyHeaders.push(idempotencyKey);

    if (path.endsWith('/v2/counsellor/student-intakes') && method === 'POST') {
      createBody = request.postDataJSON() as Record<string, unknown>;
      created = true;
      return route.fulfill({status: 201, json: response(intake())});
    }
    if (path.endsWith('/v2/counsellor/student-intakes') && method === 'GET') {
      const items = created && !assigned ? [intake()] : [];
      return route.fulfill({json: response({items, page: 0, size: 20, total: items.length})});
    }
    if (path.endsWith('/v2/counsellor/student-intakes/99/parent-links') && method === 'GET') {
      return route.fulfill({json: response(parentLinks)});
    }
    if (path.endsWith('/v2/counsellor/student-intakes/99/parent-links') && method === 'POST') {
      parentBody = request.postDataJSON() as Record<string, unknown>;
      parentLinks = [{
        linkId: 501,
        parentUserId: 601,
        studentUserId: 399,
        parentFirstName: 'Taylor',
        parentMiddleName: null,
        parentLastName: 'Chen',
        parentEmail: 'taylor.chen@example.test',
        linkedAt: '2026-09-02T03:00:00Z',
      }];
      return route.fulfill({status: 201, json: response(parentLinks[0])});
    }
    if (path.endsWith('/v2/counsellor/student-intakes/99/advisor') && method === 'PUT') {
      assignmentBody = request.postDataJSON() as Record<string, unknown>;
      assigned = true;
      return route.fulfill({json: response(intake())});
    }
    if (path.endsWith('/v2/counsellor/student-intakes/99') && method === 'PATCH') {
      patchBody = request.postDataJSON() as Record<string, unknown>;
      intakeVersion += 1;
      return route.fulfill({json: response(intake())});
    }
    if (path.endsWith('/v2/counsellor/student-intakes/99') && method === 'GET') {
      return route.fulfill({json: response(intake())});
    }
    if (path.endsWith('/v2/counsellor/advisors') && method === 'GET') {
      return route.fulfill({json: response({
        items: [{advisorUserId: 52, firstName: 'Ari', middleName: null, lastName: 'Advisor', email: 'ari@example.test', level: 'ADVISOR'}],
        page: 0,
        size: 100,
        total: 1,
      })});
    }
    return route.fulfill({status: 404, json: {code: 'NOT_FOUND'}});
  });

  await page.goto('/counsellor/intakes/new');
  await openSection(page, 'Student identity');
  await openSection(page, 'Learning context');
  await page.getByLabel('First name *').fill('Alex');
  await page.getByLabel('Last name *').fill('Chen');
  await page.getByLabel('Email *').fill('alex.chen@example.test');
  await page.getByLabel('Course request *').fill('IELTS writing support');
  await page.getByLabel('Contact phone Optional').fill('+1 555 0199');
  await page.getByLabel('Basic background Optional').fill('Preparing for university admission.');
  await page.getByRole('button', {name: 'Create intake'}).click();

  await expect(page).toHaveURL(/\/counsellor\/intakes\/99$/);
  await expect(page.getByRole('heading', {name: 'Parent or guardian access'})).toBeVisible();
  await openSection(page, 'Parent or guardian access');
  await expect(page.getByText('No parent or guardian linked')).toBeVisible();
  await page.getByLabel('Parent email').fill('taylor.chen@example.test');
  await page.getByLabel('First name', {exact: true}).fill('Taylor');
  await page.getByLabel('Last name', {exact: true}).fill('Chen');
  await page.getByLabel('Relationship note').fill('Guardian confirmed during intake');
  await page.getByRole('button', {name: 'Create or reuse Parent'}).click();
  await expect(page.getByText('Taylor Chen')).toBeVisible();

  await expect(page.getByRole('link', {name: 'Continue to advisor assignment'})).toBeVisible();
  await openSection(page, 'Learning context');
  await page.getByLabel('Course request *').fill('IELTS writing and speaking support');
  await page.getByRole('button', {name: 'Save changes'}).click();
  await expect(page).toHaveURL(/\/counsellor\/intakes\/99\/assign$/);
  await expect(page.getByText('Ari Advisor', {exact: true})).toBeVisible();
  await page.getByRole('radio').check();
  await page.getByRole('button', {name: 'Assign advisor'}).click();
  await expect(page).toHaveURL(/\/counsellor\/intakes$/);
  await expect(page.getByText('No unassigned intakes.')).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('counsellor-handover-complete.png'), fullPage: true});

  expect(createBody).toMatchObject({firstName: 'Alex', lastName: 'Chen', email: 'alex.chen@example.test', studentType: 'STANDARD'});
  expect(createBody).not.toHaveProperty('role');
  expect(createBody).not.toHaveProperty('level');
  expect(createBody).not.toHaveProperty('password');
  expect(createBody).not.toHaveProperty('name');
  expect(parentBody).toMatchObject({email: 'taylor.chen@example.test', firstName: 'Taylor', lastName: 'Chen'});
  expect(patchBody).toEqual({expectedIntakeVersion: 0, courseRequest: 'IELTS writing and speaking support'});
  expect(patchBody).not.toHaveProperty('email');
  expect(assignmentBody).toEqual({advisorUserId: 52, expectedIntakeVersion: 1});
  expect(idempotencyHeaders).toHaveLength(4);
  expect(new Set(idempotencyHeaders).size).toBe(4);
});

test('tenant intake rows, filters, management panel, and advisor dialog stay aligned and actionable', async ({page}, testInfo) => {
  await installIdentity(page, identity('NOT_APPLICABLE', {
    id: 904,
    userId: 904,
    email: 'tessa.admin@example.test',
    role: 'TENANT_ADMIN',
  }));
  const intake = {intakeId: 42, studentUserId: 142, firstName: 'Alex', middleName: null, lastName: 'Chen', email: 'alex@example.test', studentType: 'STANDARD', courseRequest: 'IELTS Academic', contactPhone: '555-0100', basicBackground: 'Preparing for university.', lifecycleStatus: 'OPEN', assignmentStatus: 'UNASSIGNED', intakeVersion: 3};
  await page.route('**/v2/tenant/student-intakes**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({json: response(path.endsWith('/42') ? intake : {items: [intake], page: 0, size: 20, total: 1})});
  });
  await page.route('**/v2/tenant/users**', route => route.fulfill({json: response({items: [{id: 52, tenantId: 7, firstName: 'Ari', lastName: 'Advisor', email: 'ari@example.test', role: 'USER', level: 'ADVISOR', status: 'ACTIVE'}], page: 0, size: 20, total: 1})}));

  await page.goto('/admin/intakes');
  await expect(page.getByLabel('Lifecycle')).toBeVisible();
  await expect(page.getByLabel('Assignment')).toBeVisible();
  const viewRecord = page.getByRole('link', {name: 'View record'});
  const manage = page.getByRole('button', {name: 'Manage'});
  const [viewBox, manageBox] = await Promise.all([viewRecord.boundingBox(), manage.boundingBox()]);
  expect(viewBox).not.toBeNull();
  expect(manageBox).not.toBeNull();
  expect(Math.abs((viewBox!.y + viewBox!.height / 2) - (manageBox!.y + manageBox!.height / 2))).toBeLessThan(2);

  await manage.click();
  await expect(page.getByRole('heading', {name: 'Alex Chen'})).toBeVisible();
  await page.getByRole('button', {name: 'Choose advisor'}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(dialogBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(Math.abs((dialogBox!.x + dialogBox!.width / 2) - viewport!.width / 2)).toBeLessThan(3);
  expect(Math.abs((dialogBox!.y + dialogBox!.height / 2) - viewport!.height / 2)).toBeLessThan(3);
  await page.screenshot({path: testInfo.outputPath('tenant-intake-advisor-dialog.png'), fullPage: true});
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
    const levels = url.searchParams.getAll('levels');
    const items = levels.length > 0 ? [
      ...(levels.includes('ADVISOR') ? [{id: 52, tenantId: 7, firstName: 'Ari', lastName: 'Advisor', email: 'ari@example.test', role: 'USER', level: 'ADVISOR', status: 'ACTIVE'}] : []),
      ...(levels.includes('INSTRUCTOR_ADVISOR') ? [{id: 53, tenantId: 7, firstName: 'Indigo', lastName: 'Advisor', email: 'indigo@example.test', role: 'USER', level: 'INSTRUCTOR_ADVISOR', status: 'ACTIVE'}] : []),
    ] : [{id: 41, tenantId: 7, firstName: 'Ivy', lastName: 'Instructor', email: 'ivy@example.test', role: 'USER', level: 'INSTRUCTOR', status: 'ACTIVE'}];
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
  await openSection(page, 'User directory');
  await expect(page.getByText('Ivy Instructor')).toBeVisible();
  await page.getByLabel('Search by name or email').fill('ivy@example.test');
  await page.getByRole('button', {name: 'Apply filters'}).click();
  await expect.poll(() => requestedPaths.filter(path => path.endsWith('/v2/tenant/users')).length).toBeGreaterThan(1);
  await expect(page.getByRole('link', {name: 'Courses'})).toHaveCount(0);

  await page.getByRole('button', {name: 'Course ownership'}).click();
  await openSection(page, 'Course ownership');
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
  await openSection(page, 'Tenant alert rules');
  await page.getByText('Tenant override', {exact: true}).click();
  await page.getByLabel('Inactivity (days)').fill('7');
  await page.getByRole('button', {name: 'Save alert rules'}).click();
  await expect(page.getByText('Alert rules saved from the latest server response.')).toBeVisible();
  expect(alertPutHeaders['idempotency-key']).toBeUndefined();

  await page.getByRole('button', {name: 'Audit'}).click();
  await openSection(page, 'Governance audit');
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
  await openSection(page, 'Compose exam content');
  await openSection(page, 'IELTS Academic A');
  await expect(page.getByRole('tab', {name: /Listening · Read only/})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Copy to new draft'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Delete draft'})).toBeVisible();
  await expect(page.getByText(/Saved sections are read only under the current create-only API/)).toBeVisible();
  await page.getByRole('button', {name: 'Load audio'}).click();
  await expect(page.locator('audio')).toBeVisible();
  await expect.poll(() => audioRequests).toBe(1);

  await page.getByRole('button', {name: 'Publish complete draft'}).click();
  await expect.poll(() => publishRequests).toBe(1);
  expect(sectionRequests).toEqual(expect.arrayContaining(['listening', 'reading', 'writing']));
});

test('creating a mock-exam draft opens the new version builder immediately', async ({page}, testInfo) => {
  await installIdentity(page, identity('NOT_APPLICABLE', {
    id: 904,
    userId: 904,
    email: 'tessa.admin@example.test',
    role: 'TENANT_ADMIN',
  }));
  const created = {id: 61, label: 'Academic B', title: 'IELTS Academic B', versions: [{id: 611, templateId: 61, versionNo: 1, status: 'DRAFT', hasListening: false, hasReading: false, hasWriting: false}]};
  let templates: typeof created[] = [];
  await page.route('**/v2/tenant/mock-exam-templates**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/versions/611/media')) return route.fulfill({json: response([])});
    if (path.endsWith('/versions/611')) return route.fulfill({json: response(created.versions[0])});
    if (path.endsWith('/mock-exam-templates/61')) return route.fulfill({json: response(created)});
    if (path.endsWith('/mock-exam-templates') && route.request().method() === 'POST') {
      templates = [created];
      return route.fulfill({status: 201, json: response(created)});
    }
    return route.fulfill({json: response(templates)});
  });

  await page.goto('/mock-exams');
  await openSection(page, 'Template versions');
  await page.getByLabel('Internal label').fill('Academic B');
  await page.getByLabel('Candidate title').fill('IELTS Academic B');
  await page.getByRole('button', {name: 'Create and open draft'}).click();
  const builder = page.getByRole('heading', {name: 'Compose exam content'});
  await expect(builder).toBeVisible();
  await expect(builder).toBeInViewport();
  await expect(page.getByRole('button', {name: 'Delete draft'})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('mock-draft-builder.png'), fullPage: true});
});
