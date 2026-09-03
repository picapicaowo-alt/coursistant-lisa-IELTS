import {BookOpenText, Headphones, PenLine} from 'lucide-react';
import type {
  CreateMockExamListeningRequest,
  CreateMockExamReadingRequest,
  CreateMockExamWritingRequest,
  MockExamMediaKind,
  MockExamTemplateVersionSummary,
} from '@/apis';

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
  if (!Number.isInteger(number) || number <= 0)
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
function questionPayload(question: QuestionDraft, index: number) {
  const questionStart = positiveInteger(
    question.start,
    'First question number',
  );
  const questionEnd = positiveInteger(question.end, 'Last question number');
  if (questionEnd < questionStart)
    throw new Error('The last question number must not precede the first.');
  if (!question.kind.trim())
    throw new Error('Enter the contract question kind.');
  if (!question.title.trim())
    throw new Error('Enter a title for every question group.');
  return {
    sortOrder: index + 1,
    title: question.title.trim(),
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
      if (!unit.label.trim())
        throw new Error(`Enter a label for Part ${index + 1}.`);
      if (!unit.mediaId)
        throw new Error(`Upload and select audio for Part ${index + 1}.`);
      return {
        seq: index + 1,
        label: unit.label.trim(),
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
      if (!unit.label.trim())
        throw new Error(`Enter a label for Passage ${index + 1}.`);
      const paragraphs = json(
        unit.paragraphs,
        `Passage ${index + 1} paragraphs`,
      );
      if (!Array.isArray(paragraphs))
        throw new Error('Reading paragraphs must be a JSON array.');
      return {
        seq: index + 1,
        shortLabel: unit.label.trim(),
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
      if (!unit.title.trim() || !unit.prompt.trim())
        throw new Error(`Enter a title and prompt for Task ${index + 1}.`);
      return {
        seq: index + 1,
        taskKey: `task-${index + 1}`,
        title: unit.title.trim(),
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
