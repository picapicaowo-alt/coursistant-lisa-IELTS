import {getApiErrorMessage} from '@/utils/apiError';
import {ExamSubmissionDialog} from '../components/ExamSubmissionDialog';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { submitReading } from '../api/readings'
import { ensureAttemptId } from '../api/tests'
import { BottomBar } from '../components/BottomBar'
import { PassagePane } from '../components/PassagePane'
import { QuestionPane } from '../components/QuestionPane'
import { TopBar } from '../components/TopBar'
import {
  allQuestionNumbers,
  findPassageForQuestion,
  getPassageById,
  type ReadingTest,
} from '../data/reading'
import type { NoteItem, TextSpan, ToolMode } from '../types/annotation'
import { buildQuestionSubmission } from '../utils/questionSubmission'

type ExamPageProps = {
  reading: ReadingTest
  testId: number
  testTitle: string
  candidateLabel: string
  onExit: () => void
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ExamPage({ reading, testId, testTitle, candidateLabel, onExit }: ExamPageProps) {
  const passages = reading.passages
  const questionIds = useMemo(() => allQuestionNumbers(passages), [passages])
  const firstPassageId = passages[0]?.id ?? 1
  const firstQuestion = questionIds[0] ?? 1

  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [remainingSeconds, setRemainingSeconds] = useState(reading.totalMinutes * 60)
  const [paused, setPaused] = useState(false)
  const [currentPassageId, setCurrentPassageId] = useState(firstPassageId)
  const [currentQuestion, setCurrentQuestion] = useState(firstQuestion)
  const [clockLabel, setClockLabel] = useState(() => formatClock(new Date()))
  const [activeTool, setActiveTool] = useState<ToolMode>(null)
  const [highlightsByPassage, setHighlightsByPassage] = useState<Record<number, TextSpan[]>>({})
  const [notesByPassage, setNotesByPassage] = useState<Record<number, NoteItem[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const [reviewByQuestion, setReviewByQuestion] = useState<Record<
    number,
    { submitted: string; correct: boolean; blank: boolean }
  > | null>(null)
  const [scoreSummary, setScoreSummary] = useState<{
    correctCount?: number
    totalQuestions?: number
  } | null>(null)
  const timeUpTriggered = useRef(false)
  const submitSectionRef = useRef<() => Promise<void>>(async () => {})

  const passage = useMemo(
    () => getPassageById(passages, currentPassageId),
    [passages, currentPassageId],
  )
  const highlights = highlightsByPassage[currentPassageId] ?? []
  const notes = notesByPassage[currentPassageId] ?? []

  useEffect(() => {
    const id = window.setInterval(() => {
      setClockLabel(formatClock(new Date()))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const scrollToQuestion = useCallback((id: number) => {
    setCurrentQuestion(id)
    window.setTimeout(() => {
      const el = document.getElementById(`q-${id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(() => {
        const input = el?.querySelector<HTMLInputElement>('input')
        input?.focus({ preventScroll: true })
      }, 180)
    }, 40)
  }, [])

  const goToQuestion = useCallback(
    (id: number) => {
      if (!questionIds.includes(id)) return
      const owner = findPassageForQuestion(passages, id)
      setCurrentPassageId(owner.id)
      scrollToQuestion(id)
    },
    [passages, questionIds, scrollToQuestion],
  )

  const handleSelectPassage = useCallback(
    (passageId: number) => {
      const next = getPassageById(passages, passageId)
      setCurrentPassageId(passageId)
      scrollToQuestion(next.questionNumbers[0])
    },
    [passages, scrollToQuestion],
  )

  const handleSelectQuestion = useCallback((id: number) => {
    setCurrentQuestion(id)
  }, [])

  const handleAnswerChange = useCallback((id: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
    setCurrentQuestion(id)
  }, [])

  const handlePrev = useCallback(() => {
    const idx = questionIds.indexOf(currentQuestion)
    if (idx <= 0) {
      scrollToQuestion(currentQuestion)
      return
    }
    goToQuestion(questionIds[idx - 1])
  }, [currentQuestion, goToQuestion, questionIds, scrollToQuestion])

  const handleNext = useCallback(() => {
    const idx = questionIds.indexOf(currentQuestion)
    if (idx < 0 || idx >= questionIds.length - 1) {
      scrollToQuestion(currentQuestion)
      return
    }
    goToQuestion(questionIds[idx + 1])
  }, [currentQuestion, goToQuestion, questionIds, scrollToQuestion])

  const submitSection = useCallback(async () => {
    if (submitting || scoreSummary) return

    const payload = buildQuestionSubmission(questionIds, answers)

    setSubmitting(true)
    setSubmissionOpen(true)
    setSubmissionError('')
    try {
      const attemptId = await ensureAttemptId(testId)
      const result = await submitReading(testId, {
        attemptId,
        answers: payload,
      })
      const byQuestion: Record<
        number,
        { submitted: string; correct: boolean; blank: boolean }
      > = {}
      for (const item of result.results) {
        byQuestion[item.questionNumber] = {
          submitted: item.submitted,
          correct: item.correct,
          blank: item.blank,
        }
      }
      setReviewByQuestion(byQuestion)
      setScoreSummary({
        correctCount: result.correctCount,
        totalQuestions: result.totalQuestions,
      })
    } catch (err) {
      setSubmissionError(getApiErrorMessage(err, 'Your exam could not be submitted. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }, [answers, questionIds, testId, scoreSummary, submitting])

  submitSectionRef.current = submitSection

  useEffect(() => {
    if (paused || scoreSummary) return
    const id = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 0) return 0
        if (prev === 1) {
          if (!timeUpTriggered.current) {
            timeUpTriggered.current = true
            window.setTimeout(() => {
              void submitSectionRef.current()
            }, 0)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [paused, scoreSummary])

  const handleFinish = useCallback(() => {
    if (submitting || scoreSummary) return
    setSubmissionOpen(true)
  }, [scoreSummary, submitting])

  const handleExit = useCallback(() => {
    if (scoreSummary) {
      onExit()
      return
    }
    const ok = window.confirm('Exit this section? Your current answers will not be saved.')
    if (ok) onExit()
  }, [onExit, scoreSummary])

  const handleToggleHighlight = useCallback(() => {
    setActiveTool((prev) => (prev === 'highlight' ? null : 'highlight'))
  }, [])

  const handleToggleNotes = useCallback(() => {
    setActiveTool((prev) => (prev === 'notes' ? null : 'notes'))
  }, [])

  const handleAddHighlight = useCallback(
    (span: Omit<TextSpan, 'id'>) => {
      setHighlightsByPassage((prev) => {
        const current = prev[currentPassageId] ?? []
        const overlaps = current.some(
          (h) =>
            h.paragraphIndex === span.paragraphIndex &&
            span.start < h.end &&
            span.end > h.start,
        )
        if (overlaps) return prev
        return {
          ...prev,
          [currentPassageId]: [...current, { ...span, id: createId() }],
        }
      })
    },
    [currentPassageId],
  )

  const handleRemoveHighlight = useCallback(
    (id: string) => {
      setHighlightsByPassage((prev) => ({
        ...prev,
        [currentPassageId]: (prev[currentPassageId] ?? []).filter((h) => h.id !== id),
      }))
    },
    [currentPassageId],
  )

  const handleAddNote = useCallback(
    (text: string) => {
      setNotesByPassage((prev) => ({
        ...prev,
        [currentPassageId]: [
          ...(prev[currentPassageId] ?? []),
          { id: createId(), text, createdAt: Date.now() },
        ],
      }))
    },
    [currentPassageId],
  )

  const handleDeleteNote = useCallback(
    (id: string) => {
      setNotesByPassage((prev) => ({
        ...prev,
        [currentPassageId]: (prev[currentPassageId] ?? []).filter((n) => n.id !== id),
      }))
    },
    [currentPassageId],
  )

  return (
    <div className="exam-shell">
      <ExamSubmissionDialog open={submissionOpen} pending={submitting} submitted={Boolean(scoreSummary)} error={submissionError} onSubmit={() => void submitSection()} onClose={() => setSubmissionOpen(false)}/>
      <TopBar
        testTitle={testTitle}
        candidateId={candidateLabel}
        remainingSeconds={remainingSeconds}
        paused={paused}
      />
      <main className="exam-main">
        <PassagePane
          passage={passage}
          highlightMode={activeTool === 'highlight'}
          highlights={highlights}
          onAddHighlight={handleAddHighlight}
          onRemoveHighlight={handleRemoveHighlight}
        />
        <QuestionPane
          passage={passage}
          answers={answers}
          currentQuestion={currentQuestion}
          activeTool={activeTool}
          notes={notes}
          reviewByQuestion={reviewByQuestion}
          onAnswerChange={scoreSummary ? () => undefined : handleAnswerChange}
          onSelectQuestion={handleSelectQuestion}
          onToggleHighlight={handleToggleHighlight}
          onToggleNotes={handleToggleNotes}
          onAddNote={handleAddNote}
          onDeleteNote={handleDeleteNote}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </main>
      <BottomBar
        passage={passage}
        passages={passages}
        testTitle={testTitle}
        answers={answers}
        currentQuestion={currentQuestion}
        paused={paused}
        clockLabel={clockLabel}
        onJump={goToQuestion}
        onSelectPassage={handleSelectPassage}
        submitting={submitting}
        reviewByQuestion={
          reviewByQuestion
            ? Object.fromEntries(
                Object.entries(reviewByQuestion).map(([k, v]) => [Number(k), v.correct]),
              )
            : null
        }
        scoreSummary={scoreSummary}
        onFinish={() => {
          void handleFinish()
        }}
        onPause={() => setPaused((p) => !p)}
        onExit={handleExit}
      />
    </div>
  )
}
