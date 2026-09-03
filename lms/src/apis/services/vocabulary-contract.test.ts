import {describe, expect, it} from 'vitest';
import {isStudySession, isVocabularyListCollection, requireVocabularyPayload} from './vocabulary-contract';

describe('Vocabulary runtime contract', () => {
  it('rejects the SPA HTML fallback before page rendering', () => {
    expect(() => requireVocabularyPayload(
      '<!doctype html><html></html>',
      isVocabularyListCollection,
      'library',
    )).toThrow('Invalid library response');
  });

  it('rejects unknown study-session statuses at the service boundary', () => {
    expect(isStudySession({
      id: 'session-id',
      unitId: 'unit-id',
      mode: 'TEST',
      status: 'STALE',
      position: 0,
      totalScheduled: 20,
      revealed: false,
      rated: false,
      canGoPrevious: false,
      currentCard: null,
    })).toBe(false);
  });

  it('accepts a well-formed empty library', () => {
    const library = {items: [], filters: {themes: [], skillFocuses: [], difficulties: []}, continue: null};
    expect(requireVocabularyPayload(library, isVocabularyListCollection, 'library')).toEqual(library);
  });
});
