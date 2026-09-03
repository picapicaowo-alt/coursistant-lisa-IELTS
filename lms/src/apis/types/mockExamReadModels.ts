/** Read projections from docs/api/mockexam.openapi.yaml, supplied 2026-09-03.
 * Optionality follows the consumed schema; do not infer values absent from a record.
 * LocalTime accepts the declared object and the existing ISO time transport. */
export type StudentMockExamSummaryDto = {
  id?: number;
  testId?: number;
  templateId?: number;
  versionNo?: number;
  title?: string;
  status?: string;
  readingSelected?: boolean;
  listeningSelected?: boolean;
  writingSelected?: boolean;
  writingInstructorUserId?: number;
  attemptId?: number;
  attemptStatus?: string;
  readingCorrect?: number;
  readingTotal?: number;
  listeningCorrect?: number;
  listeningTotal?: number;
  writingScore?: number;
  writingGradeStatus?: string;
  createdAt?: string;
};

export type InstructorWritingGradeQueueItem = {
  id?: number;
  studentMockExamId?: number;
  writingSubmissionId?: number;
  studentUserId?: number;
  studentFirstName?: string;
  studentMiddleName?: string;
  studentLastName?: string;
  templateId?: number;
  templateTitle?: string;
  templateLabel?: string;
  testVersionId?: number;
  versionNo?: number;
  status?: string;
  submittedAt?: string;
};

export type StudentWritingTaskViewDto = {
  content?: string;
  seq?: number;
  taskKey?: string;
  wordCount?: number;
};

export type WritingGradeDto = {
  id?: number;
  studentMockExamId?: number;
  writingSubmissionId?: number;
  instructorUserId?: number;
  status?: string;
  score?: number;
  feedback?: string;
  gradedAt?: string;
  createdAt?: string;
  tasks?: Array<StudentWritingTaskViewDto>;
  studentUserId?: number;
  studentFirstName?: string;
  studentMiddleName?: string;
  studentLastName?: string;
  templateId?: number;
  templateTitle?: string;
  templateLabel?: string;
  testVersionId?: number;
  versionNo?: number;
  submittedAt?: string;
};
