import {expect, test, type Page} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

async function counsellor(page: Page) {
  await fixture(page, 'COUNSELLOR');
  let intake = {intakeId: 7, studentUserId: 301, intakeVersion: 2, firstName: 'Alex', middleName: '', lastName: 'Chen', email: 'alex@example.test', studentType: 'STANDARD', courseRequest: 'Writing practice', contactPhone: '', basicBackground: ''};
  const writes: Array<{path: string; body: Record<string, unknown>}> = [];
  await page.route('**/v2/counsellor/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      writes.push({path, body});
      intake = {...intake, ...body, intakeVersion: intake.intakeVersion + 1};
      return route.fulfill({json: reply(intake)});
    }
    if (path.endsWith('/advisors')) return route.fulfill({json: reply({items: [
      {advisorUserId: 51, firstName: 'Ari', lastName: 'Advisor', email: 'ari@example.test', level: 'ADVISOR'},
      {advisorUserId: 52, firstName: 'Indigo', lastName: 'Williams', email: 'indigo.williams.with.a.long.address@example.test', level: 'INSTRUCTOR_ADVISOR'},
    ], total: 2, page: 0, size: 100})});
    if (path.endsWith('/student-intakes')) return route.fulfill({json: reply({items: [intake], total: 1, page: 0, size: 20})});
    if (path.endsWith('/parent-links')) return route.fulfill({json: reply([])});
    return route.fulfill({json: reply(intake)});
  });
  return writes;
}

test('queue actions have separate targets; advisor identity, avatar and selection stay aligned', async ({page}, info) => {
  await counsellor(page);
  await page.goto('/counsellor/intakes');
  const edit = page.getByRole('link', {name: 'Edit', exact: true});
  const assign = page.getByRole('link', {name: 'Assign advisor', exact: true});
  const editBox = await edit.boundingBox();
  const assignBox = await assign.boundingBox();
  expect(editBox!.height).toBeGreaterThanOrEqual(44);
  expect(assignBox!.x - editBox!.x - editBox!.width).toBeGreaterThanOrEqual(12);
  await assign.click();
  for (const viewport of [{width: 1440, height: 900}, {width: 390, height: 844}, {width: 320, height: 568}, {width: 844, height: 390}]) {
    await page.setViewportSize(viewport);
    const row = page.getByRole('group', {name: 'Choose an advisor'}).locator('label').first();
    await row.click();
    const radio = await row.getByRole('radio').boundingBox();
    const avatar = await row.locator('svg').boundingBox();
    const name = await row.locator('strong').boundingBox();
    expect(avatar!.x + avatar!.width).toBeLessThan(name!.x);
    expect(name!.x + name!.width).toBeLessThan(radio!.x);
    expect(Math.abs(radio!.y + radio!.height / 2 - avatar!.y - avatar!.height / 2)).toBeLessThan(2);
    expect(radio!.width).toBeLessThanOrEqual(20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: info.outputPath(`advisors-${viewport.width}.png`)});
  }
  await page.getByRole('searchbox', {name: 'Search advisors by name or email'}).fill('Indigo');
  await expect(page.getByRole('radio')).toHaveCount(1);
  await page.getByRole('button', {name: 'Clear advisor search'}).click();
  await expect(page.getByRole('radio')).toHaveCount(2);
});

test('save stays on the form; the primary next step saves dirty data before navigating', async ({page}, info) => {
  const writes = await counsellor(page);
  await page.goto('/counsellor/intakes/7');
  const save = page.getByRole('button', {name: 'Save changes', exact: true});
  await expect(save).toBeDisabled();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({width, height: 900});
    const next = page.getByRole('link', {name: 'Continue to advisor assignment'});
    await next.scrollIntoViewIfNeeded();
    const a = await save.boundingBox(); const b = await next.boundingBox();
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
    expect(b!.x - a!.x - a!.width).toBeGreaterThanOrEqual(12);
    expect(await next.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(72, 53, 235)');
    await page.screenshot({path: info.outputPath(`intake-actions-${width}.png`)});
  }
  await page.getByLabel('Course request *').fill('Revised writing practice');
  await save.click();
  await expect(page).toHaveURL(/\/counsellor\/intakes\/7$/);
  await expect(page.getByRole('status').filter({hasText: 'Changes saved.'})).toBeVisible();
  expect(writes[0].body).toEqual({expectedIntakeVersion: 2, courseRequest: 'Revised writing practice'});
  await page.getByLabel('Course request *').fill('Writing and speaking');
  await page.getByRole('button', {name: 'Save and continue to advisor assignment'}).click();
  await expect(page).toHaveURL(/\/counsellor\/intakes\/7\/assign$/);
  expect(writes[1].body).toEqual({expectedIntakeVersion: 3, courseRequest: 'Writing and speaking'});
});

test('instructor combobox searches, selects with keys, clears and dismisses without closing its dialog', async ({page}, info) => {
  await fixture(page, 'ADVISOR');
  const queries: string[] = [];
  await page.route('**/v2/advisor/instructors?*', route => {
    const q = new URL(route.request().url()).searchParams.get('q') ?? '';
    queries.push(q);
    return route.fulfill({json: reply({items: q === 'nobody' ? [] : [{instructorUserId: 51, firstName: 'Sophie', lastName: 'Grant', email: 'sophie@example.test'}], total: q === 'nobody' ? 0 : 1, page: 0, size: 20})});
  });
  await page.goto('/advisor/courses');
  await page.getByRole('button', {name: 'Create course', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Create group course'});
  const input = dialog.getByRole('combobox', {name: 'Instructor', exact: true});
  await input.fill('Soph');
  await expect(dialog.getByRole('option', {name: /Sophie Grant/})).toBeVisible();
  expect(queries).toContain('Soph');
  await page.screenshot({path: info.outputPath('instructor-dropdown.png')});
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(input).toHaveValue('Sophie Grant');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await dialog.getByRole('button', {name: 'Clear instructor'}).click();
  await expect(input).toHaveValue('');
  await input.fill('nobody');
  await expect(dialog.getByText('No matching people.')).toBeVisible();
  await input.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await input.click();
  await dialog.getByLabel('Course code', {exact: true}).click();
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
  await expect(dialog).toHaveCount(0);
});

test('instructor results preserve pagination, errors and the selected identity across query changes', async ({page}) => {
  await fixture(page, 'ADVISOR');
  let fail = true;
  await page.route('**/v2/advisor/instructors?*', route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('q') === 'fail' && fail) return route.fulfill({status: 403, json: {code: 'ACCESS_DENIED', message: 'Instructor directory unavailable'}});
    const next = url.searchParams.get('page') === '1';
    return route.fulfill({json: reply({items: [{instructorUserId: next ? 52 : 51, firstName: next ? 'Jordan' : 'Sophie', lastName: next ? 'Lee' : 'Grant', email: next ? 'jordan@example.test' : 'sophie@example.test'}], total: 21, page: next ? 1 : 0, size: 20})});
  });
  await page.goto('/advisor/courses');
  await page.getByRole('button', {name: 'Create course', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Create group course'});
  const input = dialog.getByRole('combobox', {name: 'Instructor', exact: true});
  await input.fill('fail');
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByText('No matching people.')).toHaveCount(0);
  fail = false;
  await dialog.getByRole('button', {name: 'Try again'}).click();
  await expect(dialog.getByRole('option', {name: /Sophie Grant/})).toBeVisible();
  await dialog.getByRole('navigation', {name: 'Instructor pages'}).getByRole('button', {name: 'Next'}).click();
  await dialog.getByRole('option', {name: /Jordan Lee/}).click();
  await expect(input).toHaveValue('Jordan Lee');
  await input.click();
  await expect(dialog.getByRole('option', {name: /Sophie Grant/})).toBeVisible();
  await dialog.getByLabel('Course code', {exact: true}).click();
  await expect(input).toHaveValue('Jordan Lee');
  await input.fill('unselected text');
  expect(await input.evaluate(node => (node as HTMLInputElement).checkValidity())).toBe(false);
  await dialog.getByLabel('Course code', {exact: true}).fill('WR101');
  await dialog.getByLabel('Course title', {exact: true}).fill('Academic Writing');
  await dialog.getByLabel('Term start', {exact: true}).fill('09/01/2030');
  await dialog.getByLabel('Term end', {exact: true}).fill('12/01/2030');
  await expect(dialog.getByRole('button', {name: 'Create group course', exact: true})).toBeDisabled();
});

test('TA permissions reuse the modal focus and small-screen behavior', async ({page}) => {
  await fixture(page, 'INSTRUCTOR', 'Instructor');
  await page.route('**/v2/courses/71/members?*', route => route.fulfill({json: reply({items: [{id: 1, courseId: 71, userId: 51, userName: 'Taylor Assistant', userEmail: 'taylor@example.test', courseRole: 'TA', active: true, canGrade: true}], total: 1, page: 0, size: 20})}));
  await page.goto('/roster/71');
  const trigger = page.getByRole('button', {name: 'Permissions', exact: true});
  await trigger.click();
  const dialog = page.getByRole('dialog', {name: 'TA permissions'});
  const close = dialog.getByRole('button', {name: 'Close dialog'});
  await close.focus();
  await close.press('Tab');
  await expect(dialog.getByRole('checkbox').first()).toBeFocused();
  await trigger.evaluate(node => (node as HTMLElement).focus());
  await expect(dialog.getByRole('checkbox').first()).toBeFocused();
  await page.setViewportSize({width: 320, height: 568});
  await dialog.getByRole('button', {name: 'Save permissions'}).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', {name: 'Save permissions'})).toBeInViewport();
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
