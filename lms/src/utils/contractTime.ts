import {formatUtcTimestamp} from './datetime';

/** Normalize reads without losing seconds when unchanged availability is saved. */
export function contractTimeValue(value: unknown): string | undefined {
  if (typeof value === 'string') return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?$/.test(value) ? value : undefined;
  if (!value || typeof value !== 'object') return undefined;
  const {hour, minute, second = 0, nano = 0} = value as {hour?: number; minute?: number; second?: number; nano?: number};
  if (hour == null || minute == null || ![hour, minute, second, nano].every(Number.isInteger) || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59 || nano < 0 || nano > 999999999) return undefined;
  const time = [hour, minute, second].map(part => String(part).padStart(2, '0')).join(':');
  return nano ? `${time}.${String(nano).padStart(9, '0').replace(/0+$/, '')}` : time;
}

/** LocalTime is an object in OpenAPI and an ISO string in existing transports. */
export function contractClock(value: unknown): string | undefined {
  return contractTimeValue(value)?.slice(0, 5);
}

export function formatZonedTimestamp(value?: string, timezone?: string): string | undefined {
  if (!value) return undefined;
  try {
    return formatUtcTimestamp(value, {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: timezone});
  } catch {
    return value;
  }
}
