import {isRecord} from '@/utils/apiError';
import i18n from '@/i18n';
import {formatNumber} from '@/i18n/formatting';
import type {QuestionSection} from '@/pages/MockExamSessionPage/runner/data/types';
import type {ListeningSection} from '@/pages/MockExamSessionPage/runner/data/listening/types';

export type QuestionSubject = 'listening' | 'reading';
export type Field = {
  labelKey: string;
  hintKey?: string;
  optional?: boolean;
} & (
  | {type: 'text'; multiline?: boolean}
  | {type: 'number'; questionId?: boolean}
  | {type: 'choice'; choices: readonly string[]}
  | {type: 'object'; fields: Record<string, Field>}
  | {type: 'list'; item: Field; min?: number}
  | {type: 'variant'; variants: Record<string, Field>}
);
const text = (labelKey: string, optional = false, multiline = false): Field => ({
  type: 'text',
  labelKey,
  optional,
  multiline,
});
const number = (labelKey: string, questionId = false): Field => ({
  type: 'number',
  labelKey,
  questionId,
});
const object = (labelKey: string, fields: Record<string, Field>): Field => ({
  type: 'object',
  labelKey,
  fields,
});
const list = (labelKey: string, item: Field, min = 1): Field => ({
  type: 'list',
  labelKey,
  item,
  min,
});
const id = number("common:admin.examFields.questionNumber", true);
const blank = object("exams:schema.blank", {
  id,
  before: text("exams:schema.beforeBlank", true, true),
  after: text("exams:schema.afterBlank", true, true),
});
const choice = object("exams:schema.option", {
  key: text("exams:schema.optionLabel"),
  text: text("exams:schema.optionText"),
});
const options = list(
  "assessment:quiz.options",
  {...text("exams:schema.option"), hintKey: "exams:schema.optionHint"},
  2,
);
const cells: Field = {
  type: 'variant',
  labelKey: "exams:schema.cell",
  variants: {
    text: object("common:admin.examFields.text", {value: text("exams:schema.cellText")}),
    gap: object("exams:schema.answerBlank", {id}),
  },
};
const steps: Field = {
  type: 'variant',
  labelKey: "exams:schema.step",
  variants: {
    text: object("common:admin.examFields.text", {value: text("exams:schema.stepText")}),
    gap: object("exams:schema.answerBlank", {
      id,
      before: text("exams:schema.beforeBlank", true),
      after: text("exams:schema.afterBlank", true),
    }),
  },
};
const summaryPart: Field = {
  type: 'variant',
  labelKey: "exams:schema.summaryItem",
  variants: {
    text: object("common:admin.examFields.text", {value: text("exams:schema.summaryText", false, true)}),
    gap: object("exams:schema.answerBlank", {id}),
  },
};
const common = {
  mcq: object("exams:schema.singleChoiceQuestions", {
    questions: list(
      "common:admin.examFields.questions",
      object("assessment:quiz.question", {
        id,
        prompt: text("exams:schema.questionText", false, true),
        options,
      }),
    ),
  }),
  multiSelect: object("exams:schema.multipleChoiceQuestion", {
    prompt: text("exams:schema.questionText", false, true),
    chooseCount: number("exams:schema.chooseCount"),
    questionIds: list("exams:schema.answerSlots", id),
    options,
  }),
  sentenceCompletion: object("exams:schema.sentenceCompletion", {
    questions: list("exams:schema.sentences", blank),
  }),
  summaryBank: object("exams:schema.summaryCompletion", {
    wordBank: list("exams:schema.wordBank", text("exams:schema.wordOption")),
    parts: list("exams:schema.summaryContent", summaryPart),
  }),
  matching: object("exams:schema.matching", {
    listLabel: text("exams:schema.optionsHeading"),
    choices: list("common:admin.examFields.options", choice),
    questions: list(
      "common:admin.examFields.questions",
      object("assessment:quiz.question", {
        id,
        statement: text("exams:schema.statementMatch", false, true),
      }),
    ),
  }),
  shortAnswer: object("exams:schema.shortAnswerQuestions", {
    questions: list(
      "common:admin.examFields.questions",
      object("assessment:quiz.question", {id, prompt: text("exams:schema.questionText", false, true)}),
    ),
  }),
};
const table = object("exams:schema.tableCompletion", {
  caption: text("exams:schema.tableTitle", true),
  headers: list("exams:schema.columnHeadings", text("exams:schema.columnHeading")),
  rows: list("exams:schema.rows", list("exams:schema.cells", cells)),
});
const flowchart = object("exams:schema.flowchartCompletion", {
  steps: list("exams:schema.steps", steps),
});
const diagram = object("exams:schema.diagramLabels", {
  caption: text("exams:schema.diagramTitle"),
  imageAlt: text("exams:schema.imageDescription"),
  labels: list("exams:schema.labels", object("common:admin.examFields.label", {id, prompt: text("exams:schema.labelPrompt")})),
});

export interface QuestionDefinition {
  kind: string;
  labelKey: string;
  descriptionKey: string;
  schema?: Field;
  /** Advanced types can validate known answer slots without enabling a form. */
  answerSchema?: Field;
}
// These are existing student-renderer shapes, NOT a claim that the generic
// OpenAPI specifies each payload shape. Answer-key rules live in answerKeys.ts.
const sharedDefinitions = [
  {
    kind: 'mcq',
    labelKey: "exams:schema.singleChoice",
    descriptionKey:
      "exams:schema.singleChoiceHelp",
    schema: common.mcq,
  },
  {
    kind: 'multiSelect',
    labelKey: "exams:schema.multipleChoice",
    descriptionKey:
      "exams:schema.multipleChoiceHelp",
    schema: common.multiSelect,
  },
  {
    kind: 'sentenceCompletion',
    labelKey: "exams:schema.sentenceCompletion",
    descriptionKey: "exams:schema.sentenceCompletionHelp",
    schema: common.sentenceCompletion,
  },
  {
    kind: 'summaryBank',
    labelKey: "exams:schema.summaryBank",
    descriptionKey:
      "exams:schema.summaryBankHelp",
    schema: common.summaryBank,
  },
  {
    kind: 'matching',
    labelKey: "exams:schema.matching",
    descriptionKey: "exams:schema.matchingHelp",
    schema: common.matching,
  },
  {
    kind: 'shortAnswer',
    labelKey: "assessment:quiz.shortAnswer",
    descriptionKey: "exams:schema.shortAnswerHelp",
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
      labelKey: "exams:schema.formCompletion",
      descriptionKey: "exams:schema.formCompletionHelp",
      schema: object("exams:schema.form", {
        formTitle: text("exams:schema.formHeading"),
        fields: list(
          "exams:schema.formFields",
          object("exams:schema.formField", {id, label: text("exams:schema.fieldLabel")}),
        ),
      }),
    },
    {
      kind: 'notesCompletion',
      labelKey: "exams:schema.noteCompletion",
      descriptionKey: "exams:schema.listeningNotesHelp",
      schema: object("exams:schema.notes", {
        heading: text("exams:schema.notesHeading", true),
        blanks: list("exams:schema.notes", blank),
      }),
    },
    {
      kind: 'tableCompletion',
      labelKey: "exams:schema.tableCompletion",
      descriptionKey:
        "exams:schema.tableHelp",
      schema: table,
    },
    {
      kind: 'flowchartCompletion',
      labelKey: "exams:schema.flowchartCompletion",
      descriptionKey: "exams:schema.flowchartHelp",
      schema: flowchart,
    },
    {
      kind: 'planMap',
      answerSchema: object("exams:schema.mapLabels", {
        labels: list("exams:schema.labels", object("common:admin.examFields.label", {id})),
      }),
      labelKey: "exams:schema.planMap",
      descriptionKey:
        "exams:schema.planMapHelp",
    },
  ] satisfies (QuestionDefinition & {kind: ListeningSection['kind']})[],
  reading: [
    ...sharedDefinitions,
    {
      kind: 'tfng',
      labelKey: "exams:schema.tfng",
      descriptionKey:
        "exams:schema.tfngHelp",
      schema: object("exams:schema.statements", {
        questions: list(
          "exams:schema.statements",
          object("exams:schema.statement", {id, statement: text("exams:schema.statementText")}),
        ),
      }),
    },
    {
      kind: 'notes',
      labelKey: "exams:schema.noteCompletion",
      descriptionKey:
        "exams:schema.readingNotesHelp",
      schema: object("exams:schema.notes", {
        blocks: list(
          "exams:schema.noteGroups",
          object("exams:schema.noteGroup", {
            heading: text("exams:schema.heading"),
            blanks: list("exams:schema.notes", blank),
          }),
        ),
      }),
    },
    {
      kind: 'headings',
      labelKey: "exams:schema.matchingHeadings",
      descriptionKey: "exams:schema.matchingHeadingsHelp",
      schema: object("exams:schema.headings", {
        listLabel: text("exams:schema.headingsIntroduction"),
        headings: list("exams:schema.headings", choice),
        questions: list(
          "exams:schema.paragraphsMatch",
          object("exams:schema.paragraph", {id, paragraphLabel: text("exams:schema.paragraphLabel")}),
        ),
      }),
    },
    {
      kind: 'sentenceEndings',
      labelKey: "exams:schema.matchingEndings",
      descriptionKey: "exams:schema.matchingEndingsHelp",
      schema: object("exams:schema.sentenceEndings", {
        listLabel: text("exams:schema.endingsIntroduction"),
        endings: list("exams:schema.endings", choice),
        questions: list(
          "exams:schema.sentenceBeginnings",
          object("exams:schema.sentence", {id, stem: text("exams:schema.sentenceBeginning")}),
        ),
      }),
    },
    {
      kind: 'table',
      labelKey: "exams:schema.tableCompletion",
      descriptionKey:
        "exams:schema.tableHelp",
      schema: table,
    },
    {
      kind: 'flowchart',
      labelKey: "exams:schema.flowchartCompletion",
      descriptionKey: "exams:schema.flowchartHelp",
      schema: flowchart,
    },
    {
      kind: 'diagram',
      labelKey: "exams:schema.diagramLabelling",
      descriptionKey:
        "exams:schema.diagramHelp",
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
  const name = path || i18n.t(field.labelKey);
  if (value === undefined && field.optional) return [];
  if (!fitsField(field, value))
    return [
      i18n.t('exams:validation.fieldMismatch', {name}),
    ];
  if (field.type === 'text')
    return !field.optional && !String(value).trim()
      ? [i18n.t('exams:validation.fieldText', {name})]
      : [];
  if (field.type === 'number')
    return !Number.isSafeInteger(value) || Number(value) < 1
      ? [i18n.t('exams:validation.fieldInteger', {name})]
      : [];
  if (field.type === 'choice')
    return field.choices.includes(String(value))
      ? []
      : [i18n.t('exams:validation.fieldChoice', {name})];
  if (field.type === 'list' && Array.isArray(value))
    return [
      ...(value.length < (field.min ?? 1)
        ? [i18n.t('exams:validation.fieldItems', {name, count: field.min ?? 1, number: formatNumber(field.min ?? 1)})]
        : []),
      ...value.flatMap((item, index) =>
        fieldErrors(field.item, item, i18n.t('exams:authoring.numberedField', {field: name, number: formatNumber(index + 1)})),
      ),
    ];
  if (field.type === 'object' && isRecord(value))
    return Object.entries(field.fields).flatMap(([key, item]) =>
      fieldErrors(item, value[key], `${name} / ${i18n.t(item.labelKey)}`),
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
    errors.push(i18n.t('exams:validation.numberedQuestionRequired'));
  if (new Set(numbers).size !== numbers.length)
    errors.push(i18n.t('exams:validation.uniqueQuestion'));
  if (Array.isArray(content.options) && kind === 'multiSelect') {
    if (Number(content.chooseCount) !== numbers.length)
      errors.push(
        i18n.t('exams:validation.slotCount'),
      );
    if (Number(content.chooseCount) > content.options.length)
      errors.push(i18n.t('exams:validation.enoughOptions'));
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
        i18n.t('exams:validation.optionLetters'),
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
      errors.push(i18n.t('exams:validation.uniqueOptionLabel'));
  }
  if (Array.isArray(content.rows) && Array.isArray(content.headers)) {
    const width = content.headers.length;
    if (content.rows.some((row) => !Array.isArray(row) || row.length !== width))
      errors.push(
        i18n.t('exams:validation.tableWidth'),
      );
  }
  return errors;
}
