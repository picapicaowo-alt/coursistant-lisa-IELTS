import {expect, type Page} from '@playwright/test';

export const sectionTrigger = (page: Page, title: string) => page.locator(`summary[aria-label=${JSON.stringify(title)}]`);

export async function openSection(page: Page, title: string) {
  const trigger = sectionTrigger(page, title);
  const region = page.getByRole('region', {name: title, exact: true}).or(page.getByRole('group', {name: title, exact: true})).first();
  await expect(trigger.or(region).first()).toBeVisible();
  if (await trigger.count() > 0 && !await trigger.evaluate(element => element.parentElement?.hasAttribute('open'))) await trigger.click();
}
