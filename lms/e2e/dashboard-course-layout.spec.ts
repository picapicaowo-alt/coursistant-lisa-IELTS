import {expect, test} from '@playwright/test';
import {course, fixture, reply} from './workspace-fixtures';

test('student course cards keep two desktop slots regardless of enrolment count', async ({page}, info) => {
  await fixture(page);
  let count = 1;
  await page.route('**/v2/me/courses?**', route => route.fulfill({json: reply({
    items: Array.from({length: count}, (_, index) => ({...course, id: course.id + index})),
    total: count, page: 0, size: 100,
  })}));
  for (const width of [390, 1440, 1920, 2560]) {
    await page.setViewportSize({width, height: 1100});
    let singleWidth = 0;
    for (count = 1; count <= 3; count++) {
      await page.goto('/');
      const strip = page.getByLabel('Active courses', {exact: true});
      const cards = strip.locator('article');
      await expect(cards).toHaveCount(count);
      const card = await cards.first().boundingBox();
      expect(card).not.toBeNull();
      if (count === 1) singleWidth = card!.width;
      else expect(Math.abs(card!.width - singleWidth)).toBeLessThan(2);
      if (width >= 1920) {
        const region = await strip.boundingBox();
        expect(card!.width / region!.width).toBeLessThan(.51);
        expect(card!.width / region!.width).toBeGreaterThan(.4);
        if (count === 3) {
          const next = page.getByRole('button', {name: 'Next courses', exact: true});
          await expect(next).toBeEnabled();
          await next.click();
          await expect.poll(() => strip.evaluate(element => element.scrollLeft)).toBeGreaterThan(10);
        }
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (count === 1) await page.screenshot({path: info.outputPath(`student-single-course-${width}.png`), fullPage: true});
    }
  }
});

test('advisor schedule preserves available sessions and retries a failed course read', async ({page}) => {
  await fixture(page, 'ADVISOR');
  let unavailable = true;
  const requests: URLSearchParams[] = [];
  await page.route('**/v2/advisor/courses?**', route => route.fulfill({json: reply({items: [
    {courseId: 71, title: 'Available course'}, {courseId: 72, title: 'Recovered course'},
  ], total: 2, page: 0, size: 20})}));
  await page.route('**/v2/courses/*/session-occurrences?**', route => {
    const url = new URL(route.request().url());
    requests.push(url.searchParams);
    if (url.pathname.includes('/72/') && unavailable) return route.fulfill({status: 403, json: {code: 'FORBIDDEN', message: 'Access denied'}});
    return route.fulfill({json: reply([{occurrenceId: 901, occurrenceDate: url.searchParams.get('from'), startTime: '10:00:00', endTime: '11:30:00'}])});
  });
  await page.goto('/advisor/operations');
  const schedule = page.getByRole('region', {name: 'Learning Schedule', exact: true});
  await expect(schedule.getByText('Available course', {exact: true})).toBeVisible();
  await expect(schedule.getByRole('alert')).toContainText('Some course sessions could not be displayed.');
  await expect(schedule.getByText(/No course sessions/)).toHaveCount(0);
  unavailable = false;
  await schedule.getByRole('button', {name: 'Retry', exact: true}).click();
  await expect(schedule.getByText('Recovered course', {exact: true})).toBeVisible();
  await expect(schedule.getByRole('alert')).toHaveCount(0);
  expect(requests.length).toBe(4);
  for (const params of requests) {
    expect(params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.get('includeHistory')).toBe('false');
  }
});
