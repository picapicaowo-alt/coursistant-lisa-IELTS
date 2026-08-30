import type { ListeningPaper, ListeningPart, ListeningSection } from '../data/listening/types'
import { listeningPartAudioUrl } from './listenings'
import type { ApiListeningDetail, ApiListeningPart, ApiListeningSection } from './types'

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

function mapSection(section: ApiListeningSection): ListeningSection {
  const payload = stripAnswers(section.payload)
  return {
    kind: section.kind,
    title: section.title,
    instruction: section.instruction,
    questionStart: section.questionStart,
    questionEnd: section.questionEnd,
    ...payload,
  } as ListeningSection
}

function mapPart(part: ApiListeningPart, listeningId: number): ListeningPart {
  return {
    id: part.id,
    label: part.label,
    audioSrc: part.audioSrc ?? listeningPartAudioUrl(listeningId, part.seq),
    questionNumbers: part.questionNumbers,
    sections: part.sections.map(mapSection),
  }
}

export function mapListeningDetail(detail: ApiListeningDetail): ListeningPaper {
  return {
    id: detail.id,
    totalMinutes: detail.totalMinutes,
    parts: detail.parts.map((part) => mapPart(part, detail.id)),
  }
}
