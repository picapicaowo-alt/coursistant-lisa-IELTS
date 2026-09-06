# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: backend-fix-adaptation.spec.ts >> C1 reading replaces saved content and advances revision in zh-CN
- Location: e2e/backend-fix-adaptation.spec.ts:26:71

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '检查并保存', exact: true })
    - locator resolved to <button class="_primaryButton_9n1oy_139">检查并保存</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action

```

# Test source

```ts
  1   | import {readFileSync, readdirSync} from 'node:fs';
  2   | import {expect, test, type Page} from '@playwright/test';
  3   | import {createInstance, type Resource, type TOptions} from 'i18next';
  4   | import {fixture, reply} from './workspace-fixtures';
  5   |
  6   | const locales = ['en', 'zh-CN', 'zh-TW'] as const;
  7   | const engine = createInstance();
  8   | const resources: Resource = Object.fromEntries(locales.map(locale => [locale, Object.fromEntries(readdirSync(new URL(`../src/i18n/resources/${locale}/`, import.meta.url)).map(file => [file.slice(0, -5), JSON.parse(readFileSync(new URL(`../src/i18n/resources/${locale}/${file}`, import.meta.url), 'utf8'))]))]));
  9   | test.beforeAll(async () => {await engine.init({resources, lng: 'en', fallbackLng: 'en', interpolation: {escapeValue: false}});});
  10  | const t = (locale: string, key: string, options?: TOptions) => engine.getFixedT(locale)(key, options ?? {});
  11  | async function localeSetup(page: Page, locale: string) {
  12  |   await page.addInitScript(value => localStorage.setItem('coursistant.locale', value), locale);
  13  |   await page.setViewportSize({width: locale === 'zh-TW' ? 390 : 1440, height: 1000});
  14  | }
  15  | async function fits(page: Page) {
  16  |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  17  |   await expect(page.locator('main').last()).not.toContainText(/exams:|learning:|Opaque diagnostic/);
  18  | }
  19  | const group = {id: 999, sortOrder: 7, kind: 'shortAnswer', title: 'Question 9', instruction: 'Answer the question.', questionStart: 9, questionEnd: 9, payload: {questions: [{id: 9, prompt: 'Where?', answer: 'New York'}], metadata: {retain: true}}, imagePreviewUrl: 'response-only'};
  20  | const content = {
  21  |   reading: {totalMinutes: 60, passages: [{id: 100, seq: 3, shortLabel: 'Authored passage', title: 'City', intro: '', paragraphs: ['A city library.'], questions: [group]}]},
  22  |   listening: {totalMinutes: 40, parts: [{id: 101, seq: 2, label: 'Authored part', audioMediaId: 19, audioPreviewUrl: 'response-only', sections: [group]}]},
  23  |   writing: {totalMinutes: 60, tasks: [{id: 102, seq: 2, taskKey: 'essay-b', title: 'Authored task', prompt: 'Discuss libraries.', minWords: 250, imagePreviewUrl: 'response-only'}]},
  24  | };
  25  | for (const locale of locales) {
  26  |   for (const section of ['reading', 'listening', 'writing'] as const) test(`C1 ${section} replaces saved content and advances revision in ${locale}`, async ({page}, info) => {
  27  |     await fixture(page, 'STUDENT', 'Student', 'TENANT_ADMIN');
  28  |     await localeSetup(page, locale);
  29  |     let revision = 0;
  30  |     let authoringReads = 0;
  31  |     const writes: {body: Record<string, unknown>; key?: string}[] = [];
  32  |     const version = {id: 480, versionNo: 1, status: 'DRAFT', hasReading: true, hasListening: true, hasWriting: true};
  33  |     await page.route('**/v2/tenant/mock-exam-templates**', async route => {
  34  |       const request = route.request();
  35  |       const path = new URL(request.url()).pathname;
  36  |       if (path.endsWith('/authoring')) {authoringReads++; return route.fulfill({json: reply({...content[section], id: 400, contentRevision: revision})});}
  37  |       if (request.method() === 'PUT') {
  38  |         const body = request.postDataJSON(); writes.push({body, key: request.headers()['idempotency-key']});
  39  |         revision++; return route.fulfill({json: reply({contentRevision: revision})});
  40  |       }
  41  |       if (path.endsWith('/media')) return route.fulfill({json: reply([{mediaId: 19, kind: 'LISTENING_AUDIO', status: 'UPLOADED', fileName: 'part.mp3'}])});
  42  |       if (path.endsWith('/480')) return route.fulfill({json: reply(version)});
  43  |       return route.fulfill({json: reply({id: 48, title: 'Authored exam', versions: [version]})});
  44  |     });
  45  |     await page.goto(`/mock-exams?template=48&version=480&section=${section}`);
  46  |     const review = () => page.getByRole('button', {name: t(locale, 'exams:authoring.reviewSave'), exact: true});
  47  |     await expect(review()).toBeVisible();
  48  |     // Save twice: the second write must use the revision returned by the first.
  49  |     for (let expectedRevision = 0; expectedRevision < 2; expectedRevision++) {
> 50  |       await review().click();
      |                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  51  |       await page.getByRole('button', {name: t(locale, 'exams:editing.confirmSave'), exact: true}).click();
  52  |       await expect(page.getByText(t(locale, 'exams:editing.saved'), {exact: true})).toBeVisible();
  53  |       await expect(review()).toBeEnabled();
  54  |       expect(writes[expectedRevision].body.expectedContentRevision).toBe(expectedRevision);
  55  |       expect(writes[expectedRevision].key).toBeUndefined();
  56  |       expect(writes[expectedRevision].body).not.toHaveProperty('id');
  57  |       expect(writes[expectedRevision].body).not.toHaveProperty('contentRevision');
  58  |       expect(JSON.stringify(writes[expectedRevision].body)).not.toContain('PreviewUrl');
  59  |     }
  60  |     expect(authoringReads).toBeGreaterThanOrEqual(3);
  61  |     if (section !== 'writing') expect(JSON.stringify(writes[0].body)).toContain('"id":9');
  62  |     else expect(JSON.stringify(writes[0].body)).toContain('"taskKey":"essay-b"');
  63  |     await fits(page);
  64  |     if (locale === 'zh-TW') await page.screenshot({path: info.outputPath(`${section}-traditional-mobile.png`), fullPage: true});
  65  |   });
  66  |
  67  |   test(`C3 file-only completion uses uploaded taskVersion in ${locale}`, async ({page}, info) => {
  68  |     await fixture(page);
  69  |     await localeSetup(page, locale);
  70  |     let version = 7;
  71  |     let submitted = false;
  72  |     let attached: Record<string, unknown> | undefined;
  73  |     const completeBodies: unknown[] = [];
  74  |     await page.route('**/v2/student/study-plan**', async route => {
  75  |       const request = route.request(); const url = new URL(request.url());
  76  |       if (url.pathname.endsWith('/submission-file')) {
  77  |         expect(request.method()).toBe('PUT');
  78  |         expect(url.searchParams.get('expectedVersion')).toBe('7');
  79  |         expect(request.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/);
  80  |         expect(request.postData()).toContain('name="file"');
  81  |         expect(request.postData()).not.toContain('name="fileObjectKey"');
  82  |         version = 8;
  83  |         attached = {taskId: 24, originalName: 'work.pdf', contentType: 'application/pdf', sizeBytes: 4, previewAvailable: true};
  84  |         return route.fulfill({json: reply({...attached, taskVersion: version})});
  85  |       }
  86  |       if (url.pathname.endsWith('/complete')) {
  87  |         completeBodies.push(request.postDataJSON()); submitted = true; version = 9;
  88  |         return route.fulfill({json: reply({id: 24, version, status: 'COMPLETED', submissionFile: attached})});
  89  |       }
  90  |       return route.fulfill({json: reply({studentUserId: 301, profileContext: {}, plan: {checkpoints: [{id: 23, description: 'Authored checkpoint', tasks: [{id: 24, title: 'Authored task', status: submitted ? 'COMPLETED' : 'IN_PROGRESS', version, submissionFile: attached}]}]}})});
  91  |     });
  92  |     await page.goto('/my-plan?checkpoint=23&task=24');
  93  |     const complete = page.getByRole('button', {name: t(locale, 'learning:checkpoint.complete'), exact: true});
  94  |     await expect(complete).toBeDisabled();
  95  |     await page.locator('input[type=file]').setInputFiles({name: 'work.pdf', mimeType: 'application/pdf', buffer: Buffer.from('work')});
  96  |     await expect(page.getByText(t(locale, 'learning:taskFile.attached', {name: 'work.pdf'}), {exact: true})).toBeVisible();
  97  |     await expect(complete).toBeEnabled();
  98  |     await fits(page);
  99  |     if (locale === 'zh-TW') await page.screenshot({path: info.outputPath('task-upload-traditional-mobile.png'), fullPage: true});
  100 |     await complete.click();
  101 |     await expect(complete).toHaveCount(0);
  102 |     expect(completeBodies).toEqual([{expectedVersion: 8}]);
  103 |     await fits(page);
  104 |     if (locale === 'zh-TW') await page.screenshot({path: info.outputPath('task-file-traditional-mobile.png'), fullPage: true});
  105 |   });
  106 |
  107 |   test(`C4 displays all paginated student identities before visiting them in ${locale}`, async ({page}) => {
  108 |     await fixture(page, 'PARENT');
  109 |     await localeSetup(page, locale);
  110 |     const pages: string[] = [];
  111 |     await page.route('**/v2/parent/linked-students**', route => {
  112 |       const current = new URL(route.request().url()).searchParams.get('page') ?? '0'; pages.push(current);
  113 |       return route.fulfill({json: reply({items: [{studentUserId: current === '0' ? 301 : 302, firstName: current === '0' ? 'Alex' : 'Jamie', middleName: null, lastName: 'Lee', email: `student${current}@example.test`, avatarUrl: null, parentFirstName: 'Wrong Parent'}], page: Number(current), size: 1, total: 2})});
  114 |     });
  115 |     await page.goto('/parent');
  116 |     const select = page.getByRole('combobox', {name: t(locale, 'common:roles.STUDENT'), exact: true});
  117 |     await expect(select.locator('option')).toHaveText(['Alex Lee', 'Jamie Lee']);
  118 |     expect(pages).toEqual(['0', '1']);
  119 |     await expect(page.locator('main').last()).not.toContainText('Wrong Parent');
  120 |     await select.selectOption('302');
  121 |     await expect(page).toHaveURL(/studentUserId=302/);
  122 |     await page.reload();
  123 |     await expect(select).toHaveValue('302');
  124 |     await expect(page.locator('html')).toHaveAttribute('lang', locale);
  125 |     await fits(page);
  126 |   });
  127 | }
  128 |
  129 | test('C1 conflict reloads authoring without retrying a stale PUT or overwriting the draft', async ({page}) => {
  130 |   await fixture(page, 'STUDENT', 'Student', 'TENANT_ADMIN');
  131 |   let revision = 1; let writes = 0; let reads = 0;
  132 |   await page.route('**/v2/tenant/mock-exam-templates**', route => {
  133 |     const request = route.request(); const path = new URL(request.url()).pathname;
  134 |     const version = {id: 480, versionNo: 1, status: 'DRAFT', hasReading: false, hasListening: false, hasWriting: true};
  135 |     if (path.endsWith('/authoring')) {reads++; return route.fulfill({json: reply({...content.writing, contentRevision: revision})});}
  136 |     if (request.method() === 'PUT') {
  137 |       writes++;
  138 |       if (writes === 1) {revision = 2; return route.fulfill({status: 409, json: {code: 'MOCK_EXAM_CONTENT_VERSION_CONFLICT', message: 'Opaque diagnostic'}});}
  139 |       expect(request.postDataJSON().expectedContentRevision).toBe(2);
  140 |       revision = 3; return route.fulfill({json: reply({contentRevision: 3})});
  141 |     }
  142 |     if (path.endsWith('/media')) return route.fulfill({json: reply([])});
  143 |     return route.fulfill({json: reply(path.endsWith('/480') ? version : {id: 48, versions: [version]})});
  144 |   });
  145 |   await page.goto('/mock-exams?template=48&version=480&section=writing');
  146 |   await page.getByRole('textbox', {name: 'Writing prompt', exact: true}).fill('My local draft');
  147 |   await page.getByRole('button', {name: 'Review & save', exact: true}).click();
  148 |   await page.getByRole('button', {name: 'Confirm and save changes', exact: true}).click();
  149 |   await expect(page.getByRole('button', {name: 'Load latest content and replace this draft'})).toBeVisible();
  150 |   await expect(page.getByRole('button', {name: 'Confirm and save changes'})).toBeDisabled();
```
