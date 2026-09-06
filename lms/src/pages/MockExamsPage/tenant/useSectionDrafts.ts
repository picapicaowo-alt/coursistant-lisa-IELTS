import {useEffect, useState} from 'react';
import {useBeforeUnload} from 'react-router-dom';
import {isRecord} from '@/utils/apiError';
import {
  draftContent,
  newDraft,
  restoreDraftIdentities,
  SECTIONS,
  type Section,
  type SectionDraft,
} from './model';

type Drafts = Record<Section, SectionDraft>;
const EMPTY_DRAFT_CONTENT = draftContent(newDraft());
const emptyDrafts = (): Drafts => ({
  listening: newDraft(),
  reading: newDraft(),
  writing: newDraft(),
});
const isMediaId = (value: unknown) =>
  value === null ||
  (typeof value === 'number' && Number.isInteger(value) && value > 0);
const isOptionalOrder = (value: unknown) =>
  value === undefined ||
  (typeof value === 'number' && Number.isSafeInteger(value) && value > 0);

function isDraft(value: unknown): value is SectionDraft {
  return (
    isRecord(value) &&
    (value.contentRevision === undefined || (typeof value.contentRevision === 'number' && Number.isSafeInteger(value.contentRevision) && value.contentRevision >= 0)) &&
    typeof value.minutes === 'string' &&
    Array.isArray(value.units) &&
    value.units.length > 0 &&
    value.units.every(
      (unit) =>
        isRecord(unit) &&
        isOptionalOrder(unit.seq) &&
        ['label', 'title', 'intro', 'paragraphs', 'prompt', 'minWords'].every(
          (key) => typeof unit[key] === 'string',
        ) &&
        isMediaId(unit.mediaId) &&
        Array.isArray(unit.questions) &&
        unit.questions.length > 0 &&
        unit.questions.every(
          (question) =>
            isRecord(question) &&
            isOptionalOrder(question.sortOrder) &&
            ['title', 'instruction', 'kind', 'payload', 'start', 'end'].every(
              (key) => typeof question[key] === 'string',
            ) &&
            isMediaId(question.mediaId),
        ),
    )
  );
}

function restore(key: string): Drafts {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (
      isRecord(value) &&
      isDraft(value.listening) &&
      isDraft(value.reading) &&
      isDraft(value.writing)
    )
      return {
        listening: restoreDraftIdentities(value.listening),
        reading: restoreDraftIdentities(value.reading),
        writing: restoreDraftIdentities(value.writing),
      };
  } catch {
    /* Corrupt or unavailable browser storage must not prevent editing. */
  }
  return emptyDrafts();
}

/** Tab-scoped, account/version-isolated drafts never imply a backend save. */
export function useSectionDrafts(
  userId: number,
  templateId: number,
  versionId: number,
) {
  const key = `tenant-exam-draft:v1:${userId}:${templateId}:${versionId}`;
  const [drafts, setDrafts] = useState<Drafts>(() => restore(key));
  const [storageAvailable, setStorageAvailable] = useState(true);
  const dirty = SECTIONS.some(
    (section) => draftContent(drafts[section]) !== EMPTY_DRAFT_CONTENT,
  );
  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify(drafts));
      else sessionStorage.removeItem(key);
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }, [drafts, dirty, key]);
  useBeforeUnload((event) => {
    if (dirty && !storageAvailable) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  return {drafts, setDrafts, storageAvailable};
}
