import i18n from '@/i18n';
import {formatNumber, formatDateValue, formatClockTime} from '@/i18n/formatting';
import {formatPersonName} from '@/utils/personName';
import type {AdvisorConversationAttachmentResponse, AdvisorConversationMessageResponse} from '@/apis';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;

const readString = (record: UnknownRecord, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
};

const readNumber = (record: UnknownRecord, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
};

export const contractItems = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  return record && Array.isArray(record.items) ? record.items : [];
};

// Presentation getters read the shared locale at access time. Views may be retained
// in an open review; language changes must not replace its captured id/version.
export interface AdvisorDashboardView {
  stats: Array<{key: string; label: string; value: number}>;
  urgentTasks: unknown[];
}

const DASHBOARD_STATS = [
  ['assignedStudentCount', "advising:overview.stats.assigned"],
  ['onTrackCount', "common:risk.onTrack"],
  ['atRiskCount', "common:risk.atRisk"],
  ['needsAttentionCount', "common:risk.needsAttention"],
  ['pendingApprovalCount', "advising:overview.stats.approval"],
  ['overdueFollowUpCount', "advising:overview.stats.overdue"],
] as const;

export const advisorDashboardView = (value: unknown): AdvisorDashboardView => {
  const record = asRecord(value) ?? {};
  return {
    stats: DASHBOARD_STATS.map(([key, labelKey]) => ({
      key,
      get label() {return i18n.t(labelKey);},
      value: readNumber(record, key) ?? 0,
    })),
    urgentTasks: contractItems(record.urgentTasks),
  };
};

export interface AdvisorConversationSummaryView {
  studentUserId: number;
  studentName: string;
  latestPreview?: string;
  latestAt?: string;
  unreadCount: number;
  hasThread: boolean;
}

export const advisorConversationViews = (value: unknown): AdvisorConversationSummaryView[] =>
  contractItems(value).flatMap(item => {
    const record = asRecord(item);
    if (!record) return [];
    const studentUserId = readNumber(record, 'studentUserId');
    if (studentUserId == null) return [];
    return [{
      studentUserId,
      get studentName() {return formatPersonName({firstName: readString(record, 'studentFirstName'), middleName: readString(record, 'studentMiddleName'), lastName: readString(record, 'studentLastName')}, i18n.t('common:people.studentFallback', {id: formatNumber(studentUserId)}));},
      latestPreview: readString(record, 'latestPreview'),
      latestAt: readString(record, 'latestAt'),
      unreadCount: readNumber(record, 'unreadCount') ?? 0,
      hasThread: readNumber(record, 'threadId') != null || Boolean(readString(record, 'threadId')),
    }];
  });

export interface AdvisorScheduleRequestView {
  requestId: number;
  expectedVersion?: number;
  studentName: string;
  courseLabel: string;
  requestType?: string;
  requestedDate?: string;
  requestedTime?: string;
  reason?: string;
  status?: string;
}

export const advisorScheduleRequestViews = (value: unknown): AdvisorScheduleRequestView[] =>
  contractItems(value).flatMap(item => {
    const record = asRecord(item);
    if (!record) return [];
    const requestId = readNumber(record, 'requestId', 'id');
    if (requestId == null) return [];
    const studentUserId = readNumber(record, 'studentUserId');
    const courseId = readNumber(record, 'courseId');
    const start = readString(record, 'proposedStartTime', 'startTime');
    const end = readString(record, 'proposedEndTime', 'endTime');
    return [{
      requestId,
      expectedVersion: readNumber(record, 'expectedVersion', 'version'),
      get studentName() {return readString(record, 'studentName') ?? (studentUserId == null ? i18n.t('common:roles.STUDENT') : i18n.t('common:people.studentFallback', {id: formatNumber(studentUserId)}));},
      get courseLabel() {return readString(record, 'courseTitle', 'courseCode') ?? (courseId == null ? i18n.t('common:fields.course') : i18n.t('assistant:courseFallback', {id: formatNumber(courseId)}));},
      requestType: readString(record, 'requestType'),
      get requestedDate() {const value = readString(record, 'proposedOccurrenceDate', 'occurrenceDate'); return value ? formatDateValue(value) : undefined;},
      get requestedTime() {return start ? `${formatClockTime(start)}${end ? `–${formatClockTime(end)}` : ''}` : undefined;},
      reason: readString(record, 'reason'),
      status: readString(record, 'status'),
    }];
  });

export const advisorConversationMessageViews = (value: unknown): AdvisorConversationMessageResponse[] =>
  contractItems(value).flatMap(item => {
    const record = asRecord(item);
    if (!record) return [];
    const attachments = contractItems(record.attachments).flatMap(attachment => {
      const attachmentRecord = asRecord(attachment);
      if (!attachmentRecord) return [];
      const attachmentId = readNumber(attachmentRecord, 'attachmentId');
      if (attachmentId == null) return [];
      return [{
        attachmentId,
        originalName: readString(attachmentRecord, 'originalName'),
        contentType: readString(attachmentRecord, 'contentType'),
        sizeBytes: readNumber(attachmentRecord, 'sizeBytes'),
        previewAvailable: attachmentRecord.previewAvailable === true,
      } satisfies AdvisorConversationAttachmentResponse];
    });
    return [{
      messageId: readNumber(record, 'messageId'),
      senderUserId: readNumber(record, 'senderUserId'),
      body: readString(record, 'body'),
      createdAt: readString(record, 'createdAt'),
      attachments,
    }];
  });

export const contractRecordNumber = (value: unknown, ...keys: string[]): number | undefined => {
  const record = asRecord(value);
  return record ? readNumber(record, ...keys) : undefined;
};

/** New Student cursor pages own continuation; legacy array responses remain readable during cutover. */
export function advisorConversationPage(value: unknown) {
  const items = advisorConversationMessageViews(value);
  const page = asRecord(value);
  const nextBeforeId = page ? readNumber(page, 'nextBeforeId') : undefined;
  return {items, nextBeforeId, hasMore: page?.hasMore === true};
}
