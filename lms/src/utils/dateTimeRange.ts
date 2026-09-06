import i18n from '@/i18n';
import {formatNumber} from '@/i18n/formatting';

const pad = (value: number) => String(value).padStart(2, '0');

export const DEFAULT_DURATION_MINUTES = 60;

export const SHORT_DURATION_OPTIONS = [30, 60, 90, 120, 180, 240] as const;
export const LONG_DURATION_OPTIONS = [...SHORT_DURATION_OPTIONS, 24 * 60, 7 * 24 * 60] as const;

export const durationLabel = (minutes: number): string => {
  const [key, count] = minutes === 7 * 24 * 60 ? ['common:dateTime.durationWeek', 1] as const
    : minutes === 24 * 60 ? ['common:dateTime.durationDay', 1] as const
    : minutes < 60 ? ['assessment:attempt.duration', minutes] as const
    : ['common:dateTime.durationHour', minutes / 60] as const;
  return i18n.t(key, {count, number: formatNumber(count, {maximumFractionDigits: 20})});
};

export const roundUpToMinutes = (date: Date, stepMinutes = 30): Date => {
  const rounded = new Date(date);
  const elapsedMinutes = rounded.getMinutes() + (rounded.getSeconds() || rounded.getMilliseconds() ? 1 : 0);
  const nextMinutes = Math.ceil(elapsedMinutes / stepMinutes) * stepMinutes;
  rounded.setMinutes(nextMinutes, 0, 0);
  return rounded;
};

export const toLocalDateTimeValue = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const toLocalDateValue = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const toLocalTimeValue = (date: Date): string =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const parseDateTimeValue = (value: string): Date | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  return parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day
    && parsed.getHours() === hour
    && parsed.getMinutes() === minute
    ? parsed
    : null;
};

const parseTimeValue = (value: string): number | null => {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
};

export const addMinutesToDateTimeValue = (value: string, minutes: number): string => {
  const parsed = parseDateTimeValue(value);
  if (!parsed) return '';
  parsed.setMinutes(parsed.getMinutes() + minutes);
  return toLocalDateTimeValue(parsed);
};

export const addMinutesToTimeValue = (value: string, minutes: number): string => {
  const parsed = parseTimeValue(value);
  if (parsed === null) return '';
  const next = parsed + minutes;
  if (next >= 24 * 60) return '';
  return `${pad(Math.floor(next / 60))}:${pad(next % 60)}`;
};

export const dateTimeDurationMinutes = (start: string, end: string): number | null => {
  const parsedStart = parseDateTimeValue(start);
  const parsedEnd = parseDateTimeValue(end);
  if (!parsedStart || !parsedEnd) return null;
  const minutes = (parsedEnd.getTime() - parsedStart.getTime()) / 60_000;
  return Number.isInteger(minutes) && minutes > 0 ? minutes : null;
};

export const timeDurationMinutes = (start: string, end: string): number | null => {
  const parsedStart = parseTimeValue(start);
  const parsedEnd = parseTimeValue(end);
  if (parsedStart === null || parsedEnd === null || parsedEnd <= parsedStart) return null;
  return parsedEnd - parsedStart;
};

export const defaultDateTimeRange = (now = new Date()) => {
  const start = roundUpToMinutes(now);
  const end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
  return {start: toLocalDateTimeValue(start), end: toLocalDateTimeValue(end)};
};

export const defaultTimeRange = (now = new Date()) => {
  let start = roundUpToMinutes(now);
  if (start.getDate() !== now.getDate() || start.getHours() >= 23) {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
  }
  const end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
  return {
    date: toLocalDateValue(start),
    start: toLocalTimeValue(start),
    end: toLocalTimeValue(end),
  };
};

export const presetDuration = (
  minutes: number | null,
  options: readonly number[],
): number | null => minutes !== null && options.includes(minutes) ? minutes : null;
