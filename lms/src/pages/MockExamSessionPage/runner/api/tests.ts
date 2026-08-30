import {unwrapData} from '@/apis'
import {mockExamApiService} from '@/apis/services/mock-exam-api'
import {parseAttemptId} from './runtimeData'

const attemptStorageKey = (studentMockExamId: number): string =>
  `coursistant:mock-exam:${studentMockExamId}:attempt`

export async function ensureAttemptId(studentMockExamId: number): Promise<number> {
  const key = attemptStorageKey(studentMockExamId)
  const stored = window.sessionStorage.getItem(key)
  if (stored) {
    const id = Number(stored)
    if (Number.isFinite(id) && id > 0) return id
  }

  const payload = unwrapData(
    await mockExamApiService.createStudentAttempt(studentMockExamId),
    'createStudentMockExamAttempt',
  )
  const attemptId = parseAttemptId(payload)
  if (attemptId === null) {
    throw new Error('The attempt was created, but the response did not include an attempt id.')
  }
  window.sessionStorage.setItem(key, String(attemptId))
  return attemptId
}
