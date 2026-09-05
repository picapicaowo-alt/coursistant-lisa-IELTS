import {getFormattingLocale} from './formatting';

type DateInputKind = 'date' | 'time' | 'datetime';
const pad = (value: number) => String(value).padStart(2, '0');

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${pad(month)}-${pad(day)}` : null;
}

/** Accept canonical API values and both supported display orders without ambiguous locale guessing. */
export function parseInputDate(value: string): string | null {
  const yearFirst = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yearFirst) return validDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
  const monthFirst = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return monthFirst ? validDate(Number(monthFirst[3]), Number(monthFirst[1]), Number(monthFirst[2])) : null;
}

export function parseInputTime(value: string): string | null {
  const numeric = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (numeric) return Number(numeric[1]) <= 23 && Number(numeric[2]) <= 59 ? `${pad(Number(numeric[1]))}:${numeric[2]}` : null;
  const twelveHour = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!twelveHour) return null;
  const hour = Number(twelveHour[1]);
  if (hour < 1 || hour > 12 || Number(twelveHour[2]) > 59) return null;
  return `${pad(hour % 12 + (twelveHour[3].toUpperCase() === 'PM' ? 12 : 0))}:${twelveHour[2]}`;
}

export function parseInputDateTime(value: string): string | null {
  const parts = value.trim().match(/^(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})(?:T|,\s*|\s+)(.+)$/);
  if (!parts) return null;
  const date = parseInputDate(parts[1]);
  const time = parseInputTime(parts[2]);
  return date && time ? `${date}T${time}` : null;
}

function formatter(kind: DateInputKind): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getFormattingLocale(), {
    timeZone: 'UTC',
    ...(kind !== 'time' ? {year: 'numeric', month: '2-digit', day: '2-digit'} as const : {}),
    ...(kind !== 'date' ? {hour: '2-digit', minute: '2-digit', hour12: getFormattingLocale() === 'en'} as const : {}),
  });
}

export function formatInputDate(value: string): string {
  const parsed = parseInputDate(value.split('T')[0]);
  return parsed ? formatter('date').format(new Date(`${parsed}T12:00:00Z`)) : '';
}

export function formatInputTime(value: string): string {
  const parsed = parseInputTime(value.slice(0, 5));
  return parsed ? formatter('time').format(new Date(`2000-01-01T${parsed}:00Z`)).replace(/\s+/gu, ' ') : '';
}

export function formatInputDateTime(value: string): string {
  const parsed = parseInputDateTime(value.slice(0, 16));
  return parsed ? formatter('datetime').format(new Date(`${parsed}:00Z`)).replace(/\s+/gu, ' ') : '';
}

/** Browser constraint patterns follow the same locale formatter as the displayed value. */
export function inputPattern(kind: DateInputKind): string {
  const date = formatter('date').formatToParts(new Date('2000-01-02T12:00:00Z'))[0].type === 'year'
    ? '\\d{4}/\\d{1,2}/\\d{1,2}' : '\\d{1,2}/\\d{1,2}/\\d{4}';
  const time = formatter('time').resolvedOptions().hour12 ? '\\d{1,2}:\\d{2}\\s*(AM|PM|am|pm)' : '\\d{1,2}:\\d{2}';
  return kind === 'date' ? date : kind === 'time' ? time : `${date}(?:,\\s*|\\s+)${time}`;
}
