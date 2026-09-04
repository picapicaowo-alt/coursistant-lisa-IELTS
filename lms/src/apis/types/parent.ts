import type {AdvisingPage} from './advising';
import type {ScheduleRequestType} from './courseOperations';

/** Contracts declared by docs/api/parent.openapi.yaml. */
export interface CreateOrReuseParentLinkRequest {
  email: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  reason?: string;
}

export interface ParentLinkRequest {
  reason?: string;
}

export interface ParentStudentLinkResponse {
  linkId?: number;
  parentUserId?: number;
  studentUserId?: number;
  linkedAt?: string;
  parentFirstName?: string;
  parentMiddleName?: string;
  parentLastName?: string;
  parentEmail?: string;
}

export type ParentLinkedStudentPage = AdvisingPage<ParentStudentLinkResponse>;

export interface ParentCreateScheduleRequest {
  courseId: number;
  occurrenceId: number;
  requestType: ScheduleRequestType;
  reason?: string;
  proposedOccurrenceDate?: string;
  proposedStartTime?: string;
  proposedEndTime?: string;
}

export interface ParentMessageRequest {
  clientMessageId: string;
  body?: string;
  files?: File[];
}

export interface MarkParentConversationReadRequest {
  messageId: number;
}

export interface ParentConversationAttachmentResponse {
  attachmentId?: number;
  originalName?: string;
  contentType?: string;
  sizeBytes?: number;
  previewAvailable?: boolean;
  downloadUrl?: string;
  previewUrl?: string;
}

export interface ParentConversationMessageResponse {
  messageId?: number;
  threadId?: number;
  senderUserId?: number;
  body?: string;
  createdAt?: string;
  attachments?: ParentConversationAttachmentResponse[];
}

export interface ParentNotification {
  notificationId?: number;
  studentUserId?: number;
  courseId?: number;
  courseCode?: string;
  notificationType?: string;
  message?: string;
  subjectType?: string;
  subjectId?: number;
  deepLink?: string;
  createdAt?: string;
  readAt?: string;
  availability?: string;
}

export interface ParentReportDetail {
  reportId?: number;
  reportType?: 'MID_TERM' | 'FINAL';
  overallSummary?: string;
  strengths?: string;
  weaknesses?: string;
  skillEvaluation?: string;
  improvementSuggestions?: string;
  publishedAt?: string;
}

/**
 * Parent read projections are narrowed by the corresponding page presenters.
 */
export type ParentAcademicRead = unknown;

/** ParentConversationMessageCursorPage in the September 2026 contract. */
export interface ParentConversationMessagePage {
  items: ParentConversationMessageResponse[];
  nextBeforeId?: number | null;
  hasMore?: boolean;
}

export type ParentNotificationPage = AdvisingPage<ParentNotification>;
