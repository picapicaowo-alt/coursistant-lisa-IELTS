export const VOCABULARY_PATHS = {
  root: '/vocabulary',
  list: (listId: string): string => `/vocabulary/lists/${listId}`,
  session: (unitId: string, sessionId: string): string => `/vocabulary/units/${unitId}/sessions/${sessionId}`,
} as const;

export const VOCABULARY_ROUTE_PATTERNS = {
  root: 'vocabulary',
  list: 'vocabulary/lists/:listId',
  session: 'vocabulary/units/:unitId/sessions/:sessionId',
} as const;

export const isVocabularySessionPath = (pathname: string): boolean => (
  /^\/vocabulary\/units\/[^/]+\/sessions\/[^/]+$/.test(pathname)
);
