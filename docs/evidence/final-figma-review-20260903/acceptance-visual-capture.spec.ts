import {expect, test, type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fixture, reply, course, material, ownProfile, profile, tasks} from './workspace-fixtures';

// Temporary independent acceptance captures; every API is an isolated fixture.
const OUT = '/tmp/xlearn-final-visual-review';
const skills = ['Reading', 'Writing', 'Speaking', 'Listening'].map((name, index) => ({skillCode: name.toUpperCase(), displayName: name, scale: 'IELTS', currentValue: String(5 + index / 2), targetValue: '7', position: index + 1}));
const student = {...profile, firstName: 'Alex', lastName: 'Chen', email: ownProfile.email, profileVersion: 2, studentType: 'STANDARD', skills};
const checkpoints = [{id: 91, position: 1, goal: 'Build foundations', description: 'Develop clear claims and supporting examples.', dueDate: '2026-09-14', tasks: tasks.map((item, index) => ({...item, position: index + 1, submissionRequirement: 'Add a short reflection about your practice.'}))}, {id: 92, position: 2, goal: 'Write with confidence', description: 'Practice timed writing and apply feedback.', dueDate: '2026-09-28', tasks: [{...tasks[0], id: 103, title: 'Write a complete timed essay', position: 1}]}, {id: 93, position: 3, goal: 'Review and refine', description: 'Review your progress before the assessment.', dueDate: '2026-10-12', tasks: []}];
const plan = {studentUserId: 301, profileContext: {currentProfileVersion: 2}, plan: {studyPlanId: 81, studyPlanVersion: 1, basedOnProfileVersion: 2, strategySummary: 'Practice, feedback and reflection.', startDate: '2026-09-01', planEndDate: '2026-10-12', checkpoints}};
const exams = [{id: 77, title: 'IELTS Academic Practice 1', status: 'ASSIGNED', attemptStatus: 'NOT_STARTED', readingSelected: true, listeningSelected: true, writingSelected: true, assignedAt: '2026-09-01T12:00:00Z'}, {id: 78, title: 'IELTS Academic Practice 2', status: 'COMPLETED', attemptStatus: 'SUBMITTED', readingSelected: true, listeningSelected: true, writingSelected: true, readingCorrect: 32, readingTotal: 40, listeningCorrect: 34, listeningTotal: 40, writingScore: 6.5, writingGradeStatus: 'RELEASED'}];
async function ready(page: Page) {await page.waitForLoadState('networkidle'); await page.evaluate(() => document.fonts.ready);}
function recorder(page: Page, name: string) {
  const records: unknown[] = [];
  return async (state: string, nodes: string[], note = '') => {
    await fs.mkdir(OUT, {recursive: true});
    for (const width of [1440, 390]) {
      await page.setViewportSize({width, height: width === 1440 ? 1024 : 844});
      await ready(page);
      await page.screenshot({path: path.join(OUT, `${state}-${width}.png`), animations: 'disabled'});
      const geometry = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth, documentHeight: document.documentElement.scrollHeight, brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => image.getAttribute('src'))}));
      records.push({state, nodes, width, url: page.url(), note, ...geometry});
      if (width === 390 && ['student-reading-questions', 'student-reading-results', 'student-writing-exam', 'student-writing-results'].includes(state)) {
        const navigation = page.locator('.bottom-bar'); await navigation.scrollIntoViewIfNeeded();
        const rect = await navigation.boundingBox(); expect(rect && rect.x >= 0 && rect.x + rect.width <= 391).toBeTruthy();
        const exit = await navigation.getByRole('button', {name: 'Exit', exact: true}).boundingBox(); expect(exit && exit.y >= 0 && exit.y + exit.height <= 844).toBeTruthy();
        await page.screenshot({path: path.join(OUT, `${state}-mobile-controls-proof.png`), animations: 'disabled'});
        await fs.writeFile(path.join(OUT, `${state}-mobile-navigation.json`), JSON.stringify({navigation:rect,exit},null,2));
      }
    }
    await page.setViewportSize({width: 1440, height: 1024});
    const manifestPath = path.join(OUT, `${name}-manifest.json`);
    const previous: Array<{state: string}> = JSON.parse(await fs.readFile(manifestPath, 'utf8').catch(() => '[]'));
    const refreshedStates = new Set(records.map(record => (record as {state: string}).state));
    await fs.writeFile(manifestPath, JSON.stringify([...previous.filter(record => !refreshedStates.has(record.state)), ...records], null, 2));
  };
}
async function richFixture(page: Page, role = 'STUDENT') {
  await fixture(page, role);
  await page.clock.setFixedTime(new Date('2026-09-03T12:00:00Z'));
  await page.route('**/v1/**', route => route.fulfill({json: reply({})}));
  await page.route('**/study-support/**', route => route.fulfill({contentType: 'text/event-stream', body: `event: answer\ndata: ${JSON.stringify({answer: 'A clear claim gives your paragraph a purpose.\n\n1. State your main point.\n2. Add a specific example.\n3. Explain how the example supports your claim.\n\nTry revising one paragraph using this structure.'})}\n\n`}));
  await page.route('**/v2/student/profile', route => route.fulfill({json: reply(student)}));
  await page.route('**/v2/student/study-plan', route => route.fulfill({json: reply(plan)}));
  await page.route('**/v2/student/mock-exams', route => route.fulfill({json: reply(exams)}));
  await page.route('**/v2/advisor/students/301/profile', route => route.fulfill({json: reply(student)}));
  await page.route('**/v2/advisor/students/301/study-plan', route => route.fulfill({json: reply(plan)}));
  await page.route('**/v2/advisor/students/301/study-plan/revisions**', route => route.fulfill({json: reply({items: [], total: 0})}));
  await page.route('**/v2/advisor/students/301/hub', route => route.fulfill({json: reply({...student, activeCourseCount: 3, pendingRequestCount: 1})}));
  await page.route('**/v2/advisor/schedule-requests**', route => route.fulfill({json: reply({items: [{id: 501, studentUserId: 301, courseId: 71, status: 'PENDING', requestType: 'SCHEDULE_CHANGE', proposedOccurrenceDate: '2026-09-07', proposedStartTime: '14:00:00', proposedEndTime: '15:00:00', reason: 'School examination in the morning.', version: 2}], total: 1})}));
}

test('capture student plan and checkpoint states', async ({page}) => {
  await richFixture(page); const capture = recorder(page, 'student-plan');
  await page.goto('/my-plan'); await expect(page.getByRole('heading', {name: 'My Learning Goal'})).toBeVisible(); await capture('student-plan', ['100:456', '445:3397']);
  await page.getByRole('button', {name: 'Advisor Tasks', exact: true}).click(); await expect(page.getByRole('heading', {name: 'Advisor Comments'})).toBeVisible(); await capture('student-advisor-tasks', ['148:642']);
  await page.goto('/my-plan?checkpoint=91'); await expect(page.getByRole('button', {name: /Back to study plan/i})).toBeVisible(); await capture('student-checkpoint', ['445:3823']);
  await page.goto('/my-plan?checkpoint=91&task=101'); await expect(page.getByRole('heading', {name: tasks[0].title, exact: true})).toBeVisible(); await capture('student-task-detail', ['464:3172']);
});

test('capture student course and reader states', async ({page}) => {
  await richFixture(page); const capture = recorder(page, 'student-course');
  await page.route('**/v2/courses/71/assignments/summaries', route => route.fulfill({json: reply([{id: 111, title: 'Timed essay', learningType: 'PRACTICE', submissionType: 'Individual', dueAtLocal: '2026-09-10T10:00:00', timezone: 'UTC'}, {id: 112, title: 'Read and reflect', learningType: 'PRE_CLASS', submissionType: 'Individual', dueAtLocal: '2026-09-11T10:00:00', timezone: 'UTC'}])}));
  await page.goto('/course'); await expect(page.getByText(course.title, {exact: true})).toBeVisible(); await capture('student-courses', ['82:357']);
  await page.goto('/course/71'); await expect(page.getByRole('heading', {level: 1})).toContainText(course.title); await capture('student-course-outline', ['414:3326', '493:3350']);
  await page.getByRole('button', {name: 'Assignments', exact: true}).click(); await expect(page.getByRole('link', {name: /Timed essay/})).toBeVisible(); await capture('student-course-assignments', ['494:3386']);
  await page.getByRole('button', {name: 'Courses', exact: true}).click(); await page.getByRole('link', {name: 'Open learning materials'}).click(); await page.getByRole('button', {name: material.displayName, exact: true}).click(); await expect(page).toHaveURL(/materialId=121/); await capture('student-course-reader', ['498:4121'], 'LINK material fixture; video-specific rendering is not established by this capture.');
  await page.getByRole('button', {name: 'AI Course', exact: true}).click(); await expect(page.getByRole('region', {name: 'Course AI assistant'}).getByRole('textbox')).toBeEnabled(); await capture('student-course-ai', ['507:3365']);
  const assistant = page.getByRole('region', {name: 'Course AI assistant'});
  for (const prompt of ['Explain a concept', 'Review my writing', 'Practice speaking', 'Study advice']) {await assistant.getByRole('button', {name: prompt, exact: true}).click(); await expect(assistant.getByRole('textbox', {name: 'Ask Study Support'})).toHaveValue(prompt);}
  await assistant.getByRole('button', {name: 'Send', exact: true}).click(); await expect(assistant.getByRole('button', {name: 'Copy response', exact: true})).toBeVisible();
  await capture('student-course-ai-response', ['507:3365'], 'Synthetic response exercises the compact sidecar request path; populated response is supplemental, not the exact empty Figma state.');
  await assistant.getByRole('button', {name: 'Start a new chat', exact: true}).click(); await expect(assistant.getByRole('button', {name: 'Explain a concept', exact: true})).toBeVisible(); await page.getByRole('button', {name: 'Close course assistant'}).click();
  await page.getByRole('button', {name: 'Discussion', exact: true}).click(); await expect(page.getByRole('textbox', {name: 'Add a comment'})).toBeVisible(); await capture('student-course-discussion', ['496:3494'], 'Empty discussion fixture; populated thread identity projection remains generic.');
});

test('capture student profile settings and crop states', async ({page}) => {
  await richFixture(page); const capture = recorder(page, 'profile');
  await page.goto('/profile'); await expect(page.getByRole('heading', {name: 'Alex Chen'})).toBeVisible(); await capture('student-profile', ['405:2345', '410:2120']);
  await page.getByRole('button', {name: 'Profile', exact: true}).click(); await expect(page.locator('#profile-menu')).toBeVisible(); await capture('profile-menu', ['378:1714', '406:2399'], 'Menu captured over Profile page; source reference shows Dashboard behind it.'); await page.keyboard.press('Escape');
  await page.getByRole('button', {name: 'Edit profile', exact: true}).click(); await expect(page.getByRole('dialog', {name: 'Edit Profile'})).toBeVisible(); await capture('profile-edit', ['410:2408']); await page.getByRole('button', {name: 'Cancel', exact: true}).click();
  await page.locator('input[type=file]').setInputFiles(path.resolve('public/icons/default_avatar.jpg')); await expect(page.getByRole('dialog', {name: 'Crop photo'})).toBeVisible(); await capture('profile-crop', ['408:2433']); await page.keyboard.press('Escape');
  await page.getByRole('button', {name: 'Assessments', exact: true}).click(); await expect(page.getByRole('heading', {name: 'First academic essay'})).toBeVisible(); await capture('profile-assessments', ['406:1914', '399:1628'], 'One released assessment; scrolled multi-assessment state is not independently exercised.');
  await page.goto('/settings'); await page.getByRole('tab', {name: 'Password', exact: true}).click(); await capture('settings-password', ['408:1956']);
  await page.getByLabel('Current password', {exact: true}).fill('fixture-old1'); await page.getByLabel('New password', {exact: true}).fill('fixture-new2'); await page.getByLabel('Confirm new password', {exact: true}).fill('fixture-new2'); await page.locator('form button[type=submit]').click(); await expect(page.getByText('Password updated.', {exact: true})).toBeVisible(); await capture('settings-password-success', ['406:3008']);
});

test('capture advisor directory journey and course dialogs', async ({page}) => {
  await richFixture(page, 'ADVISOR'); const capture = recorder(page, 'advisor');
  const courses = ['Academic Writing Studio', 'Speaking with Confidence', 'Critical Reading'].map((title, index) => ({courseId: 71 + index, courseCode: `EN-${101 + index}`, title, deliveryMode: 'GROUP', instructorFirstName: 'Ivy', instructorLastName: 'Lee', status: 'PUBLISHED', courseLinkVersion: 1, lectureCompleted: 4, lectureTotal: 10}));
  await page.route('**/v2/advisor/students/301/courses', route => route.fulfill({json: reply(courses)}));
  await page.route('**/v2/advisor/students/301/course-options**', route => route.fulfill({json: reply({items: [{courseId: 75, title: 'Academic Reading Workshop', courseCode: 'RD101', capacity: 16, activeStudents: 7, remainingCapacity: 9}], total: 1, page: 0, size: 20})}));
  await page.route('**/v2/advisor/students/301/mock-exams', route => route.fulfill({json: reply(exams)}));
  await page.route('**/v2/advisor/students/301/mock-exams/78', route => route.fulfill({json: reply(exams[1])}));
  await page.route('**/v2/advisor/mock-exam-templates', route => route.fulfill({json: reply([{id: 31, title: 'IELTS Academic Practice', publishedVersionId: 1}])}));
  await page.goto('/advisor/students'); await expect(page.getByRole('cell', {name: 'At risk', exact: true})).toBeVisible(); await capture('advisor-students', ['783:8276']);
  await page.getByRole('checkbox', {name: 'Select Alex Chen', exact: true}).check(); await capture('advisor-students-selected', ['791:10510'], 'Selection checkboxes are present; no matching bulk mutation contract is established.');
  await page.goto('/advisor/messages?studentUserId=301'); await expect(page.getByRole('textbox', {name: 'Reply to student', exact: true})).toBeVisible(); await capture('advisor-messages', ['810:15612']);
  await page.goto('/advisor/students/301/study-plan'); await expect(page.getByRole('heading', {name: 'Learning Journey', exact: true})).toBeVisible(); await capture('advisor-student-journey', ['803:13456']);
  await page.getByRole('button', {name: 'View phase 1', exact: true}).click(); await expect(page.getByRole('dialog')).toBeVisible(); await capture('advisor-checkpoint-dialog', ['813:4892']); await page.getByRole('button', {name: 'Close dialog'}).click();
  await page.goto('/advisor/students/301/courses'); await expect(page.getByRole('heading', {name: 'Speaking with Confidence'})).toBeVisible(); await capture('advisor-student-courses', ['805:14271']);
  await page.getByRole('button', {name: 'View Course', exact: true}).first().click(); await expect(page.getByRole('dialog')).toBeVisible(); await capture('advisor-course-information', ['818:7178'], 'Information projection; Figma learning-material access remains a contract dependency.'); await page.getByRole('button', {name: 'Class Schedule', exact: true}).click(); await capture('advisor-course-schedule', ['818:7815'], 'Schedule projection; not a captured assignment tab.'); await page.getByRole('button', {name: 'Close course details'}).click();
  await page.getByRole('button', {name: 'Add Course', exact: true}).click(); await expect(page.getByRole('dialog')).toBeVisible(); await capture('advisor-add-course', ['815:5643']); await page.keyboard.press('Escape');
  await page.goto('/advisor/students/301/exams'); await expect(page.getByRole('button', {name: /IELTS Academic Practice 2/})).toBeVisible(); await capture('advisor-exams', ['810:15017']); await page.getByRole('button', {name: /IELTS Academic Practice 2/}).click(); await expect(page.getByRole('dialog', {name: 'Mock exam results'}).getByText('34 / 40', {exact: true})).toBeVisible(); await capture('advisor-exam-results', ['818:8771']); await page.keyboard.press('Escape');
  await page.getByRole('button', {name: 'Assign exam', exact: true}).click(); await expect(page.getByRole('dialog', {name: 'Assign a mock exam'})).toBeVisible(); await capture('advisor-assign-exam', ['816:6276'], 'Assignment dialog is captured; Figma scheduling has no matching contract.');
});

test('capture calendar default detail and creation states', async ({page}) => {
  await richFixture(page); const capture = recorder(page, 'calendar');
  await page.route('**/v2/me/calendar**', route => route.fulfill({json: reply([{occurrenceId: 81, courseId: 71, title: 'Academic writing class', occurrenceDate: '2026-09-03', startTime: '10:00:00', endTime: '11:30:00', timezone: 'UTC', location: 'Room 3A'}])}));
  await page.route('**/v2/courses/71/assignments/summaries', route => route.fulfill({json: reply([{id: 111, title: 'Timed essay', learningType: 'PRACTICE', dueAtLocal: '2026-09-03T16:00:00', timezone: 'UTC'}])}));
  await page.route('**/v2/courses/71/quizzes', route => route.fulfill({json: reply([{id: 141, title: 'Vocabulary quiz', state: 'Published', closesAtLocal: '2026-09-04T14:00:00', timezone: 'UTC'}])}));
  await page.goto('/calendar'); await expect(page.getByRole('button', {name: /Academic writing class/}).first()).toBeVisible(); await capture('calendar-week', ['335:1033']);
  await page.getByRole('button', {name: /Academic writing class/}).first().click(); await expect(page.getByRole('dialog')).toBeVisible(); await capture('calendar-course-detail', ['375:3392']); await page.keyboard.press('Escape');
  await page.getByRole('button', {name: /Timed essay/}).first().click(); await expect(page.getByRole('dialog')).toBeVisible(); await capture('calendar-assignment-detail', ['375:4466']); await page.keyboard.press('Escape');
  await page.getByRole('button', {name: /Vocabulary quiz/}).first().click(); await expect(page.getByRole('dialog')).toBeVisible(); await capture('calendar-quiz-detail', ['375:3937'], 'Course quiz detail; design shows a scheduled mock exam, not the same contract resource.'); await page.keyboard.press('Escape');
  await page.getByLabel('Calendar view').selectOption('month'); await capture('calendar-month', ['365:1122']);
  await page.getByRole('button', {name: '+ Add event', exact: true}).click(); await page.getByLabel('Event title').fill('Writing practice'); await capture('calendar-add-event', ['375:1621']);
  await page.getByLabel('Starts', {exact: true}).click(); await expect(page.getByRole('dialog', {name: /Select date/i})).toBeVisible(); await capture('calendar-date-time-picker', ['375:1956', '375:2540'], 'One combined picker; reference relative-duration menu is not represented.');
});

test('capture AI empty and conversation states', async ({page}) => {
  await richFixture(page); const capture = recorder(page, 'ai');
  await page.goto('/aibot?courseId=71'); await expect(page.getByRole('textbox', {name: 'Ask Study Support'})).toBeVisible(); await capture('ai-empty', ['201:906']);
  await page.getByRole('textbox', {name: 'Ask Study Support'}).fill('How can I write a clearer argument?'); await page.getByRole('button', {name: 'Send', exact: true}).click(); await expect(page.getByText('Try revising one paragraph using this structure.', {exact: false})).toBeVisible({timeout: 60000}); await capture('ai-conversation', ['322:865']);
  await page.getByRole('button', {name: 'Collapse navigation', exact: true}).click(); await capture('ai-collapsed-navigation', ['410:9227'], 'Global navigation collapse; no persisted conversation-history contract.');
  await page.getByRole('textbox', {name: 'Ask Study Support'}).fill('Please show a second example and explain why it works.'); await page.getByRole('button', {name: 'Send', exact: true}).click(); await expect(page.getByText('Try revising one paragraph using this structure.', {exact: false})).toHaveCount(2, {timeout: 60000}); await capture('ai-long-conversation', ['333:974'], 'Two response turns; no chat history rail or jump navigator.');
});

test('capture exam library writing and completed states', async ({page}) => {
  await richFixture(page); const capture = recorder(page, 'exams');
  await page.route('**/v2/student/mock-exams/77**', route => {const pathname = new URL(route.request().url()).pathname; const data = pathname.endsWith('/attempts') ? {attemptId: 81} : route.request().method() === 'POST' ? {submissionId: 91, writingId: 77, candidateName: 'Alex Chen', tasks: [{taskKey: 'task-1', seq: 1, wordCount: 7, contentLength: 56}, {taskKey: 'task-2', seq: 2, wordCount: 6, contentLength: 36}]} : pathname.endsWith('/writing') ? {id: 77, totalMinutes: 60, tasks: [{id: 1, seq: 1, taskKey: 'task-1', title: 'Writing Task 1', prompt: 'Describe a useful learning strategy.', minWords: 1, hasImage: false}, {id: 2, seq: 2, taskKey: 'task-2', title: 'Writing Task 2', prompt: 'Explain how examples support an argument.', minWords: 1, hasImage: false}]} : exams[0]; return route.fulfill({json: reply(data)});});
  await page.goto('/mock-exams/77/writing'); await page.getByRole('textbox').fill('Regular practice and specific feedback improve learning.'); await capture('student-writing-exam', ['417:2798'], 'Actual IELTS writing prompts with the new desktop navigation rail; no AI scoring or comments are represented.');
  await page.getByRole('button', {name: 'Task 2', exact: true}).click(); await page.getByRole('textbox').fill('One clear example supports my claim.'); await page.getByRole('button', {name: 'Task 1', exact: true}).click(); await expect(page.getByRole('textbox')).toHaveValue('Regular practice and specific feedback improve learning.');
  await page.getByRole('button', {name: /Finish/}).click(); await expect(page.getByRole('dialog', {name: 'Ready to submit?'})).toBeVisible(); await capture('student-exam-confirm', []); await page.getByRole('button', {name: 'Submit section', exact: true}).click(); await expect(page.getByRole('dialog', {name: 'Section submitted'})).toBeVisible(); await capture('student-exam-complete', ['427:2694']); await page.getByRole('button', {name: 'View results', exact: true}).click(); await expect(page.getByRole('textbox')).toHaveAttribute('readonly', ''); await capture('student-writing-results', ['427:2930'], 'Writing submission receipt shows word/character counts and read-only answers; no AI score/comments contract is established.');
});

test('capture authentication form transition states', async ({page}) => {
  const capture = recorder(page, 'auth');
  await page.route('**/v1/**', route => route.fulfill({json: reply({})}));
  await page.goto('/login'); await expect(page.getByRole('heading', {name: 'Welcome to X-Learn'})).toBeVisible(); await capture('auth-login', ['715:3994']);
  await page.route('**/v1/auth/login', route => route.fulfill({status: 400, json: {status: 400, code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.'}}));
  await page.getByLabel('Email', {exact: true}).fill('review@example.test'); await page.getByLabel('Password', {exact: true}).fill('fixture-old1'); await page.locator('button[type=submit]').click(); await expect(page.getByRole('alert')).toBeVisible(); await capture('auth-login-error', ['729:3484']);
  await page.goto('/signup'); await expect(page.getByRole('heading', {name: 'Create an account'})).toBeVisible(); await capture('auth-signup', ['730:4653']);
  await page.locator('#signup-email').fill('review@example.test'); await page.locator('#signup-tenant-id').fill('1'); await page.locator('button[type=submit]').click(); await capture('auth-signup-details', ['730:4753'], 'Required structured names and tenant registration contract differ from the Figma activation form.'); await page.locator('#signup-first-name').fill('Alex'); await page.locator('#signup-last-name').fill('Chen'); await page.locator('#signup-password').fill('fixture-new2'); await page.locator('#signup-confirm-password').fill('fixture-new2'); await page.locator('button[type=submit]').click(); await expect(page.locator('#signup-verification')).toBeVisible(); await capture('auth-signup-verification', ['730:4753'], 'Verification code is contract-required; no legal-consent contract is consumed.');
  await page.goto('/forgotpassword'); await expect(page.getByRole('heading', {name: 'Forgot password?'})).toBeVisible(); await capture('auth-reset-email', ['731:4840']); await page.getByLabel('Email', {exact: true}).fill('review@example.test'); await page.locator('button[type=submit]').click(); await expect(page.getByLabel('Digit 1')).toBeVisible(); await capture('auth-reset-code', ['731:4886']);
  await page.getByLabel('Digit 1').fill('123456'); await page.locator('button[type=submit]').click(); await expect(page.locator('#reset-password')).toBeVisible(); await capture('auth-reset-password', ['732:4924']); await page.locator('#reset-password').fill('fixture-new2'); await page.locator('#reset-password-confirm').fill('fixture-new2'); await page.locator('button[type=submit]').click(); await expect(page.locator('#reset-password')).toHaveCount(0); await capture('auth-reset-success', ['732:4973']);
});

test('capture reading questions and released correctness', async ({page}) => {
  await richFixture(page); const capture = recorder(page, 'reading');
  const reading = {id: 77, totalMinutes: 60, passages: [{id: 1, seq: 1, shortLabel: 'Passage 1', title: 'The value of regular practice', intro: 'Read the passage and answer questions 1–3.', paragraphs: ['Learning improves when practice is distributed over time. Short sessions give learners opportunities to revisit an idea and notice what they still need to understand.', 'Specific feedback helps students identify the next step. A useful learning plan combines practice, reflection and a clear goal.'], questionNumbers: [1, 2, 3], questions: [{kind: 'shortAnswer', title: 'Questions 1–3', instruction: 'Write NO MORE THAN THREE WORDS for each answer.', questionStart: 1, questionEnd: 3, payload: {questions: [{id: 1, prompt: 'What should be distributed over time?'}, {id: 2, prompt: 'What helps identify the next step?'}, {id: 3, prompt: 'What does a useful plan need?'}]}}]}]};
  await page.route('**/v2/student/mock-exams/77**', route => {const endpoint = new URL(route.request().url()).pathname; const data = endpoint.endsWith('/attempts') ? {attemptId: 81} : route.request().method() === 'POST' ? {submissionId: 91, readingId: 77, candidateName: 'Alex Chen', totalQuestions: 3, correctCount: 2, results: [{questionNumber: 1, submitted: 'practice', correct: true, blank: false}, {questionNumber: 2, submitted: 'specific feedback', correct: true, blank: false}, {questionNumber: 3, submitted: 'time', correct: false, blank: false}]} : endpoint.endsWith('/reading') ? reading : exams[0]; return route.fulfill({json: reply(data)});});
  await page.goto('/mock-exams/77/reading'); await expect(page.getByRole('textbox')).toHaveCount(3); await page.getByRole('textbox').nth(0).fill('practice'); await page.getByRole('textbox').nth(1).fill('specific feedback'); await expect(page.locator('[aria-label="Answer progress"]')).toContainText(/Answered\s*2/); await expect(page.locator('[aria-label="Answer progress"]')).toContainText(/Unanswered\s*1/); await capture('student-reading-questions', ['417:2798'], 'IELTS passage/questions with the desktop 9+3 question rail and true 2 answered/1 unanswered counts.'); await page.getByRole('textbox').nth(2).fill('time');
  await page.getByRole('button', {name: /Finish section/}).click(); await page.getByRole('button', {name: 'Submit section', exact: true}).click(); await page.getByRole('button', {name: 'View results', exact: true}).click(); await expect(page.locator('[aria-label="Released question results"]')).toContainText(/Correct\s*2/); await expect(page.locator('[aria-label="Released question results"]')).toContainText(/Incorrect\s*1/); await capture('student-reading-results', ['427:2930'], 'Released per-question correctness is captured; no AI scoring, comments or Advisor-note operation is established.');
});

test('verify final phone geometry and AI controls', async ({page}) => {
  await richFixture(page); await page.setViewportSize({width: 390, height: 844});
  await page.goto('/profile'); await expect(page.getByRole('heading', {name: 'Alex Chen'})).toBeVisible(); await ready(page);
  const hero = await page.locator('section[aria-labelledby="profile-title"]').boundingBox();
  const changeAvatar = await page.getByRole('button', {name: 'Change avatar', exact: true}).boundingBox();
  const baseline = await page.getByText('Baseline assessment', {exact: true}).boundingBox();
  expect(changeAvatar && baseline && changeAvatar.y + changeAvatar.height <= baseline.y).toBeTruthy();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/aibot?courseId=71'); await expect(page.getByRole('textbox', {name: 'Ask Study Support'})).toBeEnabled();
  for (const [index, prompt] of ['How can I write a clearer argument?', 'Please explain a second example.'].entries()) {await page.getByRole('textbox', {name: 'Ask Study Support'}).fill(prompt); await page.getByRole('button', {name: 'Send', exact: true}).click(); await expect(page.getByRole('button', {name: 'Copy response', exact: true})).toHaveCount(index + 1);}
  const stream = page.locator('[class*="messageArea"]').filter({has: page.getByRole('button', {name: 'Copy response', exact: true})});
  await stream.evaluate(element => {element.scrollTop = 0; element.dispatchEvent(new Event('scroll', {bubbles: true}));});
  await expect(page.getByRole('button', {name: 'Latest response', exact: true})).toBeVisible(); await page.getByRole('button', {name: 'Latest response', exact: true}).click();
  await page.getByRole('button', {name: 'Copy response', exact: true}).last().click(); await expect(page.getByText('Response copied.', {exact: true})).toBeVisible();
  await page.screenshot({path: path.join(OUT, 'ai-phone-copy-latest-proof.png'), animations: 'disabled'});
  await fs.writeFile(path.join(OUT, 'final-phone-geometry.json'), JSON.stringify({hero, changeAvatar, baseline, avatarDoesNotOverlapSummary: true, aiLatestControlWorked: true, aiClipboardCopyWorked: true}, null, 2));
});


test('capture final Add Course design', async ({page}) => {
  await richFixture(page, 'ADVISOR'); const capture = recorder(page, 'advisor');
  await page.route('**/v2/advisor/students/301/courses', route => route.fulfill({json: reply([{courseId: 71, courseCode: 'WR101', title: 'Academic Writing Studio', deliveryMode: 'GROUP', status: 'PUBLISHED', courseLinkVersion: 1}])}));
  await page.route('**/v2/advisor/students/301/course-options**', route => route.fulfill({json: reply({items: [{courseId: 75, title: 'Academic Reading Workshop', courseCode: 'RD101', capacity: 16, activeStudents: 7, remainingCapacity: 9}], total: 1, page: 0, size: 20})}));
  await page.goto('/advisor/students/301/courses'); await page.getByRole('button', {name: 'Add Course', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Add Course', exact: true});
  await dialog.getByRole('button', {name: 'Create 1-on-1 Course', exact: true}).click(); await expect(dialog.getByRole('button', {name: 'Create 1-on-1 Course', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', {name: 'Join Group Course', exact: true}).click(); await expect(dialog.getByRole('button', {name: 'Join Group Course', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', {name: /Academic Reading Workshop/}).click(); await expect(dialog.getByRole('button', {name: 'Link selected course', exact: true})).toBeEnabled();
  await capture('advisor-add-course', ['815:5643'], 'Mode icons, descriptions and selection markers are rendered; catalog card uses supplied title/code/capacity fields. No enrollment is submitted by this capture.');
});

test('verify listening layout at intermediate width', async ({page}) => {
  await richFixture(page);
  await page.route('**/v2/student/mock-exams/77**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/listening') ? {id: 77, totalMinutes: 30, parts: [{id: 1, seq: 1, label: 'Part 1', questionNumbers: [1, 2], sections: [{kind: 'formCompletion', title: 'Questions 1–2', instruction: 'Write ONE WORD for each answer.', questionStart: 1, questionEnd: 2, payload: {formTitle: 'Study registration', fields: [{label: 'Name', id: 1}, {label: 'Course', id: 2}]}}]}]} : exams[0];
    return route.fulfill({json: reply(data)});
  });
  await page.setViewportSize({width: 1000, height: 900}); await page.goto('/mock-exams/77/listening'); await expect(page.getByRole('textbox')).toHaveCount(2); await ready(page);
  const geometry = await page.locator('.listening-main').evaluate(element => {const rect=element.getBoundingClientRect(); const style=getComputedStyle(element); return {x:rect.x,width:rect.width,gridColumn:style.gridColumn,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth};});
  expect(geometry.width).toBeGreaterThan(900); expect(geometry.scrollWidth).toBeLessThanOrEqual(1000); expect(geometry.gridColumn).toBe('1 / -1');
  await page.screenshot({path:path.join(OUT,'student-listening-1000-proof.png'),animations:'disabled'});
  await page.locator('.bottom-bar').scrollIntoViewIfNeeded(); await page.screenshot({path:path.join(OUT,'student-listening-1000-controls-proof.png'),animations:'disabled'});
  await fs.writeFile(path.join(OUT,'final-listening-geometry.json'),JSON.stringify(geometry,null,2));
});
