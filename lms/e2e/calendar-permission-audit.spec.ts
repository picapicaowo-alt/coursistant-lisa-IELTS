import {expect, test} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

for (const pagePath of ['/calendar', '/my-operations']) {
  test(`instructor personal-event 403 and retry contract at ${pagePath}`, async ({page}) => {
    await fixture(page, 'INSTRUCTOR', 'Instructor');
    if (pagePath === '/calendar') await page.setViewportSize({width: 390, height: 844});
    await page.clock.setFixedTime(new Date('2026-09-03T12:00:00Z'));
    const calls: {method: string; authenticated: boolean; params: Record<string, string>}[] = [];
    const refreshes: string[] = [];
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('request', request => {if (request.url().includes('/auth/refresh-token')) refreshes.push(request.method());});
    let denied = true;
    await page.route('**/v2/me/personal-events**', route => {
      const request = route.request();
      calls.push({method: request.method(), authenticated: request.headers().authorization === 'Bearer isolated-figma-fixture', params: Object.fromEntries(new URL(request.url()).searchParams)});
      return denied
        ? route.fulfill({status: 403, json: {status: 403, message: 'No Permission to Perform This Action'}})
        : route.fulfill({json: reply([])});
    });
    await page.goto(pagePath);
    if (pagePath === '/my-operations') await page.getByRole('navigation', {name: 'Operations sections'}).getByRole('button', {name: 'Calendar', exact: true}).click();
    const retry = page.getByRole('button', {name: 'Retry personal events', exact: true});
    await expect(retry).toBeVisible();
    await expect(page.getByRole('button', {name: '+ Add event', exact: true})).toBeDisabled();
    await expect(page.getByText('Personal events could not be loaded.', {exact: false})).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0].authenticated).toBe(true);
    expect(Object.keys(calls[0].params).sort()).toEqual(['fromUtc', 'toUtc']);
    expect(Date.parse(calls[0].params.fromUtc)).toBeLessThan(Date.parse(calls[0].params.toUtc));
    expect(calls[0].params.fromUtc).toMatch(/Z$/);
    expect(calls[0].params.toUtc).toMatch(/Z$/);
    await expect(page.getByRole('region', {name: 'Daily agenda'}).getByText('No events', {exact: true})).toHaveCount(0);
    await expect(page.getByText('No events in this view.', {exact: true})).toHaveCount(0);
    await retry.click();
    await expect.poll(() => calls.length).toBe(2);
    await expect(retry).toBeVisible();
    expect(calls[1]).toEqual(calls[0]);
    denied = false;
    await retry.click();
    await expect(retry).toHaveCount(0);
    if (pagePath === '/calendar') await expect(page.getByRole('region', {name: 'Daily agenda'}).getByText('No events', {exact: true})).toHaveCount(7);
    else await expect(page.getByText('No events in this view.', {exact: true})).toBeVisible();
    expect(calls).toHaveLength(3);
    expect(calls.every(call => call.method === 'GET')).toBe(true);
    expect(refreshes).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
