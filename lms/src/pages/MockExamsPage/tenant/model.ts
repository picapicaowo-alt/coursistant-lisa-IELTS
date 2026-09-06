import i18n from '@/i18n';
import {LocalizedError} from '@/i18n/errors';
import {formatNumber} from '@/i18n/formatting';
import {objectiveAnswerErrors} from './answerKeys';
import {questionPayloadObject} from '@/utils/mockExamAnswers';
import {BookOpenText, Headphones, PenLine} from 'lucide-react';
import type {
  CreateMockExamListeningRequest,
  CreateMockExamReadingRequest,
  CreateMockExamWritingRequest,
  MockExamMediaKind,
  MockExamTemplateVersionSummary,
} from '@/apis';
import {
  contentErrors,
  parseContent,
  questionDefinition,
  questionNumbers,
} from './questionSchema';

export const SECTION_META = {
  listening: {
    labelKey: 'common:admin.examSections.listening',
    Icon: Headphones,
    unitKey: 'exams:authoring.part',
    numberKey: 'exams:authoring.partNumber',
    mediaKind: 'LISTENING_AUDIO',
    flag: 'hasListening',
  },
  reading: {
    labelKey: 'common:admin.examSections.reading',
    Icon: BookOpenText,
    unitKey: 'exams:authoring.passage',
    numberKey: 'exams:authoring.passageNumber',
    mediaKind: 'READING_IMAGE',
    flag: 'hasReading',
  },
  writing: {
    labelKey: 'common:admin.examSections.writing',
    Icon: PenLine,
    unitKey: 'exams:authoring.task',
    numberKey: 'exams:authoring.taskNumber',
    mediaKind: 'WRITING_IMAGE',
    flag: 'hasWriting',
  },
} satisfies Record<
  string,
  {
    labelKey: string;
    Icon: typeof Headphones;
    unitKey: string;
    numberKey: string;
    mediaKind: MockExamMediaKind;
    flag: keyof MockExamTemplateVersionSummary;
  }
>;
export type Section = keyof typeof SECTION_META;
export const SECTIONS = Object.keys(SECTION_META) as Section[];
export function isSection(value: string | null): value is Section {
  return value !== null && SECTIONS.some((section) => section === value);
}
export interface QuestionDraft {
  draftId: string;
  /** Imported API ordering is retained, including non-contiguous values. */
  sortOrder?: number;
  title: string;
  instruction: string;
  kind: string;
  payload: string;
  start: string;
  end: string;
  mediaId: number | null;
}
export interface UnitDraft {
  draftId: string;
  seq?: number;
  taskKey?: string;
  label: string;
  title: string;
  intro: string;
  paragraphs: string;
  prompt: string;
  minWords: string;
  mediaId: number | null;
  questions: QuestionDraft[];
}
export interface SectionDraft {
  /** Revision from the authoring GET, never silently replaced on background reads. */
  contentRevision?: number;
  minutes: string;
  units: UnitDraft[];
}
export const newQuestion = (): QuestionDraft => ({
  draftId: crypto.randomUUID(),
  title: '',
  instruction: '',
  kind: '',
  payload: '{}',
  start: '',
  end: '',
  mediaId: null,
});
export const newUnit = (): UnitDraft => ({
  draftId: crypto.randomUUID(),
  label: '',
  title: '',
  intro: '',
  paragraphs: '[]',
  prompt: '',
  minWords: '',
  mediaId: null,
  questions: [newQuestion()],
});
export const newDraft = (): SectionDraft => ({
  minutes: '',
  units: [newUnit()],
});

/** Browser identities survive edits/reordering, but are never API payload fields. */
export function restoreDraftIdentities(draft: SectionDraft): SectionDraft {
  return {
    ...draft,
    units: draft.units.map((unit) => ({
      ...unit,
      draftId: crypto.randomUUID(),
      questions: unit.questions.map((question) => ({
        ...question,
        draftId: crypto.randomUUID(),
      })),
    })),
  };
}

export function draftContent(draft: SectionDraft): string {
  return JSON.stringify(draft, (key, value: unknown) =>
    key === 'draftId' ? undefined : value,
  );
}

export function clearDraftMedia(
  draft: SectionDraft,
  mediaId: number,
): SectionDraft {
  return {
    ...draft,
    units: draft.units.map((unit) => ({
      ...unit,
      mediaId: unit.mediaId === mediaId ? null : unit.mediaId,
      questions: unit.questions.map((question) => ({
        ...question,
        mediaId: question.mediaId === mediaId ? null : question.mediaId,
      })),
    })),
  };
}

/** Media deletion/upload and section/lifecycle writes must not race each other. */
export const tenantContentWriteKey = (templateId: number, versionId: number) =>
  ['mock-exams', 'tenant', templateId, versionId, 'content-write'] as const;

function positiveInteger(value: string, errorKey: string): number {
  const number = Number(value);
  // Create-section numeric fields are int32 in the consumed OpenAPI.
  if (!Number.isInteger(number) || number <= 0 || number > 2 ** 31 - 1)
    throw new LocalizedError(errorKey);
  return number;
}
function json(value: string, errorKey: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new LocalizedError(errorKey);
  }
}
/** These fallbacks become IELTS learning content in the request, not interface
 * labels. Keep their canonical English wording stable across UI locale changes.
 * Author-provided names, instructions and answer data are never translated. */
export function unitName(
  section: Section,
  unit: UnitDraft,
  index: number,
): string {
  return (
    (section === 'writing' ? unit.title : unit.label).trim() ||
    i18n.getFixedT('en')(SECTION_META[section].numberKey, {number: index + 1})
  );
}
export function questionTitle(question: QuestionDraft): string {
  return (
    question.title.trim() ||
    (question.start && question.end
      ? i18n.getFixedT('en')('exams:authoring.questionRange', {start: question.start, end: question.end})
      : i18n.getFixedT('en')('common:admin.examFields.questions'))
  );
}
export interface DraftIssue {
  unitIndex: number | null;
  groupIndex?: number;
  message: string;
}
/** Validate every unit (including hidden ones) before the create-only write.
 * These are frontend content-safety checks, not backend scoring acceptance. */
export function sectionIssues(
  section: Section,
  draft: SectionDraft,
): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (!Number.isSafeInteger(Number(draft.minutes)) || Number(draft.minutes) < 1)
    issues.push({
      unitIndex: null,
      message: i18n.t('exams:validation.duration'),
    });
  const seen: {start: number; end: number}[] = [];
  draft.units.forEach((unit, unitIndex) => {
    const add = (message: string, groupIndex?: number) =>
      issues.push({unitIndex, groupIndex, message});
    if (section === 'listening' && !unit.mediaId)
      add(i18n.t('exams:validation.partAudio'));
    if (section === 'writing') {
      if (!unit.prompt.trim()) add(i18n.t('exams:validation.writingPrompt'));
      if (
        !Number.isSafeInteger(Number(unit.minWords)) ||
        Number(unit.minWords) < 1
      )
        add(i18n.t('exams:validation.wordCount'));
      return;
    }
    if (section === 'reading') {
      const paragraphs = parseContent(unit.paragraphs);
      if (paragraphs === undefined)
        add(
          i18n.t('exams:validation.paragraphJson'),
        );
      else if (
        paragraphs === null ||
        paragraphs === '' ||
        (Array.isArray(paragraphs) &&
          (!paragraphs.length ||
            paragraphs.some(
              (paragraph) => typeof paragraph === 'string' && !paragraph.trim(),
            )))
      )
        add(i18n.t('exams:validation.paragraphText'));
    }
    unit.questions.forEach((question, groupIndex) => {
      const start = Number(question.start),
        end = Number(question.end);
      if (!question.kind.trim()) add(i18n.t('exams:validation.selectType'), groupIndex);
      if (
        !Number.isSafeInteger(start) ||
        start < 1 ||
        !Number.isSafeInteger(end) ||
        end < start
      )
        add(i18n.t('exams:validation.questionRange'), groupIndex);
      const value = parseContent(question.payload);
      if (value === undefined)
        add(
          i18n.t('exams:validation.questionJson'),
          groupIndex,
        );
      else {
        contentErrors(section, question.kind, value).forEach((message) =>
          add(message, groupIndex),
        );
        const definition = questionDefinition(section, question.kind);
        const schema = definition?.schema;
        const answerSchema = definition?.answerSchema ?? schema;
        if (answerSchema)
          objectiveAnswerErrors(answerSchema, value).forEach((message) =>
            add(message, groupIndex),
          );
        if (schema) {
          const numbers = questionNumbers(value, schema);
          if (
            numbers.length &&
            (Math.min(...numbers) !== start || Math.max(...numbers) !== end)
          )
            add(
              i18n.t('exams:validation.rangeContent'),
              groupIndex,
            );
        }
      }
      // Compare ranges without allocating arrays from user-supplied large values.
      if (
        Number.isSafeInteger(start) &&
        Number.isSafeInteger(end) &&
        start > 0 &&
        end >= start
      ) {
        if (seen.some((prior) => start <= prior.end && end >= prior.start))
          add(
            i18n.t('exams:validation.rangeOverlap'),
            groupIndex,
          );
        seen.push({start, end});
      }
    });
  });
  return issues;
}
function questionPayload(
  question: QuestionDraft,
  index: number,
  section: 'reading' | 'listening',
) {
  const payload = questionPayloadObject(json(question.payload, 'exams:validation.questionJson'));
  const definition = questionDefinition(section, question.kind);
  const schema = definition?.answerSchema ?? definition?.schema;
  const errors = schema ? objectiveAnswerErrors(schema, payload) : [];
  // The review renders sectionIssues on every locale change; retain the same
  // detailed validator output for direct payload callers as well.
  if (errors.length) throw new Error(errors.join(' '));
  const questionStart = positiveInteger(
    question.start,
    'exams:validation.firstInteger',
  );
  const questionEnd = positiveInteger(question.end, 'exams:validation.lastInteger');
  if (questionEnd < questionStart)
    throw new LocalizedError('exams:validation.lastBeforeFirst');
  if (!question.kind.trim()) throw new LocalizedError('exams:validation.selectType');
  return {
    sortOrder: positiveInteger(
      String(question.sortOrder ?? index + 1),
      'exams:validation.orderInteger',
    ),
    title: questionTitle(question),
    instruction: question.instruction.trim(),
    kind: question.kind.trim(),
    payload,
    questionStart,
    questionEnd,
  };
}
export function listeningPayload(
  draft: SectionDraft,
): CreateMockExamListeningRequest {
  return {
    totalMinutes: positiveInteger(draft.minutes, 'exams:validation.durationInteger'),
    parts: draft.units.map((unit, index) => {
      if (!unit.mediaId)
        throw new LocalizedError('exams:validation.partAudioNumber', {number: formatNumber(index + 1)});
      return {
        seq: unit.seq ?? index + 1,
        label: unitName('listening', unit, index),
        audioMediaId: unit.mediaId,
        sections: unit.questions.map((question, i) =>
          questionPayload(question, i, 'listening'),
        ),
      };
    }),
  };
}
export function readingPayload(
  draft: SectionDraft,
): CreateMockExamReadingRequest {
  return {
    totalMinutes: positiveInteger(draft.minutes, 'exams:validation.durationInteger'),
    passages: draft.units.map((unit, index) => {
      const paragraphs = json(
        unit.paragraphs,
        'exams:validation.paragraphJson',
      );
      return {
        seq: positiveInteger(String(unit.seq ?? index + 1), 'exams:validation.passageInteger'),
        shortLabel: unitName('reading', unit, index),
        title: unit.title.trim(),
        intro: unit.intro.trim(),
        paragraphs,
        questions: unit.questions.map((question, i) => ({
          ...questionPayload(question, i, 'reading'),
          ...(question.mediaId ? {imageMediaId: question.mediaId} : {}),
        })),
      };
    }),
  };
}
export function writingPayload(
  draft: SectionDraft,
): CreateMockExamWritingRequest {
  return {
    totalMinutes: positiveInteger(draft.minutes, 'exams:validation.durationInteger'),
    tasks: draft.units.map((unit, index) => {
      if (!unit.prompt.trim())
        throw new LocalizedError('exams:validation.taskPromptNumber', {number: formatNumber(index + 1)});
      return {
        seq: unit.seq ?? index + 1,
        taskKey: unit.taskKey ?? `task-${unit.seq ?? index + 1}`,
        title: unitName('writing', unit, index),
        prompt: unit.prompt.trim(),
        minWords: positiveInteger(unit.minWords, 'exams:validation.wordInteger'),
        ...(unit.mediaId ? {imageMediaId: unit.mediaId} : {}),
      };
    }),
  };
}

export const MEDIA_RULES = {
  LISTENING_AUDIO: {
    accept: '.mp3,.wav,audio/mpeg,audio/wav',
    extensions: ['mp3', 'wav'],
    labelKey: 'exams:authoring.audioFormat',
    maxBytes: 100 * 1024 * 1024,
  },
  READING_IMAGE: {
    accept: '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp',
    extensions: ['png', 'jpg', 'jpeg', 'webp'],
    labelKey: 'exams:authoring.imageFormat',
    maxBytes: 10 * 1024 * 1024,
  },
  WRITING_IMAGE: {
    accept: '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp',
    extensions: ['png', 'jpg', 'jpeg', 'webp'],
    labelKey: 'exams:authoring.imageFormat',
    maxBytes: 10 * 1024 * 1024,
  },
} satisfies Record<
  MockExamMediaKind,
  {accept: string; extensions: string[]; labelKey: string; maxBytes: number}
>;
