import {describe, expect, it} from 'vitest';
import {readingPayload} from './model';
import {
  parseReadingImport,
  readingImportMediaErrors,
  READING_IMPORT_EXAMPLE,
  READING_IMPORT_MAX_BYTES,
} from './readingJson';

describe('complete Reading JSON import', () => {
  it('round-trips the existing Reading request through the manual editor', () => {
    const result = parseReadingImport(JSON.stringify(READING_IMPORT_EXAMPLE));
    expect(result.errors).toEqual([]);
    expect(result.draft).toBeDefined();
    expect(readingPayload(result.draft!)).toEqual(READING_IMPORT_EXAMPLE);
  });
  it('preserves structured paragraphs, custom payloads, answer metadata and sparse ordering', () => {
    const request = structuredClone(READING_IMPORT_EXAMPLE);
    request.passages[0].seq = 7;
    request.passages[0].questions[0].sortOrder = 12;
    const raw = {
      ...request,
      passages: request.passages.map((passage) => ({
        ...passage,
        paragraphs: {blocks: [{text: 'Keep rich content', style: 'bold'}]},
        questions: passage.questions.map((group) => ({
          ...group,
          kind: 'backend_custom',
          imageMediaId: 91,
          payload: {id: 999, answerKey: {1: ['A']}, opaque: {retain: true}},
        })),
      })),
    };
    const result = parseReadingImport('\uFEFF' + JSON.stringify(raw));
    expect(result.errors).toEqual([]);
    expect(readingPayload(result.draft!)).toEqual(raw);
  });
  it.each([
    '{bad',
    'null',
    '[]',
    '{"data":{}}',
    '{"totalMinutes":60,"passages":[]}',
  ])('rejects invalid roots without creating a draft: %s', (raw) => {
    const result = parseReadingImport(raw);
    expect(result.draft).toBeUndefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });
  it('never silently drops unknown contract-level fields', () => {
    const result = parseReadingImport(
      JSON.stringify({...READING_IMPORT_EXAMPLE, answerKey: {1: 'A'}}),
    );
    expect(result.errors.join()).toContain('unsupported fields (answerKey)');
    expect(result.draft).toBeUndefined();
  });
  it('validates content and API integer bounds before loading', () => {
    const request = structuredClone(READING_IMPORT_EXAMPLE);
    request.totalMinutes = 2 ** 31;
    request.passages[0].questions[0].questionStart = 0;
    expect(parseReadingImport(JSON.stringify(request)).errors.join()).toContain(
      'API integer range',
    );
    request.totalMinutes = 60;
    request.passages[0].questions[0].questionStart = 1;
    request.passages[0].questions[0].payload.questions[0].statement = '';
    expect(parseReadingImport(JSON.stringify(request)).errors.join()).toContain(
      'enter text',
    );
  });
  it('rejects repeated ordering and overlapping question ranges', () => {
    const request = structuredClone(READING_IMPORT_EXAMPLE);
    request.passages.push(structuredClone(request.passages[0]));
    expect(parseReadingImport(JSON.stringify(request)).errors.join()).toContain(
      'ordering values',
    );
    request.passages[1].seq = 2;
    expect(parseReadingImport(JSON.stringify(request)).errors.join()).toContain(
      'overlaps',
    );
  });
  it('checks image references against uploaded Reading media in the current version', () => {
    const {draft} = parseReadingImport(JSON.stringify(READING_IMPORT_EXAMPLE));
    draft!.units[0].questions[0].mediaId = 91;
    expect(readingImportMediaErrors(draft!, [])).toHaveLength(1);
    expect(
      readingImportMediaErrors(draft!, [
        {mediaId: 91, kind: 'LISTENING_AUDIO', status: 'UPLOADED'},
      ]),
    ).toHaveLength(1);
    expect(
      readingImportMediaErrors(draft!, [
        {mediaId: 91, kind: 'READING_IMAGE', status: 'UPLOADED'},
      ]),
    ).toEqual([]);
  });
  it('rejects oversized input before parsing', () => {
    expect(
      parseReadingImport(
        ' '.repeat(READING_IMPORT_MAX_BYTES + 1),
      ).errors.join(),
    ).toContain('2 MB');
  });
});
