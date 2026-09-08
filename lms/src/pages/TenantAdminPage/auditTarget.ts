import type {TenantAuditEvent} from '@/apis';

/** Template audit events currently put template IDs in targetUserId. Resolve the
 * explicit resource snapshot instead; an unrelated person must never be shown. */
export function auditTemplateId(event: TenantAuditEvent): number | undefined {
  for (const snapshot of [event.after, event.before]) {
    const value = snapshot?.templateId;
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  }
  return undefined;
}

export const isTemplateAudit = (event: TenantAuditEvent): boolean =>
  event.resourceType === 'MOCK_EXAM_TEMPLATE';
