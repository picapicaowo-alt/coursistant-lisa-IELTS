import {expect, test} from '@playwright/test';
import {course, fixture, material, reply} from './workspace-fixtures';

for (const status of [403, 404]) {
  test(`roster treats ${status} as unavailable and hides membership actions`, async ({page}) => {
    await fixture(page, 'INSTRUCTOR', 'Instructor');
    let reads = 0;
    await page.route('**/v2/courses/71/members?*', route => {
      reads += 1;
      return route.fulfill({status, json: {code: status === 403 ? 'ACCESS_DENIED' : 'COURSE_NOT_FOUND'}});
    });
    await page.goto('/roster/71');
    await expect(page.getByRole('alert')).toContainText(status === 403 ? 'permission' : 'does not exist');
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByRole('button', {name: /^TA$|Make TA|Withdraw|Permissions|Enrol/})).toHaveCount(0);
    expect(reads).toBe(1);
  });
}

test('inactive Instructor enrollment cannot open the roster or upload materials', async ({page}) => {
  await fixture(page, 'INSTRUCTOR', 'Instructor');
  await page.route('**/v2/me/courses?*', route => route.fulfill({json: reply({items: [{...course, courseRole: 'Instructor', role: 'Instructor', active: false}], total: 1})}));
  let memberReads = 0;
  await page.route('**/v2/courses/71/members?*', route => {memberReads++; return route.fulfill({json: reply({items: [], total: 0})});});
  await page.goto('/roster/71');
  await expect(page).toHaveURL(/\/course\/71$/);
  expect(memberReads).toBe(0);
  await expect(page.getByRole('button', {name: /Upload files|Manage materials|Add materials/})).toHaveCount(0);
});

test('Instructor uploads files and links with browser multipart boundaries without material-management grants', async ({page}) => {
  await fixture(page, 'INSTRUCTOR', 'Instructor');
  await page.route('**/v2/me/courses?*', route => route.fulfill({json: reply({items: [{...course, courseRole: 'Instructor', role: 'Instructor', active: true}], total: 1})}));
  let materials = [{...material, uploadedBy: 999, publicationState: 'DRAFT'}];
  await page.route('**/v2/courses/71/weeks', route => route.fulfill({json: reply([{id: 81, title: 'Building an argument', state: 'Published', materials}])}));
  const writes: {body: string; contentType: string; key: string}[] = [];
  await page.route('**/v2/courses/71/weeks/81/materials', route => {
    const req = route.request();
    writes.push({body: req.postData() ?? '', contentType: req.headers()['content-type'], key: req.headers()['idempotency-key']});
    const next = {...material, id: 122 + writes.length, displayName: `Uploaded item ${writes.length}`, uploadedBy: 301, publicationState: 'DRAFT'};
    materials = [...materials, next];
    return route.fulfill({json: reply([next])});
  });
  await page.goto('/course/71');
  await page.getByRole('button', {name: 'Manage materials', exact: true}).click();
  const editor = page.locator('[data-material-editor]');
  await expect(editor.getByRole('button', {name: /Publish|Unpublish|Rename|Move |Delete Academic/})).toHaveCount(0);
  await editor.locator('input[type=file]').setInputFiles({name: 'contract-check.txt', mimeType: 'text/plain', buffer: Buffer.from('contract test')});
  await expect.poll(() => writes.length).toBe(1);
  await expect(editor.getByRole('listitem').filter({hasText: 'Uploaded item 1'})).toBeVisible();
  await editor.getByText('Add external link', {exact: true}).first().click();
  await editor.getByRole('textbox', {name: 'Link URL', exact: true}).fill('https://example.test/resource');
  await editor.getByRole('textbox', {name: 'Link display name'}).fill('Reference link');
  await editor.getByRole('button', {name: 'Add link', exact: true}).click();
  await expect.poll(() => writes.length).toBe(2);
  await expect(editor.getByRole('listitem').filter({hasText: 'Uploaded item 2'})).toBeVisible();
  for (const write of writes) {
    expect(write.contentType).toMatch(/^multipart\/form-data; boundary=.+/);
    expect(write.key).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  }
  expect(writes[0].body).toContain('name="files"');
  expect(writes[0].body).toContain('filename="contract-check.txt"');
  expect(writes[1].body).toContain('name="linkUrl"');
  expect(writes[1].body).toContain('name="linkDisplayName"');
  expect(writes[1].key).not.toBe(writes[0].key);
  let denied = true;
  const deleted: number[] = [];
  await page.route('**/v2/courses/71/weeks/81/materials/*', route => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1));
    if (denied) return route.fulfill({status: 403, json: {code: 'FORBIDDEN'}});
    deleted.push(id); materials = materials.filter(item => item.id !== id);
    return route.fulfill({json: reply(null)});
  });
  await editor.getByRole('listitem').filter({hasText: 'Uploaded item 1'}).locator('summary').click();
  await editor.getByRole('button', {name: 'Delete Uploaded item 1', exact: true}).click();
  await editor.getByRole('button', {name: 'Confirm', exact: true}).click();
  await expect(editor.getByRole('alert')).toContainText('You do not have permission to delete this material.');
  await expect(editor.getByRole('listitem').filter({hasText: 'Uploaded item 1'})).toBeVisible();
  denied = false;
  await editor.getByRole('button', {name: 'Confirm', exact: true}).click();
  await expect(editor.getByRole('listitem').filter({hasText: 'Uploaded item 1'})).toHaveCount(0);
  await editor.getByRole('listitem').filter({hasText: 'Uploaded item 2'}).locator('summary').click();
  await editor.getByRole('button', {name: 'Delete Uploaded item 2', exact: true}).click();
  await editor.getByRole('button', {name: 'Confirm', exact: true}).click();
  await expect(editor.getByRole('listitem').filter({hasText: 'Uploaded item 2'})).toHaveCount(0);
  expect(deleted).toEqual([123, 124]);
  await expect(editor.getByRole('listitem').filter({hasText: 'Academic writing guide'})).toBeVisible();

});
