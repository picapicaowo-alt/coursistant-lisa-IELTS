import {describe, expect, it} from 'vitest';
import {safeStudySupportProgress} from './studySupportProgress';

describe('safeStudySupportProgress', () => {
  it('maps backend phases to user-facing progress copy', () => {
    expect(safeStudySupportProgress({
      phase: 'retrieval',
      text: 'search_teaching_documents result 10 tokens 4051',
    }, 'step-1')).toEqual({
      id: 'step-1',
      text: '',
      translationKey: 'assistant:thinking.search',
    });
  });

  it('does not render unrecognized backend diagnostic text', () => {
    expect(safeStudySupportProgress({
      phase: 'private-model-step',
      text: 'gate proceed model gpt-internal',
    }, 'step-2')).toEqual({
      id: 'step-2',
      text: '',
      translationKey: 'assistant:thinking.working',
    });
  });
});
