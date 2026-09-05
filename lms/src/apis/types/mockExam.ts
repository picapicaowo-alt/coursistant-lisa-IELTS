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
  answers: Record<string, string | null>;
}

export interface SubmitMockExamReadingRequest {
  answers: Record<string, string | null>;
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

export type MockExamObjectiveAnswer = {answer: string; answers?: never} | {answer?: never; answers: string[]};
export type MockExamPayloadValue = string | number | boolean | null | MockExamPayloadValue[] | {[key: string]: MockExamPayloadValue};
/** Renderer-specific question data retains its JSON structure. Numbered slots
 * carry MockExamObjectiveAnswer; multiSelect uses answersByQuestion instead. */
export type MockExamAnswerBearingQuestionPayload = Record<string, MockExamPayloadValue>;
export interface MockExamMultipleChoiceAnswer {
  questionIds: number[];
  chooseCount: number;
  options: string[];
  answersByQuestion: Record<string, string>;
}

export interface CreateMockExamListeningSectionRequest {
  instruction: string;
  kind: string;
  payload: MockExamAnswerBearingQuestionPayload;
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
  /** The consumed OpenAPI permits structured JsonNode content, not only arrays. */
  paragraphs: unknown;
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

export interface MockExamSectionRequests {
  reading: CreateMockExamReadingRequest;
  listening: CreateMockExamListeningRequest;
  writing: CreateMockExamWritingRequest;
}

export interface MockExamContentRevision {contentRevision: number}

export type MockExamMediaKind = 'LISTENING_AUDIO' | 'READING_IMAGE' | 'WRITING_IMAGE';

export interface MockExamMediaRead {
  mediaId: number;
  kind: MockExamMediaKind;
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
  status?: string;
  sha256?: string;
  previewUrl?: string;
}

/** Response payloads remain generic where the supplied OpenAPI has no schema. */
export type MockExamRead = unknown;
