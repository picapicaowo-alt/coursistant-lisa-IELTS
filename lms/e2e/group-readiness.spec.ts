import {expect, test} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

const member = {groupId: 81, userId: 401, userFirstName: 'Mei', userMiddleName: 'An', userLastName: 'Lin', joinedAt: '2026-09-05T07:13:00', addedByType: 'Self', addedByUserId: 401};
const groups = [
  {id: 81, groupSetId: 91, name: 'Writing A', capacity: 3, capacityOverride: null, memberCount: 1, members: [member]},
  {id: 82, groupSetId: 91, name: 'Writing B', capacity: 3, capacityOverride: null, memberCount: 0, members: []},
];
const groupSet = {id: 91, courseId: 71, name: 'Writing groups', defaultCapacity: 3, locked: false, openForSelfService: true, timezone: 'Asia/Shanghai', groups, myGroup: null};

for (const [locale, move, retry, error] of [
  ['en', 'Move Mei An Lin', 'Retry', 'Ungrouped students could not be loaded.'],
  ['zh-CN', '移动 Mei An Lin', '重试', '暂时无法加载未分组学生。'],
  ['zh-TW', '移動 Mei An Lin', '重試', '暫時無法載入未分組學生。'],
] as const) {
  test(`group names and failed roster recovery preserve identities in ${locale}`, async ({page}) => {
    await fixture(page, 'INSTRUCTOR', 'Instructor');
    await page.addInitScript(locale => localStorage.setItem('coursistant.locale', locale), locale);
    await page.route('**/v2/courses/71/group-sets/91', route => route.fulfill({json: reply(groupSet)}));
    let failed = true;
    await page.route('**/v2/courses/71/group-sets/91/ungrouped-students', route => route.fulfill(failed
      ? {status: 503, json: {code: 'SERVICE_UNAVAILABLE'}}
      : {json: reply([{userId: 402, studentFirstName: 'Kai', studentLastName: 'Zhou'}])}));
    const writes: unknown[] = [];
    await page.route('**/v2/courses/71/group-sets/91/members/401/move', route => {
      writes.push(route.request().postDataJSON());
      return route.fulfill({json: reply(null)});
    });
    await page.goto('/course/71/group-sets/91');
    await expect(page.getByText('Mei An Lin', {exact: true})).toBeVisible();
    await expect(page.getByRole('combobox', {name: move, exact: true})).toBeVisible();
    await expect(page.getByText('User 401', {exact: true})).toHaveCount(0);
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(error);
    await expect(page.getByText(/0 students currently ungrouped|有 0 名学生尚未分组|有 0 名學生尚未分組/)).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Distribute randomly', exact: true})).toBeDisabled();
    failed = false;
    await alert.getByRole('button', {name: retry, exact: true}).click();
    await expect(page.getByRole('combobox', {name: 'Student', exact: true}).getByRole('option', {name: 'Kai Zhou', exact: true})).toHaveAttribute('value', '402');
    await page.getByRole('combobox', {name: move, exact: true}).selectOption('82');
    await expect(page.getByRole('alertdialog')).toContainText('Mei An Lin');
    await page.getByRole('alertdialog').getByRole('button', {name: 'Confirm', exact: true}).click();
    await expect.poll(() => writes).toEqual([{targetGroupId: 82, confirmCapacityOverfill: true, confirmAcademicImpact: true}]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('combobox', {name: move, exact: true})).toBeVisible();
  });
}

test('group rename prevents another save while the original request is pending', async ({page}) => {
  await fixture(page, 'INSTRUCTOR', 'Instructor');
  let finish: (() => void) | undefined;
  const pending = new Promise<void>(resolve => {finish = resolve;});
  let writes = 0;
  await page.route('**/v2/courses/71/group-sets/91', route => route.fulfill({json: reply(groupSet)}));
  await page.route('**/v2/courses/71/group-sets/91/groups/81', async route => {
    writes += 1;
    await pending;
    await route.fulfill({json: reply({...groups[0], name: 'Edited group'})});
  });
  await page.goto('/course/71/group-sets/91');
  const card = page.getByRole('article').filter({has: page.getByRole('heading', {name: 'Writing A', exact: true})});
  await card.getByRole('button', {name: 'Edit', exact: true}).click();
  await card.getByRole('textbox', {name: 'Name', exact: true}).fill('Edited group');
  await card.getByRole('button', {name: 'Save', exact: true}).click();
  await expect.poll(() => writes).toBe(1);
  await expect(card.getByRole('button', {name: 'Saving…', exact: true})).toBeDisabled();
  await expect(card.getByRole('button', {name: 'Cancel', exact: true})).toBeDisabled();
  finish?.();
  await expect(card.getByRole('textbox', {name: 'Name', exact: true})).toHaveCount(0);
  expect(writes).toBe(1);
});
