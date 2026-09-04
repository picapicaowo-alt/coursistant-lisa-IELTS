import {expect, test, type Page} from '@playwright/test';
import path from 'node:path';

import {reply, course, material, ownProfile, tasks, fixture} from './workspace-fixtures';
async function capture(page: Page, outputPath: (name: string) => string, name: string) {
  for (const width of [390, 1440]) {
    await page.setViewportSize({width, height: 1000});
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path: outputPath(`${name}-${width}.png`), fullPage: true});
  }
}

test('course cards and material reader preserve real progress and discussion writes', async ({page}, info) => {
  await fixture(page);
  await page.route('**/v2/courses/71/assignments/summaries', route => route.fulfill({json: reply([{id: 111, title: 'Timed essay', learningType: 'PRACTICE', submissionType: 'Individual', dueAtLocal: '2026-09-10T10:00:00', timezone: 'UTC'}, {id: 112, title: 'Read and reflect', learningType: 'PRE_CLASS', submissionType: 'Individual', dueAtLocal: '2026-09-11T10:00:00', timezone: 'UTC'}])}));
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
  await page.getByRole('button', {name: 'Assignments', exact: true}).click();
  await page.getByLabel('Learning type').selectOption('PRACTICE');
  await expect(page.getByRole('link', {name: /Timed essay/})).toBeVisible();
  await expect(page.getByRole('link', {name: /Read and reflect/})).toHaveCount(0);
  await page.getByRole('button', {name: 'Courses', exact: true}).click();
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

test('student has no unsupported AI entry or direct route', async ({page}, info) => {
  await fixture(page);
  await page.goto('/aibot?courseId=71');
  await expect(page).not.toHaveURL(/\/aibot/);
  await expect(page.getByRole('textbox', {name: 'Ask Study Support'})).toHaveCount(0);
  await expect(page.getByRole('link', {name: 'AI ChatBot'})).toHaveCount(0);
  await capture(page, info.outputPath.bind(info), 'student-dashboard');
});
