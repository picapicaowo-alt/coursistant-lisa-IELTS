import {expect, test, type Locator, type Page} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

async function setup(page: Page) {
  await fixture(page, 'ADVISOR');
  const reads: string[] = [];
  await page.route('**/v2/advisor/instructors?*', route => {
    reads.push(route.request().url());
    return route.fulfill({json: reply({items: [{instructorUserId: 51, firstName: 'Sarah', lastName: 'Chen'}], total: 1, page: 0, size: 20})});
  });
  await page.goto('/advisor/courses');
  await expect(page.getByRole('button', {name: /Create new course/})).toBeVisible();
  return reads;
}

async function fillCourse(dialog: Locator) {
  await dialog.getByLabel('Course code', {exact: true}).fill('IELTS-2030');
  await dialog.getByLabel('Course title', {exact: true}).fill('Academic Writing');
  await dialog.getByLabel('Term start', {exact: true}).fill('09/01/2030');
  await dialog.getByLabel('Term end', {exact: true}).fill('12/01/2030');
  await dialog.getByRole('combobox', {name: 'Instructor', exact: true}).fill('Sarah');
  await dialog.getByRole('option', {name: /Sarah Chen/}).click();
}

test('both create entry points open a modal and return focus without moving the course list', async ({page}) => {
  const reads = await setup(page);
  const dialog = page.getByRole('dialog', {name: 'Create group course'});
  const trigger = page.getByRole('button', {name: 'Create course', exact: true});
  const card = page.getByRole('button', {name: /Create new course/});
  const initialCard = await card.boundingBox();
  expect(reads).toHaveLength(0);
  await expect(page.getByLabel('Course code', {exact: true})).toHaveCount(0);
  await trigger.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', {name: 'Instructor', exact: true}).click();
  await expect(dialog.getByRole('option', {name: /Sarah Chen/})).toBeVisible();
  await expect(dialog.getByRole('button', {name: 'Create group course', exact: true})).toBeDisabled();
  await dialog.getByRole('button', {name: 'Close dialog'}).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByLabel('Course code', {exact: true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', {name: 'Close dialog'})).toBeFocused();
  // Native modal inertness blocks page controls; browser-chrome focus stays browser-owned.
  await trigger.evaluate(element => { if (element instanceof HTMLElement) element.focus(); });
  await expect(dialog.getByRole('button', {name: 'Close dialog'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await card.boundingBox()).toEqual(initialCard);
  await card.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeFocused();
  await trigger.click();
  await dialog.getByRole('button', {name: 'Close dialog'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

for (const width of [1440, 768, 390, 320]) {
  test(`create course modal reflows and keeps every control reachable at ${width}px`, async ({page}, info) => {
    const height = width === 320 ? 568 : width < 768 ? 844 : 900;
    await page.setViewportSize({width, height});
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await setup(page);
    await page.getByRole('button', {name: 'Create course', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Create group course'});
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(Math.abs(bounds!.x + bounds!.width / 2 - width / 2)).toBeLessThanOrEqual(1);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const code = await dialog.getByLabel('Course code', {exact: true}).boundingBox();
    const title = await dialog.getByLabel('Course title', {exact: true}).boundingBox();
    if (width >= 768) expect(code!.y).toBe(title!.y);
    else expect(title!.y).toBeGreaterThan(code!.y);
    await fillCourse(dialog);
    const submit = dialog.getByRole('button', {name: 'Create group course', exact: true});
    await expect(submit).toBeEnabled();
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport({ratio: 1});
    await dialog.getByRole('button', {name: 'Close dialog'}).scrollIntoViewIfNeeded();
    await page.screenshot({path: info.outputPath(`create-course-${width}.png`), animations: 'disabled'});
    expect(errors).toEqual([]);
  });
}

test('pending creation blocks dismissal and retries preserve the payload and idempotency key', async ({page}) => {
  await setup(page);
  const writes: Array<{body: unknown; key?: string}> = [];
  let respond: () => void = () => {};
  const pending = new Promise<void>(resolve => {respond = resolve;});
  await page.route('**/v2/courses', async route => {
    writes.push({body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']});
    if (writes.length === 1) {
      await pending;
      return route.fulfill({status: 500, json: {code: 'INTERNAL_ERROR', message: 'Temporary failure'}});
    }
    return route.fulfill({json: reply({id: 71})});
  });
  await page.getByRole('button', {name: 'Create course', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Create group course'});
  await fillCourse(dialog);
  await dialog.getByRole('button', {name: 'Create group course', exact: true}).click();
  try {
    await expect.poll(() => writes.length).toBe(1);
    await expect(dialog.getByRole('button', {name: 'Creating…'})).toBeDisabled();
    await expect(dialog.getByRole('button', {name: 'Cancel', exact: true})).toBeDisabled();
    await expect(dialog.getByRole('button', {name: 'Close dialog'})).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await dialog.locator('form').evaluate(form => { if (form instanceof HTMLFormElement) form.requestSubmit(); });
    expect(writes).toHaveLength(1);
  } finally { respond(); }
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Course code', {exact: true})).toHaveValue('IELTS-2030');
  await expect(dialog.getByLabel('Course title', {exact: true})).toHaveValue('Academic Writing');
  await dialog.getByRole('button', {name: 'Create group course', exact: true}).click();
  await expect(page).toHaveURL(/\/advisor\/courses\/71\/delivery\?view=delivery$/);
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(2);
  expect(writes[0].key).toBeTruthy();
  expect(writes[1]).toEqual(writes[0]);
  expect(writes[0].body).toEqual({courseCode: 'IELTS-2030', title: 'Academic Writing', termStartDate: '2030-09-01', termEndDate: '2030-12-01', primaryInstructorUserId: 51});
});

test('date-order validation remains active inside the modal', async ({page}) => {
  await setup(page);
  await page.getByRole('button', {name: 'Create course', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Create group course'});
  await fillCourse(dialog);
  await dialog.getByLabel('Term end', {exact: true}).fill('08/01/2030');
  await expect(dialog.getByRole('button', {name: 'Create group course', exact: true})).toBeDisabled();
  await dialog.getByLabel('Term end', {exact: true}).fill('12/01/2030');
  await expect(dialog.getByRole('button', {name: 'Create group course', exact: true})).toBeEnabled();
});
