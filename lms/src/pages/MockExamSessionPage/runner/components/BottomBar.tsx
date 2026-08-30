import { countAnswered } from '../data/reading'
import type { PassageData } from '../data/types'

type BottomBarProps = {
  passage: PassageData
  passages: PassageData[]
  testTitle: string
  answers: Record<number, string>
  currentQuestion: number
  paused: boolean
  clockLabel: string
  submitting?: boolean
  /** questionNumber -> whether correct; set after submit */
  reviewByQuestion?: Record<number, boolean> | null
  scoreSummary?: { correctCount?: number; totalQuestions?: number } | null
  onJump: (id: number) => void
  onSelectPassage: (passageId: number) => void
  onFinish: () => void
  onPause: () => void
  onExit: () => void
}

function isAnswered(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0)
}

function chipClass(
  n: number,
  currentQuestion: number,
  answers: Record<number, string>,
  reviewByQuestion?: Record<number, boolean> | null,
): string {
  const active = currentQuestion === n
  const review = reviewByQuestion?.[n]
  const answered = isAnswered(answers[n])
  const parts = ['q-chip']
  if (review !== undefined) {
    parts.push(review ? 'is-correct' : 'is-incorrect')
  } else if (answered) {
    parts.push('is-answered')
  }
  if (active) parts.push('is-active')
  return parts.join(' ')
}

export function BottomBar({
  passage,
  passages,
  testTitle,
  answers,
  currentQuestion,
  paused,
  clockLabel,
  submitting = false,
  reviewByQuestion = null,
  scoreSummary = null,
  onJump,
  onSelectPassage,
  onFinish,
  onPause,
  onExit,
}: BottomBarProps) {
  const submitted = Boolean(scoreSummary)

  return (
    <footer className="bottom-bar">
      <div className="bottom-bar__left">
        <div className="question-nav">
          <span className="question-nav__label">{passage.shortLabel}</span>
          {passage.questionNumbers.map((n) => (
            <button
              key={n}
              type="button"
              className={chipClass(n, currentQuestion, answers, reviewByQuestion)}
              onClick={() => onJump(n)}
              aria-label={`Go to question ${n}`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="bottom-bar__meta">
          <span>{testTitle}</span>
          {scoreSummary ? (
            <>
              <span className="bottom-bar__score">
                {scoreSummary.correctCount !== undefined && scoreSummary.totalQuestions !== undefined
                  ? `Score: ${scoreSummary.correctCount}/${scoreSummary.totalQuestions}`
                  : 'Answers submitted'}
              </span>
              {reviewByQuestion && Object.keys(reviewByQuestion).length > 0 ? (
                <span className="bottom-bar__score-hint">Red = incorrect · Green = correct</span>
              ) : null}
            </>
          ) : null}
          {passages.map((p, index) => {
            const answered = countAnswered(p, answers)
            const total = p.questionNumbers.length
            const active = p.id === passage.id
            return (
              <button
                key={p.id}
                type="button"
                className={`passage-progress ${active ? 'is-current' : 'muted'}`}
                onClick={() => onSelectPassage(p.id)}
              >
                {submitted
                  ? `Passage ${index + 1}`
                  : `Passage ${index + 1} (${answered} of ${total})`}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bottom-bar__right">
        <span className="bottom-bar__clock">{clockLabel}</span>
        <button
          type="button"
          className="bar-btn"
          onClick={onFinish}
          disabled={submitting || submitted}
        >
          {submitting ? 'Submitting…' : submitted ? 'Submitted' : 'Finish section'}
        </button>
        <button type="button" className="bar-btn" onClick={onPause}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className="bar-btn bar-btn--danger" onClick={onExit}>
          Exit
        </button>
      </div>
    </footer>
  )
}
