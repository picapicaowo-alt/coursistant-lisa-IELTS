import {LocalizedError} from '@/i18n/errors';
import type {
  ApiListeningDetail,
  ApiListeningPart,
  ApiListeningSection,
  ApiPassage,
  ApiQuestion,
  ApiReadingDetail,
  ApiWritingDetail,
  ApiWritingTask,
  ListeningSubmissionResult,
  QuestionResult,
  SubmissionResult,
  WritingSubmissionResult,
} from './types'

export type JsonRecord = Record<string, unknown>

export function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function requiredPositiveNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new LocalizedError('exams:session.invalidTiming')
  }
  return value
}

function asBoolean(value: unknown): boolean {
  return value === true
}

function numberList(value: unknown): number[] {
  return asArray(value).filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
}

function stringList(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === 'string')
}

function range(start: number, end: number): number[] {
  if (start <= 0 || end < start) return []
  return Array.from({length: end - start + 1}, (_, index) => start + index)
}

function nestedSection(value: unknown, key: 'listening' | 'reading' | 'writing'): unknown {
  if (!isRecord(value)) return value
  const nested = value[key]
  return isRecord(nested) ? nested : value
}

function parseQuestion(value: unknown, index: number): ApiQuestion {
  // These fallbacks belong to the original IELTS paper, not the UI locale.
  // Parsing must produce the same labels, question identities and content in all locales.
  const record = isRecord(value) ? value : {}
  const payload = isRecord(record.payload) ? record.payload : {}
  return {
    kind: asString(record.kind),
    title: asString(record.title, `Questions ${index + 1}`),
    instruction: asString(record.instruction),
    questionStart: asNumber(record.questionStart, 0),
    questionEnd: asNumber(record.questionEnd, 0),
    payload,
  }
}

export function parseReadingDetail(value: unknown, fallbackId: number): ApiReadingDetail {
  const source = nestedSection(value, 'reading')
  if (!isRecord(source)) throw new LocalizedError('exams:session.invalidData')

  const passages: ApiPassage[] = asArray(source.passages).map((item, index) => {
    const record = isRecord(item) ? item : {}
    const questions = asArray(record.questions).map(parseQuestion)
    const derivedNumbers = questions.flatMap((question) => range(question.questionStart, question.questionEnd))
    const seq = asNumber(record.seq, index + 1)
    return {
      id: asNumber(record.id, seq),
      seq,
      shortLabel: asString(record.shortLabel, `Passage ${seq}`),
      title: asString(record.title, `Reading passage ${seq}`),
      intro: asString(record.intro),
      paragraphs: stringList(record.paragraphs),
      questionNumbers: numberList(record.questionNumbers).length > 0
        ? numberList(record.questionNumbers)
        : [...new Set(derivedNumbers)],
      questions,
    }
  })

  if (passages.length === 0) throw new LocalizedError('exams:session.noReading')
  return {
    id: asNumber(source.id, fallbackId),
    totalMinutes: requiredPositiveNumber(source.totalMinutes),
    passages,
  }
}

function parseListeningSection(value: unknown, index: number): ApiListeningSection {
  const record = isRecord(value) ? value : {}
  return {
    kind: asString(record.kind),
    title: asString(record.title, `Questions ${index + 1}`),
    instruction: asString(record.instruction),
    questionStart: asNumber(record.questionStart, 0),
    questionEnd: asNumber(record.questionEnd, 0),
    payload: isRecord(record.payload) ? record.payload : {},
  }
}

export function parseListeningDetail(value: unknown, fallbackId: number): ApiListeningDetail {
  const source = nestedSection(value, 'listening')
  if (!isRecord(source)) throw new LocalizedError('exams:session.invalidData')

  const parts: ApiListeningPart[] = asArray(source.parts).map((item, index) => {
    const record = isRecord(item) ? item : {}
    const sections = asArray(record.sections).map(parseListeningSection)
    const derivedNumbers = sections.flatMap((section) => range(section.questionStart, section.questionEnd))
    const seq = asNumber(record.seq, index + 1)
    return {
      id: asNumber(record.id, seq),
      seq,
      label: asString(record.label, `Part ${seq}`),
      questionNumbers: numberList(record.questionNumbers).length > 0
        ? numberList(record.questionNumbers)
        : [...new Set(derivedNumbers)],
      sections,
    }
  })

  if (parts.length === 0) throw new LocalizedError('exams:session.noListening')
  return {
    id: asNumber(source.id, fallbackId),
    totalMinutes: requiredPositiveNumber(source.totalMinutes),
    parts,
  }
}

export function parseWritingDetail(value: unknown, fallbackId: number): ApiWritingDetail {
  const source = nestedSection(value, 'writing')
  if (!isRecord(source)) throw new LocalizedError('exams:session.invalidData')

  const tasks: ApiWritingTask[] = asArray(source.tasks).map((item, index) => {
    const record = isRecord(item) ? item : {}
    const seq = asNumber(record.seq, index + 1)
    return {
      id: asNumber(record.id, seq),
      seq,
      taskKey: asString(record.taskKey, `task-${seq}`),
      title: asString(record.title, `Writing Task ${seq}`),
      prompt: asString(record.prompt),
      minWords: asNumber(record.minWords, 0),
      hasImage: asBoolean(record.hasImage) || asString(record.imagePath).length > 0,
    }
  })

  if (tasks.length === 0) throw new LocalizedError('exams:session.noWriting')
  return {
    id: asNumber(source.id, fallbackId),
    totalMinutes: requiredPositiveNumber(source.totalMinutes),
    tasks,
  }
}

export function parseAttemptId(value: unknown): number | null {
  if (!isRecord(value)) return null
  for (const candidate of [value.attemptId, value.id]) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate
  }
  return isRecord(value.attempt) ? parseAttemptId(value.attempt) : null
}

function parseQuestionResults(value: unknown): QuestionResult[] {
  return asArray(value).flatMap((item) => {
    if (!isRecord(item)) return []
    const questionNumber = asNumber(item.questionNumber, 0)
    if (questionNumber <= 0) return []
    return [{
      questionNumber,
      submitted: asString(item.submitted),
      correct: asBoolean(item.correct),
      blank: asBoolean(item.blank),
    }]
  })
}

export function parseReadingSubmission(value: unknown): SubmissionResult {
  const record = isRecord(value) ? value : {}
  return {
    submissionId: asNumber(record.submissionId, asNumber(record.id, 0)),
    readingId: asNumber(record.readingId, 0),
    candidateName: asString(record.candidateName),
    totalQuestions: typeof record.totalQuestions === 'number' ? record.totalQuestions : undefined,
    correctCount: typeof record.correctCount === 'number' ? record.correctCount : undefined,
    results: parseQuestionResults(record.results),
  }
}

export function parseListeningSubmission(value: unknown): ListeningSubmissionResult {
  const record = isRecord(value) ? value : {}
  return {
    submissionId: asNumber(record.submissionId, asNumber(record.id, 0)),
    listeningId: asNumber(record.listeningId, 0),
    candidateName: asString(record.candidateName),
    totalQuestions: typeof record.totalQuestions === 'number' ? record.totalQuestions : undefined,
    correctCount: typeof record.correctCount === 'number' ? record.correctCount : undefined,
    results: parseQuestionResults(record.results),
  }
}

export function parseWritingSubmission(
  value: unknown,
  submittedTasks: {taskKey: string; content: string}[],
): WritingSubmissionResult {
  const record = isRecord(value) ? value : {}
  const responseTasks = asArray(record.tasks)
  const tasks = responseTasks.length > 0
    ? responseTasks.flatMap((item, index) => {
      if (!isRecord(item)) return []
      return [{
        taskKey: asString(item.taskKey, submittedTasks[index]?.taskKey ?? `task-${index + 1}`),
        seq: asNumber(item.seq, index + 1),
        wordCount: asNumber(item.wordCount, 0),
        contentLength: asNumber(item.contentLength, 0),
      }]
    })
    : submittedTasks.map((task, index) => ({
      taskKey: task.taskKey,
      seq: index + 1,
      wordCount: task.content.trim() ? task.content.trim().split(/\s+/).length : 0,
      contentLength: task.content.length,
    }))

  return {
    submissionId: asNumber(record.submissionId, asNumber(record.id, 0)),
    writingId: asNumber(record.writingId, 0),
    candidateName: asString(record.candidateName),
    tasks,
  }
}

export function readExamTitle(value: unknown, fallback: string): string {
  if (!isRecord(value)) return fallback
  for (const candidate of [value.title, value.label, value.templateTitle]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate
  }
  return fallback
}
