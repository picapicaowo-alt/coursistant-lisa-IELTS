import type {MockExamMediaRead} from '@/apis';
import {isRecord} from '@/utils/apiError';
import {newQuestion, newUnit, sectionIssues, type SectionDraft} from './model';

// A browser parsing/storage guard, not a claimed server upload limit.
export const READING_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const MAX_INT32 = 2 ** 31 - 1;

export interface ReadingImportResult {
  draft?: SectionDraft;
  errors: string[];
}

/** Read the existing CreateReadingRequest body, never an API response envelope.
 * Extra contract-level fields fail closed; arbitrary JsonNode fields survive. */
export function parseReadingImport(raw: string): ReadingImportResult {
  const errors: string[] = [];
  if (new TextEncoder().encode(raw).byteLength > READING_IMPORT_MAX_BYTES)
    return {
      errors: [
        'This browser importer accepts JSON up to 2 MB. Split oversized content with your content team.',
      ],
    };
  let value: unknown;
  try {
    value = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    return {
      errors: ['The JSON cannot be read. Check quotes, commas and brackets.'],
    };
  }
  const record = (input: unknown, path: string, keys: string[]) => {
    if (!isRecord(input)) {
      errors.push(`${path}: expected an object.`);
      return {};
    }
    const extra = Object.keys(input).filter((key) => !keys.includes(key));
    if (extra.length)
      errors.push(
        `${path}: unsupported fields (${extra.join(', ')}). Use the Reading request body, not a response envelope. Nothing will be discarded.`,
      );
    return input;
  };
  const integer = (input: unknown, path: string, max = MAX_INT32) => {
    if (
      typeof input !== 'number' ||
      !Number.isSafeInteger(input) ||
      input < 1 ||
      input > max
    ) {
      errors.push(
        `${path}: enter a positive whole number within the API integer range.`,
      );
      return 0;
    }
    return input;
  };
  const text = (input: unknown, path: string) => {
    if (input === undefined) return '';
    if (typeof input !== 'string') {
      errors.push(`${path}: expected text.`);
      return '';
    }
    return input;
  };
  const items = (input: unknown, path: string): unknown[] => {
    if (!Array.isArray(input) || !input.length) {
      errors.push(`${path}: include at least one item.`);
      return [];
    }
    return input;
  };
  const unique = (values: number[], path: string) => {
    if (new Set(values).size !== values.length)
      errors.push(`${path}: ordering values must be unique.`);
  };
  const root = record(value, 'Reading', ['totalMinutes', 'passages']);
  const draft: SectionDraft = {
    minutes: String(integer(root.totalMinutes, 'totalMinutes')),
    units: items(root.passages, 'passages').map((input, index) => {
      const path = `passages[${index}]`;
      const passage = record(input, path, [
        'seq',
        'shortLabel',
        'title',
        'intro',
        'paragraphs',
        'questions',
      ]);
      if (!('paragraphs' in passage))
        errors.push(`${path}.paragraphs: content is required.`);
      const questions = items(passage.questions, `${path}.questions`).map(
        (input, position) => {
          const groupPath = `${path}.questions[${position}]`;
          const group = record(input, groupPath, [
            'sortOrder',
            'kind',
            'title',
            'instruction',
            'questionStart',
            'questionEnd',
            'payload',
            'imageMediaId',
          ]);
          if (!('payload' in group))
            errors.push(`${groupPath}.payload: content is required.`);
          return {
            ...newQuestion(),
            sortOrder: integer(group.sortOrder, `${groupPath}.sortOrder`),
            kind: text(group.kind, `${groupPath}.kind`),
            title: text(group.title, `${groupPath}.title`),
            instruction: text(group.instruction, `${groupPath}.instruction`),
            start: String(
              integer(group.questionStart, `${groupPath}.questionStart`),
            ),
            end: String(integer(group.questionEnd, `${groupPath}.questionEnd`)),
            payload: JSON.stringify(group.payload ?? null),
            mediaId:
              group.imageMediaId === undefined
                ? null
                : integer(
                    group.imageMediaId,
                    `${groupPath}.imageMediaId`,
                    Number.MAX_SAFE_INTEGER,
                  ),
          };
        },
      );
      unique(
        questions.map((group) => group.sortOrder),
        `${path}.questions`,
      );
      return {
        ...newUnit(),
        seq: integer(passage.seq, `${path}.seq`),
        label: text(passage.shortLabel, `${path}.shortLabel`),
        title: text(passage.title, `${path}.title`),
        intro: text(passage.intro, `${path}.intro`),
        paragraphs: JSON.stringify(passage.paragraphs ?? null),
        questions: questions.sort((a, b) => a.sortOrder - b.sortOrder),
      };
    }),
  };
  unique(
    draft.units.map((unit) => unit.seq ?? 0),
    'passages',
  );
  draft.units.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  if (!errors.length)
    errors.push(
      ...sectionIssues('reading', draft).map(
        (issue) =>
          `${issue.unitIndex === null ? 'Reading' : `Passage ${issue.unitIndex + 1}`}${issue.groupIndex === undefined ? '' : ` / Group ${issue.groupIndex + 1}`}: ${issue.message}`,
      ),
    );
  return errors.length ? {errors} : {draft, errors};
}

export function readingImportMediaErrors(
  draft: SectionDraft,
  media: MockExamMediaRead[],
): string[] {
  const available = new Set(
    media
      .filter(
        (item) => item.kind === 'READING_IMAGE' && item.status === 'UPLOADED',
      )
      .map((item) => item.mediaId),
  );
  const references = new Set(
    draft.units.flatMap((unit) =>
      unit.questions.flatMap((group) =>
        group.mediaId === null ? [] : [group.mediaId],
      ),
    ),
  );
  return [...references]
    .filter((id) => !available.has(id))
    .map(
      (id) =>
        `Image ${id} is not an available Reading image in this version. Upload it here first and use its returned media ID, or remove imageMediaId and select an image after importing.`,
    );
}

export const READING_IMPORT_EXAMPLE = {
  totalMinutes: 60,
  passages: [
    {
      seq: 1,
      shortLabel: 'Passage 1',
      title: 'Example passage',
      intro: '',
      paragraphs: ['Replace this example with your passage text.'],
      questions: [
        {
          sortOrder: 1,
          kind: 'tfng',
          title: 'Questions 1–1',
          instruction: 'Choose True, False or Not Given.',
          questionStart: 1,
          questionEnd: 1,
          payload: {
            questions: [
              {
                id: 1,
                statement: 'Replace this example statement.',
                answer: 'True',
              },
            ],
          },
        },
      ],
    },
  ],
};
