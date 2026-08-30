import type { PassageData } from './types'

export type ReadingTest = {
  id: number
  totalMinutes: number
  passages: PassageData[]
}

export const candidateId = 'Candidate'

export function getPassageById(passages: PassageData[], id: number): PassageData {
  const found = passages.find((p) => p.id === id)
  if (!found) throw new Error(`Unknown passage id: ${id}`)
  return found
}

export function countAnswered(
  passage: PassageData,
  answers: Record<number, string>,
): number {
  return passage.questionNumbers.filter((n) => {
    const value = answers[n]
    return Boolean(value && value.trim().length > 0)
  }).length
}

export function findPassageForQuestion(
  passages: PassageData[],
  questionId: number,
): PassageData {
  const found = passages.find((p) => p.questionNumbers.includes(questionId))
  if (!found) throw new Error(`Unknown question id: ${questionId}`)
  return found
}

export function allQuestionNumbers(passages: PassageData[]): number[] {
  return passages.flatMap((p) => p.questionNumbers)
}
