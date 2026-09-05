import i18n from '@/i18n';
import {formatDateValue, formatClockTime} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import {asRecord, collection} from '@/components/RecordSummaryList/recordPresentation';
import {formatPersonName} from '@/utils/personName';

export {asRecord};
export const parentRecords = (value: unknown): Record<string, unknown>[] =>
  (collection(value) ?? []).flatMap(item => {const record = asRecord(item); return record ? [record] : [];});
export const parentText = (record: Record<string, unknown> | null, key: string): string | undefined =>
  typeof record?.[key] === 'string' && record[key].trim() ? record[key] : undefined;
export const parentNumber = (record: Record<string, unknown>, key: string): number | undefined =>
  typeof record[key] === 'number' && Number.isFinite(record[key]) ? record[key] : undefined;

export function parentStudentName(value: unknown, fallback: string): string {
  const student = asRecord(asRecord(value)?.student);
  return formatPersonName({firstName: parentText(student, 'firstName'), middleName: parentText(student, 'middleName'), lastName: parentText(student, 'lastName')}, fallback);
}

/** Date-only and class wall-clock values must not move with the viewer's time zone. */
export function parentDate(value?: string): string {
  if (!value) return i18n.t("learning:parent.noDate");
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDateValue(value) : value;
}

export const parentTime = (value?: string): string | undefined => value ? formatClockTime(value) : undefined;
export const parentLabel = statusLabel;

export function withoutFields(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));
}
