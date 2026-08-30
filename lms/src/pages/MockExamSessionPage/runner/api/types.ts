/** Raw shapes from GET /api/readings and /api/readings/{id} */

export type ReadingSummary = {
  id: number
  totalMinutes: number
}

export type ApiQuestion = {
  kind: string
  title: string
  instruction: string
  questionStart: number
  questionEnd: number
  payload: Record<string, unknown>
}

export type ApiPassage = {
  id: number
  seq: number
  shortLabel: string
  title: string
  intro: string
  paragraphs: string[]
  questionNumbers: number[]
  questions: ApiQuestion[]
}

export type ApiReadingDetail = {
  id: number
  totalMinutes: number
  passages: ApiPassage[]
}

export type SubmitReadingRequest = {
  attemptId: number
  answers: Record<string, string>
}

export type QuestionResult = {
  questionNumber: number
  submitted: string
  correct: boolean
  blank: boolean
}

export type SubmissionResult = {
  submissionId: number
  readingId: number
  candidateName: string
  totalQuestions?: number
  correctCount?: number
  results: QuestionResult[]
}

export type ListeningSummary = {
  id: number
  totalMinutes: number
}

export type ApiListeningSection = {
  kind: string
  title: string
  instruction: string
  questionStart: number
  questionEnd: number
  payload: Record<string, unknown>
}

export type ApiListeningPart = {
  id: number
  seq: number
  label: string
  audioSrc?: string
  questionNumbers: number[]
  sections: ApiListeningSection[]
}

export type ApiListeningDetail = {
  id: number
  totalMinutes: number
  parts: ApiListeningPart[]
}

export type SubmitListeningRequest = {
  attemptId: number
  answers: Record<string, string>
}

export type ListeningSubmissionResult = {
  submissionId: number
  listeningId: number
  candidateName: string
  totalQuestions?: number
  correctCount?: number
  results: QuestionResult[]
}

export type WritingSummary = {
  id: number
  totalMinutes: number
}

export type ApiWritingTask = {
  id: number
  seq: number
  taskKey: string
  title: string
  prompt: string
  minWords: number
  hasImage: boolean
}

export type ApiWritingDetail = {
  id: number
  totalMinutes: number
  tasks: ApiWritingTask[]
}

export type SubmitWritingRequest = {
  attemptId: number
  tasks: { taskKey: string; content: string }[]
}

export type WritingSubmissionTaskResult = {
  taskKey: string
  seq: number
  wordCount: number
  contentLength: number
}

export type WritingSubmissionResult = {
  submissionId: number
  writingId: number
  candidateName: string
  tasks: WritingSubmissionTaskResult[]
}
