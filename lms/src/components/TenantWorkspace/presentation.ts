import i18n from '@/i18n';
import {roleLabel, statusLabel} from '@/i18n/presentation';
import {formatDateTime} from '@/i18n/formatting';

/** Unknown contract values remain readable rather than being silently reclassified. */
export function readableValue(value?: string | null): string {
  if (!value) return '—';
  return i18n.exists(`common:roles.${value.toUpperCase()}`)
    ? roleLabel(value)
    : statusLabel(value);
}

/** Audit evidence has unbounded contract codes; localize known display labels
 * while retaining an unknown code verbatim for investigation. */
export function tenantAuditValue(value: string, category: 'actions' | 'resources' = 'actions'): string {
  const key = `operations:audit.${category}.${value}`;
  return i18n.exists(key) ? i18n.t(key) : readableValue(value);
}

export function tenantDate(value?: string, withTime = false): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return formatDateTime(new Date(value), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? ({hour: 'numeric', minute: '2-digit'} as const) : {}),
  });
}
