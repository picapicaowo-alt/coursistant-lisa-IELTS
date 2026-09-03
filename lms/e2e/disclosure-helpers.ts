import {expect, type Page} from '@playwright/test';

export const sectionTrigger = (page: Page, title: string) => page.locator(`summary[aria-label=${JSON.stringify(title)}]`);

export async function openSection(page: Page, title: string) {
  const trigger = sectionTrigger(page, title);
  await expect(trigger).toBeVisible();
  if (!await trigger.evaluate(element => element.parentElement?.hasAttribute('open'))) await trigger.click();
}
