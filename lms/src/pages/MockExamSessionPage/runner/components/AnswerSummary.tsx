type AnswerSummaryProps = {
  questionNumbers: number[];
  answers: Record<number, string>;
  reviewByQuestion?: Record<number, boolean> | null;
};

/** Counts only the questions in the current section; scores are never inferred from answers. */
export function AnswerSummary({questionNumbers, answers, reviewByQuestion}: AnswerSummaryProps) {
  const answered = questionNumbers.filter(number => answers[number]?.trim()).length;
  if (reviewByQuestion) {
    const correct = questionNumbers.filter(number => reviewByQuestion[number] === true).length;
    const incorrect = questionNumbers.filter(number => reviewByQuestion[number] === false).length;
    return <div className="answer-summary" aria-label="Released question results"><span data-state="correct">Correct <strong>{correct}</strong></span><span data-state="incorrect">Incorrect <strong>{incorrect}</strong></span></div>;
  }
  return <div className="answer-summary" aria-label="Answer progress"><span data-state="answered">Answered <strong>{answered}</strong></span><span data-state="unanswered">Unanswered <strong>{questionNumbers.length - answered}</strong></span></div>;
}
