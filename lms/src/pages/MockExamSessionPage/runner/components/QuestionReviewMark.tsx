import {useTranslation} from 'react-i18next';
export type QuestionReview = {
  submitted: string
  correct: boolean
  blank: boolean
}

type QuestionReviewMarkProps = {
  review?: QuestionReview | null
}

export function QuestionReviewMark({ review }: QuestionReviewMarkProps) {
  const {t: translate} = useTranslation();
  if (!review || review.correct) return null
  const yours = review.blank || !review.submitted.trim() ? translate('exams:runner.blank') : review.submitted
  return (
    <div className="answer-review" role="status">
      <span className="answer-review__yours">{translate('exams:runner.yourAnswer', {answer: yours})}</span>
    </div>
  )
}
