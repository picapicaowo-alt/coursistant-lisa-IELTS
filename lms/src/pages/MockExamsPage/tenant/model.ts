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
    label: 'Listening',
    Icon: Headphones,
    unit: 'Part',
    mediaKind: 'LISTENING_AUDIO',
    flag: 'hasListening',
  },
  reading: {
    label: 'Reading',
    Icon: BookOpenText,
    unit: 'Passage',
    mediaKind: 'READING_IMAGE',
    flag: 'hasReading',
  },
  writing: {
    label: 'Writing',
    Icon: PenLine,
    unit: 'Task',
    mediaKind: 'WRITING_IMAGE',
    flag: 'hasWriting',
  },
} satisfies Record<
  string,
  {
    label: string;
    Icon: typeof Headphones;
    unit: string;
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

function positiveInteger(value: string, label: string): number {
  const number = Number(value);
  // Create-section numeric fields are int32 in the consumed OpenAPI.
  if (!Number.isInteger(number) || number <= 0 || number > 2 ** 31 - 1)
    throw new Error(`${label} must be a positive whole number.`);
  return number;
}
function json(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}
export function unitName(
  section: Section,
  unit: UnitDraft,
  index: number,
): string {
  return (
    (section === 'writing' ? unit.title : unit.label).trim() ||
    `${SECTION_META[section].unit} ${index + 1}`
  );
}
export function questionTitle(question: QuestionDraft): string {
  return (
    question.title.trim() ||
    (question.start && question.end
      ? `Questions ${question.start}–${question.end}`
      : 'Questions')
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
      message: 'Enter the section duration in whole minutes.',
    });
  const seen: {start: number; end: number}[] = [];
  draft.units.forEach((unit, unitIndex) => {
    const add = (message: string, groupIndex?: number) =>
      issues.push({unitIndex, groupIndex, message});
    if (section === 'listening' && !unit.mediaId)
      add('Upload and select audio for this part.');
    if (section === 'writing') {
      if (!unit.prompt.trim()) add('Enter the writing prompt.');
      if (
        !Number.isSafeInteger(Number(unit.minWords)) ||
        Number(unit.minWords) < 1
      )
        add('Enter a minimum word count.');
      return;
    }
    if (section === 'reading') {
      const paragraphs = parseContent(unit.paragraphs);
      if (paragraphs === undefined)
        add(
          'Passage content is not valid JSON. Check Advanced paragraph data.',
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
        add('Add the passage text and complete each paragraph.');
    }
    unit.questions.forEach((question, groupIndex) => {
      const start = Number(question.start),
        end = Number(question.end);
      if (!question.kind.trim()) add('Select a question type.', groupIndex);
      if (
        !Number.isSafeInteger(start) ||
        start < 1 ||
        !Number.isSafeInteger(end) ||
        end < start
      )
        add('Check the first and last question numbers.', groupIndex);
      const value = parseContent(question.payload);
      if (value === undefined)
        add(
          'Question data is not valid JSON. Check Advanced data.',
          groupIndex,
        );
      else {
        contentErrors(section, question.kind, value).forEach((message) =>
          add(message, groupIndex),
        );
        const schema = questionDefinition(section, question.kind)?.schema;
        if (schema) {
          const numbers = questionNumbers(value, schema);
          if (
            numbers.length &&
            (Math.min(...numbers) !== start || Math.max(...numbers) !== end)
          )
            add(
              'The group range must match the question numbers in its content.',
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
            'This question range overlaps an earlier group. Use unique question numbers.',
            groupIndex,
          );
        seen.push({start, end});
      }
    });
  });
  return issues;
}
function questionPayload(question: QuestionDraft, index: number) {
  const questionStart = positiveInteger(
    question.start,
    'First question number',
  );
  const questionEnd = positiveInteger(question.end, 'Last question number');
  if (questionEnd < questionStart)
    throw new Error('The last question number must not precede the first.');
  if (!question.kind.trim()) throw new Error('Select a question type.');
  return {
    sortOrder: positiveInteger(
      String(question.sortOrder ?? index + 1),
      'Question group order',
    ),
    title: questionTitle(question),
    instruction: question.instruction.trim(),
    kind: question.kind.trim(),
    payload: json(question.payload, 'Question payload'),
    questionStart,
    questionEnd,
  };
}
export function listeningPayload(
  draft: SectionDraft,
): CreateMockExamListeningRequest {
  return {
    totalMinutes: positiveInteger(draft.minutes, 'Section duration'),
    parts: draft.units.map((unit, index) => {
      if (!unit.mediaId)
        throw new Error(`Upload and select audio for Part ${index + 1}.`);
      return {
        seq: index + 1,
        label: unitName('listening', unit, index),
        audioMediaId: unit.mediaId,
        sections: unit.questions.map(questionPayload),
      };
    }),
  };
}
export function readingPayload(
  draft: SectionDraft,
): CreateMockExamReadingRequest {
  return {
    totalMinutes: positiveInteger(draft.minutes, 'Section duration'),
    passages: draft.units.map((unit, index) => {
      const paragraphs = json(
        unit.paragraphs,
        `Passage ${index + 1} paragraphs`,
      );
      return {
        seq: positiveInteger(String(unit.seq ?? index + 1), 'Passage sequence'),
        shortLabel: unitName('reading', unit, index),
        title: unit.title.trim(),
        intro: unit.intro.trim(),
        paragraphs,
        questions: unit.questions.map((question, i) => ({
          ...questionPayload(question, i),
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
    totalMinutes: positiveInteger(draft.minutes, 'Section duration'),
    tasks: draft.units.map((unit, index) => {
      if (!unit.prompt.trim())
        throw new Error(`Enter a prompt for Task ${index + 1}.`);
      return {
        seq: index + 1,
        taskKey: `task-${index + 1}`,
        title: unitName('writing', unit, index),
        prompt: unit.prompt.trim(),
        minWords: positiveInteger(unit.minWords, 'Minimum words'),
        ...(unit.mediaId ? {imageMediaId: unit.mediaId} : {}),
      };
    }),
  };
}

export const MEDIA_RULES = {
  LISTENING_AUDIO: {
    accept: '.mp3,.wav,audio/mpeg,audio/wav',
    extensions: ['mp3', 'wav'],
    label: 'MP3 or WAV · up to 100 MB',
    maxBytes: 100 * 1024 * 1024,
  },
  READING_IMAGE: {
    accept: '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp',
    extensions: ['png', 'jpg', 'jpeg', 'webp'],
    label: 'PNG, JPG, JPEG, or WEBP · up to 10 MB',
    maxBytes: 10 * 1024 * 1024,
  },
  WRITING_IMAGE: {
    accept: '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp',
    extensions: ['png', 'jpg', 'jpeg', 'webp'],
    label: 'PNG, JPG, JPEG, or WEBP · up to 10 MB',
    maxBytes: 10 * 1024 * 1024,
  },
} satisfies Record<
  MockExamMediaKind,
  {accept: string; extensions: string[]; label: string; maxBytes: number}
>;
