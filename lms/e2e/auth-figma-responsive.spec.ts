import {expect, test} from '@playwright/test';

for (const route of [{path: '/login', title: 'Welcome to X-Learn'}, {path: '/forgotpassword', title: 'Forgot password?'}]) {
  test(`Figma authentication composition remains usable at every width: ${route.path}`, async ({page}, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(route.path);
    await expect(page.getByRole('heading', {name: route.title, exact: true})).toBeVisible();
    for (const width of [320, 390, 768, 1024, 1440, 1920, 2560]) {
      await page.setViewportSize({width, height: 960});
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const email = page.getByRole('textbox', {name: 'Email', exact: true});
      await expect(email).toBeVisible();
      await email.fill('responsive@example.test');
      if (width >= 1024) {
        const art = page.locator('img[src="/icons/figma-auth/dashboard.png"]');
        await expect(art).toBeVisible();
        expect(await art.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
        const fieldBox = await email.boundingBox();
        const artBox = await art.boundingBox();
        expect(artBox!.x).toBeGreaterThan(fieldBox!.x + fieldBox!.width);
      }
      if (width === 390 || width === 1440) await page.screenshot({path: testInfo.outputPath(`auth-${width}.png`), fullPage: true});
    }
    if (route.path === '/login') {
      for (const viewport of [{width: 1280, height: 720}, {width: 1710, height: 805}, {width: 2560, height: 960}]) {
        await page.setViewportSize(viewport);
        const art = await page.locator('img[src="/icons/figma-auth/goal.png"]').boundingBox();
        expect(art!.y + art!.height).toBeLessThanOrEqual(viewport.height);
      }
    }
    expect(errors).toEqual([]);
  });
}
