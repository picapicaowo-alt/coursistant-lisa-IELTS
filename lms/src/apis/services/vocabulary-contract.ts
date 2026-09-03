import type {
  StudySessionResponse,
  VocabularyListCollectionResponse,
  VocabularyListDetailResponse,
  VocabularyUnitResponse,
} from '@/apis/types/vocabulary';
import {isRecord} from '@/utils/apiError';

const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every(item => typeof item === 'string')
);

const hasProgress = (value: unknown): boolean => isRecord(value)
  && typeof value.clearedWords === 'number'
  && typeof value.totalWords === 'number'
  && typeof value.completionCount === 'number';

const hasListSummary = (value: unknown): boolean => isRecord(value)
  && typeof value.id === 'string'
  && typeof value.name === 'string'
  && typeof value.description === 'string'
  && typeof value.totalWords === 'number'
  && typeof value.theme === 'string'
  && typeof value.skillFocus === 'string'
  && typeof value.difficulty === 'string'
  && hasProgress(value.progress);

export const isVocabularyListCollection = (value: unknown): value is VocabularyListCollectionResponse => {
  if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.filters)) return false;
  return value.items.every(hasListSummary)
    && isStringArray(value.filters.themes)
    && isStringArray(value.filters.skillFocuses)
    && isStringArray(value.filters.difficulties)
    && (value.continue === null || isRecord(value.continue));
};

export const isVocabularyListDetail = (value: unknown): value is VocabularyListDetailResponse => (
  hasListSummary(value)
  && isRecord(value)
  && Array.isArray(value.units)
  && value.units.every(unit => isRecord(unit) && typeof unit.id === 'string' && hasProgress(unit.progress))
);

export const isVocabularyUnit = (value: unknown): value is VocabularyUnitResponse => (
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.listId === 'string'
  && typeof value.listName === 'string'
  && typeof value.number === 'number'
  && hasProgress(value.progress)
);

export const isStudySession = (value: unknown): value is StudySessionResponse => (
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.unitId === 'string'
  && (value.mode === 'REMEMBER' || value.mode === 'TEST')
  && ['ACTIVE', 'PAUSED', 'COMPLETED', 'ENDED'].includes(String(value.status))
  && typeof value.position === 'number'
  && typeof value.totalScheduled === 'number'
  && typeof value.revealed === 'boolean'
  && typeof value.rated === 'boolean'
  && typeof value.canGoPrevious === 'boolean'
  && (value.currentCard === null || isRecord(value.currentCard))
);

export const requireVocabularyPayload = <T>(
  value: unknown,
  predicate: (candidate: unknown) => candidate is T,
  responseName: string,
): T => {
  if (!predicate(value)) {
    throw new Error(`Invalid ${responseName} response from the Vocabulary service.`);
  }
  return value;
};
