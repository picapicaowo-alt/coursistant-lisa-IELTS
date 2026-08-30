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
  label?: string;
  title?: string;
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

export interface CreateMockExamListeningSectionRequest {
  instruction?: string;
  kind?: string;
  payload?: unknown;
  questionEnd?: number;
  questionStart?: number;
  sortOrder?: number;
  title?: string;
}

export interface CreateMockExamListeningPartRequest {
  audioPath?: string;
  label?: string;
  sections?: CreateMockExamListeningSectionRequest[];
  seq?: number;
}

export interface CreateMockExamListeningRequest {
  parts?: CreateMockExamListeningPartRequest[];
  totalMinutes?: number;
}

export type CreateMockExamPassageQuestionRequest = CreateMockExamListeningSectionRequest;

export interface CreateMockExamPassageRequest {
  intro?: string;
  paragraphs?: unknown;
  questions?: CreateMockExamPassageQuestionRequest[];
  seq?: number;
  shortLabel?: string;
  title?: string;
}

export interface CreateMockExamReadingRequest {
  passages?: CreateMockExamPassageRequest[];
  totalMinutes?: number;
}

export interface CreateMockExamWritingTaskRequest {
  imagePath?: string;
  minWords?: number;
  prompt?: string;
  seq?: number;
  taskKey?: string;
  title?: string;
}

export interface CreateMockExamWritingRequest {
  tasks?: CreateMockExamWritingTaskRequest[];
  totalMinutes?: number;
}

/** Response payloads are not described for most mock-exam operations. */
export type MockExamRead = unknown;
