import i18n from './index';
import {DEFAULT_LOCALE, isAppLocale, type AppLocale} from './configuration';

/** Read at call time; locale changes must never freeze dates/numbers at import time. */
export function getFormattingLocale(): AppLocale {
  return isAppLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
}

export function formatDateTime(value: Date | number, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(getFormattingLocale(), options).format(value);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getFormattingLocale(), options).format(value);
}

/** Percentages use fractional input: 0.25 means 25%, not 0.25%. */
export function formatPercent(value: number, options?: Intl.NumberFormatOptions): string {
  return formatNumber(value, {style: 'percent', ...options});
}

const weekdayOffsets: Record<string, number> = {SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6};

/** A recurring weekday is a code, not an instant in the browser's time zone. */
export function formatWeekday(code: string, width: 'short' | 'long' = 'short'): string {
  const offset = weekdayOffsets[code];
  return offset == null ? code : formatDateTime(Date.UTC(2026, 0, 4 + offset), {weekday: width, timeZone: 'UTC'});
}

/** Time-only API fields retain wall-clock semantics; never parse them as UTC instants. */
export function formatClockTime(value: string): string {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return value;
  return formatDateTime(Date.UTC(2026, 0, 1, Number(match[1]), Number(match[2])), {hour: 'numeric', minute: '2-digit', timeZone: 'UTC'});
}
