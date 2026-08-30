import {describe, expect, it} from 'vitest';
import {isVocabularyListCollection, requireVocabularyPayload} from './vocabulary-contract';

describe('Vocabulary runtime contract', () => {
  it('rejects the SPA HTML fallback before page rendering', () => {
    expect(() => requireVocabularyPayload(
      '<!doctype html><html></html>',
      isVocabularyListCollection,
      'library',
    )).toThrow('Invalid library response');
  });

  it('accepts a well-formed empty library', () => {
    const library = {items: [], filters: {themes: [], skillFocuses: [], difficulties: []}, continue: null};
    expect(requireVocabularyPayload(library, isVocabularyListCollection, 'library')).toEqual(library);
  });
});
