import {isRecord} from '@/utils/apiError';
import type {QuestionSection} from '@/pages/MockExamSessionPage/runner/data/types';
import type {ListeningSection} from '@/pages/MockExamSessionPage/runner/data/listening/types';

export type QuestionSubject = 'listening' | 'reading';
export type Field = {
  label: string;
  hint?: string;
  optional?: boolean;
} & (
  | {type: 'text'; multiline?: boolean}
  | {type: 'number'; questionId?: boolean}
  | {type: 'choice'; choices: readonly string[]}
  | {type: 'object'; fields: Record<string, Field>}
  | {type: 'list'; item: Field; min?: number}
  | {type: 'variant'; variants: Record<string, Field>}
);
const text = (label: string, optional = false, multiline = false): Field => ({
  type: 'text',
  label,
  optional,
  multiline,
});
const number = (label: string, questionId = false): Field => ({
  type: 'number',
  label,
  questionId,
});
const object = (label: string, fields: Record<string, Field>): Field => ({
  type: 'object',
  label,
  fields,
});
const list = (label: string, item: Field, min = 1): Field => ({
  type: 'list',
  label,
  item,
  min,
});
const id = number('Question number', true);
const blank = object('Blank', {
  id,
  before: text('Text before the blank', true, true),
  after: text('Text after the blank', true, true),
});
const choice = object('Option', {
  key: text('Option label'),
  text: text('Option text'),
});
const options = list(
  'Answer options',
  {...text('Option'), hint: 'Include the letter, for example A. Library.'},
  2,
);
const cells: Field = {
  type: 'variant',
  label: 'Cell',
  variants: {
    text: object('Text', {value: text('Cell text')}),
    gap: object('Answer blank', {id}),
  },
};
const steps: Field = {
  type: 'variant',
  label: 'Step',
  variants: {
    text: object('Text', {value: text('Step text')}),
    gap: object('Answer blank', {
      id,
      before: text('Text before the blank', true),
      after: text('Text after the blank', true),
    }),
  },
};
const summaryPart: Field = {
  type: 'variant',
  label: 'Summary item',
  variants: {
    text: object('Text', {value: text('Summary text', false, true)}),
    gap: object('Answer blank', {id}),
  },
};
const common = {
  mcq: object('Single-choice questions', {
    questions: list(
      'Questions',
      object('Question', {
        id,
        prompt: text('Question text', false, true),
        options,
      }),
    ),
  }),
  multiSelect: object('Multiple-choice question', {
    prompt: text('Question text', false, true),
    chooseCount: number('Number of answers to choose'),
    questionIds: list('Answer slots', id),
    options,
  }),
  sentenceCompletion: object('Sentence completion', {
    questions: list('Sentences', blank),
  }),
  summaryBank: object('Summary completion', {
    wordBank: list('Word bank', text('Word or labelled option')),
    parts: list('Summary content', summaryPart),
  }),
  matching: object('Matching', {
    listLabel: text('Options heading'),
    choices: list('Options', choice),
    questions: list(
      'Questions',
      object('Question', {
        id,
        statement: text('Statement to match', false, true),
      }),
    ),
  }),
  shortAnswer: object('Short-answer questions', {
    questions: list(
      'Questions',
      object('Question', {id, prompt: text('Question text', false, true)}),
    ),
  }),
};
const table = object('Table completion', {
  caption: text('Table title', true),
  headers: list('Column headings', text('Column heading')),
  rows: list('Rows', list('Cells', cells)),
});
const flowchart = object('Flowchart completion', {
  steps: list('Steps', steps),
});
const diagram = object('Diagram labels', {
  caption: text('Diagram title'),
  imageAlt: text('Image description'),
  labels: list('Labels', object('Label', {id, prompt: text('Label prompt')})),
});

export interface QuestionDefinition {
  kind: string;
  label: string;
  description: string;
  schema?: Field;
}
// These are existing student-renderer shapes, NOT a claim that the generic
// OpenAPI specifies authoring/answer-key validation. Do not add grading fields.
const sharedDefinitions = [
  {
    kind: 'mcq',
    label: 'Multiple choice · one answer',
    description:
      'A question with lettered options. The student selects one answer.',
    schema: common.mcq,
  },
  {
    kind: 'multiSelect',
    label: 'Multiple choice · several answers',
    description:
      'One prompt with several correct selections and a numbered slot for each answer.',
    schema: common.multiSelect,
  },
  {
    kind: 'sentenceCompletion',
    label: 'Sentence completion',
    description: 'A sentence with an answer blank between two pieces of text.',
    schema: common.sentenceCompletion,
  },
  {
    kind: 'summaryBank',
    label: 'Summary completion · word bank',
    description:
      'Build a summary from text and answer blanks, with a shared word bank.',
    schema: common.summaryBank,
  },
  {
    kind: 'matching',
    label: 'Matching',
    description: 'Students match each statement to a labelled option.',
    schema: common.matching,
  },
  {
    kind: 'shortAnswer',
    label: 'Short answer',
    description: 'A question followed by a short written answer.',
    schema: common.shortAnswer,
  },
] satisfies (QuestionDefinition & {
  kind: QuestionSection['kind'] & ListeningSection['kind'];
})[];

export const QUESTION_TYPES = {
  listening: [
    ...sharedDefinitions,
    {
      kind: 'formCompletion',
      label: 'Form completion',
      description: 'A form with a heading and labelled answer blanks.',
      schema: object('Form', {
        formTitle: text('Form heading'),
        fields: list(
          'Form fields',
          object('Form field', {id, label: text('Field label')}),
        ),
      }),
    },
    {
      kind: 'notesCompletion',
      label: 'Note completion',
      description: 'A heading and notes with answer blanks.',
      schema: object('Notes', {
        heading: text('Notes heading', true),
        blanks: list('Notes', blank),
      }),
    },
    {
      kind: 'tableCompletion',
      label: 'Table completion',
      description:
        'Add column headings, then cells containing text or an answer blank.',
      schema: table,
    },
    {
      kind: 'flowchartCompletion',
      label: 'Flowchart completion',
      description: 'Add ordered steps containing text or an answer blank.',
      schema: flowchart,
    },
    {
      kind: 'planMap',
      label: 'Plan / map labelling · advanced',
      description:
        'Use an existing, verified payload. Listening image authoring is not defined in the supplied API.',
    },
  ] satisfies (QuestionDefinition & {kind: ListeningSection['kind']})[],
  reading: [
    ...sharedDefinitions,
    {
      kind: 'tfng',
      label: 'True / False / Not Given',
      description:
        'Statements that students compare with the passage. Advanced data can retain Yes / No / Not Given options.',
      schema: object('Statements', {
        questions: list(
          'Statements',
          object('Statement', {id, statement: text('Statement text')}),
        ),
      }),
    },
    {
      kind: 'notes',
      label: 'Note completion',
      description:
        'Organize notes under headings, with an answer blank in each note.',
      schema: object('Notes', {
        blocks: list(
          'Note groups',
          object('Note group', {
            heading: text('Heading'),
            blanks: list('Notes', blank),
          }),
        ),
      }),
    },
    {
      kind: 'headings',
      label: 'Matching headings',
      description: 'A bank of headings to match to labelled paragraphs.',
      schema: object('Headings', {
        listLabel: text('Headings introduction'),
        headings: list('Headings', choice),
        questions: list(
          'Paragraphs to match',
          object('Paragraph', {id, paragraphLabel: text('Paragraph label')}),
        ),
      }),
    },
    {
      kind: 'sentenceEndings',
      label: 'Matching sentence endings',
      description: 'A bank of endings to match to sentence beginnings.',
      schema: object('Sentence endings', {
        listLabel: text('Endings introduction'),
        endings: list('Endings', choice),
        questions: list(
          'Sentence beginnings',
          object('Sentence', {id, stem: text('Sentence beginning')}),
        ),
      }),
    },
    {
      kind: 'table',
      label: 'Table completion',
      description:
        'Add column headings, then cells containing text or an answer blank.',
      schema: table,
    },
    {
      kind: 'flowchart',
      label: 'Flowchart completion',
      description: 'Add ordered steps containing text or an answer blank.',
      schema: flowchart,
    },
    {
      kind: 'diagram',
      label: 'Diagram labelling',
      description:
        'Write label prompts and attach the diagram in the Media section.',
      schema: diagram,
    },
  ] satisfies (QuestionDefinition & {kind: QuestionSection['kind']})[],
};
export function questionDefinition(
  subject: QuestionSubject,
  kind: string,
): QuestionDefinition | undefined {
  return QUESTION_TYPES[subject].find((definition) => definition.kind === kind);
}
export function parseContent(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
export function emptyValue(field: Field, nextId: () => number): unknown {
  switch (field.type) {
    case 'number':
      return field.questionId ? nextId() : 1;
    case 'choice':
      return field.choices[0] ?? '';
    case 'text':
      return '';
    case 'list':
      return Array.from({length: field.min ?? 1}, () =>
        emptyValue(field.item, nextId),
      );
    case 'object':
      return Object.fromEntries(
        Object.entries(field.fields).map(([key, item]) => [
          key,
          emptyValue(item, nextId),
        ]),
      );
    case 'variant': {
      const type = Object.keys(field.variants)[0];
      const value = emptyValue(field.variants[type], nextId);
      return {type, ...(isRecord(value) ? value : {})};
    }
  }
}
/** Structure-only checks keep partially completed forms editable, while never
 * coercing or erasing imported/custom payloads and unrecognized extra fields. */
export function fitsField(field: Field, value: unknown): boolean {
  if (value === undefined && field.optional) return true;
  switch (field.type) {
    case 'text':
    case 'choice':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' || value === '';
    case 'list':
      return (
        Array.isArray(value) &&
        value.every((item) => fitsField(field.item, item))
      );
    case 'object':
      return (
        isRecord(value) &&
        Object.entries(field.fields).every(([key, item]) =>
          fitsField(item, value[key]),
        )
      );
    case 'variant':
      return (
        isRecord(value) &&
        typeof value.type === 'string' &&
        Boolean(field.variants[value.type]) &&
        fitsField(field.variants[value.type], value)
      );
  }
}
export function fieldErrors(field: Field, value: unknown, path = ''): string[] {
  const name = path || field.label;
  if (value === undefined && field.optional) return [];
  if (!fitsField(field, value))
    return [
      `${name}: content does not match this editor. Check Advanced data.`,
    ];
  if (field.type === 'text')
    return !field.optional && !String(value).trim()
      ? [`${name}: enter text.`]
      : [];
  if (field.type === 'number')
    return !Number.isSafeInteger(value) || Number(value) < 1
      ? [`${name}: enter a positive whole number.`]
      : [];
  if (field.type === 'choice')
    return field.choices.includes(String(value))
      ? []
      : [`${name}: select an option.`];
  if (field.type === 'list' && Array.isArray(value))
    return [
      ...(value.length < (field.min ?? 1)
        ? [`${name}: add at least ${field.min ?? 1} item(s).`]
        : []),
      ...value.flatMap((item, index) =>
        fieldErrors(field.item, item, `${name} ${index + 1}`),
      ),
    ];
  if (field.type === 'object' && isRecord(value))
    return Object.entries(field.fields).flatMap(([key, item]) =>
      fieldErrors(item, value[key], `${name} / ${item.label}`),
    );
  if (field.type === 'variant' && isRecord(value))
    return fieldErrors(field.variants[String(value.type)], value, name);
  return [];
}
export function questionNumbers(value: unknown, field?: Field): number[] {
  // Only active answer slots defined by the renderer schema are question
  // numbers. Imported metadata and dormant IDs must remain untouched.
  if (!field) return [];
  if (field.type === 'number')
    return field.questionId && Number.isSafeInteger(value) && Number(value) > 0
      ? [Number(value)]
      : [];
  if (field.type === 'list' && Array.isArray(value))
    return value.flatMap((item) => questionNumbers(item, field.item));
  if (field.type === 'object' && isRecord(value))
    return Object.entries(field.fields).flatMap(([key, item]) =>
      questionNumbers(value[key], item),
    );
  if (field.type === 'variant' && isRecord(value))
    return questionNumbers(value, field.variants[String(value.type)]);
  return [];
}
export function contentErrors(
  subject: QuestionSubject,
  kind: string,
  content: unknown,
): string[] {
  const schema = questionDefinition(subject, kind)?.schema;
  if (!schema) return [];
  const errors = fieldErrors(schema, content);
  if (errors.length || !isRecord(content)) return errors;
  const numbers = questionNumbers(content, schema);
  if (!numbers.length)
    errors.push('Add at least one numbered question or answer blank.');
  if (new Set(numbers).size !== numbers.length)
    errors.push('Each question number must be used only once in this group.');
  if (Array.isArray(content.options) && kind === 'multiSelect') {
    if (Number(content.chooseCount) !== numbers.length)
      errors.push(
        'The number of answer slots must match the number of answers to choose.',
      );
    if (Number(content.chooseCount) > content.options.length)
      errors.push('Add enough options for the number of answers to choose.');
  }
  const checkOptions = (value: unknown) => {
    if (!isRecord(value) || !Array.isArray(value.options)) return;
    const labels = value.options.map((option) =>
      typeof option === 'string' ? option.charAt(0) : '',
    );
    if (
      labels.some((label) => !/^[A-Z]$/.test(label)) ||
      new Set(labels).size !== labels.length
    )
      errors.push(
        'Start every option with a different capital letter, for example A. Library.',
      );
  };
  if (kind === 'mcq' && Array.isArray(content.questions))
    content.questions.forEach(checkOptions);
  if (kind === 'multiSelect') checkOptions(content);
  const keyedOptions =
    kind === 'matching'
      ? content.choices
      : kind === 'headings'
        ? content.headings
        : kind === 'sentenceEndings'
          ? content.endings
          : undefined;
  if (Array.isArray(keyedOptions)) {
    const keys = keyedOptions.map((option) =>
      isRecord(option) ? String(option.key).trim() : '',
    );
    if (new Set(keys).size !== keys.length)
      errors.push('Use a different label for each answer option.');
  }
  if (Array.isArray(content.rows) && Array.isArray(content.headers)) {
    const width = content.headers.length;
    if (content.rows.some((row) => !Array.isArray(row) || row.length !== width))
      errors.push(
        'Every table row must have one cell for each column heading.',
      );
  }
  return errors;
}
