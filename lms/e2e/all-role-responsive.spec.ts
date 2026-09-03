import {expect, test, type Page} from '@playwright/test';

const students = [
  {studentUserId: 301, firstName: 'Alexandra', lastName: 'Chen', email: 'alexandra.chen@example.test', studentType: 'STANDARD', assignmentVersion: 2, targetGoal: 'Reach IELTS Writing 6.5 before university admission', riskStatus: 'ON_TRACK', lastActivityAt: '2026-09-01T10:00:00Z'},
  {studentUserId: 302, firstName: 'Lucas', lastName: 'Tan', email: 'lucas.tan@example.test', studentType: 'VIP', assignmentVersion: 1, targetGoal: 'Build confidence in academic speaking', riskStatus: 'NEEDS_ATTENTION'},
];
const courses = [
  {id: 71, courseCode: 'WR101', title: 'Academic Writing Studio', role: 'Student', primaryInstructor: {userId: 51, name: 'Ivy Lee'}},
  {id: 72, courseCode: 'SP201', title: 'Speaking with Confidence', role: 'Student', primaryInstructor: {userId: 52, name: 'Daniel Wong'}},
  {id: 73, courseCode: 'RD301', title: 'Critical Reading and Vocabulary', role: 'Student', primaryInstructor: {userId: 53, name: 'Mei Tan'}},
];
const envelope = (data: unknown) => ({status: 200, code: 'SUCCESS', data});

async function fixture(page: Page, level: string, role = 'USER') {
  const writes: string[] = [];
  await page.addInitScript(user => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accToken', user.accessToken);
  }, {id: 901, userId: 901, firstName: 'Alex', lastName: 'Reviewer', name: 'Alex Reviewer', email: 'responsive@example.test', role, level, accessToken: 'isolated-responsive-fixture'});
  await page.route('**/v2/**', route => {
    const request = route.request();
    if (request.method() !== 'GET') writes.push(request.method());
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    let data: unknown = [];
    if (path.endsWith('/unread-count')) data = {unreadCount: 0};
    else if (path === '/v2/advisor/students') {
      const q = url.searchParams.get('q')?.toLowerCase() ?? '';
      const items = students.filter(student => `${student.firstName} ${student.lastName} ${student.email}`.toLowerCase().includes(q));
      data = {items, page: 0, size: 20, total: items.length};
    } else if (path === '/v2/counsellor/dashboard') data = {createdCount: 12, assignedCount: 8, unassignedCount: 4};
    else if (path === '/v2/parent/linked-students') data = {items: [{studentUserId: 301}], page: 0, size: 20, total: 1};
    else if (path === '/v2/tenant/users') data = {items: [{id: 51, firstName: 'Ivy', lastName: 'Lee', email: 'ivy.lee@example.test', role: 'USER', level: 'INSTRUCTOR', status: 'ACTIVE'}], page: 0, size: 20, total: 1};
    else if (path.endsWith('/me/courses')) data = {items: courses, page: 0, size: 100, total: courses.length};
    else if (path.endsWith('/profile')) data = {studentUserId: 301, profileVersion: 1, targetGoal: 'Reach IELTS 6.5', skills: []};
    else if (path.endsWith('/study-plan')) data = {studentUserId: 301, profileContext: {currentProfileVersion: 1}, plan: {studyPlanId: 81, studyPlanVersion: 1, basedOnProfileVersion: 1, strategySummary: 'Weekly practice and review', checkpoints: []}};
    else if (path === '/v2/student/mock-exams') data = [{studentMockExamId: 71, title: 'September Academic Practice', status: 'Assigned', listeningSelected: true, readingSelected: true}, {studentMockExamId: 72, title: 'Writing Skills Review', status: 'Completed', writingSelected: true}];
    return route.fulfill({json: envelope(data)});
  });
  return writes;
}

const cases = [
  {name: 'student', level: 'STUDENT', path: '/my-plan', title: 'Study plan'},
  {name: 'advisor', level: 'ADVISOR', path: '/advisor/students', title: 'Students'},
  {name: 'instructor', level: 'INSTRUCTOR', path: '/my-operations', title: 'Teaching operations'},
  {name: 'combined-instructor-advisor', level: 'INSTRUCTOR_ADVISOR', path: '/my-operations', title: 'Teaching operations'},
  {name: 'counsellor', level: 'COUNSELLOR', path: '/counsellor', title: 'Intake dashboard'},
  {name: 'parent', level: 'PARENT', path: '/parent', title: 'Student progress'},
  {name: 'tenant-admin', level: 'NOT_APPLICABLE', role: 'TENANT_ADMIN', path: '/admin', title: 'Tenant governance'},
  {name: 'system-admin', level: 'NOT_APPLICABLE', role: 'SYSTEM_ADMIN', path: '/admin', title: 'Admin Console'},
  {name: 'student-exams', level: 'STUDENT', path: '/mock-exams', title: 'Exams'},
];
for (const subject of cases) {
  test(`${subject.name} shares the design scale and fits responsive widths`, async ({page}, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const writes = await fixture(page, subject.level, subject.role);
    await page.goto(subject.path);
    const title = page.getByRole('heading', {level: 1, name: subject.title, exact: true});
    await expect(title).toBeVisible();
    if (subject.name === 'advisor') await expect(page.getByRole('link', {name: 'Open Alexandra Chen'})).toBeVisible();
    for (const width of [320, 390, 768, 1024, 1440, 1920, 2560]) {
      await page.setViewportSize({width, height: 960});
      await expect(title).toBeVisible();
      const geometry = await title.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return {left: rect.left, right: rect.right, font: parseFloat(getComputedStyle(element).fontSize), viewport: innerWidth, content: document.documentElement.scrollWidth};
      });
      expect(geometry.content, `${subject.name} overflow at ${width}`).toBeLessThanOrEqual(width);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width);
      expect(geometry.font).toBeGreaterThanOrEqual(28);
      expect(geometry.font).toBeLessThanOrEqual(32);
      if (width === 390 || width === 1440) await page.screenshot({path: testInfo.outputPath(`${subject.name}-${width}.png`), fullPage: true});
    }
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}

test('student list filters still use the contract and opens the registered student route', async ({page}) => {
  await fixture(page, 'ADVISOR');
  await page.goto('/advisor/students');
  await expect(page.getByRole('link', {name: 'Open Alexandra Chen'})).toBeVisible();
  await page.getByRole('searchbox', {name: 'Search students'}).fill('Lucas');
  await expect(page.getByRole('link', {name: 'Open Alexandra Chen'})).toHaveCount(0);
  await expect(page.getByRole('link', {name: 'Open Lucas Tan'})).toHaveAttribute('href', '/advisor/students/302/intake');
  await page.getByRole('searchbox', {name: 'Search students'}).fill('No match');
  await expect(page.getByText('No students match these filters.')).toBeVisible();
});

test('exam filters use supplied sections and states', async ({page}) => {
  await fixture(page, 'STUDENT');
  await page.goto('/mock-exams');
  await page.getByRole('button', {name: 'Writing', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Writing Skills Review'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'September Academic Practice'})).toHaveCount(0);
  await page.getByRole('combobox', {name: 'Exam status'}).selectOption('Assigned');
  await expect(page.getByText('No papers match these filters.')).toBeVisible();
});
