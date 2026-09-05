import {expect, test, type Page} from '@playwright/test';

const students = [
  {intakeId: 101, studentUserId: 301, firstName: 'Sarah', lastName: 'Chen', email: 'sarah.chen@example.test', studentType: 'STANDARD', courseRequest: 'IELTS Academic · target band 7.0', contactPhone: '+1 202 555 0110', basicBackground: 'Preparing for postgraduate study. Focus on academic writing and speaking.'},
  {intakeId: 102, studentUserId: 302, firstName: 'James', lastName: 'Liu', email: 'james.liu@example.test', studentType: 'VIP', courseRequest: 'GRE preparation', basicBackground: 'Quantitative reasoning and analytical writing.'},
  {intakeId: 103, studentUserId: 303, firstName: 'Maria', lastName: 'Santos', email: 'maria.santos@example.test', studentType: 'STANDARD', courseRequest: 'TOEFL preparation'},
  {intakeId: 104, studentUserId: 304, firstName: 'Elena', lastName: 'Rostova', email: 'elena.rostova@example.test', studentType: 'STANDARD', courseRequest: 'IELTS General Training'},
  {intakeId: 105, studentUserId: 305, firstName: 'Amara', lastName: 'Okafor', email: 'amara.okafor@example.test', studentType: 'VIP', courseRequest: 'IELTS speaking practice'},
  {intakeId: 106, studentUserId: 306, firstName: 'Wei', lastName: 'Li', email: 'wei.li@example.test', studentType: 'STANDARD', courseRequest: 'Academic English foundation'},
].map((student, index) => ({...student, lifecycleStatus: 'OPEN', assignmentStatus: 'UNASSIGNED', intakeVersion: 1,
  createdAt: `2026-09-0${index + 1}T09:00:00Z`, updatedAt: '2026-09-07T10:00:00Z'}));
students.push(...Array.from({length: 18}, (_, index) => ({...students[0], intakeId: 107 + index, studentUserId: 307 + index, firstName: `Learner ${index + 7}`, lastName: 'Example', email: `learner${index + 7}@example.test`})));

const advisors = [
  {advisorUserId: 51, firstName: 'Priya', lastName: 'Nair', email: 'priya.nair@example.test', level: 'ADVISOR'},
  {advisorUserId: 52, firstName: 'Daniel', lastName: 'Kim', email: 'daniel.kim@example.test', level: 'INSTRUCTOR_ADVISOR'},
  {advisorUserId: 53, firstName: 'Anika', lastName: 'Patel', email: 'anika.patel@example.test', level: 'ADVISOR'},
  {advisorUserId: 54, firstName: 'Robin', lastName: 'Park', email: 'robin.park@example.test', level: 'ADVISOR'},
];
const response = (data: unknown) => ({status: 200, code: 'SUCCESS', data});

async function installWorkspace(page: Page, empty = false) {
  await page.addInitScript(() => {
    const user = {id: 905, userId: 905, firstName: 'Casey', lastName: 'Morgan', name: 'Casey Morgan', email: 'casey@example.test', role: 'USER', level: 'COUNSELLOR', accessToken: 'isolated-counsellor-test'};
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accToken', user.accessToken);
  });
  const requests: string[] = [];
  await page.route('**/api/**', route => {
    const request = route.request();
    requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    return route.fulfill({json: response([])});
  });
  await page.route('**/v2/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    requests.push(`${request.method()} ${path}`);
    let data: unknown = [];
    if (path.endsWith('/unread-count')) data = {unreadCount: 0};
    else if (path === '/v2/counsellor/dashboard') data = {createdCount: empty ? 2 : students.length + 8, assignedCount: empty ? 2 : 8, unassignedCount: empty ? 0 : students.length};
    else if (path === '/v2/counsellor/student-intakes' || path === '/v2/counsellor/advisors') {
      expect([...url.searchParams.keys()].sort()).toEqual(['page', 'size']);
      const current = Number(url.searchParams.get('page'));
      const size = Number(url.searchParams.get('size'));
      const list = path.endsWith('/advisors') ? advisors : empty ? [] : students;
      data = {page: current, size, total: list.length, items: list.slice(current * size, (current + 1) * size)};
    } else if (path.endsWith('/parent-links')) data = path.includes('/101/') ? [{parentUserId: 601, parentFirstName: 'Helen', parentLastName: 'Chen', parentEmail: 'helen.chen@example.test'}] : [];
    else if (/\/student-intakes\/\d+$/.test(path)) data = students.find(student => student.intakeId === Number(path.split('/').at(-1)));
    return route.fulfill({json: response(data)});
  });
  return requests;
}

test('counsellor workspace selects records and paginates using only existing reads', async ({page}) => {
  const requests = await installWorkspace(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('/counsellor');
  await expect(page.getByText('Helen Chen')).toBeVisible();
  const preview = page.getByRole('region', {name: 'Intake preview'});
  await page.getByRole('button', {name: /James Liu/}).click();
  await expect(preview.getByText('GRE preparation')).toBeVisible();
  await expect(preview.getByText('Helen Chen')).toHaveCount(0);
  await expect(preview.getByRole('link', {name: 'Edit intake'})).toHaveAttribute('href', '/counsellor/intakes/102');
  await expect(preview.getByRole('link', {name: 'Select advisor'})).toHaveAttribute('href', '/counsellor/intakes/102/assign');
  await page.getByRole('navigation', {name: 'intake pages'}).getByRole('button', {name: 'Next page'}).click();
  await expect(preview.getByRole('link', {name: 'Select advisor'})).not.toHaveAttribute('href', '/counsellor/intakes/102/assign');
  await page.getByRole('navigation', {name: 'advisor pages'}).getByRole('button', {name: 'Next page'}).click();
  await expect(page.getByText('Robin Park')).toBeVisible();
  await preview.getByRole('link', {name: 'Select advisor'}).click();
  await expect(page.getByRole('heading', {name: 'Assign advisor', exact: true})).toBeVisible();
  await expect(page.getByText(/Assigning an Advisor completes the handover/)).toBeVisible();
  expect(requests.every(request => request.startsWith('GET '))).toBe(true);
  expect(requests.some(request => /\/tenant\/|\/advisor\//.test(request))).toBe(false);
  expect(errors).toEqual([]);
});

test('all operational panels and controls fit the available viewport without scrolling', async ({page}, testInfo) => {
  await installWorkspace(page);
  await page.setViewportSize({width: 1920, height: 1080});
  await page.goto('/counsellor');
  await expect(page.getByRole('link', {name: 'Select advisor'})).toBeVisible();
  const viewports = [
    {width: 2560, height: 1440}, {width: 1920, height: 1080}, {width: 1440, height: 900},
    {width: 1366, height: 768}, {width: 1280, height: 720}, {width: 1024, height: 768},
    {width: 768, height: 1024}, {width: 390, height: 844}, {width: 375, height: 667},
    {width: 320, height: 568}, {width: 844, height: 390},
  ];
  const measurements = [];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('link', {name: 'Select advisor'})).toBeVisible();
    await expect.poll(async () => page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? {horizontal: main.scrollWidth - main.clientWidth, vertical: main.scrollHeight - main.clientHeight} : null;
    }), {message: `No page overflow at ${viewport.width} × ${viewport.height}`}).toEqual({horizontal: 0, vertical: 0});
    const geometry = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) throw new Error('Missing workspace');
      const bounds = main.getBoundingClientRect();
      const visible = (node: Element) => node.getClientRects().length > 0;
      return {
        main: {width: main.clientWidth, height: main.clientHeight},
        rows: document.querySelectorAll('tbody tr').length,
        outOfBounds: Array.from(main.querySelectorAll('section[aria-labelledby], a, button, summary')).filter(visible).filter(node => {
          const rect = node.getBoundingClientRect();
          return rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1 || rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
        }).map(node => node.getAttribute('aria-label') || node.textContent?.trim()),
      };
    });
    measurements.push({...viewport, ...geometry});
    await page.screenshot({path: testInfo.outputPath(`viewport-${viewport.width}x${viewport.height}.png`)});
    expect(geometry.outOfBounds, JSON.stringify(viewport)).toEqual([]);
  }
  await testInfo.attach('viewport-measurements', {body: JSON.stringify(measurements, null, 2), contentType: 'application/json'});
  // Paging changes the record without scrolling the single-screen workspace.
  await page.setViewportSize({width: 375, height: 667});
  const preview = page.getByRole('region', {name: 'Intake preview'});
  await expect(preview.getByRole('link', {name: 'Select advisor'})).toBeVisible();
  const initial = await preview.getByRole('link', {name: 'Select advisor'}).getAttribute('href');
  await page.getByRole('navigation', {name: 'intake pages'}).getByRole('button', {name: 'Next page'}).click();
  await expect(preview.getByRole('link', {name: 'Select advisor'})).not.toHaveAttribute('href', initial ?? '');
  expect(await page.locator('main').evaluate(node => node.scrollTop)).toBe(0);
});

test('small-screen help and parent-link failures keep actions visible', async ({page}) => {
  await installWorkspace(page);
  await page.route('**/student-intakes/*/parent-links', route => route.fulfill({status: 403, json: {status: 403, code: 'ACCESS_DENIED', message: 'Access denied'}}));
  await page.setViewportSize({width: 320, height: 568});
  await page.goto('/counsellor');
  await expect(page.getByText('Parent links unavailable')).toBeVisible();
  await expect(page.getByRole('link', {name: 'Parents', exact: true})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Select advisor'})).toBeVisible();
  for (const label of ['About unassigned count', 'About assigned count', 'About created count']) {
    await page.getByLabel(label).click();
    const popup = page.locator('details[open] p');
    const bounds = await popup.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    await page.keyboard.press('Escape');
  }
  expect(await page.locator('main').evaluate(node => ({x: node.scrollWidth - node.clientWidth, y: node.scrollHeight - node.clientHeight}))).toEqual({x: 0, y: 0});
});

test('empty unassigned queue offers creation without reconstructing assigned students', async ({page}, testInfo) => {
  const requests = await installWorkspace(page, true);
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/counsellor');
  await expect(page.getByRole('heading', {name: 'No unassigned intakes'})).toBeVisible();
  await expect(page.getByRole('link', {name: /0 Unassigned/})).toBeVisible();
  await expect(page.getByText('Priya Nair')).toBeVisible();
  await expect(page.getByRole('link', {name: 'Select advisor'})).toHaveCount(0);
  await page.screenshot({path: testInfo.outputPath('counsellor-workspace-empty.png'), fullPage: true});
  expect(requests.some(request => /student-intakes\/\d/.test(request))).toBe(false);
});
