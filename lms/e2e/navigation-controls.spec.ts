import {expect, test, type Page} from '@playwright/test';

const identities = [
  {name: 'student', role: 'USER', level: 'STUDENT'},
  {name: 'instructor', role: 'USER', level: 'INSTRUCTOR'},
  {name: 'advisor', role: 'USER', level: 'ADVISOR'},
  {name: 'instructor-advisor', role: 'USER', level: 'INSTRUCTOR_ADVISOR'},
  {name: 'counsellor', role: 'USER', level: 'COUNSELLOR'},
  {name: 'parent', role: 'USER', level: 'PARENT'},
  {name: 'tenant-admin', role: 'TENANT_ADMIN', level: 'NOT_APPLICABLE'},
  {name: 'system-admin', role: 'SYSTEM_ADMIN', level: 'NOT_APPLICABLE'},
];
const locales = [
  {locale: 'en', back: 'Back', previous: 'Previous page', next: 'Next page', students: 'Back to students'},
  {locale: 'zh-CN', back: '返回', previous: '上一页', next: '下一页', students: '返回学生列表'},
  {locale: 'zh-TW', back: '返回', previous: '上一頁', next: '下一頁', students: '返回學生清單'},
];

async function fixture(page: Page, identity: typeof identities[number]) {
  await page.addInitScript(user => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accToken', user.accessToken);
    if (!localStorage.getItem('coursistant.locale')) localStorage.setItem('coursistant.locale', 'en');
  }, {...identity, id: 901, userId: 901, firstName: 'Navigation', lastName: 'Reviewer', email: 'navigation@example.test', accessToken: 'isolated-navigation-fixture'});
  await page.route('**/v2/**', route => {
    const url = new URL(route.request().url());
    let data: unknown = [];
    if (url.pathname.endsWith('/me/profile')) data = {id: 901, firstName: 'Navigation', lastName: 'Reviewer', email: 'navigation@example.test'};
    else if (url.pathname.endsWith('/unread-count')) data = {unreadCount: 0};
    else if (url.pathname.endsWith('/advisor/students')) {
      const pageNumber = Number(url.searchParams.get('page') ?? 0);
      data = {items: pageNumber === 0 ? [{studentUserId: 301, firstName: 'Alex', lastName: 'Chen', studentType: 'STANDARD'}] : [], page: pageNumber, size: 20, total: 21};
    } else if (url.pathname.endsWith('/profile')) data = {studentUserId: 301, profileVersion: 1, skills: []};
    else if (url.pathname.endsWith('/study-plan')) data = {studentUserId: 301, plan: null};
    return route.fulfill({json: {status: 200, code: 'SUCCESS', data}});
  });
}

async function changeLocale(page: Page, locale: string) {
  // Exercise the shared cross-tab locale subscription without enabling the release-gated switcher.
  await page.evaluate(value => {
    localStorage.setItem('coursistant.locale', value);
    window.dispatchEvent(new StorageEvent('storage', {key: 'coursistant.locale', newValue: value}));
  }, locale);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}

for (const identity of identities) {
  test(`${identity.name}: compact Back retains its tooltip, keyboard action and locale`, async ({page}, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await fixture(page, identity);
    await page.goto('/settings');
    await expect(page.getByRole('button', {name: 'Back', exact: true})).toBeVisible();
    await page.goto('/settings?navigation-audit=return');
    for (const {locale, back} of locales) {
      await changeLocale(page, locale);
      const button = page.getByRole('button', {name: back, exact: true});
      await expect(button).toHaveAttribute('title', back);
      await expect(button).toHaveText('');
      await expect(button.locator('svg')).toHaveAttribute('aria-hidden', 'true');
      for (const width of [390, 1440]) {
        await page.setViewportSize({width, height: 960});
        await button.focus();
        await expect(button).toBeFocused();
        await button.hover();
        const box = await button.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(24);
        expect(box?.height).toBeGreaterThanOrEqual(24);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        if (identity.name === 'student' && locale === 'en') await page.screenshot({path: testInfo.outputPath(`settings-${width}.png`)});
      }
    }
    const button = page.getByRole('button', {name: '返回', exact: true});
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
    expect(errors).toEqual([]);
  });
}

for (const locale of locales) {
  test(`advisor: pagination and text-only return work in ${locale.locale}`, async ({page}) => {
    await fixture(page, identities[2]);
    await page.goto('/advisor/students');
    await changeLocale(page, locale.locale);
    const previous = page.getByRole('button', {name: locale.previous, exact: true});
    const next = page.getByRole('button', {name: locale.next, exact: true});
    await expect(previous).toBeDisabled();
    await expect(previous).toHaveAttribute('title', locale.previous);
    await expect(next).toHaveAttribute('title', locale.next);
    await expect(next).toBeEnabled();
    const request = page.waitForRequest(request => request.url().includes('/advisor/students?') && new URL(request.url()).searchParams.get('page') === '1');
    await next.click();
    await request;
    await expect(previous).toBeEnabled();
    await expect(next).toBeDisabled();
    await page.goto('/advisor/students/301/study-plan');
    await changeLocale(page, locale.locale);
    const back = page.getByRole('link', {name: locale.students, exact: true});
    await expect(back).toBeVisible();
    await expect(back.locator('svg, img')).toHaveCount(0);
    await back.click();
    await expect(page).toHaveURL('/advisor/students');
    await expect(page.locator('html')).toHaveAttribute('lang', locale.locale);
  });
}
