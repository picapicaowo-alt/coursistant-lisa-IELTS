import { formatPersonName } from "@/utils/personName";

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
    ? { title: String(record[key]), consumed: new Set([key]) }
    : { consumed: new Set() };
}

export function displayScalar(value: unknown): string | null {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : null;
  if (typeof value !== "string" || !value.trim()) return null;
  return /^[A-Z]+(?:_[A-Z]+)+$/.test(value)
    ? humanize(value.toLowerCase())
    : value;
}
