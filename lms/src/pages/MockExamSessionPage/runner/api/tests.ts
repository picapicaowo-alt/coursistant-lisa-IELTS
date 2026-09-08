import {mockExamSessionKey} from '@/utils/mockExamSessionStorage';
import {unwrapData} from '@/apis'
import {LocalizedError} from '@/i18n/errors';
import {mockExamApiService} from '@/apis/services/mock-exam-api'
import {parseAttemptId} from './runtimeData'

export async function ensureAttemptId(studentMockExamId: number, studentUserId: number): Promise<number> {
  const key = mockExamSessionKey(studentUserId, studentMockExamId, 'attempt');
  try {
    const stored = window.sessionStorage.getItem(key);
    if (stored) {
      const id = Number(stored);
      if (Number.isFinite(id) && id > 0) return id;
    }
  } catch { /* The API can still create or recover the current attempt. */ }

  const payload = unwrapData(
    await mockExamApiService.createStudentAttempt(studentMockExamId),
    'createStudentMockExamAttempt',
  )
  const attemptId = parseAttemptId(payload)
  if (attemptId === null) {
    throw new LocalizedError('exams:session.missingAttempt')
  }
  try { window.sessionStorage.setItem(key, String(attemptId)); } catch { /* Do not discard a successful API response. */ }
  return attemptId
}
