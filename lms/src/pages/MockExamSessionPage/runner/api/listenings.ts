import {unwrapData} from '@/apis'
import {mockExamApiService} from '@/apis/services/mock-exam-api'
import {parseListeningSubmission} from './runtimeData'
import type {ListeningSubmissionResult, SubmitListeningRequest} from './types'

export function listeningPartAudioUrl(_listeningId?: number, _seq?: number): string {
  return ''
}

export async function submitListening(
  studentMockExamId: number,
  body: SubmitListeningRequest,
): Promise<ListeningSubmissionResult> {
  const payload = unwrapData(
    await mockExamApiService.submitStudentListening(studentMockExamId, body.attemptId, {answers: body.answers}),
    'submitStudentMockExamListening',
  )
  return parseListeningSubmission(payload)
}
