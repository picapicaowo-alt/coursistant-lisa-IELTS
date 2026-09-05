import i18n from '@/i18n';
import {formatNumber} from '@/i18n/formatting';

/** The live teaching feed uses `kind`; older projections include display copy. */
export function teachingAlertTitle(alert: Record<string, unknown>): string {
  const text = (key: string) => typeof alert[key] === 'string' && alert[key].trim() ? alert[key] : undefined;
  const supplied = text('message') ?? text('title');
  if (supplied) return supplied;
  const kind = text('kind') ?? text('type') ?? text('alertType');
  if (kind === 'PENDING_GRADING') {
    const count = alert.pendingCount;
    return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
      ? i18n.t('dashboard:teachingAlerts.pendingGrading', {count, displayCount: formatNumber(count)})
      : i18n.t('dashboard:teachingAlerts.grading');
  }
  if (kind === 'UPCOMING_CLASS') return [i18n.t('dashboard:teachingAlerts.upcomingClass'), text('courseCode')].filter(Boolean).join(' · ');
  if (kind === 'SCHEDULE_CONFLICT') return i18n.t('dashboard:teachingAlerts.scheduleConflict');
  return i18n.t('dashboard:teachingUpdate');
}
