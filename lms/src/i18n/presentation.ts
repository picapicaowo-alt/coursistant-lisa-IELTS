import i18n from './index';

/** Only known identity codes are localized; unknown server values remain diagnosable. */
export function roleLabel(value?: string | null): string {
  if (!value) return '';
  const key = `common:roles.${value}`;
  return i18n.exists(key) ? i18n.t(key) : value;
}

const statusAliases: Record<string, string> = {
  PENDING: 'pending',
  IN_PROGRESS: 'inProgress',
  RESOLVED: 'resolved',
};

/** Translate known presentation codes without modifying their API representation. */
export function statusLabel(value?: string | null): string {
  if (!value) return i18n.t('common:feedback.notProvided');
  const code = value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toUpperCase();
  const key = `common:status.${statusAliases[code] ?? code}`;
  return i18n.exists(key) ? i18n.t(key) : value;
}
