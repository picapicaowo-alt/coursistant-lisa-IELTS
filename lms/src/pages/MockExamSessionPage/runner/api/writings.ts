import {unwrapData} from '@/apis'
import {mockExamApiService} from '@/apis/services/mock-exam-api'
import {parseWritingSubmission} from './runtimeData'
import type {SubmitWritingRequest, WritingSubmissionResult} from './types'

const imageUrls = new Map<string, string>()

const imageKey = (writingId: number, seq: number): string => `${writingId}:${seq}`

export function rememberWritingTaskImageUrl(writingId: number, seq: number, url: string): void {
  imageUrls.set(imageKey(writingId, seq), url)
}

export function writingTaskImageUrl(writingId: number, seq: number): string {
  return imageUrls.get(imageKey(writingId, seq)) ?? ''
}

export async function submitWriting(
  studentMockExamId: number,
  body: SubmitWritingRequest,
): Promise<WritingSubmissionResult> {
  const payload = unwrapData(
    await mockExamApiService.submitStudentWriting(studentMockExamId, body.attemptId, {tasks: body.tasks}),
    'submitStudentMockExamWriting',
  )
  return parseWritingSubmission(payload, body.tasks)
}
