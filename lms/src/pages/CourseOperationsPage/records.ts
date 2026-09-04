import { formatPersonName } from "@/utils/personName";
import type {CourseWeek} from '@/apis';

export function occurrenceTitle(item: Occurrence, weeks?: CourseWeek[]) {
  return weeks?.find(week => week.id === item.weekId)?.title || item.title || (item.sessionId ? `Session ${item.sessionId}` : 'Class session');
}

import {record, optionalNumber, textValue, recordId, recordPage, type OperationRecord} from '@/utils/operationRecords';
export {record, optionalNumber, textValue, recordId, recordPage, type OperationRecord} from '@/utils/operationRecords';
export const PAGE_SIZE = 20;
export const REPORT_TYPES = [
  { value: "MID_TERM", label: "Mid-term report" },
  { value: "FINAL", label: "Final report" },
] as const;
export const REPORT_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export const operationKeys = {
  course: (id: number) => ["instructor-course", id] as const,
  occurrences: (id: number) =>
    ["instructor-course", id, "occurrences"] as const,
  attendance: (id: number, occurrence: number) =>
    ["instructor-course", id, "attendance", occurrence] as const,
  reports: (id: number) => ["instructor-course", id, "reports"] as const,
  weeks: (id: number) => ["course-weeks", id] as const,
  requests: (id: number) => ["instructor-course", id, "requests"] as const,
};

export const studentName = (item: OperationRecord) =>
  formatPersonName(
    {
      firstName: textValue(item, "studentFirstName", "userFirstName"),
      middleName: textValue(item, "studentMiddleName", "userMiddleName"),
      lastName: textValue(item, "studentLastName", "userLastName"),
    },
    textValue(item, "userName") ||
      `Student #${optionalNumber(item, "studentUserId", "userId") ?? "—"}`,
  );

export const dateLabel = (value?: string) => {
  if (!value) return "Not provided";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
};
export const timeLabel = (value?: string) => {
  if (!value) return "Time not provided";
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
};
export const timeRange = (start?: string, end?: string) =>
  `${timeLabel(start)}${end ? ` – ${timeLabel(end)}` : ""}`;

export interface Occurrence {
  id: number;
  date: string;
  startTime?: string;
  endTime?: string;
  sessionId?: number;
  weekId?: number;
  status?: string;
  version?: number;
  timezone?: string;
  title?: string;
  attendanceOpened?: boolean;
}
export function parseOccurrence(value: unknown): Occurrence {
  const item = record(value);
  const date = textValue(item, "occurrenceDate", "date");
  if (!date)
    throw new Error(
      "A class is missing its date. Please refresh the schedule.",
    );
  return {
    id: recordId(item, "occurrenceId", "id"),
    date,
    startTime: textValue(item, "startTime"),
    endTime: textValue(item, "endTime"),
    sessionId: optionalNumber(item, "sessionId"),
    weekId: optionalNumber(item, "weekId"),
    status: textValue(item, "status"),
    version: optionalNumber(item, "version"),
    timezone: textValue(item, "timezone"),
    title: textValue(item, "title"),
    attendanceOpened:
      typeof item.attendanceOpened === "boolean"
        ? item.attendanceOpened
        : undefined,
  };
}
export const parseOccurrences = (value: unknown) =>
  recordPage(value)
    .items.map(parseOccurrence)
    .sort((a, b) =>
      `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
    );

export interface AttendanceRow {
  studentUserId: number;
  name: string;
  status?: string;
  effectiveStatus?: string;
}
export interface AttendanceRoster {
  version?: number;
  items: AttendanceRow[];
}
export function parseAttendance(value: unknown): AttendanceRoster {
  const root = record(value);
  const items = recordPage(root, ["entries", "rows", "students"]).items.map(
    (item) => ({
      studentUserId: recordId(item, "studentUserId"),
      name: studentName(item),
      status: textValue(item, "rawStatus", "status"),
      effectiveStatus: textValue(item, "effectiveStatus"),
    }),
  );
  if (new Set(items.map((item) => item.studentUserId)).size !== items.length)
    throw new Error(
      "The attendance roster contains duplicate students. Please synchronize the roster.",
    );
  return {
    version: optionalNumber(root, "attendanceVersion", "version"),
    items,
  };
}

export interface StudentReport {
  id: number;
  studentUserId: number;
  name: string;
  reportType?: string;
  status?: string;
  updatedAt?: string;
  version?: number;
  overallSummary?: string;
  strengths?: string;
  weaknesses?: string;
  skillEvaluation?: string;
  improvementSuggestions?: string;
}
export function parseReport(value: unknown): StudentReport {
  const item = record(value);
  return {
    id: recordId(item, "reportId", "id"),
    studentUserId: recordId(item, "studentUserId"),
    name: studentName(item),
    reportType: textValue(item, "reportType"),
    status: textValue(item, "status"),
    updatedAt: textValue(item, "updatedAt", "createdAt"),
    version: optionalNumber(item, "version"),
    overallSummary: textValue(item, "overallSummary"),
    strengths: textValue(item, "strengths"),
    weaknesses: textValue(item, "weaknesses"),
    skillEvaluation: textValue(item, "skillEvaluation"),
    improvementSuggestions: textValue(item, "improvementSuggestions"),
  };
}

export interface DiscussionPost {
  id: number;
  body: string;
  name: string;
  createdAt?: string;
}
export function parsePost(value: unknown): DiscussionPost {
  const item = record(value);
  return {
    id: recordId(item, "postId", "id"),
    body: textValue(item, "body") ?? "",
    name: formatPersonName(
      {
        firstName: textValue(item, "authorFirstName"),
        middleName: textValue(item, "authorMiddleName"),
        lastName: textValue(item, "authorLastName"),
      },
      "Course member",
    ),
    createdAt: textValue(item, "createdAt"),
  };
}

/** Instructor decisions are limited to the state transition delivered by course OpenAPI. */
export const isInstructorScheduleRequestReviewable = (request: OperationRecord): boolean =>
  request.requestType === 'SCHEDULE_CHANGE' && request.status === 'PENDING_INSTRUCTOR';
