/** Section submissions require every question number, including unanswered questions. */
export function buildQuestionSubmission(
  questionNumbers: readonly number[],
  answers: Readonly<Record<number, string>>,
): Record<string, string> {
  return Object.fromEntries(questionNumbers.map(number => [String(number), answers[number] ?? '']));
}
