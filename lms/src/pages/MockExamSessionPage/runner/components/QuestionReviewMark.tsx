export type QuestionReview = {
  submitted: string
  correct: boolean
  blank: boolean
}

type QuestionReviewMarkProps = {
  review?: QuestionReview | null
}

export function QuestionReviewMark({ review }: QuestionReviewMarkProps) {
  if (!review || review.correct) return null
  const yours = review.blank || !review.submitted.trim() ? '(blank)' : review.submitted
  return (
    <div className="answer-review" role="status">
      <span className="answer-review__yours">Your answer: {yours}</span>
    </div>
  )
}
