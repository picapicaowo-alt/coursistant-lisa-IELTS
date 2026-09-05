import { useTranslation } from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
import { countAnswered } from '../data/reading'
import type { PassageData } from '../data/types'
import {AnswerSummary} from './AnswerSummary'

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
  const { t: translate } = useTranslation();
  const submitted = Boolean(scoreSummary)

  return (
    <footer className="bottom-bar">
      <div className="bottom-bar__left">
        <h2 className="exam-navigation-title">{translate("common:status.READING")}</h2>
        <AnswerSummary questionNumbers={passage.questionNumbers} answers={answers} reviewByQuestion={reviewByQuestion} />
        <div className="question-nav">
          <span className="question-nav__label">{passage.shortLabel}</span>
          {passage.questionNumbers.map((n) => (
            <button
              key={n}
              type="button"
              className={chipClass(n, currentQuestion, answers, reviewByQuestion)}
              onClick={() => onJump(n)}
              aria-label={translate('exams:runner.goToQuestion', {number: formatNumber(n)})}
              aria-current={currentQuestion === n ? 'step' : undefined}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="bottom-bar__meta">
          <span className="exam-navigation-context">{testTitle}</span>
          {scoreSummary ? (
            <>
              <span className="bottom-bar__score">
                {scoreSummary.correctCount !== undefined && scoreSummary.totalQuestions !== undefined
                  ? translate('exams:runner.scoreSummary', {correct: formatNumber(scoreSummary.correctCount), total: formatNumber(scoreSummary.totalQuestions)})
                  : translate('exams:runner.answersSubmitted')}
              </span>
              {reviewByQuestion && Object.keys(reviewByQuestion).length > 0 ? (
                <span className="bottom-bar__score-hint">{translate('exams:runner.reviewLegend')}</span>
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
                  ? translate('exams:runner.passage', {number: formatNumber(index + 1)})
                  : translate('exams:runner.passageProgress', {number: formatNumber(index + 1), answered: formatNumber(answered), total: formatNumber(total)})}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bottom-bar__right">
        <span className="bottom-bar__clock">{clockLabel}</span>
        <button
          type="button"
          className="bar-btn bar-btn--primary"
          onClick={onFinish}
          disabled={submitting || submitted}
        >
          {submitting ? translate("common:actions.submitting") : submitted ? translate('common:status.SUBMITTED') : translate('exams:runner.finishSection')}
        </button>
        <button type="button" className="bar-btn" onClick={onPause}>
          {paused ? translate('exams:runner.resume') : translate('exams:runner.pause')}
        </button>
        <button type="button" className="bar-btn bar-btn--danger" onClick={onExit}>{translate('exams:runner.exit')}</button>
      </div>
    </footer>
  )
}
