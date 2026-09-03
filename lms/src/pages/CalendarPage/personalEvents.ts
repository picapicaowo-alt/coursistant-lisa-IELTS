import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';

export interface PersonalEventView {
  id: number;
  title: string;
  startsAtLocal: string;
  endsAtLocal: string;
  timezone: string;
  version?: number;
  reminderMinutesBefore?: number;
}
const object = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
/** The generic read contract is guarded before an event is editable. Never create a version for a missing field. */
export function personalEventView(
  value: unknown,
): PersonalEventView | undefined {
  const row = object(value);
  if (!row) return;
  const id = row.eventId ?? row.id;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return;
  const {title, startsAtLocal, endsAtLocal, timezone} = row;
  if (
    typeof title !== 'string' ||
    typeof startsAtLocal !== 'string' ||
    typeof endsAtLocal !== 'string' ||
    typeof timezone !== 'string'
  )
    return;
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(startsAtLocal) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(endsAtLocal)
  )
    return;
  const version = row.version ?? row.eventVersion;
  return {
    id,
    title,
    startsAtLocal,
    endsAtLocal,
    timezone,
    version:
      typeof version === 'number' &&
      Number.isSafeInteger(version) &&
      version >= 0
        ? version
        : undefined,
    reminderMinutesBefore:
      typeof row.reminderMinutesBefore === 'number'
        ? row.reminderMinutesBefore
        : undefined,
  };
}
export function personalEventViews(value: unknown) {
  const record = object(value);
  const list = Array.isArray(value)
    ? value
    : (record?.items ?? record?.content);
  const raw = Array.isArray(list) ? list : [];
  const items = raw.flatMap((item) =>
    personalEventView(item) ? [personalEventView(item)!] : [],
  );
  return {items, unavailableCount: raw.length - items.length};
}
export function usePersonalEvents(fromUtc: string, toUtc: string) {
  return useQuery({
    queryKey: ['me', 'personal-events', fromUtc, toUtc],
    queryFn: async () =>
      personalEventViews(
        unwrapData(
          await courseOperationsApiService.listMyPersonalEvents({
            fromUtc,
            toUtc,
          }),
          'myPersonalEvents',
        ),
      ),
    retry: false,
  });
}
