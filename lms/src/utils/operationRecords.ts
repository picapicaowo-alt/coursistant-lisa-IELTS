import {LocalizedError} from '@/i18n/errors';

export type OperationRecord = Record<string, unknown>;

export function record(value: unknown): OperationRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new LocalizedError('common:records.unsupportedRecord');
  return value as OperationRecord;
}
export function optionalNumber(
  item: OperationRecord,
  ...keys: string[]
): number | undefined {
  for (const key of keys)
    if (
      typeof item[key] === "number" &&
      Number.isSafeInteger(item[key]) &&
      Number(item[key]) >= 0
    )
      return Number(item[key]);
  return undefined;
}
export function textValue(
  item: OperationRecord,
  ...keys: string[]
): string | undefined {
  for (const key of keys)
    if (typeof item[key] === "string" && item[key]) return item[key] as string;
  return undefined;
}
export function recordId(item: OperationRecord, ...keys: string[]): number {
  const id = optionalNumber(item, ...keys);
  if (!id)
    throw new LocalizedError('common:records.missingIdentity');
  return id;
}
/** Generic OpenAPI envelopes are read defensively. Malformed data is never an empty success. */
export function recordPage(
  value: unknown,
  collectionKeys: string[] = [],
): { items: OperationRecord[]; total?: number } {
  if (Array.isArray(value)) return { items: value.map(record) };
  const result = record(value);
  for (const key of ["items", "content", ...collectionKeys]) {
    if (Array.isArray(result[key]))
      return {
        items: result[key].map(record),
        total: optionalNumber(result, "total", "totalElements"),
      };
  }
  throw new LocalizedError('common:records.unsupportedList');
}
