import type { ListeningPaper } from './types'

export function allListeningQuestionNumbers(paper: ListeningPaper): number[] {
  return paper.parts.flatMap((p) => p.questionNumbers)
}

export function findPartForQuestion(paper: ListeningPaper, questionId: number) {
  const found = paper.parts.find((p) => p.questionNumbers.includes(questionId))
  if (!found) throw new Error(`Unknown listening question: ${questionId}`)
  return found
}
