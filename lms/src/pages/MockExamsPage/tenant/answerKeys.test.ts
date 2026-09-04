import {describe, expect, it} from 'vitest';
import {answerKeyErrors, objectiveAnswerErrors} from './answerKeys';
import {questionDefinition} from './questionSchema';
import {
  newDraft,
  newQuestion,
  readingPayload,
  listeningPayload,
  sectionIssues,
} from './model';
import {parseReadingImport, READING_IMPORT_EXAMPLE} from './readingJson';

const invalidKeys = [
  {},
  {answer: 'a', answers: ['a']},
  {answer: ''},
  {answer: '  '},
  {answer: ['a']},
  {answer: null},
  {answers: []},
  {answers: 'a'},
  {answers: ['a', '']},
  {answers: ['a', '\t']},
  {answers: [1]},
  {answers: ['a', 'a']},
  {answers: ['a', ' a ']},
];
describe('official objective answer keys', () => {
  it.each(invalidKeys)('rejects invalid answer keys: %j', (key) => {
    expect(answerKeyErrors(key).length).toBeGreaterThan(0);
  });
  it.each([
    {answer: 'fermentation'},
    {answers: ['fermentation', 'fermentation process']},
    {answers: ['cow dung', 'dung cow']},
    {answers: ['one']},
  ])('accepts supported keys: %j', (key) => {
    expect(answerKeyErrors(key)).toEqual([]);
  });
  for (const subject of ['reading', 'listening'] as const) {
    it(`${subject} review and outgoing payload enforce the same answer rules`, () => {
      const draft = newDraft();
      draft.minutes = '60';
      draft.units[0].mediaId = 11;
      draft.units[0].paragraphs = '["Passage"]';
      const toPayload =
        subject === 'reading' ? readingPayload : listeningPayload;
      for (const key of invalidKeys) {
        draft.units[0].questions[0] = {
          ...newQuestion(),
          kind: 'shortAnswer',
          start: '9',
          end: '9',
          payload: JSON.stringify({
            questions: [{id: 9, prompt: 'What?', ...key}],
          }),
        };
        expect(
          sectionIssues(subject, draft)
            .map((issue) => issue.message)
            .join(),
        ).toContain('Question 9');
        expect(() => toPayload(draft)).toThrow('Question 9');
      }
      draft.units[0].questions[0].payload = JSON.stringify({
        questions: [
          {id: 9, prompt: 'What?', answers: ['cow dung', 'dung cow']},
        ],
      });
      expect(sectionIssues(subject, draft)).toEqual([]);
      expect(JSON.stringify(toPayload(draft))).toContain(
        '"answers":["cow dung","dung cow"]',
      );
    });
    it(`${subject} leaves multiSelect answersByQuestion unchanged`, () => {
      const schema = questionDefinition(subject, 'multiSelect')!.schema!;
      const payload = {
        prompt: 'Choose two',
        chooseCount: 2,
        questionIds: [1, 2],
        options: ['A. One', 'B. Two'],
        answersByQuestion: {'1': 'A', '2': 'B'},
      };
      expect(objectiveAnswerErrors(schema, payload)).toEqual([]);
      const draft = newDraft();
      draft.minutes = '60';
      draft.units[0].mediaId = 11;
      draft.units[0].paragraphs = '["Passage"]';
      draft.units[0].questions[0] = {
        ...newQuestion(),
        kind: 'multiSelect',
        start: '1',
        end: '2',
        payload: JSON.stringify(payload),
      };
      const output =
        subject === 'reading'
          ? readingPayload(draft).passages[0].questions[0].payload
          : listeningPayload(draft).parts[0].sections[0].payload;
      expect(output).toEqual(payload);
    });
  }
  it('validates known answer slots in advanced Listening maps', () => {
    const schema = questionDefinition('listening', 'planMap')!.answerSchema!;
    expect(objectiveAnswerErrors(schema, {labels: [{id: 9, answers: []}]}).join()).toContain('Question 9');
    expect(objectiveAnswerErrors(schema, {labels: [{id: 9, answer: 'Library'}]})).toEqual([]);
  });
  it('validates active nested gaps without interpreting metadata or dormant IDs', () => {
    const schema = questionDefinition('reading', 'table')!.schema!;
    expect(
      objectiveAnswerErrors(schema, {
        headers: ['One', 'Two'],
        rows: [
          [
            {type: 'text', value: 'Text', id: 1, answer: []},
            {type: 'gap', id: 2, answers: ['cow dung', 'dung cow']},
          ],
        ],
        metadata: {id: 3},
      }),
    ).toEqual([]);
    expect(
      objectiveAnswerErrors(schema, {
        rows: [[{type: 'gap', id: 2, answers: []}]],
      }).join(),
    ).toContain('Question 2');
  });
  it.each(invalidKeys)(
    'blocks invalid keys during Reading import: %j',
    (key) => {
      const request = structuredClone(READING_IMPORT_EXAMPLE);
      request.passages[0].questions[0].payload = {
        questions: [{id: 1, statement: 'Statement', ...key}],
      } as (typeof request.passages)[0]['questions'][0]['payload'];
      const result = parseReadingImport(JSON.stringify(request));
      expect(result.draft).toBeUndefined();
      expect(result.errors.join()).toContain('Question 1');
    },
  );
  it.each([
    {answer: 'fermentation'},
    {answers: ['fermentation', 'fermentation process']},
    {answers: ['cow dung', 'dung cow']},
  ])('round-trips official text through import and save: %j', (key) => {
    const request = structuredClone(READING_IMPORT_EXAMPLE);
    Object.assign(request.passages[0].questions[0], {
      payload: {questions: [{id: 1, statement: 'Statement', ...key}]},
    });
    const result = parseReadingImport(JSON.stringify(request));
    expect(result.errors).toEqual([]);
    expect(readingPayload(result.draft!)).toEqual(request);
  });
});
