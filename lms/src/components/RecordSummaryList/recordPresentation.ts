import { formatPersonName } from "@/utils/personName";
import i18n from "@/i18n";
import {
  formatClockTime,
  formatDateValue,
  formatNumber,
  formatNumericText,
  formatWeekday,
} from "@/i18n/formatting";
import { roleLabel, statusLabel } from "@/i18n/presentation";
import { formatFileSize } from "@/utils/file-utils";

export type RecordValue = Record<string, unknown>;
export const asRecord = (value: unknown): RecordValue | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RecordValue)
    : null;

export const collection = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return null;
  for (const key of ["items", "content", "records", "results"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return null;
};

export const humanize = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());

const sharedFieldKeys: Record<string, string> = {
  submissionRequirement: 'advising:journey.submissionRequirement',
  advisorPrivateNotes: 'advising:profile.privateNotes',
};

export function recordFieldLabel(key: string): string {
  if (sharedFieldKeys[key]) return i18n.t(sharedFieldKeys[key]);
  const shared = `common:fields.${key}`;
  if (i18n.exists(shared)) return i18n.t(shared);
  // Unexpected contract fields remain visible, and the shared missing-key
  // warning identifies the field that needs a reviewed translation.
  return i18n.t(`records:fields.${key}`, { defaultValue: humanize(key) });
}

// Generic reads are presentation boundaries, not permission boundaries. Keep
// internal concurrency, storage and authentication metadata out of product UI.
export const isDisplayField = (key: string): boolean =>
  !/^(?:id|page|size|totalPages|totalElements|hasMore|nextBeforeId|checksum|cas|privateNotes|internalNotes|profileContext)$/i.test(
    key,
  ) &&
  !/(?:Id|Ids)$/.test(key) &&
  !/(?:Version|ObjectKey|Watermark|Token|Password|Secret|Credential|Checksum|DownloadUrl|PreviewUrl)$/i.test(
    key,
  ) &&
  !key.startsWith("_");

const TITLE_KEYS = [
  "title",
  "name",
  "studentName",
  "courseTitle",
  "courseCode",
  "eventTitle",
  "originalName",
  "displayName",
  "description",
  "overallSummary",
  "taskType",
  "notificationType",
  "reportType",
];
export function recordHeading(record: RecordValue): {
  title?: string;
  consumed: Set<string>;
} {
  const person = formatPersonName({
    firstName:
      typeof record.firstName === "string" ? record.firstName : undefined,
    middleName:
      typeof record.middleName === "string" ? record.middleName : undefined,
    lastName: typeof record.lastName === "string" ? record.lastName : undefined,
  });
  if (person)
    return {
      title: person,
      consumed: new Set(["firstName", "middleName", "lastName"]),
    };
  const key = TITLE_KEYS.find(
    (key) => typeof record[key] === "string" && record[key].trim(),
  );
  return key
    ? {
        title: displayScalar(record[key], key) ?? undefined,
        consumed: new Set([key]),
      }
    : { consumed: new Set() };
}

const ENUM_FIELDS = new Set([
  "status",
  "state",
  "rawStatus",
  "effectiveStatus",
  "enrollmentStatus",
  "requestType",
  "reportType",
  "taskType",
  "notificationType",
  "studentType",
  "materialType",
  "teachingType",
  "decision",
  "instructorDecision",
  "skillCode",
  "priority",
  "severity",
  "riskLevel",
]);

export function displayScalar(value: unknown, key?: string): string | null {
  if (typeof value === "boolean")
    return i18n.t(value ? "common:common.yes" : "common:common.no");
  if (typeof value === "number")
    return Number.isFinite(value)
      ? key === "sizeBytes"
        ? formatFileSize(value)
        : formatNumber(value, { maximumFractionDigits: 20 })
      : null;
  if (typeof value !== "string" || !value.trim()) return null;
  if (key === 'currentValue' || key === 'targetValue') return formatNumericText(value) ?? null;
  if (key === "role" || key === "courseRole") return roleLabel(value);
  if (key && ENUM_FIELDS.has(key)) return statusLabel(value);
  if (key === "dayOfWeek") return formatWeekday(value, "long");
  if (key && /(?:^date$|Date$|At(?:Local|Utc)?$)/.test(key))
    return formatDateValue(value);
  if (key && /Time$/.test(key)) return formatClockTime(value);
  // Uppercase or underscored authored content is not an enum.
  return value;
}
