/** Shared by the intake preview and the relationship editor. */
export const parentLinkQueryKeys = {
  subject: (scope: 'counsellor' | 'advisor' | 'tenant', subjectId: number) =>
    ['parent-links', scope, subjectId] as const,
};
