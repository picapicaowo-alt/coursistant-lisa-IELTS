import {expect, test, type Page} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

test('release audit: class dates load on demand and failures stay in their own section', async ({page}, info) => {
  await setupCourse(page);
  let unavailable = true;
  let reads = 0;
  await page.route('**/v2/courses/71/session-occurrences?*', route => {
    reads++;
    return route.fulfill(unavailable
      ? {status: 500, json: {code: 'INTERNAL_ERROR', message: 'Course does not exist'}}
      : {json: reply([{occurrenceId: 99, occurrenceDate: '2030-09-04', startTime: '14:00', endTime: '15:30', location: 'Room 302', status: 'SCHEDULED'}])});
  });
  await page.goto('/advisor/courses/71/delivery?view=schedule');
  const dates = page.getByRole('button', {name: 'View class dates'});
  await expect(dates).toBeVisible();
  await expect(page.getByRole('region', {name: 'Recurring sessions'}).getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(reads).toBe(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height: 1000});
    const geometry = await page.getByRole('main').evaluate(main => ({available: main.clientWidth, content: main.scrollWidth}));
    expect(geometry.content).toBeLessThanOrEqual(geometry.available);
    await page.screenshot({path: info.outputPath(`schedule-on-demand-${width}.png`), fullPage: true, animations: 'disabled'});
  }
  await dates.click();
  const section = page.getByRole('region', {name: 'Course occurrences'});
  await expect(section.getByRole('alert')).toContainText('Class dates could not be loaded.');
  await expect(page.getByRole('button', {name: 'Generate dates'})).toHaveCount(0);
  await expect(page.getByText('Course does not exist', {exact: true})).toHaveCount(0);
  await expect(page.getByText('No occurrences were returned for this period.')).toHaveCount(0);
  unavailable = false;
  await section.getByRole('button', {name: 'Try again'}).click();
  await expect(section.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Generate dates'})).toBeEnabled();
  await expect(page.getByRole('cell', {name: 'SCHEDULED'})).toBeVisible();
  expect(reads).toBe(2);
});

test('release audit: denied class dates remain a permission state, not an empty schedule', async ({page}) => {
  await setupCourse(page);
  await page.route('**/v2/courses/71/session-occurrences?*', route => route.fulfill({status: 403, json: {code: 'ACCESS_DENIED', message: 'Access denied'}}));
  await page.goto('/advisor/courses/71/delivery?view=schedule');
  await page.getByRole('button', {name: 'View class dates'}).click();
  await expect(page.getByRole('region', {name: 'Course occurrences'}).getByRole('alert')).toContainText('You do not have permission');
  await expect(page.getByText('No occurrences were returned for this period.')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Generate dates'})).toHaveCount(0);
  await expect(page.getByRole('region', {name: 'Recurring sessions'}).getByRole('article')).toHaveCount(1);
});

test('release audit: failed schedule writes retry idempotently and block launch across tabs', async ({page}) => {
  await setupCourse(page);
  const keys: string[] = [];
  let releaseRequest: () => void = () => {};
  const pending = new Promise<void>(resolve => {releaseRequest = resolve;});
  await page.route('**/v2/courses/71/session-occurrences/generate', async route => {
    keys.push(route.request().headers()['idempotency-key']);
    if (keys.length === 1) return route.fulfill({status: 500, json: {code: 'INTERNAL_ERROR', message: 'Temporary failure'}});
    await pending;
    return route.fulfill({json: reply([])});
  });
  await page.goto('/advisor/courses/71/delivery?view=schedule');
  await page.getByRole('button', {name: 'View class dates'}).click();
  await page.getByRole('button', {name: 'Generate dates'}).click();
  await page.getByRole('button', {name: 'Generate occurrences', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('Your input is preserved');
  await expect(page.getByRole('button', {name: 'Retry', exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Generate occurrences', exact: true}).click();
  await page.getByRole('tab', {name: 'Delivery', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Validate readiness'})).toBeDisabled();
  await page.getByRole('tab', {name: 'Schedule', exact: true}).click();
  await page.getByRole('button', {name: 'View class dates'}).click();
  await expect(page.getByRole('button', {name: 'Generate dates'})).toBeDisabled();
  releaseRequest();
  await expect(page.getByRole('button', {name: 'Generate dates'})).toBeEnabled();
  await page.getByRole('tab', {name: 'Delivery', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Validate readiness'})).toBeEnabled();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});

test('release audit: create group course sends the selected instructor and course-local dates', async ({page}) => {
  await setupCourse(page);
  const writes: Array<{body: unknown; key?: string}> = [];
  await page.route('**/v2/advisor/instructors?*', route => route.fulfill({json: reply({items: [{instructorUserId: 51, firstName: 'Sarah', lastName: 'Chen', email: 'instructor@example.test'}], total: 1, page: 0, size: 20})}));
  await page.route('**/v2/courses', route => {
    writes.push({body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']});
    return route.fulfill({json: reply({id: 71})});
  });
  await page.goto('/advisor/courses');
  await page.getByRole('button', {name: 'Create course', exact: true}).click();
  await page.getByLabel('Course code', {exact: true}).fill('IELTS-2030');
  await page.getByLabel('Course title', {exact: true}).fill('Academic Writing');
  await page.getByLabel('Term start', {exact: true}).fill('09/01/2030');
  await page.getByLabel('Term end', {exact: true}).fill('12/01/2030');
  await page.getByRole('combobox', {name: 'Instructor', exact: true}).selectOption('51');
  await page.getByRole('button', {name: 'Create group course', exact: true}).click();
  await expect(page).toHaveURL(/\/advisor\/courses\/71\/delivery\?view=delivery$/);
  expect(writes).toEqual([{body: {courseCode: 'IELTS-2030', title: 'Academic Writing', termStartDate: '2030-09-01', termEndDate: '2030-12-01', primaryInstructorUserId: 51}, key: expect.any(String)}]);
});

test('release audit: search, lifecycle and pagination use the owned-course query contract', async ({page}) => {
  await setupCourse(page);
  const reads: URLSearchParams[] = [];
  await page.route('**/v2/advisor/courses?*', route => {
    const params = new URL(route.request().url()).searchParams;
    reads.push(params);
    return route.fulfill({json: reply({items: [{courseId: 71, title: params.get('page') === '1' ? 'Second page course' : 'First page course'}], total: 21, page: Number(params.get('page')), size: Number(params.get('size'))})});
  });
  await page.goto('/advisor/courses');
  await page.getByRole('navigation', {name: 'Owned course pages'}).getByRole('button', {name: 'Next'}).click();
  await expect(page.getByRole('heading', {name: 'Second page course'})).toBeVisible();
  await page.getByLabel('Search courses', {exact: true}).fill('Writing');
  await page.getByRole('button', {name: 'Run course search'}).click();
  await expect(page.getByRole('heading', {name: 'First page course'})).toBeVisible();
  await page.getByLabel('Lifecycle').selectOption('Archived');
  await expect.poll(() => reads.some(params => params.get('q') === 'Writing' && params.get('lifecycleState') === 'Archived' && params.get('page') === '0' && params.get('size') === '20')).toBe(true);
});

test('release audit: configuration error recovery hydrates the required version and saves real input', async ({page}) => {
  await setupCourse(page);
  let unavailable = true;
  const writes: unknown[] = [];
  await page.route('**/v2/advisor/courses/71/delivery-config', route => {
    if (unavailable) return route.fulfill({status: 500, json: {code: 'INTERNAL_ERROR', message: 'Temporarily unavailable'}});
    if (route.request().method() === 'PUT') writes.push(route.request().postDataJSON());
    return route.fulfill({json: reply({courseId: 71, deliveryMode: 'GROUP', catalogCode: writes.length ? 'NEW-CATALOG' : 'IELTS', capacity: 16, launchState: 'DRAFT', courseLaunchVersion: writes.length ? 3 : 2})});
  });
  await page.goto('/advisor/courses/71/delivery');
  await expect(page.getByRole('button', {name: 'Edit details'})).toHaveCount(0);
  await expect(page.getByRole('alert')).toBeVisible();
  unavailable = false;
  await page.getByRole('button', {name: 'Retry', exact: true}).click();
  await page.getByRole('button', {name: 'Edit details'}).click();
  await expect(page.getByLabel('Catalog code', {exact: true})).toHaveValue('IELTS');
  await page.getByLabel('Catalog code', {exact: true}).fill('NEW-CATALOG');
  await page.getByRole('button', {name: 'Save changes'}).click();
  await expect(page.getByText('Version 3', {exact: true})).toBeVisible();
  expect(writes).toEqual([{catalogCode: 'NEW-CATALOG', capacity: 16, expectedCourseLaunchVersion: 2}]);
});

test('release audit: only the precise config-not-found response enables first configuration', async ({page}) => {
  await setupCourse(page);
  for (const code of ['COURSE_NOT_FOUND', 'COURSE_DELIVERY_CONFIG_NOT_FOUND']) {
    await page.route('**/v2/advisor/courses/71/delivery-config', route => route.fulfill({status: 404, json: {code, message: code}}));
    await page.goto('/advisor/courses/71/delivery');
    if (code === 'COURSE_NOT_FOUND') {
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByLabel('Catalog code', {exact: true})).toHaveCount(0);
    } else {
      await expect(page.getByLabel('Catalog code', {exact: true})).toBeVisible();
      await expect(page.getByRole('button', {name: 'Configure delivery'})).toBeDisabled();
      await page.getByRole('tab', {name: 'Schedule', exact: true}).click();
      await expect(page.getByRole('button', {name: 'Add session', exact: true})).toBeEnabled();
    }
  }
});

test('release audit: one-on-one, missing-version and published configurations cannot schedule here', async ({page}) => {
  await setupCourse(page);
  for (const config of [
    {deliveryMode: 'ONE_ON_ONE', launchState: 'DRAFT', courseLaunchVersion: 2},
    {deliveryMode: 'GROUP', launchState: 'DRAFT'},
    {deliveryMode: 'GROUP', launchState: 'PUBLISHED', courseLaunchVersion: 2},
  ]) {
    await page.route('**/v2/advisor/courses/71/delivery-config', route => route.fulfill({json: reply({courseId: 71, catalogCode: 'IELTS', capacity: 16, ...config})}));
    await page.goto('/advisor/courses/71/delivery?view=schedule');
    await expect(page.getByRole('heading', {name: 'Recurring sessions'})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Add session', exact: true})).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Generate dates'})).toHaveCount(0);
    await page.getByRole('tab', {name: 'Delivery', exact: true}).click();
    for (const button of await page.getByRole('button', {name: /Publish course|Validate/}).all()) await expect(button).toBeDisabled();
    if (config.deliveryMode === 'ONE_ON_ONE') await expect(page.getByRole('button', {name: 'Edit details'})).toHaveCount(0);
  }
});

test('release audit: direct schedule load generates course-local term dates through the documented endpoint', async ({page}) => {
  await setupCourse(page);
  const writes: Array<{body: unknown; key?: string}> = [];
  await page.route('**/v2/courses/71/session-occurrences/generate', route => {
    writes.push({body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']});
    return route.fulfill({json: reply([])});
  });
  await page.goto('/advisor/courses/71/delivery?view=schedule');
  await page.getByRole('button', {name: 'View class dates'}).click();
  await page.getByRole('button', {name: 'Generate dates'}).click();
  await page.getByRole('button', {name: 'Generate occurrences', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Generate dated occurrences'})).toHaveCount(0);
  expect(writes).toEqual([{body: {from: '2030-09-01', to: '2030-12-01'}, key: expect.any(String)}]);
});

test('release audit: recurring edit and duplicate use complete templates and distinct idempotent operations', async ({page}) => {
  await setupCourse(page);
  await page.route('**/v2/advisor/courses/71/delivery-config', route => route.fulfill({status: 404, json: {code: 'COURSE_DELIVERY_CONFIG_NOT_FOUND'}}));
  const writes: Array<{method: string; body: unknown; key?: string}> = [];
  const session = {id: 31, courseId: 71, type: 'Lecture', dayOfWeek: 'WED', startTime: '14:00:00', endTime: '15:30:00', location: 'Room 302', timezone: 'Asia/Singapore'};
  await page.route('**/v2/courses/71/sessions*', route => {
    if (route.request().method() === 'POST') writes.push({method: 'POST', body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']});
    return route.fulfill({json: reply(route.request().method() === 'GET' ? [session] : session)});
  });
  await page.route('**/v2/courses/71/sessions/31', route => {
    writes.push({method: 'PUT', body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key']});
    return route.fulfill({json: reply(session)});
  });
  await page.goto('/advisor/courses/71/delivery?view=schedule');
  await page.getByRole('button', {name: 'Edit', exact: true}).click();
  await page.getByLabel('Location (optional)').fill('Room 118');
  await page.getByRole('button', {name: 'Save session'}).click();
  await expect(page.getByRole('heading', {name: 'Edit recurring session'})).toHaveCount(0);
  await page.getByRole('button', {name: 'Duplicate', exact: true}).click();
  await page.getByLabel('Weekday').selectOption('FRI');
  await page.getByRole('region', {name: 'Add recurring session'}).getByRole('button', {name: 'Add session', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Add recurring session'})).toHaveCount(0);
  expect(writes).toEqual([
    {method: 'PUT', body: {type: 'Lecture', dayOfWeek: 'WED', startTime: '14:00', endTime: '15:30', location: 'Room 118'}, key: expect.any(String)},
    {method: 'POST', body: {type: 'Lecture', dayOfWeek: 'FRI', startTime: '14:00', endTime: '15:30', location: 'Room 302'}, key: expect.any(String)},
  ]);
  expect(writes[0].key).not.toBe(writes[1].key);
});

test('release audit: version conflict preserves input and retries with the refreshed version', async ({page}) => {
  await setupCourse(page);
  let version = 2;
  let conflict = true;
  const writes: Array<{expectedCourseLaunchVersion: number; catalogCode: string}> = [];
  await page.route('**/v2/advisor/courses/71/delivery-config', route => {
    if (route.request().method() === 'PUT') {
      writes.push(route.request().postDataJSON());
      if (conflict) {version = 3; return route.fulfill({status: 409, json: {code: 'COURSE_LAUNCH_VERSION_CONFLICT', message: 'Version conflict'}});}
      version = 4;
    }
    return route.fulfill({json: reply({courseId: 71, deliveryMode: 'GROUP', catalogCode: version === 4 ? 'PRESERVED' : 'IELTS', capacity: 16, launchState: 'DRAFT', courseLaunchVersion: version})});
  });
  await page.goto('/advisor/courses/71/delivery');
  await page.getByRole('button', {name: 'Edit details'}).click();
  await page.getByLabel('Catalog code', {exact: true}).fill('PRESERVED');
  await page.getByRole('button', {name: 'Save changes'}).click();
  await expect(page.getByRole('button', {name: 'Save changes'})).toBeDisabled();
  await page.getByRole('button', {name: 'Load latest delivery version'}).click();
  await expect(page.getByLabel('Catalog code', {exact: true})).toHaveValue('PRESERVED');
  conflict = false;
  await page.getByRole('button', {name: 'Save changes'}).click();
  await expect(page.getByText('Version 4', {exact: true})).toBeVisible();
  expect(writes.map(item => item.expectedCourseLaunchVersion)).toEqual([2, 3]);
});

test('release audit: returning to the list refreshes saved delivery data and summary counts', async ({page}) => {
  await setupCourse(page);
  let capacity = 16;
  let listingReads = 0;
  await page.route('**/v2/advisor/courses?*', route => {
    listingReads += 1;
    return route.fulfill({json: reply({items: [{courseId: 71, title: 'Academic Writing', courseCode: 'IELTS', launchState: 'DRAFT', capacity, activeStudents: 2}], total: 1, page: 0, size: 20})});
  });
  await page.route('**/v2/advisor/courses/71/delivery-config', route => {
    if (route.request().method() === 'PUT') capacity = route.request().postDataJSON().capacity;
    return route.fulfill({json: reply({courseId: 71, deliveryMode: 'GROUP', catalogCode: 'IELTS', capacity, launchState: 'DRAFT', courseLaunchVersion: capacity === 16 ? 2 : 3})});
  });
  await page.goto('/advisor/courses');
  await page.getByRole('link', {name: 'Manage delivery'}).click();
  await page.getByRole('button', {name: 'Edit details'}).click();
  await page.getByLabel('Capacity', {exact: true}).fill('24');
  await page.getByRole('button', {name: 'Save changes'}).click();
  await expect(page.getByText('Version 3', {exact: true})).toBeVisible();
  const readsBeforeReturn = listingReads;
  await page.getByRole('complementary', {name: 'Primary navigation'}).getByRole('link', {name: 'Course management'}).click();
  await expect(page.getByText('2 / 24 students enrolled')).toBeVisible();
  expect(listingReads).toBeGreaterThan(readsBeforeReturn);
});

test('release audit: changing course identity resets drafts even when versions coincide', async ({page}) => {
  await setupCourse(page);
  await page.route('**/v2/courses/72', route => route.fulfill({json: reply({id: 72, courseCode: 'SECOND', title: 'Second course'})}));
  await page.route('**/v2/advisor/courses/72/delivery-config', route => route.fulfill({json: reply({courseId: 72, deliveryMode: 'GROUP', catalogCode: 'SECOND-CATALOG', capacity: 30, launchState: 'DRAFT', courseLaunchVersion: 2})}));
  await page.route('**/v2/courses/72/sessions', route => route.fulfill({json: reply([])}));
  await page.goto('/advisor/courses/71/delivery');
  await page.getByRole('button', {name: 'Edit details'}).click();
  await page.getByLabel('Catalog code', {exact: true}).fill('UNSAVED-FIRST');
  await page.evaluate(() => {history.pushState({}, '', '/advisor/courses/72/delivery'); window.dispatchEvent(new PopStateEvent('popstate'));});
  await expect(page.getByRole('heading', {name: 'SECOND · Second course'})).toBeVisible();
  await page.getByRole('button', {name: 'Edit details'}).click();
  await expect(page.getByLabel('Catalog code', {exact: true})).toHaveValue('SECOND-CATALOG');
  await expect(page.getByLabel('Capacity', {exact: true})).toHaveValue('30');
});


async function setupCourse(page: Page, denied = false) {
  await fixture(page, 'ADVISOR');
  await page.route('**/v2/courses/71', route => route.fulfill({json: reply({id: 71, courseId: 71, courseCode: 'IELTS-201', title: 'Academic Writing and Speaking', termStartDate: '2030-09-01', termEndDate: '2030-12-01', primaryInstructor: {userId: 51, name: 'Course Instructor'}})}));
  await page.route('**/v2/advisor/courses/71/delivery-config', route => route.fulfill(denied
    ? {status: 403, json: {status: 403, code: 'ACCESS_DENIED', message: 'Access denied'}}
    : {json: reply({courseId: 71, deliveryMode: 'GROUP', catalogCode: 'IELTS', capacity: 16, launchState: 'DRAFT', courseLaunchVersion: 2, blockers: []})}));
  await page.route('**/v2/courses/71/sessions', route => route.fulfill({json: reply([{id: 31, courseId: 71, type: 'Lecture', dayOfWeek: 'WED', startTime: '14:00:00', endTime: '15:30:00', location: 'Room 302', timezone: 'Asia/Singapore'}])}));
  await page.route('**/v2/courses/71/session-occurrences?*', route => route.fulfill({json: reply([])}));
}

test('release audit: course routes preserve the same shell and fit their actual scroll container', async ({page}, info) => {
  await setupCourse(page);
  for (const width of [320, 390, 768, 1024, 1440, 1920, 2560]) {
    await page.setViewportSize({width, height: 1000});
    let shell: {header: number; navigation: number} | undefined;
    for (const route of ['/advisor', '/advisor/courses', '/advisor/courses/71/delivery?view=delivery', '/advisor/courses/71/delivery?view=schedule']) {
      await page.goto(route);
      await expect(page.getByRole('complementary', {name: 'Primary navigation'})).toBeVisible();
      await expect(page.getByRole('main').getByRole('heading', {level: 1})).toBeVisible();
      const dimensions = await page.evaluate(() => {
        const main = document.querySelector('main')!;
        const header = document.querySelector('header[role="banner"]') ?? document.querySelector('header');
        const navigation = document.querySelector('aside[aria-label="Primary navigation"]')!;
        return {viewport: document.documentElement.scrollWidth, content: main.scrollWidth, available: main.clientWidth, header: header!.getBoundingClientRect().height, navigation: navigation.getBoundingClientRect().width};
      });
      expect(dimensions.viewport, `${route} at ${width}px`).toBeLessThanOrEqual(width);
      expect(dimensions.content, `${route} actual main width at ${width}px`).toBeLessThanOrEqual(dimensions.available);
      if (!shell) shell = dimensions;
      expect(dimensions.header).toBe(shell.header);
      expect(dimensions.navigation).toBe(shell.navigation);
    }
    await page.screenshot({path: info.outputPath(`schedule-${width}.png`), fullPage: true, animations: 'disabled'});
  }
});

test('release audit: forbidden delivery must not enable scheduling writes', async ({page}) => {
  await setupCourse(page, true);
  await page.goto('/advisor/courses/71/delivery?view=schedule');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Add session', exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Generate dates', exact: true})).toHaveCount(0);
});

test('release audit: catalog input respects the consumed API maximum of 64', async ({page}) => {
  await setupCourse(page);
  await page.goto('/advisor/courses/71/delivery');
  await expect(page.getByText('Version 2', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Edit details'}).click();
  await expect(page.getByLabel('Catalog code', {exact: true})).toHaveAttribute('maxlength', '64');
});

test('release audit: maximum-length catalog codes stay within course cards', async ({page}) => {
  await setupCourse(page);
  const catalogCode = 'C'.repeat(64);
  await page.route('**/v2/advisor/courses?*', route => route.fulfill({json: reply({items: [{courseId: 71, courseCode: 'IELTS-201', catalogCode, title: 'Academic Writing', lifecycleState: 'Active', launchState: 'READY', activeStudents: 12, capacity: 16}], total: 1, page: 0, size: 20})}));
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height: 1000});
    await page.goto('/advisor/courses');
    await expect(page.getByText(catalogCode, {exact: true})).toBeVisible();
    const geometry = await page.getByRole('main').evaluate(main => ({available: main.clientWidth, content: main.scrollWidth}));
    expect(geometry.content, `Main scroll width at ${width}px`).toBeLessThanOrEqual(geometry.available);
    const code = page.getByText(catalogCode, {exact: true});
    const [codeBox, cardBox] = await Promise.all([code.boundingBox(), page.getByRole('article').first().boundingBox()]);
    const containers = await code.evaluate(element => {
      const result = [];
      for (let current: Element | null = element; current && result.length < 5; current = current.parentElement) {
        const css = getComputedStyle(current);
        result.push({className: current.className, width: css.width, minWidth: css.minWidth, columns: css.gridTemplateColumns, overflow: css.overflow, display: css.display});
      }
      return result;
    });
    expect(codeBox!.x + codeBox!.width, JSON.stringify(containers)).toBeLessThanOrEqual(cardBox!.x + cardBox!.width);
  }
});

test('new group courses prepare recurring sessions before delivery locks their templates', async ({page}) => {
  await setupCourse(page);
  let configured = false;
  const sessions: Array<{id: number; type: string; dayOfWeek: string; startTime: string; endTime: string}> = [];
  const mutations: string[] = [];
  await page.route('**/v2/advisor/courses/71/delivery-config', route => {
    if (route.request().method() === 'PUT') {configured = true; mutations.push('configure');}
    return configured
      ? route.fulfill({json: reply({courseId: 71, deliveryMode: 'GROUP', catalogCode: 'QA-WR', capacity: 2, launchState: 'DRAFT', courseLaunchVersion: 0})})
      : route.fulfill({status: 404, json: {code: 'COURSE_DELIVERY_CONFIG_NOT_FOUND'}});
  });
  await page.route('**/v2/courses/71/sessions', route => {
    if (route.request().method() === 'POST') {
      expect(configured).toBe(false);
      mutations.push('session');
      sessions.push({id: 32, ...route.request().postDataJSON()});
    }
    return route.fulfill({json: reply(route.request().method() === 'GET' ? sessions : sessions.at(-1))});
  });
  await page.goto('/advisor/courses/71/delivery');
  await page.getByLabel('Catalog code', {exact: true}).fill('QA-WR');
  await page.getByLabel('Capacity', {exact: true}).fill('2');
  await expect(page.getByRole('button', {name: 'Configure delivery', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: 'Set up schedule', exact: true}).click();
  await page.getByRole('button', {name: 'Add session', exact: true}).click();
  await page.getByRole('textbox', {name: 'Start time Open time picker', exact: true}).fill('11:00 AM');
  await page.getByRole('textbox', {name: 'End time Open time picker', exact: true}).fill('11:30 AM');
  await page.getByRole('region', {name: 'Add recurring session'}).getByRole('button', {name: 'Add session', exact: true}).click();
  await page.getByRole('tab', {name: 'Delivery', exact: true}).click();
  await page.getByRole('button', {name: 'Configure delivery', exact: true}).click();
  await expect(page.getByText('Version 0', {exact: true})).toBeVisible();
  await page.getByRole('tab', {name: 'Schedule', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Add session', exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'View class dates', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Generate dates'})).toBeEnabled();
  expect(mutations).toEqual(['session', 'configure']);
});
