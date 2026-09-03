import {expect, test, type Page} from '@playwright/test';
import {openSection, sectionTrigger} from './disclosure-helpers';

const profile = {studentUserId: 301, email: 'alex.chen@example.test', studentType: 'STANDARD', profileVersion: 2, firstName: 'Alex', lastName: 'Chen', academicBackground: 'Preparing for university admission.', targetGoal: 'Reach IELTS Writing 6.5', targetMetric: 'IELTS Writing', targetValue: '6.5', targetDate: '2026-10-12', skills: [{skillCode: 'WR', displayName: 'Writing', scale: 'IELTS', currentValue: '5.5', targetValue: '6.5', position: 1}]};
const plan = {studentUserId: 301, profileContext: {currentProfileVersion: 2}, plan: {studyPlanId: 81, studyPlanVersion: 1, basedOnProfileVersion: 2, strategySummary: 'Weekly timed essays and targeted review.', startDate: '2026-09-14', planEndDate: '2026-10-12', checkpoints: [{id: 91, position: 1, description: 'Complete the diagnostic', goal: 'Identify recurring patterns', dueDate: '2026-09-21', tasks: [{id: 101, position: 1, title: 'Submit the week 1 essay', description: 'Submit one timed response.', dueDate: '2026-09-21', status: 'NOT_STARTED', version: 0}]}]}};
const courses = [
  {courseId: 71, courseCode: 'WR-101', title: 'Academic Writing Studio', deliveryMode: 'GROUP', instructorFirstName: 'Ivy', instructorLastName: 'Lee', status: 'PUBLISHED', courseLinkVersion: 1},
  {courseId: 72, courseCode: 'SP-201', title: 'Speaking with Confidence', deliveryMode: 'ONE_ON_ONE', instructorFirstName: 'Daniel', instructorLastName: 'Wong', launchState: 'DRAFT', courseLaunchVersion: 2, courseLinkVersion: 1},
  {courseId: 73, courseCode: 'RD-301', title: 'Critical Reading and Vocabulary', deliveryMode: 'GROUP', instructorFirstName: 'Mei', instructorLastName: 'Tan', status: 'PUBLISHED', courseLinkVersion: 1},
];

async function installFixture(page: Page, level = 'ADVISOR') {
  await page.addInitScript(currentLevel => {
    const user = {id: 901, userId: 901, name: 'Alex Advisor', email: 'ui-review@example.test', level: currentLevel, role: 'USER', accessToken: 'isolated-disclosure-test'};
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accToken', user.accessToken);
  }, level);
  await page.route('**/v2/**', route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/unread-count')) data = {unreadCount: 0};
    else if (path.endsWith('/hub') || path.endsWith('/intake')) data = {...profile, assignmentStatus: 'ASSIGNED', assignmentVersion: 2};
    else if (path.endsWith('/profile')) data = profile;
    else if (path.endsWith('/study-plan')) data = plan;
    else if (path.endsWith('/courses')) data = courses;
    else if (path.endsWith('/instructors') || path.includes('/revisions')) data = {items: [], page: 0, size: 20, total: 0};
    return route.fulfill({json: {status: 200, code: 'SUCCESS', data}});
  });
}

for (const width of [1440, 390]) {
  test(`independent disclosures preserve drafts and reveal required fields at ${width}px`, async ({page}, testInfo) => {
    await page.setViewportSize({width, height: 960});
    await installFixture(page);
    const errors: string[] = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('/advisor/students/301/profile');
    await expect(sectionTrigger(page, 'Primary target')).toBeVisible();
    await expect(page.locator('details[open]')).toHaveCount(0);
    await page.screenshot({path: testInfo.outputPath(`profile-collapsed-${width}.png`), fullPage: true});
    await openSection(page, 'Student context');
    await page.getByRole('textbox', {name: 'Academic background', exact: true}).fill('Unsaved background stays in place.');
    await sectionTrigger(page, 'Student context').click();
    await openSection(page, 'Primary target');
    await expect(sectionTrigger(page, 'Student context').locator('..')).not.toHaveAttribute('open');
    await openSection(page, 'Student context');
    await expect(page.getByRole('textbox', {name: 'Academic background', exact: true})).toHaveValue('Unsaved background stays in place.');
    await openSection(page, 'Measured skills');
    await openSection(page, 'Writing');
    await page.getByRole('textbox', {name: /^Skill code/}).fill('');
    await sectionTrigger(page, 'Measured skills').click();
    const saveButton = page.getByRole('button', {name: 'Save profile', exact: true});
    await saveButton.scrollIntoViewIfNeeded();
    if (width === 390) {
      const box = await saveButton.boundingBox();
      expect(box && box.y + box.height).toBeLessThanOrEqual(960 - 76);
    }
    await saveButton.click();
    await expect(page.getByRole('textbox', {name: /^Skill code/})).toBeFocused();
    await expect(sectionTrigger(page, 'Measured skills').locator('..')).toHaveAttribute('open', '');
    await expect(sectionTrigger(page, 'Writing').locator('..')).toHaveAttribute('open', '');
    expect(errors.filter(message => /not focusable|validateDOMNesting|Maximum update/.test(message))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.goto('/advisor/students/301/study-plan');
    await expect(page.getByRole('heading', {name: 'Learning journey'})).toBeVisible();
    await page.getByRole('button', {name: 'Edit study plan', exact: true}).click();
    await expect(sectionTrigger(page, 'Plan direction')).toBeVisible();
    await expect(page.locator('details[open]')).toHaveCount(0);
    await page.screenshot({path: testInfo.outputPath(`study-plan-collapsed-${width}.png`), fullPage: true});
    await page.goto('/advisor/students/301/study-plan?advisorTaskId=101');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', {name: 'Edit checkpoint & tasks'}).click();
    await expect(page.getByLabel('Title', {exact: true})).toBeVisible();
    await expect(page.getByLabel('Title', {exact: true})).toHaveValue('Submit the week 1 essay');
    await expect(sectionTrigger(page, 'Plan direction').locator('..')).not.toHaveAttribute('open');
  });

  test(`colored courses stay distinct and date popovers never cover their anchor at ${width}px`, async ({page}, testInfo) => {
    await page.setViewportSize({width, height: 960});
    await installFixture(page);
    await page.goto('/advisor/students/301/courses');
    await expect(sectionTrigger(page, courses[2].title)).toBeVisible();
    await expect(page.locator('details[open]')).toHaveCount(0);
    // Identity colour lives in the leading mark tile; card surfaces stay neutral.
    const tones = await Promise.all(courses.map(course => sectionTrigger(page, course.title).locator('> span').first().evaluate(element => getComputedStyle(element).backgroundColor)));
    expect(new Set(tones).size).toBe(3);
    await page.screenshot({path: testInfo.outputPath(`course-cards-${width}.png`), fullPage: true});
    await openSection(page, courses[1].title);
    await page.getByRole('button', {name: 'Edit schedule'}).click();
    await expect(sectionTrigger(page, 'Update a one-to-one course').locator('..')).toHaveAttribute('open', '');
    await sectionTrigger(page, 'Update a one-to-one course').click();
    await page.getByRole('button', {name: 'Edit schedule'}).click();
    await expect(sectionTrigger(page, 'Update a one-to-one course').locator('..')).toHaveAttribute('open', '');
    await sectionTrigger(page, 'Update a one-to-one course').click();
    await openSection(page, 'Create a one-to-one course');
    const input = page.getByLabel('Term start', {exact: true});
    await input.scrollIntoViewIfNeeded();
    await input.click();
    const popup = page.getByRole('dialog', {name: 'Select date', exact: true});
    await expect(popup).toBeVisible();
    const anchorBox = await input.boundingBox();
    const popupBox = await popup.boundingBox();
    if (!anchorBox || !popupBox) throw new Error('Date field and calendar must have layout boxes');
    expect(popupBox.x >= anchorBox.x + anchorBox.width || popupBox.y >= anchorBox.y + anchorBox.height || popupBox.y + popupBox.height <= anchorBox.y).toBe(true);
    expect(popupBox.x).toBeGreaterThanOrEqual(0);
    expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(width);
    expect(popupBox.y).toBeGreaterThanOrEqual(0);
    expect(popupBox.y + popupBox.height).toBeLessThanOrEqual(960);
    const cancelBox = await popup.getByRole('button', {name: 'Cancel', exact: true}).boundingBox();
    if (!cancelBox) throw new Error('Calendar dismissal must remain reachable');
    expect(cancelBox.y + cancelBox.height).toBeLessThanOrEqual(popupBox.y + popupBox.height);
    await page.screenshot({path: testInfo.outputPath(`calendar-position-${width}.png`)});
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    await expect(input).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('a collapsed intake reveals required fields on native form validation', async ({page}) => {
  await installFixture(page, 'COUNSELLOR');
  await page.goto('/counsellor/intakes/new');
  await expect(sectionTrigger(page, 'Student identity')).toBeVisible();
  await expect(page.locator('details[open]')).toHaveCount(0);
  await page.getByRole('button', {name: 'Create intake', exact: true}).click();
  await expect(page.getByLabel('First name *')).toBeFocused();
  await expect(sectionTrigger(page, 'Learning context').locator('..')).toHaveAttribute('open', '');
});
