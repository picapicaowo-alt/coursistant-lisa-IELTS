import {expect, test, type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const basePath = '/mock-exams?template=48&version=480';
const importedReading = {
  totalMinutes: 60,
  passages: [
    {
      seq: 3,
      shortLabel: 'Community libraries',
      title: 'A shared library',
      intro: 'Read carefully.',
      paragraphs: ['Libraries serve their communities.'],
      questions: [
        {
          sortOrder: 7,
          kind: 'tfng',
          title: 'Question 1',
          instruction: 'Choose an answer.',
          questionStart: 1,
          questionEnd: 1,
          payload: {
            questions: [
              {
                id: 1,
                statement: 'Libraries serve communities.',
                answer: 'TRUE',
              },
            ],
            metadata: {retain: true},
          },
        },
      ],
    },
    {
      seq: 9,
      shortLabel: 'Second passage',
      title: 'Transport',
      intro: '',
      paragraphs: ['A bus connects the towns.'],
      questions: [
        {
          sortOrder: 2,
          kind: 'backend_custom',
          title: 'Question 2',
          instruction: 'Read the question.',
          questionStart: 2,
          questionEnd: 2,
          payload: {
            questions: [{id: 2, answer: 'bus'}],
            backendMetadata: {retain: true},
          },
        },
      ],
    },
  ],
};
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
    if (section === 'authoring') return route.fulfill({json: envelope({...saved[path.split('/').at(-2)!] as object, contentRevision: 1})});
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
  test(`long multilingual content remains usable at ${width}px`, async ({
    page,
  }) => {
    await install(page);
    await page.setViewportSize({width, height: 1000});
    await page.goto(`${basePath}&section=listening`);
    await page
      .getByLabel('Part name', {exact: true})
      .fill('听力练习 — Universität accommodation registration 📝 '.repeat(8));
    await page
      .getByLabel('Question type', {exact: true})
      .selectOption('formCompletion');
    await page
      .getByLabel('Form / Form heading')
      .fill('Community registration '.repeat(30));
    await page
      .getByLabel('Instructions for students')
      .fill('请完整阅读说明。 Überprüfen Sie Ihre Antworten. '.repeat(20));
    await expect(page.getByLabel('Question type', {exact: true})).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page
      .getByRole('button', {name: 'Review & save', exact: true})
      .click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
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
      .getByRole('button', {name: 'Add Form field', exact: true})
      .click();
    await page
      .getByLabel('Form / Form fields 2 / Field label')
      .fill('Contact number');
    await page.getByLabel('Form / Form fields 1 / Official accepted answers').fill('Alice\nAlice Smith');
    await page.getByLabel('Form / Form fields 2 / Official accepted answers').fill('123456');
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
    await expect(review).toContainText('Content checks validate the supported answer format');
    await expect(page.getByLabel('Question type', {exact: true})).toBeHidden();
    await page.screenshot({path: `${directory}/review-${width}.png`});
    failSave();
    await page
      .getByRole('button', {name: 'Confirm and create section'})
      .click();
    await expect(page.getByRole('alert')).toContainText(
      'The section could not be created. Your draft is preserved.',
    );
    await expect(page.getByRole('alert')).not.toContainText('Synthetic save failure');
    await expect(review).toBeVisible();
    await page
      .getByRole('button', {name: 'Confirm and create section'})
      .click();
    await expect(
      page.getByRole('button', {name: 'Review & save', exact: true}),
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
                  {id: 1, label: 'Full name', answers: ['Alice', 'Alice Smith']},
                  {id: 2, label: 'Contact number', answer: '123456'},
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

for (const width of [1440, 768, 390, 320]) {
  test(`complete Reading file import previews and posts once at ${width}px`, async ({
    page,
  }) => {
    const {writes, unexpected} = await install(page);
    await page.setViewportSize({width, height: 1000});
    await page.goto(`${basePath}&section=reading`);
    await page
      .getByRole('button', {name: 'Import Reading JSON', exact: true})
      .click();
    const importDialog = page.getByRole('dialog', {
      name: 'Import Reading JSON',
      exact: true,
    });
    await expect(importDialog).toBeVisible();
    await expect(
      importDialog.getByText('Drag & drop a JSON file', {exact: true}),
    ).toBeVisible();
    await expect(page.getByLabel('Or paste complete Reading JSON')).toHaveCount(
      0,
    );
    await mkdir('.impeccable/review/mock-import-dialog', {recursive: true});
    await page.screenshot({
      path: `.impeccable/review/mock-import-dialog/upload-${width}.png`,
    });
    await page.getByLabel('Reading JSON file · up to 2 MB').setInputFiles({
      name: 'reading.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importedReading)),
    });
    await expect(
      importDialog.getByText('reading.json', {exact: true}),
    ).toBeVisible();
    await expect(
      importDialog.getByText('Loaded locally', {exact: false}).first(),
    ).toBeVisible();
    await page
      .getByRole('button', {name: 'Validate JSON', exact: true})
      .click();
    await expect(page.getByText('Ready to load', {exact: false})).toBeVisible();
    const importGeometry = await importDialog.evaluate((panel) => ({
      overflow: panel.scrollWidth - panel.clientWidth,
      left: panel.getBoundingClientRect().left,
      right: panel.getBoundingClientRect().right,
      top: panel.getBoundingClientRect().top,
      bottom: panel.getBoundingClientRect().bottom,
      modal: panel.matches(':modal'),
      bodyOverflow: document.body.style.overflow,
    }));
    expect(importGeometry.overflow).toBeLessThanOrEqual(1);
    expect(importGeometry.left).toBeGreaterThanOrEqual(8);
    expect(importGeometry.right).toBeLessThanOrEqual(width - 8);
    expect(importGeometry.top).toBeGreaterThanOrEqual(8);
    expect(importGeometry.bottom).toBeLessThanOrEqual(992);
    expect(importGeometry.modal).toBe(true);
    expect(importGeometry.bodyOverflow).toBe('hidden');
    await page
      .getByRole('button', {name: 'Load into editor', exact: true})
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `.impeccable/review/mock-import-dialog/validated-${width}.png`,
    });
    expect(writes).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page
      .getByRole('button', {name: 'Load into editor', exact: true})
      .click();
    await expect(importDialog).toHaveCount(0);
    await expect(page.getByLabel('Passage title')).toHaveValue(
      'A shared library',
    );
    await expect(page.getByLabel('Question type', {exact: true})).toHaveValue(
      'tfng',
    );
    expect(writes).toEqual([]);
    await page.reload();
    await expect(page.getByLabel('Passage title')).toHaveValue(
      'A shared library',
    );
    await page.getByLabel('Passage title').fill('A shared library — reviewed');
    await page
      .getByRole('button', {name: 'Review & save', exact: true})
      .click();
    await expect(
      page.getByRole('region', {name: 'Review section submission'}),
    ).toContainText('Second passage');
    expect(writes).toEqual([]);
    await page
      .getByRole('button', {name: 'Confirm and create section'})
      .click();
    await expect(
      page.getByRole('button', {name: 'Review & save', exact: true}),
    ).toBeVisible();
    expect(writes).toHaveLength(1);
    const expected = structuredClone(importedReading);
    expected.passages[0].title = 'A shared library — reviewed';
    expect(writes[0]).toEqual({
      path: '/v2/tenant/mock-exam-templates/48/versions/480/reading',
      body: expected,
    });
    expect(unexpected).toEqual([]);
  });
}

for (const width of [1440, 390]) {
  test(`Reading import modal preserves input and keyboard focus at ${width}px`, async ({
    page,
  }) => {
    const {writes} = await install(page);
    await page.setViewportSize({width, height: 720});
    await page.goto(`${basePath}&section=reading`);
    await page.getByLabel('Passage title').fill('Keep my draft');
    const trigger = page.getByRole('button', {
      name: 'Import Reading JSON',
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole('dialog', {
      name: 'Import Reading JSON',
      exact: true,
    });
    const fileInput = page.getByLabel('Reading JSON file · up to 2 MB');
    await expect(
      dialog.getByRole('button', {name: 'Close JSON import'}),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      dialog.getByRole('button', {name: 'Upload file', exact: true}),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      dialog.getByRole('button', {name: 'Paste JSON', exact: true}),
    ).toBeFocused();
    await fileInput.setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('{}'),
    });
    await expect(dialog.getByRole('alert')).toContainText(
      'Choose a .json file',
    );
    await expect(
      dialog.getByRole('button', {name: 'Validate JSON'}),
    ).toBeDisabled();

    const dropData = await page.evaluateHandle((body) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([JSON.stringify(body)], 'reading-dropped.json', {
          type: 'application/json',
        }),
      );
      return transfer;
    }, importedReading);
    await dialog
      .getByLabel('Reading JSON upload area')
      .dispatchEvent('drop', {dataTransfer: dropData});
    await dropData.dispose();
    await expect(
      dialog.getByText('reading-dropped.json', {exact: true}),
    ).toBeVisible();
    await dialog.getByRole('button', {name: 'Paste JSON', exact: true}).click();
    const paste = dialog.getByLabel('Or paste complete Reading JSON');
    await paste.fill(JSON.stringify(importedReading, null, 2));
    await dialog
      .getByRole('button', {name: 'Validate JSON', exact: true})
      .click();
    const fieldGeometry = await paste.evaluate((field) => ({
      width: field.getBoundingClientRect().width,
      labelWidth: field.parentElement!.getBoundingClientRect().width,
      fontSize: getComputedStyle(field).fontSize,
    }));
    expect(fieldGeometry.width).toBeCloseTo(fieldGeometry.labelWidth, 0);
    expect(fieldGeometry.fontSize).toBe('16px');
    await mkdir('.impeccable/review/mock-import-dialog', {recursive: true});
    await page.screenshot({
      path: `.impeccable/review/mock-import-dialog/paste-${width}.png`,
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByLabel('Passage title')).toHaveValue('Keep my draft');
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      'hidden',
    );
    await trigger.click();
    await expect(paste).toHaveValue(JSON.stringify(importedReading, null, 2));
    await dialog
      .getByRole('button', {name: 'Upload file', exact: true})
      .click();
    await expect(
      dialog.getByText('reading-dropped.json', {exact: true}),
    ).toBeVisible();
    await dialog
      .getByRole('button', {name: 'Remove file', exact: true})
      .click();
    await expect(
      dialog.getByText('reading-dropped.json', {exact: true}),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole('button', {name: 'Validate JSON', exact: true}),
    ).toBeDisabled();
    await dialog.getByRole('button', {name: 'Cancel import'}).click();
    expect(writes).toEqual([]);
  });
}

test('Reading paste import protects existing work and rejects invalid media references', async ({
  page,
}) => {
  const {writes} = await install(page);
  await page.goto(`${basePath}&section=reading`);
  await page.getByLabel('Passage title').fill('Keep my draft');
  await page
    .getByRole('button', {name: 'Import Reading JSON', exact: true})
    .click();
  await page.getByRole('button', {name: 'Paste JSON', exact: true}).click();
  await page.getByLabel('Or paste complete Reading JSON').fill('{bad');
  await page.getByRole('button', {name: 'Validate JSON', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('JSON cannot be read');
  await expect(
    page.getByRole('button', {name: 'Load into editor'}),
  ).toHaveCount(0);
  await page
    .getByLabel('Or paste complete Reading JSON')
    .fill(JSON.stringify(importedReading));
  await page.getByRole('button', {name: 'Validate JSON', exact: true}).click();
  await page
    .getByRole('button', {name: 'Load into editor', exact: true})
    .click();
  await page.getByRole('dialog', {name: 'Import Reading JSON', exact: true}).getByRole('button', {name: 'Cancel', exact: true}).click();
  await expect(page.getByLabel('Passage title')).toHaveValue('Keep my draft');
  const withImage = {
    ...importedReading,
    passages: importedReading.passages.map((passage) => ({
      ...passage,
      questions: passage.questions.map((group) => ({
        ...group,
        imageMediaId: 999,
      })),
    })),
  };
  await page
    .getByLabel('Or paste complete Reading JSON')
    .fill(JSON.stringify(withImage));
  await page.getByRole('button', {name: 'Validate JSON', exact: true}).click();
  await page
    .getByRole('button', {name: 'Load into editor', exact: true})
    .click();
  await page.getByRole('dialog', {name: 'Import Reading JSON', exact: true}).getByRole('button', {name: 'Confirm', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText(
    'not an available Reading image in this version',
  );
  await expect(page.getByLabel('Passage title')).toHaveValue('Keep my draft');
  await page.getByRole('button', {name: 'Cancel import'}).click();
  await expect(page.getByLabel('Passage title')).toHaveValue('Keep my draft');
  expect(writes).toEqual([]);
});

test('reading and writing use text fields and retain drafts across section navigation', async ({
  page,
}) => {
  const {writes, unexpected} = await install(page);
  await page.goto(`${basePath}&section=reading`);
  await page
    .getByLabel('Reading duration (minutes)', {exact: false})
    .fill('60');
  await page.getByRole('button', {name: 'Add Paragraph', exact: true}).click();
  await page
    .getByLabel('Passage paragraphs 1', {exact: true})
    .fill('A library serves the whole community.');
  await page.getByLabel('Question type', {exact: true}).selectOption('tfng');
  await page
    .getByLabel('Statements / Statements 1 / Statement text')
    .fill('The library is open to the community.');
  await page.getByLabel('Statements / Statements 1 / Official accepted answers').fill('True');
  await page.reload();
  await expect(
    page.getByLabel('Passage paragraphs 1', {exact: true}),
  ).toHaveValue('A library serves the whole community.');
  await page.getByRole('button', {name: 'Review & save', exact: true}).click();
  await page.getByRole('button', {name: 'Confirm and create section'}).click();
  await expect(
    page.getByRole('button', {name: 'Review & save', exact: true}),
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
    page.getByRole('button', {name: 'Review & save', exact: true}),
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
  await page.getByRole('button', {name: 'Discard draft', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Cancel', exact: true}).click();
  await expect(page.getByLabel('Part name', {exact: true})).toHaveValue(
    'Unsaved listening part',
  );
  await page.getByRole('button', {name: 'Discard draft', exact: true}).click();
  await expect(page.getByRole('dialog')).toContainText('Uploaded files will not be deleted');
  await page.getByRole('dialog').getByRole('button', {name: 'Confirm', exact: true}).click();
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

test('official answers reject invalid input and save equivalent alternatives through retry', async ({page}) => {
  const {writes, failSave} = await install(page);
  await page.goto(`${basePath}&section=listening`);
  await page.getByLabel('Listening duration (minutes)', {exact: false}).fill('40');
  await page.getByLabel('Question type', {exact: true}).selectOption('shortAnswer');
  await page.getByLabel('Short-answer questions / Questions 1 / Question text').fill('What process?');
  await page.getByRole('radio').check();
  const answers = page.getByLabel('Short-answer questions / Questions 1 / Official accepted answers');
  await answers.fill('fermentation\nfermentation');
  await page.getByRole('button', {name: 'Review & save', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Review section submission'})).toHaveCount(0);
  expect(writes).toEqual([]);
  await answers.fill('fermentation\nfermentation process');
  await page.getByRole('button', {name: 'Review & save', exact: true}).click();
  failSave();
  await page.getByRole('button', {name: 'Confirm and create section'}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', {name: 'Confirm and create section'}).click();
  await expect(page.getByRole('button', {name: 'Review & save', exact: true})).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[0].body).toEqual(writes[1].body);
  expect(writes[1].body).toMatchObject({parts: [{sections: [{payload: {
    questions: [{id: 1, prompt: 'What process?', answers: ['fermentation', 'fermentation process']}],
  }}]}]});
  expect(JSON.stringify(writes[1].body)).not.toContain('"answer":');
});
