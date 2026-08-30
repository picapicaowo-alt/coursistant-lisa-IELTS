import {unwrapData} from '@/apis'
import {mockExamApiService} from '@/apis/services/mock-exam-api'
import {parseReadingSubmission} from './runtimeData'
import type {SubmissionResult, SubmitReadingRequest} from './types'

export async function submitReading(
  studentMockExamId: number,
  body: SubmitReadingRequest,
): Promise<SubmissionResult> {
  const payload = unwrapData(
    await mockExamApiService.submitStudentReading(studentMockExamId, body.attemptId, {answers: body.answers}),
    'submitStudentMockExamReading',
  )
  return parseReadingSubmission(payload)
}
