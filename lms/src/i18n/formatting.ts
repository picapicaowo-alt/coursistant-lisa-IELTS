import i18n from "./index";
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from "./configuration";

/** Read at call time; locale changes must never freeze dates/numbers at import time. */
export function getFormattingLocale(): AppLocale {
  return isAppLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
}

export function formatDateTime(
  value: Date | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(getFormattingLocale(), options).format(value);
}

/** Date-only values retain their calendar day; zoned instants use the viewer's zone. */
export function formatDateValue(
  value: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!dateOnly && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return value;
  const parsed = new Date(dateOnly ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return formatDateTime(parsed, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(!dateOnly ? ({ hour: "numeric", minute: "2-digit" } as const) : {}),
    ...options,
    ...(dateOnly ? { timeZone: "UTC" } : {}),
  });
}

export function formatDateRange(
  start: Date,
  end: Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  // Older embedded browsers may not implement Intl's range formatter.
  const formatter: Intl.DateTimeFormat & {
    formatRange?: (start: Date, end: Date) => string;
  } = new Intl.DateTimeFormat(getFormattingLocale(), options);
  return (
    formatter.formatRange?.(start, end) ??
    `${formatter.format(start)} – ${formatter.format(end)}`
  );
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(getFormattingLocale(), options).format(value);
}

/** Numeric profile metrics may be serialized as text; authored descriptions stay unchanged. */
export function formatNumericText(value?: string | number): string | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? formatNumber(value, {maximumFractionDigits: 20}) : undefined;
  if (!value?.trim()) return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatNumber(numeric, {maximumFractionDigits: 20}) : value;
}

/** Percentages use fractional input: 0.25 means 25%, not 0.25%. */
export function formatPercent(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return formatNumber(value, { style: "percent", ...options });
}

const weekdayOffsets: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

/** A recurring weekday is a code, not an instant in the browser's time zone. */
export function formatWeekday(
  code: string,
  width: "short" | "long" = "short",
): string {
  const offset = weekdayOffsets[code];
  return offset == null
    ? code
    : formatDateTime(Date.UTC(2026, 0, 4 + offset), {
        weekday: width,
        timeZone: "UTC",
      });
}

/** Time-only API fields retain wall-clock semantics; never parse them as UTC instants. */
export function formatClockTime(
  value: string,
  options?: Pick<Intl.DateTimeFormatOptions, "hour" | "hourCycle">,
): string {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return value;
  return formatDateTime(
    Date.UTC(2026, 0, 1, Number(match[1]), Number(match[2])),
    { hour: "numeric", minute: "2-digit", ...options, timeZone: "UTC" },
  );
}
