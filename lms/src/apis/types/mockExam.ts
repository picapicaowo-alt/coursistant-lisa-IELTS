/** Contracts declared by docs/api/mockexam.openapi.yaml. */
export interface MockExamTemplateVersionSummary {
  id?: number;
  templateId?: number;
  versionNo?: number;
  label?: string;
  title?: string;
  status?: string;
  hasListening?: boolean;
  hasReading?: boolean;
  hasWriting?: boolean;
  createdAt?: string;
  publishedAt?: string;
}

export interface MockExamTemplateSummary {
  id?: number;
  label?: string;
  title?: string;
  publishedVersionId?: number;
  publishedVersionNo?: number;
  versions?: MockExamTemplateVersionSummary[];
}

export interface CreateMockExamTemplateRequest {
  label: string;
  title: string;
}

export interface CreateStudentMockExamRequest {
  templateId?: number;
  listeningSelected?: boolean;
  readingSelected?: boolean;
  writingSelected?: boolean;
  writingInstructorUserId?: number;
}

export interface GradeMockExamWritingRequest {
  score?: number;
  feedback?: string;
}

export interface SubmitMockExamListeningRequest {
  answers?: unknown;
}

export interface SubmitMockExamReadingRequest {
  answers?: unknown;
}

export interface SubmitMockExamWritingTask {
  taskKey?: string;
  content?: string;
}

export interface SubmitMockExamWritingRequest {
  tasks?: SubmitMockExamWritingTask[];
}

export interface MockExamAttempt {
  candidateName?: string;
  id?: number;
  startedAt?: string;
  status?: string;
  studentMockExamId?: number;
  studentUserId?: number;
  submittedAt?: string;
  testId?: number;
}

export interface ObserverMockExamDetail {
  attempt?: MockExamAttempt;
  createdAt?: string;
  id?: number;
  listeningCorrect?: number;
  listeningSelected?: boolean;
  listeningTotal?: number;
  readingCorrect?: number;
  readingSelected?: boolean;
  readingTotal?: number;
  status?: string;
  templateId?: number;
  testId?: number;
  title?: string;
  versionNo?: number;
  writingGradeStatus?: string;
  writingInstructorUserId?: number;
  writingScore?: number;
  writingSelected?: boolean;
}

export interface StudentWritingTaskView {
  content?: string;
  seq?: number;
  taskKey?: string;
  wordCount?: number;
}

export interface StudentMockExamDetail extends ObserverMockExamDetail {
  writingFeedback?: string;
  writingTasks?: StudentWritingTaskView[];
}

export interface CreateMockExamListeningSectionRequest {
  instruction: string;
  kind: string;
  payload: unknown;
  questionEnd: number;
  questionStart: number;
  sortOrder: number;
  title: string;
}

export interface CreateMockExamListeningPartRequest {
  audioMediaId: number;
  label: string;
  sections: CreateMockExamListeningSectionRequest[];
  seq: number;
}

export interface CreateMockExamListeningRequest {
  parts: CreateMockExamListeningPartRequest[];
  totalMinutes: number;
}

export interface CreateMockExamPassageQuestionRequest extends CreateMockExamListeningSectionRequest {
  imageMediaId?: number;
}

export interface CreateMockExamPassageRequest {
  intro: string;
  paragraphs: unknown[];
  questions: CreateMockExamPassageQuestionRequest[];
  seq: number;
  shortLabel: string;
  title: string;
}

export interface CreateMockExamReadingRequest {
  passages: CreateMockExamPassageRequest[];
  totalMinutes: number;
}

export interface CreateMockExamWritingTaskRequest {
  imageMediaId?: number;
  minWords: number;
  prompt: string;
  seq: number;
  taskKey: string;
  title: string;
}

export interface CreateMockExamWritingRequest {
  tasks: CreateMockExamWritingTaskRequest[];
  totalMinutes: number;
}

export type MockExamMediaKind = 'LISTENING_AUDIO' | 'READING_IMAGE' | 'WRITING_IMAGE';

export interface MockExamMediaRead {
  mediaId: number;
  kind: MockExamMediaKind;
  originalFilename?: string;
  contentType?: string;
  sizeBytes?: number;
  status?: string;
  createdAt?: string;
}

/** Response payloads remain generic where the supplied OpenAPI has no schema. */
export type MockExamRead = unknown;
