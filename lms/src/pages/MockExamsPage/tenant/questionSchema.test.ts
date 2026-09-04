import {describe, expect, it} from 'vitest';
import {
  contentErrors,
  emptyValue,
  fitsField,
  parseContent,
  QUESTION_TYPES,
  questionDefinition,
  questionNumbers,
} from './questionSchema';
import {
  listeningPayload,
  newDraft,
  newQuestion,
  newUnit,
  sectionIssues,
  unitName,
} from './model';

describe('question authoring schemas', () => {
  it('does not count dormant answer IDs when a cell is switched to text', () => {
    expect(
      questionNumbers(
        {
          steps: [
            {type: 'text', id: 1, value: 'Read the instructions'},
            {type: 'gap', id: 2},
          ],
        },
        questionDefinition('reading', 'flowchart')?.schema,
      ),
    ).toEqual([2]);
  });
  it('uses the existing section-specific renderer codes', () => {
    expect(QUESTION_TYPES.listening.map((type) => type.kind)).toContain(
      'notesCompletion',
    );
    expect(QUESTION_TYPES.reading.map((type) => type.kind)).toContain('notes');
    expect(questionDefinition('listening', 'tfng')).toBeUndefined();
    expect(questionDefinition('reading', 'form_completion')).toBeUndefined();
  });
  it('creates editable empty forms for every guided type', () => {
    for (const subject of ['listening', 'reading'] as const) {
      for (const definition of QUESTION_TYPES[subject]) {
        if (!('schema' in definition) || !definition.schema) continue;
        let number = 5;
        const content = emptyValue(definition.schema, () => number++);
        expect(fitsField(definition.schema, content), definition.kind).toBe(
          true,
        );
        expect(new Set(questionNumbers(content, definition.schema)).size).toBe(
          questionNumbers(content, definition.schema).length,
        );
      }
    }
  });
  it('validates content, choice letters, answer slots and table widths', () => {
    expect(
      contentErrors('listening', 'mcq', {
        questions: [
          {id: 1, prompt: 'Where?', options: ['A. Here', 'B. There']},
        ],
      }),
    ).toEqual([]);
    expect(
      contentErrors('listening', 'mcq', {
        questions: [{id: 1, prompt: 'Where?', options: ['Here', 'Here']}],
      }).join(),
    ).toContain('capital letter');
    expect(
      contentErrors('listening', 'multiSelect', {
        prompt: 'Choose two',
        chooseCount: 2,
        questionIds: [1],
        options: ['A. One', 'B. Two'],
      }).join(),
    ).toContain('answer slots');
    expect(
      contentErrors('reading', 'table', {
        headers: ['Name', 'Date'],
        rows: [[{type: 'gap', id: 1}]],
      }).join(),
    ).toContain('one cell');
    expect(
      contentErrors('reading', 'sentenceCompletion', {
        questions: [{id: 1, before: '', after: 'at the beginning.'}],
      }),
    ).toEqual([]);
  });
  it('ignores unknown types while preserving advanced payloads', () => {
    const payload = {
      custom: {answer: 'keep'},
      questions: [{id: 9, answer: 'keep'}],
    };
    expect(contentErrors('reading', 'verified_custom', payload)).toEqual([]);
    expect(parseContent(JSON.stringify(payload))).toEqual(payload);
    expect(parseContent('{')).toBeUndefined();
    expect(
      questionNumbers(
        {
          id: 123,
          questions: [{id: 2}],
          answers: [{id: 88}],
          metadata: {id: 99},
        },
        questionDefinition('reading', 'shortAnswer')?.schema,
      ),
    ).toEqual([2]);
  });
  it('rejects duplicated matching option keys used by the student renderer', () => {
    expect(
      contentErrors('reading', 'matching', {
        listLabel: 'Choose a place',
        choices: [
          {key: 'A', text: 'Library'},
          {key: 'A', text: 'Office'},
        ],
        questions: [{id: 1, statement: 'Borrow a book'}],
      }),
    ).toContain('Use a different label for each answer option.');
  });
});

describe('whole-section checks and defaults', () => {
  it('validates hidden units, contained ranges and group-number mismatches', () => {
    const draft = newDraft();
    draft.minutes = '40';
    draft.units = [newUnit(), newUnit()];
    draft.units[0].mediaId = 1;
    draft.units[0].questions[0] = {
      ...newQuestion(),
      kind: 'verified_custom',
      start: '1',
      end: '10',
    };
    draft.units[1].questions[0] = {
      ...newQuestion(),
      kind: 'formCompletion',
      start: '3',
      end: '4',
      payload: JSON.stringify({
        formTitle: 'Booking',
        fields: [{id: 3, label: 'Name'}],
      }),
    };
    const issues = sectionIssues('listening', draft);
    expect(
      issues
        .filter((issue) => issue.unitIndex === 1)
        .map((issue) => issue.message)
        .join(),
    ).toMatch(/audio/);
    expect(issues.map((issue) => issue.message).join()).toMatch(/overlaps/);
    expect(issues.map((issue) => issue.message).join()).toMatch(
      /range must match/,
    );
  });
  it('uses display defaults without dirtying the original draft or erasing answer metadata', () => {
    const draft = newDraft();
    draft.minutes = '40';
    draft.units[0].mediaId = 11;
    const content = {
      formTitle: 'Booking',
      fields: [{id: 1, label: 'Name', answer: 'Alice'}],
      grading: {version: 2},
    };
    draft.units[0].questions[0] = {
      ...newQuestion(),
      kind: 'formCompletion',
      start: '1',
      end: '1',
      payload: JSON.stringify(content),
    };
    expect(sectionIssues('listening', draft)).toEqual([]);
    expect(unitName('listening', draft.units[0], 0)).toBe('Part 1');
    expect(listeningPayload(draft).parts[0]).toMatchObject({
      label: 'Part 1',
      sections: [{title: 'Questions 1–1', payload: content}],
    });
    expect(draft.units[0].label).toBe('');
  });
  it('requires reading content and writing prompt but never invents a fixed paper length', () => {
    const draft = newDraft();
    draft.minutes = '60';
    expect(
      sectionIssues('reading', draft)
        .map((issue) => issue.message)
        .join(),
    ).toContain('passage text');
    draft.units[0].prompt = 'Discuss the two views.';
    draft.units[0].minWords = '250';
    expect(sectionIssues('writing', draft)).toEqual([]);
  });
});
