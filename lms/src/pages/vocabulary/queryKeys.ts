export const vocabularyQueryKeys = {
  all: ['vocabulary'] as const,
  library: (studentId: string, filters: object) => [...vocabularyQueryKeys.all, 'library', studentId, filters] as const,
  list: (studentId: string, listId: string) => [...vocabularyQueryKeys.all, 'list', studentId, listId] as const,
  unit: (studentId: string, unitId: string) => [...vocabularyQueryKeys.all, 'unit', studentId, unitId] as const,
  session: (studentId: string, sessionId: string) => [...vocabularyQueryKeys.all, 'session', studentId, sessionId] as const,
};
