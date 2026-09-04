export type OperationRecord = Record<string, unknown>;

export function record(value: unknown): OperationRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(
      "The server returned an unsupported record. Please refresh or contact support.",
    );
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
    throw new Error(
      "A record is missing its identity. Actions are unavailable until the server returns a valid record.",
    );
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
  throw new Error("The server did not return a supported list. Please retry.");
}
