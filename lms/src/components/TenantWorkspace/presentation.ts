export const identityLabels: Record<string, string> = {
  TENANT_ADMIN: 'Tenant Admin',
  COUNSELLOR: 'Counsellor',
  ADVISOR: 'Advisor',
  INSTRUCTOR: 'Instructor',
  INSTRUCTOR_ADVISOR: 'Instructor + Advisor',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

/** Unknown contract values remain readable rather than being silently reclassified. */
export function readableValue(value?: string | null): string {
  if (!value) return '—';
  return (
    identityLabels[value] ??
    value
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/^\w/, (letter) => letter.toUpperCase())
  );
}

export function tenantDate(value?: string, withTime = false): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? ({hour: 'numeric', minute: '2-digit'} as const) : {}),
  }).format(new Date(value));
}
