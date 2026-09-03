import {isRecord} from '@/utils/apiError';
import {runtimeItems, templateItems} from '@/pages/MockExamsPage/staffRuntime';

/** A paginated/incomplete response must never masquerade as a tenant-wide count. */
export function publishedTemplateCount(value: unknown): number | undefined {
  if (
    !Array.isArray(value) &&
    (!isRecord(value) ||
      !['items', 'content', 'records', 'templates'].some((key) =>
        Array.isArray(value[key]),
      ))
  )
    return undefined;
  const rows = runtimeItems(value);
  if (
    isRecord(value) &&
    typeof value.total === 'number' &&
    value.total > rows.length
  )
    return undefined;
  if (
    rows.some(
      (row) =>
        !('publishedVersionId' in row) &&
        !('publishedVersionNo' in row) &&
        !Array.isArray(row.versions),
    )
  )
    return undefined;
  return templateItems(value).filter((item) =>
    Boolean(
      item.publishedVersionId ||
      item.publishedVersionNo ||
      item.versions?.some((version) => version.status === 'PUBLISHED'),
    ),
  ).length;
}

export function validCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}
