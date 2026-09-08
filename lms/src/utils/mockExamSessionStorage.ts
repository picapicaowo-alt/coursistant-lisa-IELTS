const PREFIX = 'coursistant:mock-exam:';

export const mockExamSessionKey = (studentUserId: number, examId: number, section: string) =>
  `${PREFIX}${studentUserId}:${examId}:${section}`;

export function clearMockExamSessionStorage(): void {
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Browsers may disable storage; signing out must still complete.
  }
}
