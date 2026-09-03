import {isRecord} from '@/pages/MockExamSessionPage/runner/api/runtimeData';

export type Section = 'listening' | 'reading' | 'writing'

export type StudentExamSummary = {
  id: number
  title: string
  label: string
  status: string
  assignedAt: string | null
  sections: Section[]
  results: Partial<Record<Section, string>>
  attemptStatus: string | null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export function listItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) return []
  for (const key of ['content', 'items', 'exams', 'mockExams', 'records']) {
    const candidate = value[key]
    if (Array.isArray(candidate)) return candidate
  }
  return []
}

function nestedString(record: Record<string, unknown>, key: string): string | null {
  const direct = asString(record[key])
  if (direct) return direct
  const template = isRecord(record.template) ? record.template : null
  return template ? asString(template[key]) : null
}

function includesSection(record: Record<string, unknown>, section: Section): boolean {
  const titleCase = `${section[0].toUpperCase()}${section.slice(1)}`
  return record[`${section}Selected`] === true
    || record[`has${titleCase}`] === true
    || record[section] !== undefined && record[section] !== null
}

export function normalizeStudentExams(value: unknown): StudentExamSummary[] {
  return listItems(value).flatMap((item) => {
    if (!isRecord(item)) return []
    const idValue = item.studentMockExamId ?? item.id
    if (typeof idValue !== 'number' || !Number.isFinite(idValue) || idValue <= 0) return []
    const sections = (['listening', 'reading', 'writing'] as const)
      .filter((section) => includesSection(item, section))
    return [{
      id: idValue,
      title: nestedString(item, 'title') ?? `Mock exam ${idValue}`,
      label: nestedString(item, 'label') ?? 'Mock exam',
      status: asString(item.status) ?? 'Status unavailable',
      assignedAt: asString(item.assignedAt) ?? asString(item.createdAt),
      sections,
      attemptStatus: asString(item.attemptStatus),
      results: {
        reading: typeof item.readingCorrect === 'number' && typeof item.readingTotal === 'number' ? `${item.readingCorrect} / ${item.readingTotal} correct` : undefined,
        listening: typeof item.listeningCorrect === 'number' && typeof item.listeningTotal === 'number' ? `${item.listeningCorrect} / ${item.listeningTotal} correct` : undefined,
        writing: typeof item.writingScore === 'number' ? `Score ${item.writingScore}` : asString(item.writingGradeStatus)?.replace(/_/g, ' ').toLowerCase(),
      },
    }]
  })
}
