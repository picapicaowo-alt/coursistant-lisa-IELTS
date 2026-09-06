import {formatNumber} from '@/i18n/formatting';
import { useTranslation } from 'react-i18next';
import type { ListeningPart } from '../../data/listening/types'
import {AnswerSummary} from '../AnswerSummary'

type ListeningBottomBarProps = {
  parts: ListeningPart[]
  currentPartId: number
  questionNumbers: number[]
  answers: Record<number, string>
  currentQuestion: number
  testTitle: string
  clockLabel: string
  paused: boolean
  submitting?: boolean
  reviewByQuestion?: Record<number, boolean> | null
  scoreSummary?: { correctCount?: number; totalQuestions?: number } | null
  onSelectPart: (partId: number) => void
  onJump: (id: number) => void
  onFinish: () => void
  onPause: () => void
  onExit: () => void
}

function isAnswered(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0)
}

function countAnswered(part: ListeningPart, answers: Record<number, string>): number {
  return part.questionNumbers.filter((n) => isAnswered(answers[n])).length
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

export function ListeningBottomBar({
  parts,
  currentPartId,
  questionNumbers,
  answers,
  currentQuestion,
  testTitle,
  clockLabel,
  paused,
  submitting = false,
  reviewByQuestion = null,
  scoreSummary = null,
  onSelectPart,
  onJump,
  onFinish,
  onPause,
  onExit,
}: ListeningBottomBarProps) {
  const { t: translate } = useTranslation();
  const currentPart = parts.find((p) => p.id === currentPartId)
  const submitted = Boolean(scoreSummary)

  return (
    <footer className="bottom-bar">
      <div className="bottom-bar__left">
        <h2 className="exam-navigation-title">{translate("common:status.LISTENING")}</h2>
        <AnswerSummary questionNumbers={questionNumbers} answers={answers} reviewByQuestion={reviewByQuestion} />
        <div className="question-nav">
          <span className="question-nav__label">{currentPart?.label ?? translate('exams:runner.part')}</span>
          {questionNumbers.map((n) => (
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
          {parts.map((part) => {
            const answered = countAnswered(part, answers)
            const total = part.questionNumbers.length
            const active = part.id === currentPartId
            return (
              <button
                key={part.id}
                type="button"
                className={`passage-progress ${active ? 'is-current' : 'muted'}`}
                onClick={() => onSelectPart(part.id)}
              >
                {submitted
                  ? part.label
                  : translate('exams:runner.partProgress', {part: part.label, answered: formatNumber(answered), total: formatNumber(total)})}
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
