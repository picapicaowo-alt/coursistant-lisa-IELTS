import {LocalizedError} from '@/i18n/errors';
import {isRecord} from '@/utils/apiError';
import {newQuestion, newUnit, type QuestionDraft, type Section, type SectionDraft} from './model';

function invalid(): never {throw new LocalizedError('exams:editing.invalidContent');}
function record(value: unknown): Record<string, unknown> {return isRecord(value) ? value : invalid();}
function integer(value: unknown, minimum = 1): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum ? value : invalid();
}
function text(value: unknown): string {return typeof value === 'string' ? value : invalid();}
function items(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 ? value.map(record) : invalid();
}
function media(value: unknown): number | null {return value == null ? null : integer(value);}
function question(value: Record<string, unknown>): QuestionDraft {
  return {
    ...newQuestion(), sortOrder: integer(value.sortOrder), title: text(value.title),
    instruction: text(value.instruction), kind: text(value.kind),
    payload: JSON.stringify(record(value.payload)), start: String(integer(value.questionStart)),
    end: String(integer(value.questionEnd)), mediaId: media(value.imageMediaId),
  };
}

/** Project only request fields into the draft. Never strip IDs recursively:
 * payload question IDs are grading identities, unlike response entity IDs. */
export function authoringDraft(section: Section, value: unknown): SectionDraft {
  const root = record(value);
  const source = items(root[section === 'reading' ? 'passages' : section === 'listening' ? 'parts' : 'tasks']);
  return {
    contentRevision: integer(root.contentRevision, 0), minutes: String(integer(root.totalMinutes)),
    units: source.map(unit => {
      const base = {...newUnit(), seq: integer(unit.seq)};
      if (section === 'writing') return {
        ...base, title: text(unit.title), taskKey: text(unit.taskKey), prompt: text(unit.prompt),
        minWords: String(integer(unit.minWords)), mediaId: media(unit.imageMediaId),
      };
      if (section === 'listening') return {
        ...base, label: text(unit.label), mediaId: integer(unit.audioMediaId),
        questions: items(unit.sections).map(question),
      };
      if (unit.paragraphs === undefined) invalid();
      return {
        ...base, label: text(unit.shortLabel), title: text(unit.title), intro: text(unit.intro),
        paragraphs: JSON.stringify(unit.paragraphs), questions: items(unit.questions).map(question),
      };
    }),
  };
}

export const AUTHORING_ERROR_KEYS: Record<string, string> = {
  MOCK_EXAM_CONTENT_VERSION_CONFLICT: 'exams:editing.versionConflict',
  MOCK_EXAM_CONTENT_LOCKED: 'exams:editing.locked',
  MOCK_EXAM_MEDIA_STATE_CONFLICT: 'exams:editing.mediaConflict',
  MOCK_EXAM_SECTION_NOT_FOUND: 'exams:editing.sectionMissing',
};
