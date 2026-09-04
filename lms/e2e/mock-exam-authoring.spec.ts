import {expect, test, type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const basePath = '/mock-exams?template=48&version=480';
const envelope = (data: unknown) => ({code: 'SUCCESS', status: 200, data});
async function install(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 1,
        userId: 1,
        role: 'TENANT_ADMIN',
        firstName: 'Grace',
        lastName: 'Tan',
        name: 'Grace Tan',
        accessToken: 'isolated-authoring-fixture',
      }),
    );
    localStorage.setItem('accToken', 'isolated-authoring-fixture');
  });
  const writes: {path: string; body: unknown}[] = [];
  const unexpected: string[] = [];
  const saved: Record<string, unknown> = {};
  let failNextSave = false;
  await page.route('**/v2/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const section = path.split('/').at(-1) ?? '';
    const version = {
      id: 480,
      versionNo: 1,
      status: 'DRAFT',
      hasListening: Boolean(saved.listening),
      hasReading: Boolean(saved.reading),
      hasWriting: Boolean(saved.writing),
    };
    if (path === '/v2/tenant/mock-exam-templates')
      return route.fulfill({
        json: envelope([
          {
            id: 48,
            title: 'Academic practice exam',
            label: 'AUTHORING QA',
            versions: [version],
          },
        ]),
      });
    if (
      request.method() === 'POST' &&
      ['listening', 'reading', 'writing'].includes(section)
    ) {
      writes.push({path, body: request.postDataJSON()});
      if (failNextSave) {
        failNextSave = false;
        return route.fulfill({
          status: 500,
          json: {message: 'Synthetic save failure; retry the same draft.'},
        });
      }
      saved[section] = request.postDataJSON();
      return route.fulfill({json: envelope(saved[section])});
    }
    if (path === '/v2/tenant/mock-exam-templates/48')
      return route.fulfill({
        json: envelope({
          id: 48,
          title: 'Academic practice exam',
          label: 'AUTHORING QA',
          versions: [version],
        }),
      });
    if (path === '/v2/tenant/mock-exam-templates/48/versions/480')
      return route.fulfill({json: envelope(version)});
    if (path.endsWith('/media'))
      return route.fulfill({
        json: envelope([
          {
            mediaId: 11,
            kind: 'LISTENING_AUDIO',
            status: 'UPLOADED',
            fileName: 'part-1.mp3',
          },
        ]),
      });
    if (['listening', 'reading', 'writing'].includes(section))
      return route.fulfill({json: envelope(saved[section])});
    unexpected.push(`${request.method()} ${path}`);
    return route.fulfill({
      status: 404,
      json: {message: 'Unmapped authoring fixture'},
    });
  });
  return {
    writes,
    unexpected,
    failSave: () => {
      failNextSave = true;
    },
  };
}

for (const width of [320, 768]) {
  test(`long multilingual content remains usable at ${width}px`, async ({page}) => {
    await install(page);
    await page.setViewportSize({width, height: 1000});
    await page.goto(`${basePath}&section=listening`);
    await page.getByLabel('Part name', {exact: true}).fill('听力练习 — Universität accommodation registration 📝 '.repeat(8));
    await page.getByLabel('Question type', {exact: true}).selectOption('formCompletion');
    await page.getByLabel('Form / Form heading').fill('Community registration '.repeat(30));
    await page.getByLabel('Instructions for students').fill('请完整阅读说明。 Überprüfen Sie Ihre Antworten. '.repeat(20));
    await expect(page.getByLabel('Question type', {exact: true})).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('button', {name: 'Review & save', exact: true}).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

for (const width of [1752, 1440, 1024, 390]) {
  test(`guided authoring, preview, review and retry at ${width}px`, async ({
    page,
  }) => {
    const {writes, unexpected, failSave} = await install(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({width, height: width === 1752 ? 1246 : 1000});
    await page.goto(`${basePath}&section=listening`);
    await page
      .getByLabel('Listening duration (minutes)', {exact: false})
      .fill('40');
    await page
      .getByLabel('Question type', {exact: true})
      .selectOption('formCompletion');
    await page
      .getByLabel('Form / Form heading')
      .fill('Community centre registration');
    await page
      .getByLabel('Form / Form fields 1 / Field label')
      .fill('Full name');
    await page
      .getByRole('button', {name: 'Add form field', exact: true})
      .click();
    await page
      .getByLabel('Form / Form fields 2 / Field label')
      .fill('Contact number');
    await page.getByRole('radio').check();
    await page.getByText('Preview this question group', {exact: true}).click();
    await page
      .getByRole('textbox', {name: 'Question 1', exact: true})
      .fill('Practice answer');
    expect(writes).toEqual([]);
    await page
      .getByLabel('Instructions for students')
      .fill('Write no more than two words for each answer.');
    await expect(page.getByLabel('First question number')).toHaveValue('1');
    await expect(page.getByLabel('Last question number')).toHaveValue('2');
    const directory = '.impeccable/review/mock-authoring-reference';
    await mkdir(directory, {recursive: true});
    await page.getByRole('heading', {level: 1}).scrollIntoViewIfNeeded();
    await page.screenshot({path: `${directory}/overview-${width}.png`});
    const tabs = page.getByRole('navigation', {name: 'Exam sections'});
    expect(
      await tabs.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await expect(
      page.getByRole('complementary', {name: 'Section outline'}),
    ).toHaveCount(0);
    expect(
      await page.locator('fieldset > section > div > h2').allTextContents(),
    ).toEqual(['Part Settings', 'Content', 'Media', 'Question Configuration']);
    await expect(page.getByLabel('Instructions for students')).toBeVisible();
    const settings = page.getByRole('heading', {
      name: 'Part Settings',
      exact: true,
    });
    expect(
      await settings.evaluate((heading) =>
        heading
          .closest('section')!
          .contains(document.querySelector('input[required][type="number"]')),
      ),
    ).toBe(true);
    await page
      .getByRole('heading', {name: 'Media', exact: true})
      .scrollIntoViewIfNeeded();
    await page.screenshot({path: `${directory}/media-${width}.png`});
    await page
      .getByLabel('Question type', {exact: true})
      .scrollIntoViewIfNeeded();
    await page.screenshot({path: `${directory}/form-${width}.png`});
    const group = page.getByRole('region', {
      name: 'Question configuration',
      exact: true,
    });
    const metrics = await group.evaluate((panel) => {
      const select = panel.querySelector('select')!;
      const label = select.closest('label')!;
      const heading = panel.querySelector('h2')!;
      const field = panel.querySelector(
        'input[type="text"], input:not([type])',
      )!;
      const selectStyle = getComputedStyle(select);
      const labelStyle = getComputedStyle(label);
      return {
        fontSize: selectStyle.fontSize,
        // Native select menus report normal line-height in Chromium. Measure
        // the actual text field for the authoring text rhythm instead.
        lineHeight: getComputedStyle(field).lineHeight,
        height: select.getBoundingClientRect().height,
        labelSize: labelStyle.fontSize,
        labelLineHeight: parseFloat(labelStyle.lineHeight),
        panelPadding: parseFloat(getComputedStyle(panel).paddingLeft),
        headingAlignment: Math.abs(
          heading.getBoundingClientRect().left -
            select.getBoundingClientRect().left,
        ),
        fieldAlignment: Math.abs(
          field.getBoundingClientRect().left -
            select.getBoundingClientRect().left,
        ),
        fieldWidth: field.getBoundingClientRect().width,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(metrics.fontSize).toBe('16px');
    expect(metrics.lineHeight).toBe('24px');
    expect(metrics.height).toBeGreaterThanOrEqual(54);
    expect(metrics.labelSize).toBe('16px');
    expect(metrics.labelLineHeight).toBeGreaterThanOrEqual(26);
    expect(metrics.panelPadding).toBeCloseTo(
      width > 700 ? Math.min(40, Math.max(24, width * 0.025)) : 20,
      1,
    );
    expect(metrics.headingAlignment).toBeLessThanOrEqual(1);
    expect(metrics.fieldAlignment).toBeLessThanOrEqual(1);
    expect(metrics.fieldWidth).toBeGreaterThanOrEqual(width > 700 ? 400 : 280);
    expect(metrics.pageOverflow).toBeLessThanOrEqual(1);
    await expect(page.locator('main').first()).toBeVisible();
    expect(
      await page
        .locator('main')
        .first()
        .evaluate((main) => main.scrollWidth - main.clientWidth),
    ).toBeLessThanOrEqual(1);
    await page
      .getByRole('button', {name: 'Review & save', exact: true})
      .click();
    const review = page.getByRole('region', {
      name: 'Review section submission',
    });
    await expect(review).toBeVisible();
    await expect(review).toContainText('Questions 1–2');
    await expect(review).toContainText('answer key or scoring');
    await expect(page.getByLabel('Question type', {exact: true})).toBeHidden();
    await page.screenshot({path: `${directory}/review-${width}.png`});
    failSave();
    await page
      .getByRole('button', {name: 'Confirm and create section'})
      .click();
    await expect(page.getByRole('alert')).toContainText(
      'Synthetic save failure',
    );
    await expect(review).toBeVisible();
    await page
      .getByRole('button', {name: 'Confirm and create section'})
      .click();
    await expect(
      page.getByText('This saved section is read only.', {exact: false}),
    ).toBeVisible();
    expect(writes).toHaveLength(2);
    expect(writes[0].body).toEqual(writes[1].body);
    expect(writes[1].body).toMatchObject({
      parts: [
        {
          seq: 1,
          label: 'Part 1',
          audioMediaId: 11,
          sections: [
            {
              kind: 'formCompletion',
              questionStart: 1,
              questionEnd: 2,
              payload: {
                formTitle: 'Community centre registration',
                fields: [
                  {id: 1, label: 'Full name'},
                  {id: 2, label: 'Contact number'},
                ],
              },
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(writes)).not.toContain('Practice answer');
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('reading and writing use text fields and retain drafts across section navigation', async ({
  page,
}) => {
  const {writes, unexpected} = await install(page);
  await page.goto(`${basePath}&section=reading`);
  await page
    .getByLabel('Reading duration (minutes)', {exact: false})
    .fill('60');
  await page.getByRole('button', {name: 'Add paragraph', exact: true}).click();
  await page
    .getByLabel('Passage paragraphs 1', {exact: true})
    .fill('A library serves the whole community.');
  await page.getByLabel('Question type', {exact: true}).selectOption('tfng');
  await page
    .getByLabel('Statements / Statements 1 / Statement text')
    .fill('The library is open to the community.');
  await page.reload();
  await expect(
    page.getByLabel('Passage paragraphs 1', {exact: true}),
  ).toHaveValue('A library serves the whole community.');
  await page.getByRole('button', {name: 'Review & save', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm and create section'}).click();
  await expect(
    page.getByText('This saved section is read only.', {exact: false}),
  ).toBeVisible();
  await page.goto(`${basePath}&section=writing`);
  await page
    .getByLabel('Writing duration (minutes)', {exact: false})
    .fill('60');
  await page
    .getByLabel('Writing prompt')
    .fill('Discuss how libraries support a community.');
  await page.getByLabel('Minimum words').fill('250');
  await page.getByRole('button', {name: 'Review & save', exact: true}).click();
  await expect(
    page.getByRole('region', {name: 'Review section submission'}),
  ).toContainText('Discuss how libraries support a community.');
  await page.getByRole('button', {name: 'Confirm and create section'}).click();
  await expect(
    page.getByText('This saved section is read only.', {exact: false}),
  ).toBeVisible();
  expect(writes[0].body).toMatchObject({
    passages: [
      {
        shortLabel: 'Passage 1',
        paragraphs: ['A library serves the whole community.'],
      },
    ],
  });
  expect(writes[1].body).toMatchObject({
    tasks: [{title: 'Task 1', taskKey: 'task-1', minWords: 250}],
  });
  expect(unexpected).toEqual([]);
});

test('discard confirms its scope, preserves another section and does not delete uploaded media', async ({
  page,
}) => {
  const {writes, unexpected} = await install(page);
  await page.goto(`${basePath}&section=writing`);
  await page.getByLabel('Writing prompt').fill('Keep this writing task.');
  await page.goto(`${basePath}&section=listening`);
  await page
    .getByLabel('Part name', {exact: true})
    .fill('Unsaved listening part');
  await page.getByRole('radio').check();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', {name: 'Discard draft', exact: true}).click();
  await expect(page.getByLabel('Part name', {exact: true})).toHaveValue(
    'Unsaved listening part',
  );
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Uploaded files will not be deleted');
    await dialog.accept();
  });
  await page.getByRole('button', {name: 'Discard draft', exact: true}).click();
  await expect(page).toHaveURL(/version=480$/);
  await page.goto(`${basePath}&section=listening`);
  await expect(page.getByLabel('Part name', {exact: true})).toHaveValue('');
  await expect(page.getByRole('radio')).not.toBeChecked();
  await page.goto(`${basePath}&section=writing`);
  await expect(page.getByLabel('Writing prompt')).toHaveValue(
    'Keep this writing task.',
  );
  expect(writes).toEqual([]);
  expect(unexpected).toEqual([]);
});

test('review finds hidden-part errors and changing a type never silently clears content', async ({
  page,
}) => {
  const {writes} = await install(page);
  await page.goto(`${basePath}&section=listening`);
  await page
    .getByLabel('Question type', {exact: true})
    .selectOption('formCompletion');
  await page.getByLabel('Form / Form heading').fill('Keep this heading');
  await page.getByLabel('Question type', {exact: true}).selectOption('mcq');
  await expect(page.getByRole('alert')).toContainText(
    'Replace the question content?',
  );
  await page.getByRole('button', {name: 'Keep current type'}).click();
  await expect(page.getByLabel('Form / Form heading')).toHaveValue(
    'Keep this heading',
  );
  await page.getByRole('button', {name: 'Add part', exact: true}).click();
  await page.getByRole('button', {name: 'Review & save', exact: true}).click();
  await page
    .getByRole('button', {
      name: 'Part 1: Upload and select audio for this part.',
      exact: true,
    })
    .click();
  await expect(page.getByLabel('Form / Form heading')).toHaveValue(
    'Keep this heading',
  );
  expect(writes).toEqual([]);
});
