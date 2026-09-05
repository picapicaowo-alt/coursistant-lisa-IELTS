import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import {formatDateTime} from '@/i18n/formatting';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);

const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Course activity DTOs pair a local timestamp with its IANA zone. Explicit offsets remain authoritative. */
export const parseZonedTimestamp = (value: string, zone: string): Date => {
  try {
    return HAS_TIMEZONE.test(value) ? new Date(value) : dayjs.tz(value, zone).toDate();
  } catch {
    return new Date(NaN);
  }
};

/** Calendar feeds carry instants; convert them once into the displayed IANA zone. */
export function calendarLocalFields(startsAtUtc: string, endsAtUtc: string | undefined, zone: string) {
  try {
    const start = dayjs.utc(startsAtUtc).tz(zone);
    const end = endsAtUtc ? dayjs.utc(endsAtUtc).tz(zone) : undefined;
    if (!start.isValid() || (end && !end.isValid())) return undefined;
    return {date: start.format('YYYY-MM-DD'), startTime: start.format('HH:mm'), endTime: end?.format('HH:mm')};
  } catch {
    return undefined;
  }
}

/**
 * Backend audit/receipt timestamps are UTC, but several legacy DTOs expose
 * them as a zone-less `LocalDateTime`. Normalize those values before handing
 * them to `Date`; otherwise a browser silently treats UTC as local wall time.
 */
export const parseUtcTimestamp = (value: string): Date => {
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  return new Date(HAS_TIMEZONE.test(normalized) ? normalized : `${normalized}Z`);
};

export const formatUtcTimestamp = (
  value: string,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  },
): string => {
  const date = parseUtcTimestamp(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDateTime(date, options);
};

/**
 * Formats a deadline for display.
 *
 * The API hands back wall-clock time in the *tenant's* zone with no offset
 * attached, so the string alone is ambiguous — it has to be re-anchored in
 * that zone before it means an instant. INV-06 then requires showing it in the
 * viewer's own zone with a timezone label, so that every screen refers to the
 * same moment and nobody misreads a deadline by the offset between them.
 *
 * The label is deliberately concentrated here. The Figma date picker and
 * schedule modal show no timezone at all, which contradicts INV-06 — that is
 * open-decisions.md B-8, still undecided. When it is settled, this function is
 * the only place that has to change.
 *
 * @param atLocal wall-clock time in `tenantZone`, e.g. "2026-08-01T00:26:01"
 * @param tenantZone IANA zone the value is expressed in
 */
export const formatDeadline = (atLocal: string, tenantZone: string): string => {
  const instant = dayjs.tz(atLocal, tenantZone);

  if (!instant.isValid()) {
    // Better to surface the raw value than to render a plausible wrong time.
    return atLocal;
  }

  return formatDateTime(instant.toDate(), {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short'});
};

/**
 * Whether a deadline expressed in `tenantZone` has already passed.
 * Compares instants, so the viewer's zone does not affect the answer.
 */
export const isPastDeadline = (atLocal: string, tenantZone: string): boolean => {
  const instant = dayjs.tz(atLocal, tenantZone);
  return instant.isValid() && instant.isBefore(dayjs());
};
