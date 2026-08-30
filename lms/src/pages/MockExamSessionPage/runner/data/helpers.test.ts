import { describe, expect, it } from 'vitest'
import { allQuestionNumbers, findPassageForQuestion } from '../data/reading'
import {
  allListeningQuestionNumbers,
  findPartForQuestion,
} from '../data/listening/helpers'
import type { PassageData } from '../data/types'
import type { ListeningPaper } from '../data/listening/types'

const passages: PassageData[] = [
  {
    id: 1,
    shortLabel: 'P1',
    title: 'A',
    intro: '',
    paragraphs: [],
    questionNumbers: [1, 2],
    sections: [],
  },
  {
    id: 2,
    shortLabel: 'P2',
    title: 'B',
    intro: '',
    paragraphs: [],
    questionNumbers: [3],
    sections: [],
  },
]

const paper: ListeningPaper = {
  id: 4,
  totalMinutes: 30,
  parts: [
    {
      id: 10,
      label: 'Part 1',
      audioSrc: '/a',
      questionNumbers: [1, 2],
      sections: [],
    },
    {
      id: 11,
      label: 'Part 2',
      audioSrc: '/b',
      questionNumbers: [3],
      sections: [],
    },
  ],
}

describe('FE-U-HELP-01 reading/listening helpers', () => {
  it('FE-U-HELP-01: allQuestionNumbers flattens across passages', () => {
    expect(allQuestionNumbers(passages)).toEqual([1, 2, 3])
  })

  it('FE-U-HELP-01: findPassageForQuestion finds owner; unknown throws', () => {
    expect(findPassageForQuestion(passages, 3).id).toBe(2)
    expect(() => findPassageForQuestion(passages, 99)).toThrow(/Unknown question/)
  })

  it('FE-U-HELP-01: listening helpers across parts; unknown throws', () => {
    expect(allListeningQuestionNumbers(paper)).toEqual([1, 2, 3])
    expect(findPartForQuestion(paper, 3).id).toBe(11)
    expect(() => findPartForQuestion(paper, 99)).toThrow(/Unknown listening question/)
  })
})
