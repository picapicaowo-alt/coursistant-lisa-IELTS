import {isRecord} from '@/pages/MockExamSessionPage/runner/api/runtimeData'
import type {MockExamTemplateSummary, MockExamTemplateVersionSummary} from '@/apis'

export type RuntimeRecord = Record<string, unknown>

export function runtimeItems(value: unknown): RuntimeRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (!isRecord(value)) return []
  for (const key of ['content', 'items', 'records', 'templates', 'exams', 'grades', 'mockExams']) {
    const candidate = value[key]
    if (Array.isArray(candidate)) return candidate.filter(isRecord)
  }
  return []
}

export function runtimeNumber(record: RuntimeRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

export function runtimeString(record: RuntimeRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

export function templateItems(value: unknown): MockExamTemplateSummary[] {
  return runtimeItems(value).map((record) => ({
    id: runtimeNumber(record, 'id', 'templateId') ?? undefined,
    label: runtimeString(record, 'label') ?? undefined,
    title: runtimeString(record, 'title') ?? undefined,
    publishedVersionId: runtimeNumber(record, 'publishedVersionId') ?? undefined,
    publishedVersionNo: runtimeNumber(record, 'publishedVersionNo') ?? undefined,
    versions: Array.isArray(record.versions)
      ? record.versions.filter(isRecord).map((version): MockExamTemplateVersionSummary => ({
        id: runtimeNumber(version, 'id', 'versionId') ?? undefined,
        templateId: runtimeNumber(version, 'templateId') ?? undefined,
        versionNo: runtimeNumber(version, 'versionNo') ?? undefined,
        label: runtimeString(version, 'label') ?? undefined,
        title: runtimeString(version, 'title') ?? undefined,
        status: runtimeString(version, 'status') ?? undefined,
        hasListening: version.hasListening === true,
        hasReading: version.hasReading === true,
        hasWriting: version.hasWriting === true,
        createdAt: runtimeString(version, 'createdAt') ?? undefined,
        publishedAt: runtimeString(version, 'publishedAt') ?? undefined,
      }))
      : [],
  }))
}

export function recordLabel(record: RuntimeRecord, fallback: string): string {
  return runtimeString(record, 'title', 'label', 'name', 'candidateName', 'studentName') ?? fallback
}
