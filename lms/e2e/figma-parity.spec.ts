import {expect, test, type Page} from '@playwright/test';
import path from 'node:path';

const reply = (data: unknown) => ({status: 200, code: 'SUCCESS', data});
const course = {id: 71, courseCode: 'WR101', title: 'Academic Writing Studio', state: 'Active', description: 'Build clear, well-supported arguments through guided practice and feedback.', termStartDate: '2026-09-01', termEndDate: '2026-12-01', primaryInstructor: {userId: 51, name: 'Ivy Lee'}, role: 'Student', permissions: {}};
const material = {id: 121, weekId: 81, displayName: 'Academic writing guide', materialType: 'LINK', linkUrl: 'https://example.test/writing-guide', previewAvailable: false};
const profile = {studentUserId: 301, targetGoal: 'Communicate confidently in academic English', baselineAssessment: 'Initial diagnostic completed', targetMetric: 'Writing', targetValue: '6.5', targetDate: '2026-10-12', skills: [{skillCode: 'WR', displayName: 'Writing', scale: 'IELTS', currentValue: '5.5', targetValue: '6.5'}]};
const ownProfile = {userId: 301, firstName: 'Alex', lastName: 'Chen', email: 'review@example.test', role: 'USER', level: 'STUDENT', avatarUrl: null, phone: '', emailNotifications: true};
const tasks = [{id: 101, title: 'Write a timed response', description: 'Use a clear claim and supporting examples.', status: 'NOT_STARTED', dueDate: '2026-09-07', version: 1}, {id: 102, title: 'Review advisor feedback', status: 'COMPLETED', dueDate: '2026-09-02', advisorFeedback: 'Your examples support the argument. Make the introduction more concise.', version: 1}];
async function fixture(page: Page, level = 'STUDENT', courseRole = 'Student') {
  await page.addInitScript(user => {localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('accToken', user.accessToken);}, {...ownProfile, name: 'Alex Chen', id: level === 'ADVISOR' ? 801 : 301, level, accessToken: 'isolated-figma-fixture'});
  await page.route('**/v2/**', route => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace(/^\/api/, '');
    let data: unknown = [];
    if (endpoint === '/v2/me/courses') data = {items: [{...course, role: courseRole, courseRole}], total: 1, page: 0, size: 100};
    else if (endpoint === '/v2/courses/71') data = course;
    else if (endpoint === '/v2/courses/71/weeks') data = [{id: 81, title: 'Building an argument', state: 'Published', materials: [material]}];
    else if (endpoint === '/v2/me/progress') data = {courses: [{courseId: 71, totalAssignmentCount: 10, completedAssignmentCount: 4}]};
    else if (endpoint === '/v2/student/profile') data = profile;
    else if (endpoint === '/v2/student/study-plan') data = {studentUserId: 301, profileContext: {}, plan: {strategySummary: 'Weekly practice and reflection.', checkpoints: [{id: 91, description: 'Build the foundations', tasks}]}};
    else if (endpoint === '/v2/me/profile') data = ownProfile;
    else if (endpoint.endsWith('/unread-count')) data = {unreadCount: 0};
    else if (endpoint === '/v2/courses/71/my-grades') data = [{assignmentId: 111, assignmentTitle: 'First academic essay', released: true, gradeDisplay: '16 / 20', pointsPossible: 20, dueAtUtc: '2026-09-01T12:00:00Z'}];
    else if (endpoint === '/v2/advisor/instructors' || endpoint === '/v2/advisor/courses' || endpoint === '/v2/advisor/action-tasks') data = {items: [], total: 0, page: 0, size: 20};
    else if (endpoint === '/v2/advisor/dashboard') data = {assignedStudentCount: 1, onTrackCount: 0, atRiskCount: 1, needsAttentionCount: 0, pendingApprovalCount: 0, overdueFollowUpCount: 0};
    else if (endpoint === '/v2/advisor/students') data = {items: [{...profile, firstName: 'Alex', lastName: 'Chen', riskStatus: 'AT_RISK'}], total: 1, page: 0, size: 20};
    else if (endpoint === '/v2/advisor/conversations') data = {items: [{studentUserId: 301, studentFirstName: 'Alex', studentLastName: 'Chen', unreadCount: 1, latestPreview: 'Could you review my introduction?'}], total: 1, page: 0, size: 20};
    else if (endpoint.endsWith('/hub')) data = {...profile, firstName: 'Alex', lastName: 'Chen'};
    else if (endpoint.endsWith('/conversation/messages')) data = [{messageId: 901, senderUserId: 301, body: 'Could you review my introduction?', createdAt: '2026-09-03T12:00:00Z'}];
    return route.fulfill({json: reply(data)});
  });
}
async function capture(page: Page, outputPath: (name: string) => string, name: string) {
  for (const width of [390, 1440]) {
    await page.setViewportSize({width, height: 1000});
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path: outputPath(`${name}-${width}.png`), fullPage: true});
  }
}

test('course cards and material reader preserve real progress and discussion writes', async ({page}, info) => {
  await fixture(page);
  await page.goto('/course');
  await expect(page.getByText('40%', {exact: true})).toBeVisible();
  await capture(page, info.outputPath.bind(info), 'courses');
  await page.getByRole('button', {name: 'Collapse navigation', exact: true}).click();
  await expect(page.getByRole('complementary', {name: 'Primary navigation'})).toHaveAttribute('data-collapsed', 'true');
  await page.screenshot({path: info.outputPath('collapsed-navigation-1440.png')});
  await page.getByRole('button', {name: 'Expand navigation', exact: true}).click();
  await page.getByRole('button', {name: 'List view', exact: true}).click();
  await page.goto('/course/71');
  await expect(page.getByRole('heading', {level: 1})).toContainText(course.title);
  await capture(page, info.outputPath.bind(info), 'course-outline');
  await page.getByRole('link', {name: 'Open learning materials'}).click();
  await page.getByRole('button', {name: material.displayName, exact: true}).click();
  await expect(page).toHaveURL(/materialId=121/);
  await expect(page.getByRole('link', {name: /Open learning resource/})).toHaveAttribute('href', material.linkUrl);
  await capture(page, info.outputPath.bind(info), 'course-reader');
  const writes: string[] = [];
  await page.route('**/v2/courses/71/discussion/posts**', async route => {
    if (route.request().method() === 'POST') {writes.push(route.request().postData() ?? ''); expect(route.request().headers()['idempotency-key']).toBeTruthy();}
    return route.fulfill({json: reply([])});
  });
  await page.getByRole('button', {name: 'Discussion', exact: true}).click();
  await page.getByRole('textbox', {name: 'Add a comment'}).fill('How can I make this claim more precise?');
  await page.getByRole('button', {name: 'Post comment'}).click();
  await expect(page.getByRole('textbox', {name: 'Add a comment'})).toHaveValue('');
  expect(writes).toHaveLength(1);
  expect(writes[0]).toContain('How can I make this claim more precise?');
  await capture(page, info.outputPath.bind(info), 'discussion');
});

test('tasks use actual status counts and open their checkpoint', async ({page}, info) => {
  await fixture(page);
  await page.goto('/my-plan?view=tasks');
  await expect(page.getByRole('heading', {name: 'Advisor Comments'})).toBeVisible();
  await expect(page.getByText(tasks[1].advisorFeedback!)).toBeVisible();
  await capture(page, info.outputPath.bind(info), 'advisor-tasks');
  await page.getByRole('navigation', {name: 'Task status filters'}).getByRole('button', {name: /Not started/}).click();
  await expect(page.getByRole('region', {name: 'Tasks by checkpoint'}).getByText('Review advisor feedback')).toHaveCount(0);
  await page.getByRole('button', {name: 'View task', exact: true}).click();
  await expect(page).toHaveURL(/checkpoint=91/);
});

test('profile uses released assessments and crops before uploading a photo', async ({page}, info) => {
  await fixture(page);
  await page.goto('/profile');
  await expect(page.getByRole('heading', {name: 'Alex Chen'})).toBeVisible();
  await page.getByRole('button', {name: 'Assessments', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'First academic essay'})).toBeVisible();
  await capture(page, info.outputPath.bind(info), 'profile-assessments');
  await page.getByRole('button', {name: 'Edit profile', exact: true}).click();
  await expect(page.getByRole('dialog', {name: 'Edit Profile'})).toBeVisible();
  await page.getByRole('button', {name: 'Cancel', exact: true}).click();
  const writes: string[] = [];
  await page.route('**/v2/me/profile/avatar', route => {writes.push(route.request().method()); return route.fulfill({json: reply({...ownProfile, avatarUrl: '/icons/default_avatar.jpg'})});});
  await page.locator('input[type=file]').setInputFiles(path.resolve('public/icons/default_avatar.jpg'));
  const crop = page.getByRole('dialog', {name: 'Crop photo'});
  await expect(crop.getByRole('button', {name: 'Save photo'})).toBeEnabled();
  expect(writes).toEqual([]);
  await capture(page, info.outputPath.bind(info), 'avatar-crop');
  await crop.getByRole('button', {name: 'Save photo'}).click();
  await expect(crop).toHaveCount(0);
  expect(writes).toEqual(['PUT']);
});

test('calendar retains local times and current versions when creating and editing', async ({page}, info) => {
  await fixture(page);
  await page.clock.setFixedTime(new Date('2026-09-03T12:00:00Z'));
  let event: Record<string, unknown> | undefined;
  const writes: {method: string; body: Record<string, unknown>}[] = [];
  await page.route('**/v2/me/personal-events**', route => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({json: reply(new URL(req.url()).pathname.endsWith('/7') ? {...event, version: 4} : event ? [event] : [])});
    writes.push({method: req.method(), body: req.postDataJSON()});
    event = {...req.postDataJSON(), id: 7, version: 4};
    return route.fulfill({json: reply(event)});
  });
  await page.goto('/calendar');
  await page.getByRole('button', {name: '+ Add event', exact: true}).click();
  await page.getByLabel('Event title').fill('Writing practice');
  await page.getByLabel('Starts', {exact: true}).fill('09/03/2026, 03:00 PM');
  await page.getByLabel('Ends', {exact: true}).fill('09/03/2026, 04:00 PM');
  await page.getByLabel('Timezone', {exact: true}).fill('America/Los_Angeles');
  await page.getByRole('button', {name: 'Create event', exact: true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes[0].body).toMatchObject({startsAtLocal: '2026-09-03T15:00:00', endsAtLocal: '2026-09-03T16:00:00', timezone: 'America/Los_Angeles'});
  await capture(page, info.outputPath.bind(info), 'calendar-week');
  await page.getByLabel('Calendar view').selectOption('day');
  await page.getByRole('button', {name: /Writing practice/}).first().click();
  await page.getByRole('button', {name: 'Edit event', exact: true}).click();
  await page.getByLabel('Event title').fill('Timed writing practice');
  await page.getByRole('button', {name: 'Save changes'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes[1].body.expectedVersion).toBe(4);
  await page.getByLabel('Calendar view').selectOption('month');
  await capture(page, info.outputPath.bind(info), 'calendar-month');
});

test('advisor messages is a distinct directory and conversation workspace', async ({page}, info) => {
  await fixture(page, 'ADVISOR');
  await page.goto('/advisor/messages?studentUserId=301');
  await expect(page.getByRole('heading', {name: 'Messages', exact: true})).toBeVisible();
  await expect(page.getByRole('textbox', {name: 'Reply to student', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Progress Overview'})).toHaveCount(0);
  await capture(page, info.outputPath.bind(info), 'advisor-messages');
});

test('TA membership preserves course permissions within the shared course design', async ({page}, info) => {
  await fixture(page, 'INSTRUCTOR', 'TA');
  await page.goto('/course/71');
  await expect(page.getByRole('heading', {level: 1})).toContainText(course.title);
  await capture(page, info.outputPath.bind(info), 'ta-course');
  await page.getByRole('button', {name: 'Assignments', exact: true}).click();
  await expect(page.getByRole('link', {name: /Create assignment|New assignment/})).toHaveCount(0);
});


test('advisor dashboard and students retain distinct workspaces at both breakpoints', async ({page}, info) => {
  await fixture(page, 'ADVISOR');
  await page.goto('/advisor/operations');
  await expect(page.getByRole('heading', {name: 'Progress Overview', exact: true})).toBeVisible();
  await capture(page, info.outputPath.bind(info), 'advisor-dashboard');
  await page.goto('/advisor/students');
  await expect(page.getByRole('cell', {name: 'At risk', exact: true})).toBeVisible();
  await capture(page, info.outputPath.bind(info), 'advisor-students');
});

test('student AI presents a focused course-aware learning workspace', async ({page}, info) => {
  await fixture(page);
  await page.goto('/aibot?courseId=71');
  await expect(page.getByRole('textbox', {name: 'Ask Study Support'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Your personal learning assistant'})).toBeVisible();
  await expect(page.getByRole('button', {name: course.title, exact: true})).toBeVisible();
  await capture(page, info.outputPath.bind(info), 'student-ai');
});
