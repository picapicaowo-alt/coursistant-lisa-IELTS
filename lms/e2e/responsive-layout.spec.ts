import {expect, test, type Page} from '@playwright/test';

type AccountRole = 'USER' | 'TENANT_ADMIN' | 'SYSTEM_ADMIN';
type AccountLevel = 'STUDENT' | 'INSTRUCTOR' | 'COUNSELLOR' | 'ADVISOR' | 'PARENT' | 'NOT_APPLICABLE' | null;

type TestIdentity = {
  id: number;
  userId: number;
  email: string;
  name: string;
  username: string;
  role: AccountRole;
  level: AccountLevel;
  avatar: null;
  accessToken: string;
};

const identity = (role: AccountRole, level: AccountLevel, name: string): TestIdentity => ({
  id: 801,
  userId: 801,
  email: `${name.toLowerCase().replaceAll(' ', '.')}@example.test`,
  name,
  username: name.toLowerCase().replaceAll(' ', '.'),
  role,
  level,
  avatar: null,
  accessToken: 'responsive-layout-token',
});

const installIdentity = async (page: Page, user: TestIdentity): Promise<void> => {
  await page.addInitScript(currentUser => {
    window.localStorage.setItem('user', JSON.stringify(currentUser));
    window.localStorage.setItem('accToken', currentUser.accessToken);
  }, user);
  await page.route('**/v2/me/notifications/unread-count', route => route.fulfill({
    json: {status: 200, code: 'SUCCESS', message: 'Success', data: {unreadCount: 0}},
  }));
};

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    workspace: (() => {
      const main = document.querySelector('main');
      return main ? main.scrollWidth - main.clientWidth : 0;
    })(),
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.workspace).toBeLessThanOrEqual(1);
};

const expectDesktopNavigationReadable = async (page: Page): Promise<void> => {
  const labels = page.locator('aside[aria-label="Primary navigation"] nav').first().locator('a span');
  const metrics = await labels.evaluateAll(elements => elements.map(element => ({
    text: element.textContent?.trim() ?? '',
    clippedInline: element.scrollWidth > element.clientWidth + 1,
    clippedBlock: element.scrollHeight > element.clientHeight + 1,
    visible: element.getClientRects().length > 0,
  })));
  expect(metrics.length).toBeGreaterThan(0);
  expect(metrics.filter(metric => metric.visible && (metric.clippedInline || metric.clippedBlock))).toEqual([]);
};

test('student dashboard fills its fluid workspace from mobile through ultra-wide viewports', async ({page}) => {
  await installIdentity(page, identity('USER', 'STUDENT', 'Responsive Student'));
  await page.goto('/');
  const dashboard = page.getByRole('region', {name: 'Student dashboard'});
  await expect(dashboard).toBeVisible();

  const viewports = [
    {width: 320, height: 760, columns: 1},
    {width: 390, height: 844, columns: 1},
    {width: 768, height: 1024, columns: 1},
    {width: 1024, height: 768, columns: 1},
    {width: 1280, height: 800, columns: 2},
    {width: 1440, height: 900, columns: 3},
    {width: 1710, height: 811, columns: 3},
    {width: 1920, height: 1080, columns: 3},
    {width: 2560, height: 1440, columns: 3},
    {width: 3420, height: 1622, columns: 3},
    {width: 3840, height: 2160, columns: 3},
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const geometry = await dashboard.evaluate(element => {
      const dashboardRect = element.getBoundingClientRect();
      const pageElement = element.parentElement!;
      const pageRect = pageElement.getBoundingClientRect();
      const pageStyle = getComputedStyle(pageElement);
      const available = pageRect.width
        - Number.parseFloat(pageStyle.paddingLeft)
        - Number.parseFloat(pageStyle.paddingRight);
      return {
        unusedInlineSpace: available - dashboardRect.width,
        columnCount: getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
      };
    });

    expect(geometry.unusedInlineSpace, `${viewport.width}px workspace gap`).toBeLessThanOrEqual(2);
    expect(geometry.columnCount, `${viewport.width}px column count`).toBe(viewport.columns);
    await expectNoHorizontalOverflow(page);
  }
});

test('shared shell keeps every role navigation label readable on desktop', async ({context}) => {
  const roles = [
    {user: identity('USER', 'STUDENT', 'Student User'), path: '/', heading: 'Welcome back, Student User!'},
    {user: identity('USER', 'INSTRUCTOR', 'Instructor User'), path: '/my-operations', heading: 'Teaching operations'},
    {user: identity('USER', 'COUNSELLOR', 'Counsellor User'), path: '/counsellor', heading: 'Intake dashboard'},
    {user: identity('USER', 'ADVISOR', 'Advisor User'), path: '/advisor/operations', heading: 'Today’s student work'},
    {user: identity('USER', 'PARENT', 'Parent User'), path: '/parent', heading: 'Student progress'},
    {user: identity('TENANT_ADMIN', 'NOT_APPLICABLE', 'Tenant Admin'), path: '/admin/intakes', heading: 'Student intakes'},
    {user: identity('SYSTEM_ADMIN', null, 'System Admin'), path: '/admin', heading: 'Admin Console'},
  ];

  for (const role of roles) {
    const page = await context.newPage();
    await page.setViewportSize({width: 1710, height: 811});
    await installIdentity(page, role.user);
    await page.goto(role.path);
    await expect(page.getByRole('heading', {name: role.heading, exact: true})).toBeVisible();
    await expectDesktopNavigationReadable(page);
    await expectNoHorizontalOverflow(page);
    await page.close();
  }
});
