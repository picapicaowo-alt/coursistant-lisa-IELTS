import {expect, test, type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const people = [
  {id: 1, firstName: 'Grace', lastName: 'Tan', email: 'grace.tan@example.test', role: 'TENANT_ADMIN', level: null},
  {id: 2, firstName: 'Mei Lin', lastName: 'Chen', email: 'mei.chen@example.test', role: 'USER', level: 'COUNSELLOR'},
  {id: 3, firstName: 'Daniel', lastName: 'Koh', email: 'daniel.koh@example.test', role: 'USER', level: 'ADVISOR'},
  {id: 4, firstName: 'Sarah', lastName: 'Lim', email: 'sarah.lim@example.test', role: 'USER', level: 'INSTRUCTOR'},
  {id: 5, firstName: 'James', lastName: 'Teo', email: 'james.teo@example.test', role: 'USER', level: 'INSTRUCTOR_ADVISOR'},
  {id: 6, firstName: 'Emily', lastName: 'Wong', email: 'emily.wong@example.test', role: 'USER', level: 'STUDENT'},
  {id: 7, firstName: 'Lucas', lastName: 'Tan', email: 'lucas.tan@example.test', role: 'USER', level: 'STUDENT'},
  {id: 8, firstName: 'Rachel', lastName: 'Wong', email: 'rachel.wong@example.test', role: 'USER', level: 'PARENT'},
  {id: 9, firstName: 'Lisha', lastName: 'Pang', email: 'lisha.pang@example.test', role: 'USER', level: 'STUDENT'},
].map(person => ({...person, status: 'ACTIVE', userVersion: 1, roleVersion: 1}));
const intakes = [people[8], people[6], people[5]].map((person, i) => ({...person, intakeId: 1350 - i, studentUserId: person.id, lifecycleStatus: 'OPEN', assignmentStatus: i === 0 ? 'UNASSIGNED' : 'ASSIGNED', advisorUserId: i === 0 ? null : 3, intakeVersion: 1, assignmentVersion: i === 0 ? null : 2, studentType: 'STANDARD', courseRequest: 'IELTS Academic preparation', createdAt: '2026-09-01T09:00:00Z'}));
const titles = ['IELTS Academic — Practice Set A', 'IELTS General Training — Set B', 'IELTS Academic — Mock Final', 'IELTS Academic — Practice Set C'];
const templates = titles.map((title, index) => ({id: 48 + index, title, label: ['TESTING V1', 'GENERAL V1', 'ACADEMIC FINAL', 'PRACTICE V2'][index], versions: [{id: 480 + index, versionNo: 1, status: index % 2 === 0 ? 'DRAFT' : 'PUBLISHED', hasListening: index !== 0, hasReading: index !== 0, hasWriting: index % 2 !== 0, createdAt: '2026-09-01T09:00:00Z'}]}));
const courses = ['IELTS Academic Writing', 'IELTS Speaking Practice', 'Math Foundation', 'Science Olympiad Prep', 'Study Skills Workshop'].map((title, index) => ({courseId: 71 + index, courseCode: `COURSE-${index + 1}`, title, launchState: 'PUBLISHED', lifecycleState: 'ACTIVE', ownerAdvisorUserId: 3, ownerAdvisorFirstName: 'Daniel', ownerAdvisorLastName: 'Koh', ownershipVersion: 2}));
const events = ['CREATE_MANAGED_USER', 'UPDATE_ALERT_RULES', 'ASSIGN_ADVISOR', 'TRANSFER_COURSE_OWNER', 'UPDATE_MANAGED_USER'].map((action, index) => ({eventId: 100 + index, actorUserId: index === 2 ? 2 : 1, targetUserId: index === 0 ? 4 : index === 2 ? 7 : undefined, action, resourceType: index === 0 ? 'USER' : 'GOVERNANCE', createdAt: `2026-09-0${3 - Math.floor(index / 2)}T10:24:00Z`, after: {status: 'ACTIVE'}}));
const envelope = (data: unknown) => ({status: 200, code: 'SUCCESS', data});

async function install(page: Page) {
  await page.addInitScript(user => {localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('accToken', user.accessToken);}, {...people[0], name: 'Grace Tan', accessToken: 'isolated-tenant-ui-fixture'});
  const requests: {method: string; path: string; query: string; body: unknown}[] = [];
  const unknown: string[] = [];
  let listening: unknown = null;
  const paged = (items: unknown[], url: URL) => {
    const pageIndex = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);
    return {items: items.slice(pageIndex * size, (pageIndex + 1) * size), total: items.length, page: pageIndex, size};
  };
  await page.route('**/v2/**', route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace(/^\/api/, '');
    const method = request.method(); const body: unknown = request.postData() ? request.postDataJSON() : null;
    requests.push({method, path, query: url.search, body});
    let data: unknown;
    if (path === '/v2/tenant/users') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const levels = url.searchParams.getAll('levels');
      data = paged(people.filter(person => (!q || `${person.firstName} ${person.lastName} ${person.email}`.toLowerCase().includes(q)) && (!url.searchParams.get('role') || person.role === url.searchParams.get('role')) && (!url.searchParams.get('level') || person.level === url.searchParams.get('level')) && (!levels.length || levels.includes(person.level ?? ''))), url);
    } else if (/^\/v2\/tenant\/users\/\d+$/.test(path)) data = people.find(person => person.id === Number(path.split('/').at(-1)));
    else if (path.endsWith('/disable-blockers')) data = {canDisable: false, blockers: [{code: 'COURSE_OWNERSHIP', count: 1, message: 'Transfer course ownership before disabling.'}]};
    else if (path === '/v2/tenant/student-intakes') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      data = paged(intakes.filter(intake => (!q || `${intake.firstName} ${intake.lastName} ${intake.email}`.toLowerCase().includes(q)) && (!url.searchParams.get('intakeId') || intake.intakeId === Number(url.searchParams.get('intakeId'))) && (!url.searchParams.get('assignmentStatus') || intake.assignmentStatus === url.searchParams.get('assignmentStatus'))), url);
    } else if (/^\/v2\/tenant\/student-intakes\/\d+$/.test(path)) data = intakes.find(intake => intake.intakeId === Number(path.split('/').at(-1)));
    else if (path === '/v2/tenant/course-ownerships') data = paged(courses, url);
    else if (/^\/v2\/tenant\/courses\/\d+\/owner$/.test(path)) data = courses.find(course => course.courseId === Number(path.split('/')[4]));
    else if (path === '/v2/tenant/audit-events') data = paged(events, url);
    else if (path === '/v2/tenant/alert-rules') data = {mode: 'TENANT_OVERRIDE', version: 2, inactivityDays: 7, absenceCount: 3, absenceWindowDays: 14, completionPercentage: 60, completionWindowDays: 7, completionMinimumSample: 3, performancePercentage: 50, performanceMinimumGradedSample: 3, deadlineWindowDays: 3, gradingDelayDays: 5, overdueTaskEnabled: 1, checkpointIncompleteEnabled: 1, negativeHoursEnabled: null};
    else if (path === '/v2/tenant/mock-exam-templates') data = templates;
    else if (/^\/v2\/tenant\/mock-exam-templates\/\d+$/.test(path)) {
      const template = templates.find(item => item.id === Number(path.split('/').at(-1)));
      data = template && {...template, versions: template.versions.map(version => ({...version, hasListening: template.id === 48 ? Boolean(listening) : version.hasListening}))};
    } else if (/\/versions\/\d+$/.test(path)) {
      const version = templates.flatMap(template => template.versions).find(item => item.id === Number(path.split('/').at(-1)));
      data = {...version, hasListening: version?.id === 480 ? Boolean(listening) : version?.hasListening};
    } else if (path.endsWith('/media')) data = [{mediaId: 11, kind: 'LISTENING_AUDIO', status: 'UPLOADED', fileName: 'listening-part-1.mp3', sizeBytes: 12400000}];
    else if (path.endsWith('/listening')) { if (method === 'POST') listening = body; data = listening; }
    else if (path.endsWith('/reading') || path.endsWith('/writing')) data = {totalMinutes: 60, tasks: []};
    else if (path.endsWith('/parent-links')) data = [];
    else { unknown.push(`${method} ${path}`); return route.fulfill({status: 404, json: {message: 'Unmapped fixture request'}}); }
    return route.fulfill({json: envelope(data)});
  });
  return {requests, unknown};
}

test('tenant reference layouts render across desktop and mobile without page overflow', async ({page}) => {
  const {requests, unknown} = await install(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const directory = '.impeccable/review/tenant-admin'; await mkdir(directory, {recursive: true});
  const screens = [
    ['dashboard', '/admin/dashboard', 'Welcome back, Grace'], ['people', '/admin', 'Tenant governance'],
    ['ownership', '/admin?section=ownership', 'Tenant governance'], ['alerts', '/admin?section=alerts', 'Tenant governance'],
    ['audit', '/admin?section=audit', 'Tenant governance'], ['intakes', '/admin/intakes', 'Student intakes'],
    ['templates', '/mock-exams', 'Mock exam templates'], ['version', '/mock-exams?template=48&version=480', titles[0]],
    ['composer', '/mock-exams?template=48&version=480&section=listening', titles[0]],
  ];
  for (const viewport of [{width: 1714, height: 1216}, {width: 390, height: 844}]) {
    await page.setViewportSize(viewport);
    for (const [name, path, heading] of screens) {
      await page.goto(path);
      await expect(page.getByRole('heading', {name: heading, exact: true})).toBeVisible();
      await expect(page.getByText(/^(Loading|Checking the current version)/).filter({visible: true})).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(() => page.locator('main').first().evaluate(main => main.scrollWidth - main.clientWidth), {message: `${name} horizontal overflow at ${viewport.width}`}).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
      if (viewport.width === 390 && ['people', 'audit'].includes(name)) {
        await expect(page.locator('main tbody tr').first()).toBeInViewport();
      }
      if (viewport.width === 390 && name === 'people') {
        const firstPerson = page.locator('main tbody tr').first();
        for (const text of ['grace.tan@example.test', 'Active']) {
          const content = firstPerson.getByText(text, {exact: true});
          await expect(content).toBeInViewport({ratio: 1});
          const bounds = await content.boundingBox();
          const mainBounds = await page.locator('main').first().boundingBox();
          expect(bounds && mainBounds && bounds.y + bounds.height <= mainBounds.y + mainBounds.height).toBe(true);
        }
      }
      if (viewport.width === 390 && name === 'alerts') {
        await expect(page.getByRole('listitem').filter({hasText: 'Learning inactivity'}).first()).toBeInViewport();
      }
      await page.screenshot({path: `${directory}/${name}-${viewport.width}.png`, fullPage: true, animations: 'disabled'});
      if ((viewport.width === 390 && ['people', 'audit', 'intakes', 'alerts', 'version'].includes(name)) || name === 'composer') {
        await page.locator('main').first().evaluate(main => {main.scrollTop = Math.min(700, main.scrollHeight - main.clientHeight);});
        await page.screenshot({path: `${directory}/${name}-details-${viewport.width}.png`, animations: 'disabled'});
      }
    }
  }
  expect(errors).toEqual([]); expect(unknown).toEqual([]);
  expect(requests.every(request => request.method === 'GET' && request.path.startsWith('/v2/tenant/'))).toBe(true);
});

test('governance secondary filters and policy summaries remain usable on mobile', async ({page}) => {
  const {requests} = await install(page);
  const directory = '.impeccable/review/tenant-admin';
  await mkdir(directory, {recursive: true});
  for (const width of [1714, 390]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 1216});
    await page.goto('/admin?section=audit');
    if (width === 390) {
      await expect(page.getByLabel('From', {exact: true})).toBeHidden();
      await page.getByRole('button', {name: 'More filters', exact: true}).click();
    }
    for (const label of ['From', 'To']) {
      const input = page.getByLabel(label, {exact: true});
      await input.fill('09/03/2026, 10:24 AM');
      await input.blur();
      await expect(input).toHaveValue('09/03/2026, 10:24 AM');
      // Verify full display text fits before the overlaid calendar control.
      expect(await input.evaluate(field => {
        const element = field as HTMLInputElement;
        const css = getComputedStyle(element);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas measurement unavailable');
        context.font = css.font;
        return element.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight) - context.measureText(element.value).width;
      })).toBeGreaterThanOrEqual(0);
    }
    await page.getByLabel('From', {exact: true}).scrollIntoViewIfNeeded();
    await page.screenshot({path: `${directory}/audit-filters-${width}.png`, animations: 'disabled'});
    await page.getByRole('button', {name: 'Apply filters', exact: true}).click();
    await expect.poll(() => requests.some(request => request.path.endsWith('/audit-events') && new URLSearchParams(request.query).has('from'))).toBe(true);
  }
  await page.goto('/admin?section=alerts');
  const inactivity = page.getByRole('listitem').filter({hasText: 'Learning inactivity'}).first();
  await expect(inactivity).toContainText('Inactivity: 7 days');
  await inactivity.getByRole('button', {name: 'Edit learning inactivity'}).click();
  await page.getByLabel('Inactivity (days)', {exact: true}).fill('9');
  await page.getByRole('button', {name: 'Apply to draft', exact: true}).click();
  await expect(inactivity).toContainText('Inactivity: 9 days');
  await expect(inactivity.getByLabel('Unsaved changes')).toHaveCount(1);
  await expect(page.getByRole('switch', {name: 'Negative hours'})).not.toBeChecked();
  await expect(page.getByRole('switch', {name: 'Overdue tasks'})).toBeChecked();
  await page.screenshot({path: `${directory}/alerts-unsaved-390.png`, animations: 'disabled'});
});

test('tenant intake search uses the correct ID parameter and account management opens in a drawer', async ({page}) => {
  const {requests, unknown} = await install(page);
  await page.goto('/admin/intakes');
  await page.getByRole('combobox', {name: 'Search field', exact: true}).selectOption('intakeId');
  await page.getByLabel('Intake ID', {exact: true}).fill('1350');
  await page.getByRole('button', {name: 'Apply filters', exact: true}).click();
  await expect(page.getByText('Lisha Pang', {exact: true})).toBeVisible();
  expect(requests.some(request => request.path.endsWith('/student-intakes') && request.query.includes('intakeId=1350') && !request.query.includes('q='))).toBe(true);
  await page.goto('/admin');
  const manage = page.getByRole('button', {name: 'Manage Sarah Lim', exact: true}); await manage.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(manage).toBeFocused();
  expect(unknown).toEqual([]);
});

test('composer keeps tab drafts and submits every part once then becomes read only', async ({page}) => {
  const {requests, unknown} = await install(page);
  await page.goto('/mock-exams?template=48&version=480&section=listening');
  await page.getByLabel('Listening duration (minutes)', {exact: false}).fill('40');
  for (const index of [0, 1]) {
    if (index) await page.getByRole('button', {name: 'Add part', exact: true}).click();
    await page.getByLabel('Part label', {exact: true}).fill(`Part ${index + 1}`);
    await page.getByLabel('First question number', {exact: true}).fill(String(index * 10 + 1));
    await page.getByLabel('Last question number', {exact: true}).fill(String(index * 10 + 10));
    await page.getByLabel('Question group title', {exact: true}).fill('Complete the notes');
    await page.getByLabel('Question kind', {exact: true}).fill('form_completion');
    await page.getByRole('radio').check();
  }
  await page.reload();
  await expect(page.getByLabel('Part label', {exact: true})).toHaveValue('Part 1');
  await page.getByRole('button', {name: 'Part 2', exact: true}).click();
  await expect(page.getByLabel('Part label', {exact: true})).toHaveValue('Part 2');
  await page.getByRole('button', {name: 'Review complete section', exact: true}).click();
  await expect(page.getByText('Submit all 2 parts?')).toBeVisible();
  expect(requests.filter(request => request.method === 'POST')).toHaveLength(0);
  await page.getByRole('button', {name: 'Confirm and create section'}).click();
  await expect(page.getByRole('heading', {name: 'Listening content', exact: true})).toBeVisible();
  await expect(page.getByText('This saved section is read only.', {exact: false})).toBeVisible();
  expect(requests.filter(request => request.method === 'POST')).toEqual([expect.objectContaining({path: '/v2/tenant/mock-exam-templates/48/versions/480/listening', body: expect.objectContaining({totalMinutes: 40, parts: [expect.objectContaining({seq: 1, audioMediaId: 11}), expect.objectContaining({seq: 2, audioMediaId: 11})]})})]);
  expect(unknown).toEqual([]);
});

test('delayed upload stays with its originating part and preserves intervening edits', async ({page}) => {
  await install(page);
  let finishUpload: (() => void) | undefined;
  let uploadStarted = false;
  await page.route('**/v2/tenant/mock-exam-templates/48/versions/480/media', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    expect(route.request().postData()).toContain('LISTENING_AUDIO');
    uploadStarted = true;
    await new Promise<void>(resolve => {finishUpload = resolve;});
    await route.fulfill({status: 201, json: envelope({mediaId: 11, kind: 'LISTENING_AUDIO', status: 'UPLOADED'})});
  });
  await page.goto('/mock-exams?template=48&version=480&section=listening');
  await page.getByLabel('Part label', {exact: true}).fill('Original part');
  await page.getByLabel('Choose media file').setInputFiles({name: 'test.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('isolated upload fixture')});
  await page.getByRole('button', {name: 'Upload and use', exact: true}).click();
  await expect.poll(() => uploadStarted).toBe(true);
  await page.getByLabel('Part label', {exact: true}).fill('Edited while uploading');
  await page.getByRole('button', {name: 'Add part', exact: true}).click();
  await page.getByLabel('Part label', {exact: true}).fill('Second part');
  await expect(page.getByRole('button', {name: 'Review complete section', exact: true})).toBeDisabled();
  finishUpload!();
  await expect(page.getByRole('button', {name: 'Review complete section', exact: true})).toBeEnabled();
  await expect(page.getByRole('radio')).not.toBeChecked();
  await expect(page.getByLabel('Part label', {exact: true})).toHaveValue('Second part');
  await page.getByRole('button', {name: 'Part 1', exact: true}).click();
  await expect(page.getByRole('radio')).toBeChecked();
  await expect(page.getByLabel('Part label', {exact: true})).toHaveValue('Edited while uploading');
  await page.reload();
  await expect(page.getByRole('radio')).toBeChecked();
  await expect(page.getByLabel('Part label', {exact: true})).toHaveValue('Edited while uploading');
});

for (const [section, unit, kind] of [['listening', 'Part', 'LISTENING_AUDIO'], ['reading', 'Passage', 'READING_IMAGE'], ['writing', 'Task', 'WRITING_IMAGE']]) {
  test(`deleting ${section} media clears references in other unsaved units and storage`, async ({page}) => {
    await install(page);
    let deleted = false;
    await page.route('**/v2/tenant/mock-exam-templates/48/versions/480/media', route => route.fulfill({json: envelope(deleted ? [] : [{mediaId: 11, kind, status: 'UPLOADED', fileName: 'shared-media'}])}));
    await page.route('**/v2/tenant/mock-exam-templates/48/versions/480/media/11', route => {
      expect(route.request().method()).toBe('DELETE');
      deleted = true;
      return route.fulfill({status: 204});
    });
    await page.goto(`/mock-exams?template=48&version=480&section=${section}`);
    await page.getByRole('radio').check();
    await page.getByRole('button', {name: `Add ${unit.toLowerCase()}`, exact: true}).click();
    await page.getByRole('radio').check();
    await page.getByRole('button', {name: 'Delete shared-media', exact: true}).click();
    await expect(page.getByRole('button', {name: 'Clear media selection', exact: true})).toHaveCount(0);
    await page.getByRole('button', {name: `${unit} 1`, exact: true}).click();
    await expect(page.getByRole('button', {name: 'Clear media selection', exact: true})).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', {name: 'Clear media selection', exact: true})).toHaveCount(0);
    const stored = await page.evaluate(() => sessionStorage.getItem('tenant-exam-draft:v1:1:48:480'));
    expect(stored).not.toContain('"mediaId":11');
  });
}

test('intake write errors stay inside the active drawer and reset when changing records', async ({page}) => {
  await install(page);
  const writes: {method: string; path: string; body: unknown}[] = [];
  await page.route('**/v2/tenant/student-intakes/1350', route => {
    if (route.request().method() === 'GET') return route.fallback();
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    writes.push({method: route.request().method(), path: new URL(route.request().url()).pathname, body: route.request().postDataJSON()});
    return route.fulfill({status: 403, json: {status: 403, code: 'FORBIDDEN', message: 'Forbidden'}});
  });
  await page.goto('/admin/intakes');
  await page.getByRole('row').filter({hasText: 'Lisha Pang'}).getByRole('button', {name: 'Manage', exact: true}).click();
  const drawer = page.getByRole('dialog', {name: 'Intake management', exact: true});
  await drawer.getByLabel('Course request *').fill('Changed request');
  await drawer.getByRole('button', {name: 'Save intake changes', exact: true}).click();
  await expect(drawer.getByRole('alert')).toContainText('You do not have permission');
  await expect(drawer.getByLabel('Course request *')).toHaveValue('Changed request');
  expect(writes).toEqual([{method: 'PATCH', path: '/api/v2/tenant/student-intakes/1350', body: {expectedIntakeVersion: 1, courseRequest: 'Changed request'}}]);
  await page.keyboard.press('Escape');
  await page.getByRole('row').filter({hasText: 'Lucas Tan'}).getByRole('button', {name: 'Manage', exact: true}).click();
  await expect(drawer.getByRole('heading', {name: 'Reassign advisor', exact: true})).toBeVisible();
  await expect(drawer.getByRole('alert')).toHaveCount(0);
});

test('an in-flight reading upload keeps its question identity when another group is removed', async ({page}) => {
  await install(page);
  let finishUpload: (() => void) | undefined;
  await page.route('**/v2/tenant/mock-exam-templates/48/versions/480/media', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postData()).toContain('READING_IMAGE');
      await new Promise<void>(resolve => {finishUpload = resolve;});
      return route.fulfill({status: 201, json: envelope({mediaId: 11, kind: 'READING_IMAGE', status: 'UPLOADED'})});
    }
    return route.fulfill({json: envelope([{mediaId: 11, kind: 'READING_IMAGE', status: 'UPLOADED', fileName: 'question.png'}])});
  });
  await page.goto('/mock-exams?template=48&version=480&section=reading');
  await page.getByRole('button', {name: 'Add question group', exact: true}).click();
  await page.getByLabel('Question group title', {exact: true}).nth(1).fill('Keep this group');
  await page.getByLabel('Choose media file').nth(1).setInputFiles({name: 'question.png', mimeType: 'image/png', buffer: Buffer.from('isolated upload fixture')});
  await page.getByRole('button', {name: 'Upload and use', exact: true}).click();
  await expect.poll(() => Boolean(finishUpload)).toBe(true);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', {name: 'Remove group', exact: true}).first().click();
  finishUpload!();
  await expect(page.getByRole('radio')).toBeChecked();
  await expect(page.getByLabel('Question group title', {exact: true})).toHaveValue('Keep this group');
  await page.reload();
  await expect(page.getByRole('radio')).toBeChecked();
  await expect(page.getByLabel('Question group title', {exact: true})).toHaveValue('Keep this group');
});
