import type { PassageData, QuestionSection } from '../data/types'
import type { ReadingTest } from '../data/reading'
import type { ApiPassage, ApiQuestion, ApiReadingDetail } from './types'

function stripAnswers<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripAnswers(item)) as T
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'answer' || key === 'answers') continue
      out[key] = stripAnswers(nested)
    }
    return out as T
  }
  return value
}

function mapQuestion(question: ApiQuestion): QuestionSection {
  const payload = stripAnswers(question.payload)
  return {
    kind: question.kind,
    title: question.title,
    instruction: question.instruction,
    ...payload,
  } as QuestionSection
}

function mapPassage(passage: ApiPassage): PassageData {
  return {
    id: passage.id,
    shortLabel: passage.shortLabel,
    title: passage.title,
    intro: passage.intro,
    paragraphs: passage.paragraphs,
    questionNumbers: passage.questionNumbers,
    sections: passage.questions.map(mapQuestion),
  }
}

export function mapReadingDetail(detail: ApiReadingDetail): ReadingTest {
  return {
    id: detail.id,
    totalMinutes: detail.totalMinutes,
    passages: detail.passages.map(mapPassage),
  }
}
