import {describe, expect, it} from 'vitest';
import {authoringDraft} from './authoringContent';
import {readingPayload, listeningPayload, writingPayload} from './model';

const question = {id: 99, sortOrder: 7, title: 'Question', instruction: 'Answer', kind: 'shortAnswer', questionStart: 9, questionEnd: 9,
  imageMediaId: 17, imagePreviewUrl: 'response-only', payload: {questions: [{id: 9, prompt: 'Where?', answers: ['New York', 'NY']}], metadata: {id: 81}}};
const inputs = {
  reading: {id: 1, contentRevision: 0, totalMinutes: 60, passages: [{id: 2, seq: 3, shortLabel: 'Passage', title: 'City', intro: '', paragraphs: ['Text'], questions: [question]}]},
  listening: {id: 1, contentRevision: 0, totalMinutes: 40, parts: [{id: 3, seq: 4, label: 'Part', audioMediaId: 19, audioPreviewUrl: 'response-only', sections: [question]}]},
  writing: {id: 1, contentRevision: 0, totalMinutes: 60, tasks: [{id: 4, seq: 2, taskKey: 'essay-b', title: 'Essay', prompt: 'Discuss', minWords: 250, imageMediaId: 17, imagePreviewUrl: 'response-only'}]},
};

describe('authoring content replacement', () => {
  it('preserves answer identities, alternatives and ordering without copying response fields', () => {
    const draft = authoringDraft('reading', inputs.reading);
    expect(draft.contentRevision).toBe(0);
    const request = readingPayload(draft);
    expect(request.passages[0].seq).toBe(3);
    expect(request.passages[0].questions[0].payload).toEqual(question.payload);
    expect(request.passages[0].questions[0].sortOrder).toBe(7);
    expect(request.passages[0].questions[0]).not.toHaveProperty('id');
    expect(JSON.stringify(request)).not.toMatch(/PreviewUrl|contentRevision/);
  });
  it('retains listening order/audio and writing task identities', () => {
    expect(listeningPayload(authoringDraft('listening', inputs.listening)).parts[0]).toMatchObject({seq: 4, audioMediaId: 19});
    expect(writingPayload(authoringDraft('writing', inputs.writing)).tasks[0]).toMatchObject({seq: 2, taskKey: 'essay-b', imageMediaId: 17});
  });
  it('refuses to seed an incomplete replacement or an unversioned draft', () => {
    expect(() => authoringDraft('reading', {...inputs.reading, contentRevision: undefined})).toThrow();
    expect(() => authoringDraft('reading', {...inputs.reading, passages: []})).toThrow();
    expect(() => authoringDraft('reading', {...inputs.reading, passages: [{}]})).toThrow();
  });
});
