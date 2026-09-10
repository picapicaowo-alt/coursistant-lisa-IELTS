import {parseUtcTimestamp} from './datetime';

interface CalendarDisplay {
  date: string;
  startTime: string;
  endTime?: string;
  timezone: string;
  durationMinutes?: number;
}

/** Produce canonical grid coordinates from UTC instants in the envelope's zone.
 * The fixed numeric locale is for internal date/time keys, not visible copy. */
export function calendarDisplay(row: Record<string, unknown>, displayZone: unknown): CalendarDisplay | undefined {
  if (row.startsAtUtc != null) {
    if (typeof row.startsAtUtc !== 'string' || typeof displayZone !== 'string' || !displayZone) return;
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: displayZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23', numberingSystem: 'latn',
      });
      const parts = (value: string) => Object.fromEntries(formatter.formatToParts(parseUtcTimestamp(value)).map(part => [part.type, part.value]));
      const start = parts(row.startsAtUtc);
      const end = typeof row.endsAtUtc === 'string' ? parts(row.endsAtUtc) : undefined;
      return {
        date: `${start.year}-${start.month}-${start.day}`,
        startTime: `${start.hour}:${start.minute}`,
        endTime: end ? `${end.hour}:${end.minute}` : undefined,
        timezone: displayZone,
        durationMinutes: typeof row.endsAtUtc === 'string'
          ? (parseUtcTimestamp(row.endsAtUtc).getTime() - parseUtcTimestamp(row.startsAtUtc).getTime()) / 60_000
          : undefined,
      };
    } catch {
      // An invalid instant/zone must not silently become a plausible local time.
      return;
    }
  }
  // Retain older dated occurrence reads. Never let them override a UTC field.
  const date = row.occurrenceDate ?? row.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof row.startTime !== 'string' || !/^\d{2}:\d{2}/.test(row.startTime) || typeof row.timezone !== 'string' || !row.timezone) return;
  return {date, startTime: row.startTime.slice(0, 5), endTime: typeof row.endTime === 'string' ? row.endTime.slice(0, 5) : undefined, timezone: row.timezone};
}
