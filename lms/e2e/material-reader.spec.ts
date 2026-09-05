import {readFile} from 'node:fs/promises';
import {expect, test} from '@playwright/test';
import {fixture, reply} from './workspace-fixtures';

function readingPdf() {
  const stream = 'BT /F1 20 Tf 72 720 Td (Academic reading guide) Tj ET\n';
  const second = 'BT /F1 20 Tf 72 720 Td (Reading practice questions) Tj ET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    `<< /Length ${Buffer.byteLength(second)} >>\nstream\n${second}endstream`,
  ];
  let document = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {offsets.push(Buffer.byteLength(document)); document += `${index + 1} 0 obj\n${object}\nendobj\n`;});
  const xref = Buffer.byteLength(document);
  document += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(document);
}

test('course materials preview actual media, retry failures and preserve ordered navigation', async ({page}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await fixture(page);
  await page.goto('/');
  // Generate a playable local video so this check does not depend on any third-party media host.
  const video = Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
    const context = canvas.getContext('2d')!;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, {mimeType: 'video/webm;codecs=vp8'});
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const recording = new Promise<Blob>(resolve => {recorder.onstop = () => resolve(new Blob(chunks, {type: 'video/webm'}));});
    recorder.start();
    for (let frame = 0; frame < 4; frame += 1) {
      context.fillStyle = frame % 2 ? '#2f3545' : '#e6e3ff'; context.fillRect(0, 0, canvas.width, canvas.height);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    recorder.stop();
    const blob = await recording; stream.getTracks().forEach(track => track.stop());
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }));
  const pdf = readingPdf();
  const base = {courseId: 71, materialType: 'FILE', previewAvailable: true, linkUrl: null};
  const materials = [
    {...base, id: 121, weekId: 81, displayName: 'Writing demonstration', originalFilename: 'writing.webm', contentType: 'video/webm', extension: 'webm'},
    {...base, id: 132, weekId: 81, displayName: 'Academic reading guide', originalFilename: 'reading-guide.pdf', contentType: 'application/pdf', extension: 'pdf'},
  ];
  await page.route('**/v2/courses/71/weeks', route => route.fulfill({json: reply([
    {id: 81, title: 'Practice and reading', state: 'Published', materials},
    {id: 95, title: 'Reflection', state: 'Published', materials: [{...base, id: 244, weekId: 95, displayName: 'Reflection resource', materialType: 'LINK', previewAvailable: false, linkUrl: 'https://example.test/reflection'}]},
  ])}));
  let previewCalls = 0;
  let downloadCalls = 0;
  await page.route('**/v2/courses/71/weeks/81/materials/121/preview', route => {
    previewCalls += 1;
    return previewCalls === 1
      ? route.fulfill({status: 503, json: {message: 'Preview temporarily unavailable'}})
      : route.fulfill({contentType: 'video/webm', body: video});
  });
  await page.route('**/v2/courses/71/weeks/81/materials/132/preview', route => route.fulfill({contentType: 'application/pdf', body: pdf}));
  await page.route('**/v2/courses/71/weeks/81/materials/132/download', route => {
    downloadCalls += 1;
    return downloadCalls === 1 ? route.fulfill({json: {error: 'Unavailable'}}) : route.fulfill({contentType: 'application/pdf', body: pdf});
  });
  await page.goto('/course/71?materialId=121');
  const viewer = page.getByRole('region', {name: 'Course learning viewer'});
  await expect(viewer.getByRole('alert')).toBeVisible();
  await viewer.getByRole('button', {name: 'Retry', exact: true}).click();
  await expect(viewer.locator('video')).toHaveAttribute('controls', '');
  await viewer.locator('video').evaluate(async (element: HTMLVideoElement) => {await element.play();});
  await expect.poll(() => viewer.locator('video').evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
  expect(previewCalls).toBe(2);
  await viewer.getByRole('button', {name: /Go to next item/}).click();
  await expect(page).toHaveURL(/materialId=132/);
  const pdfPreview = viewer.getByRole('region', {name: 'Academic reading guide PDF preview'});
  const canvas = pdfPreview.locator('canvas');
  await expect(canvas).toHaveAttribute('data-rendered', 'true');
  // A Blob URL or successful fetch alone does not prove a PDF page was painted.
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data;
    let ink = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 0 && pixels[index] < 100 && pixels[index + 1] < 100 && pixels[index + 2] < 100) ink += 1;
    }
    return ink;
  })).toBeGreaterThan(100);
  await expect(pdfPreview.getByText('Page 1 of 2')).toBeVisible();
  await expect(pdfPreview.getByRole('button', {name: 'Previous PDF page'})).toBeDisabled();
  const pdfViewport = pdfPreview.locator('[aria-busy]');
  await pdfViewport.evaluate(element => {element.scrollTop = element.scrollHeight;});
  await expect.poll(() => pdfViewport.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await pdfPreview.getByRole('button', {name: 'Next PDF page'}).click();
  await expect(canvas).toHaveAttribute('data-rendered', 'true');
  await expect(pdfPreview).toContainText('Reading practice questions');
  await expect(pdfPreview.getByText('Page 2 of 2')).toBeVisible();
  await expect.poll(() => pdfViewport.evaluate(element => element.scrollTop)).toBe(0);
  await expect(pdfPreview.getByRole('button', {name: 'Next PDF page'})).toBeDisabled();
  const fitWidth = await canvas.evaluate(element => element.getBoundingClientRect().width);
  await pdfPreview.getByLabel('Zoom').selectOption('1.5');
  await expect.poll(() => canvas.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(fitWidth * 1.4);
  await pdfPreview.getByLabel('Zoom').selectOption('1');
  await pdfPreview.getByRole('button', {name: 'Previous PDF page'}).click();
  await expect(pdfPreview).toContainText('Academic reading guide');
  await expect(viewer.locator('video')).toHaveCount(0);
  await viewer.getByRole('button', {name: 'Download material', exact: true}).click();
  await expect(viewer.getByRole('alert')).toHaveText('The file could not be downloaded.');
  const downloadEvent = page.waitForEvent('download');
  await viewer.getByRole('button', {name: 'Download material', exact: true}).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('reading-guide.pdf');
  expect(await readFile((await download.path())!)).toEqual(pdf);
  await expect(viewer.getByRole('alert')).toHaveCount(0);
  for (const width of [390, 1440]) {
    await page.setViewportSize({width, height: 1000});
    await expect(canvas).toHaveAttribute('data-rendered', 'true');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path: `/tmp/xlearn-material-followup/pdf-${width}.png`, fullPage: true});
  }
  await viewer.getByRole('button', {name: /Go to next item/}).click();
  await expect(page).toHaveURL(/materialId=244/);
  await expect(viewer.getByRole('link', {name: /Open learning resource/})).toHaveAttribute('href', 'https://example.test/reflection');
  await expect(viewer.getByRole('button', {name: /Go to next item/})).toHaveCount(0);
  await viewer.getByRole('button', {name: /Back to course/}).click();
  await expect(page).toHaveURL(/\/course\/71$/);
  expect(pageErrors).toEqual([]);
});

test('a corrupt PDF has a recoverable error and retries protected preview bytes', async ({page}) => {
  await fixture(page);
  let requests = 0;
  await page.route('**/v2/courses/71/weeks', route => route.fulfill({json: reply([
    {id: 81, title: 'Reading', state: 'Published', materials: [{id: 132, courseId: 71, weekId: 81, materialType: 'FILE', displayName: 'Reading PDF', originalFilename: 'reading.pdf', contentType: 'application/pdf', previewAvailable: true}]},
  ])}));
  await page.route('**/v2/courses/71/weeks/81/materials/132/preview', route => {
    requests += 1;
    return route.fulfill({contentType: 'application/pdf', body: requests === 1 ? Buffer.from('%PDF-invalid') : readingPdf()});
  });
  await page.goto('/course/71?materialId=132');
  const preview = page.getByRole('region', {name: 'Reading PDF PDF preview'});
  await expect(preview.getByRole('alert')).toContainText('could not be opened');
  await preview.getByRole('button', {name: 'Retry PDF'}).click();
  await expect(preview.locator('canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(preview).toContainText('Academic reading guide');
  expect(requests).toBe(2);
});
