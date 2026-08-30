import {describe, expect, it} from 'vitest'
import {
  parseAttemptId,
  parseListeningDetail,
  parseReadingDetail,
  parseWritingDetail,
} from './runtimeData'

describe('mock exam runtime adapters', () => {
  it('derives reading question navigation from contract ranges', () => {
    const detail = parseReadingDetail({
      totalMinutes: 60,
      passages: [{
        seq: 1,
        shortLabel: 'Passage 1',
        title: 'A memory model',
        paragraphs: ['First paragraph'],
        questions: [{
          kind: 'tfng',
          title: 'Questions 1–3',
          instruction: 'Choose an answer.',
          questionStart: 1,
          questionEnd: 3,
          payload: {questions: []},
        }],
      }],
    }, 42)

    expect(detail.id).toBe(42)
    expect(detail.passages[0].questionNumbers).toEqual([1, 2, 3])
  })

  it('accepts section payloads nested under their section name', () => {
    const listening = parseListeningDetail({listening: {
      totalMinutes: 30,
      parts: [{seq: 1, sections: [{questionStart: 1, questionEnd: 2, payload: {}}]}],
    }}, 7)
    const writing = parseWritingDetail({writing: {
      totalMinutes: 60,
      tasks: [{seq: 1, taskKey: 'task-1', imagePath: '/secured/chart'}],
    }}, 7)

    expect(listening.parts[0].questionNumbers).toEqual([1, 2])
    expect(writing.tasks[0].hasImage).toBe(true)
  })

  it('extracts attempt ids without depending on an undocumented full response shape', () => {
    expect(parseAttemptId({attempt: {id: 81}})).toBe(81)
    expect(parseAttemptId({attemptId: 82})).toBe(82)
    expect(parseAttemptId({status: 'STARTED'})).toBeNull()
  })
})
