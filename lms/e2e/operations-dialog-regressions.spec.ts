import {expect, test, type Locator, type Page} from '@playwright/test';
import {fixture, reply, course} from './workspace-fixtures';

async function fits(dialog: Locator, width: number, height: number) {
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(height);
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
}

async function enrollmentFixture(page: Page) {
  await fixture(page, 'ADVISOR');
  const enrolled = {courseId: 71, title: 'Academic Writing Studio', deliveryMode: 'GROUP', status: 'ACTIVE', courseLinkVersion: 3, completionVersion: 2};
  await page.route('**/v2/advisor/students/301/study-plan', route => route.fulfill({json: reply({plan: {studyPlanVersion: 4}})}));
  await page.route('**/v2/advisor/students/301/courses', route => route.fulfill({json: reply([enrolled])}));
}

for (const width of [1440, 390, 320]) {
  test(`enrollment opens a contained modal with a usable reason at ${width}px`, async ({page}, info) => {
    const height = width === 320 ? 568 : 900;
    await page.setViewportSize({width, height});
    await enrollmentFixture(page);
    await page.goto('/advisor/students/301/courses');
    const trigger = page.getByRole('button', {name: 'Manage enrollment'});
    await expect(page.getByLabel('Reason for withdrawal')).toHaveCount(0);
    await trigger.click();
    const dialog = page.getByRole('dialog', {name: 'Manage enrollment'});
    await expect(dialog).toBeVisible();
    await fits(dialog, width, height);
    const reason = dialog.getByLabel('Reason for withdrawal');
    await expect(dialog.getByRole('button', {name: 'Withdraw', exact: true})).toBeDisabled();
    await reason.fill('Schedule conflict');
    await expect(reason).toHaveValue('Schedule conflict');
    const box = await reason.boundingBox();
    expect(box!.width).toBeGreaterThan(220);
    expect(box!.height).toBeGreaterThan(80);
    await dialog.getByRole('button', {name: 'Withdraw', exact: true}).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('button', {name: 'Withdraw', exact: true})).toBeInViewport();
    await page.screenshot({path: info.outputPath(`enrollment-${width}.png`)});
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test(`counsellor create uses the shared intake modal at ${width}px`, async ({page}, info) => {
    const height = width === 320 ? 568 : 900;
    await page.setViewportSize({width, height});
    await fixture(page, 'COUNSELLOR');
    await page.route('**/v2/counsellor/student-intakes?*', route => route.fulfill({json: reply({items: [], total: 0})}));
    await page.goto('/counsellor/intakes');
    await page.getByRole('link', {name: 'Create student', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Create student intake'});
    await expect(dialog).toBeVisible();
    await fits(dialog, width, height);
    await dialog.getByLabel('First name').fill('Alex');
    await dialog.getByLabel('Last name').fill('Example');
    await dialog.getByLabel('Email').fill('alex@example.test');
    await dialog.getByLabel('Course request').fill('Writing practice');
    await expect(dialog.getByRole('button', {name: 'Create intake', exact: true})).toBeInViewport();
    await page.screenshot({path: info.outputPath(`intake-${width}.png`)});
    await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
    await expect(page).toHaveURL(/\/counsellor\/intakes$/);
    await expect(dialog).toHaveCount(0);
  });
}

test('withdrawal preserves the reason and idempotency key after failure', async ({page}) => {
  await enrollmentFixture(page);
  const writes: Array<{body: unknown; key?: string}> = [];
  await page.route('**/v2/advisor/students/301/courses/71/withdraw', route => {
    writes.push({body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']});
    return writes.length === 1
      ? route.fulfill({status: 500, json: {code: 'INTERNAL_SERVER_ERROR', message: 'Retry later'}})
      : route.fulfill({json: reply({courseId: 71, status: 'WITHDRAWN'})});
  });
  await page.goto('/advisor/students/301/courses');
  await page.getByRole('button', {name: 'Manage enrollment'}).click();
  const dialog = page.getByRole('dialog', {name: 'Manage enrollment'});
  await dialog.getByLabel('Reason for withdrawal').fill('  Schedule conflict  ');
  await dialog.getByRole('button', {name: 'Withdraw', exact: true}).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Reason for withdrawal')).toHaveValue('  Schedule conflict  ');
  await dialog.getByRole('button', {name: 'Withdraw', exact: true}).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(2);
  expect(writes[0].body).toEqual({expectedCourseLinkVersion: 3, reason: 'Schedule conflict'});
  expect(writes[0].key).toBeTruthy();
  expect(writes[1]).toEqual(writes[0]);
});

test('enrollment conflict requires an explicit reload and preserves the reason', async ({page}) => {
  await enrollmentFixture(page);
  let version = 3;
  const writes: Array<{body: unknown; key?: string}> = [];
  await page.route('**/v2/advisor/students/301/courses', route => route.fulfill({json: reply([{courseId: 71, title: 'Academic Writing Studio', deliveryMode: 'GROUP', courseLinkVersion: version}])}));
  await page.route('**/v2/advisor/students/301/courses/71/withdraw', route => {
    writes.push({body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']});
    version = 5;
    return writes.length === 1 ? route.fulfill({status: 409, json: {code: 'COURSE_LINK_VERSION_CONFLICT', message: 'Version changed'}}) : route.fulfill({json: reply({courseId: 71})});
  });
  await page.goto('/advisor/students/301/courses');
  await page.getByRole('button', {name: 'Manage enrollment'}).click();
  const dialog = page.getByRole('dialog', {name: 'Manage enrollment'});
  await dialog.getByLabel('Reason for withdrawal').fill('Keep this reason');
  await dialog.getByRole('button', {name: 'Withdraw', exact: true}).click();
  await expect(dialog.getByRole('button', {name: 'Load latest planning records'})).toBeVisible();
  await expect(dialog.getByRole('button', {name: 'Withdraw', exact: true})).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name: 'Manage enrollment'}).click();
  await dialog.getByLabel('Reason for withdrawal').fill('Keep this reason');
  await expect(dialog.getByRole('button', {name: 'Withdraw', exact: true})).toBeDisabled();
  await dialog.getByRole('button', {name: 'Load latest planning records'}).click();
  await expect(dialog.getByLabel('Reason for withdrawal')).toHaveValue('Keep this reason');
  await dialog.getByRole('button', {name: 'Withdraw', exact: true}).click();
  await expect(dialog).toHaveCount(0);
  expect(writes.map(write => write.body)).toEqual([{expectedCourseLinkVersion: 3, reason: 'Keep this reason'}, {expectedCourseLinkVersion: 5, reason: 'Keep this reason'}]);
  expect(writes[1].key).not.toEqual(writes[0].key);
});

test('counsellor creation retains its API, pending lock and retry key', async ({page}) => {
  await fixture(page, 'COUNSELLOR');
  await page.route('**/v2/counsellor/student-intakes?*', route => route.fulfill({json: reply({items: [], total: 0})}));
  const writes: Array<{body: unknown; key?: string}> = [];
  let respond: () => void = () => {};
  const pending = new Promise<void>(resolve => {respond = resolve;});
  await page.route('**/v2/counsellor/student-intakes', async route => {
    writes.push({body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']});
    if (writes.length === 1) {await pending; return route.fulfill({status: 500, json: {code: 'INTERNAL_SERVER_ERROR', message: 'Retry later'}});}
    return route.fulfill({json: reply({intakeId: 7})});
  });
  await page.route('**/v2/counsellor/student-intakes/7', route => route.fulfill({json: reply({intakeId: 7, intakeVersion: 1, firstName: 'Alex', lastName: 'Example', email: 'alex@example.test', studentType: 'STANDARD', courseRequest: 'Writing'})}));
  await page.goto('/counsellor/intakes/new');
  const dialog = page.getByRole('dialog', {name: 'Create student intake'});
  await dialog.getByLabel('First name').fill('Alex');
  await dialog.getByLabel('Last name').fill('Example');
  await dialog.getByLabel('Email').fill('alex@example.test');
  await dialog.getByLabel('Course request').fill('Writing');
  await dialog.getByRole('button', {name: 'Create intake', exact: true}).click();
  try {
    await expect.poll(() => writes.length).toBe(1);
    await expect(dialog.getByRole('button', {name: 'Cancel', exact: true})).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
  } finally {respond();}
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('First name')).toHaveValue('Alex');
  await dialog.getByRole('button', {name: 'Create intake', exact: true}).click();
  await expect(page).toHaveURL(/\/counsellor\/intakes\/7$/);
  expect(writes).toHaveLength(2);
  expect(writes[0].body).toEqual({firstName: 'Alex', lastName: 'Example', email: 'alex@example.test', studentType: 'STANDARD', courseRequest: 'Writing'});
  expect(writes[0].key).toBeTruthy();
  expect(writes[1]).toEqual(writes[0]);
});

test('owner picker keeps radio, identity and role in one row inside an owner form', async ({page}, info) => {
  await fixture(page, 'STANDARD', 'Student', 'TENANT_ADMIN');
  const ownership = {courseId: 71, courseCode: 'WR101', title: 'Academic Writing', ownershipVersion: 2};
  await page.route('**/v2/tenant/course-ownerships**', route => route.fulfill({json: reply({items: [ownership], total: 1})}));
  await page.route('**/v2/tenant/courses/71/owner', route => route.fulfill({json: reply(ownership)}));
  await page.route('**/v2/tenant/users?*', route => route.fulfill({json: reply({items: [{id: 51, firstName: 'Daniel', lastName: 'Example', email: 'daniel@example.test', level: 'ADVISOR', role: 'USER', status: 'ACTIVE'}], total: 1})}));
  await page.goto('/admin?section=ownership');
  await page.getByRole('button', {name: 'Transfer owner of Academic Writing'}).click();
  await page.getByRole('button', {name: 'Choose eligible advisor'}).click();
  const dialog = page.getByRole('dialog', {name: 'Choose a new course owner'});
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('dialog', {name: 'Transfer owner', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Choose eligible advisor'}).click();
  for (const width of [1440, 390, 320]) {
    const height = width === 320 ? 568 : 900;
    await page.setViewportSize({width, height});
    await fits(dialog, width, height);
    const row = dialog.locator('label').filter({hasText: 'Daniel Example'});
    await row.click();
    const radio = await row.getByRole('radio').boundingBox();
    const identity = await row.locator('span').boundingBox();
    const role = await row.locator('em').boundingBox();
    expect(radio!.x + radio!.width).toBeLessThan(identity!.x);
    expect(identity!.x + identity!.width).toBeLessThan(role!.x);
    expect(Math.abs(radio!.y + radio!.height / 2 - (role!.y + role!.height / 2))).toBeLessThan(2);
    await expect(dialog.getByRole('button', {name: 'Use selected person'})).toBeInViewport();
    await page.screenshot({path: info.outputPath(`picker-${width}.png`)});
  }
  await dialog.getByRole('button', {name: 'Search', exact: true}).click();
  await dialog.getByRole('button', {name: 'Use selected person'}).click();
  await expect(page.getByRole('button', {name: 'Review transfer'})).toBeVisible();
});

test('course readiness fraction remains centered within its circle', async ({page}) => {
  await fixture(page, 'ADVISOR');
  await page.route('**/v2/courses/71', route => route.fulfill({json: reply(course)}));
  await page.route('**/v2/advisor/courses/71/delivery-config', route => route.fulfill({json: reply({courseId: 71, deliveryMode: 'GROUP', catalogCode: 'WR101', capacity: 16, launchState: 'READY', courseLaunchVersion: 2, blockers: []})}));
  await page.route('**/v2/courses/71/sessions', route => route.fulfill({json: reply([{id: 31, type: 'Lecture', dayOfWeek: 'MON', startTime: '10:00:00', endTime: '11:00:00'}])}));
  await page.goto('/advisor/courses/71/delivery?view=delivery');
  const mark = page.getByText('4/4', {exact: true});
  await expect(mark).toBeVisible();
  const center = await mark.evaluate(node => {
    const circle = node.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(node);
    const text = range.getBoundingClientRect();
    return {x: Math.abs(circle.x + circle.width / 2 - text.x - text.width / 2), y: Math.abs(circle.y + circle.height / 2 - text.y - text.height / 2)};
  });
  expect(center.x).toBeLessThan(2);
  expect(center.y).toBeLessThan(3);
});
