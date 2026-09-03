import {describe, expect, it} from 'vitest';
import {
  listeningPayload,
  readingPayload,
  writingPayload,
  newDraft,
  newUnit,
  newQuestion,
  clearDraftMedia,
  draftContent,
  restoreDraftIdentities,
} from './model';

describe('Create-only exam composition', () => {
  it('submits all listening parts in one section payload with media IDs', () => {
    const draft = newDraft();
    draft.minutes = '40';
    draft.units = [newUnit(), newUnit()];
    draft.units.forEach((part, index) => {
      part.label = `Part ${index + 1}`;
      part.mediaId = index + 11;
      part.questions[0] = {
        ...part.questions[0],
        title: 'Questions',
        kind: 'contract_kind',
        start: String(index * 10 + 1),
        end: String(index * 10 + 10),
        payload: '{"questions":[]}',
      };
    });
    const payload = listeningPayload(draft);
    expect(payload.totalMinutes).toBe(40);
    expect(payload.parts).toHaveLength(2);
    expect(payload.parts[1]).toMatchObject({
      seq: 2,
      audioMediaId: 12,
      sections: [{questionStart: 11, questionEnd: 20, sortOrder: 1}],
    });
    expect(JSON.stringify(payload)).not.toMatch(/audioPath|objectKey|draftId/);
  });
  it('uses stable local identities without making an empty draft dirty', () => {
    const first = newDraft();
    const second = newDraft();
    expect(first.units[0].draftId).not.toBe(second.units[0].draftId);
    expect(draftContent(first)).toBe(draftContent(second));
    const restored = restoreDraftIdentities(first);
    expect(restored.units[0].draftId).not.toBe(first.units[0].draftId);
    expect(draftContent(restored)).toBe(draftContent(first));
  });
  it('clears deleted media across all units and questions without changing content or identity', () => {
    const draft = newDraft();
    draft.units.push(newUnit());
    draft.units[0].label = 'Keep my work';
    draft.units[0].mediaId = 11;
    draft.units[0].questions[0].mediaId = 11;
    draft.units[1].questions.push({...newQuestion(), mediaId: 12});
    draft.units[1].questions[0].mediaId = 11;
    const cleared = clearDraftMedia(draft, 11);
    expect(cleared.units[0]).toMatchObject({
      draftId: draft.units[0].draftId,
      label: 'Keep my work',
      mediaId: null,
    });
    expect(cleared.units[0].questions[0].mediaId).toBeNull();
    expect(
      cleared.units[1].questions.map((question) => question.mediaId),
    ).toEqual([null, 12]);
    expect(draft.units[0].mediaId).toBe(11);
  });
  it('validates hidden parts before first submission', () => {
    const draft = newDraft();
    draft.minutes = '40';
    draft.units[0].label = 'Part 1';
    expect(() => listeningPayload(draft)).toThrow('audio for Part 1');
    draft.units[0].mediaId = 9;
    expect(() => listeningPayload(draft)).toThrow('First question number');
  });
  it('preserves reading question image binding and writing task sequence', () => {
    const reading = newDraft();
    reading.minutes = '60';
    reading.units[0].label = 'Passage 1';
    reading.units[0].questions[0] = {
      ...reading.units[0].questions[0],
      title: 'Questions',
      start: '1',
      end: '3',
      kind: 'contract_kind',
      mediaId: 5,
    };
    expect(readingPayload(reading).passages[0].questions[0].imageMediaId).toBe(
      5,
    );
    reading.units[0].paragraphs = '{}';
    expect(() => readingPayload(reading)).toThrow('JSON array');
    const writing = newDraft();
    writing.minutes = '60';
    writing.units = [newUnit(), newUnit()];
    writing.units.forEach((unit) => {
      unit.minWords = '150';
      unit.title = 'Task';
      unit.prompt = 'Write a response.';
    });
    expect(writingPayload(writing).tasks[1]).toMatchObject({
      seq: 2,
      taskKey: 'task-2',
      minWords: 150,
    });
  });
});
