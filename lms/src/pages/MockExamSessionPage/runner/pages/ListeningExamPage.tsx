import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { submitListening } from '../api/listenings'
import { ensureAttemptId } from '../api/tests'
import { ListeningBottomBar } from '../components/listening/ListeningBottomBar'
import { ListeningSectionView } from '../components/listening/ListeningSections'
import { ListeningTopBar } from '../components/listening/ListeningTopBar'
import {
  allListeningQuestionNumbers,
  findPartForQuestion,
} from '../data/listening/helpers'
import type { ListeningPaper } from '../data/listening/types'

type ListeningExamPageProps = {
  paper: ListeningPaper
  testId: number
  testTitle: string
  candidateLabel: string
  onExit: () => void
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function ListeningExamPage({ paper, testId, testTitle, candidateLabel, onExit }: ListeningExamPageProps) {
  const questionIds = useMemo(() => allListeningQuestionNumbers(paper), [paper])
  const firstQuestion = questionIds[0] ?? 1

  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [remainingSeconds, setRemainingSeconds] = useState(paper.totalMinutes * 60)
  const [paused, setPaused] = useState(false)
  const [currentPartId, setCurrentPartId] = useState(paper.parts[0]?.id ?? 1)
  const [currentQuestion, setCurrentQuestion] = useState(firstQuestion)
  const [clockLabel, setClockLabel] = useState(() => formatClock(new Date()))
  const [submitting, setSubmitting] = useState(false)
  const [reviewByQuestion, setReviewByQuestion] = useState<Record<
    number,
    { submitted: string; correct: boolean; blank: boolean }
  > | null>(null)
  const [scoreSummary, setScoreSummary] = useState<{
    correctCount?: number
    totalQuestions?: number
  } | null>(null)
  /** partId -> ready to play (HTTP cache warmed); use API URL directly as src */
  const [audioReadyByPartId, setAudioReadyByPartId] = useState<Record<number, boolean>>({})
  const [audioErrors, setAudioErrors] = useState<Record<number, string>>({})
  const [audioStopSignal, setAudioStopSignal] = useState(0)
  const timeUpTriggered = useRef(false)
  const submitSectionRef = useRef<() => Promise<void>>(async () => {})
  const audioReadyRef = useRef<Record<number, boolean>>({})

  const currentPart = useMemo(
    () => paper.parts.find((p) => p.id === currentPartId) ?? paper.parts[0],
    [paper.parts, currentPartId],
  )

  useEffect(() => {
    let cancelled = false
    audioReadyRef.current = {}
    setAudioReadyByPartId({})
    setAudioErrors({})

    for (const part of paper.parts) {
      void (async () => {
        try {
          const res = await fetch(part.audioSrc)
          if (!res.ok) {
            throw new Error(`Audio failed (${res.status})`)
          }
          // Consume body so the response is fully cached; play via API URL (not blob).
          await res.blob()
          if (cancelled) return
          audioReadyRef.current[part.id] = true
          setAudioReadyByPartId((prev) => ({ ...prev, [part.id]: true }))
        } catch {
          if (!cancelled) {
            setAudioErrors((prev) => ({ ...prev, [part.id]: 'Audio failed to load' }))
          }
        }
      })()
    }

    return () => {
      cancelled = true
    }
  }, [paper])

  useEffect(() => {
    const id = window.setInterval(() => setClockLabel(formatClock(new Date())), 1000)
    return () => window.clearInterval(id)
  }, [])

  const pendingScrollRef = useRef<number | null>(null)

  const focusQuestion = useCallback((id: number) => {
    window.setTimeout(() => {
      const el = document.getElementById(`lq-${id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(() => {
        const input =
          el?.querySelector<HTMLInputElement>('input:not([type="radio"]):not([type="checkbox"])') ??
          el?.querySelector<HTMLInputElement>('input')
        input?.focus({ preventScroll: true })
      }, 180)
    }, 40)
  }, [])

  const scrollToQuestion = useCallback(
    (id: number) => {
      setCurrentQuestion(id)
      pendingScrollRef.current = id
      focusQuestion(id)
    },
    [focusQuestion],
  )

  useEffect(() => {
    if (pendingScrollRef.current == null) return
    const id = pendingScrollRef.current
    pendingScrollRef.current = null
    focusQuestion(id)
  }, [currentPartId, focusQuestion])

  const goToQuestion = useCallback(
    (id: number) => {
      if (!questionIds.includes(id)) return
      const owner = findPartForQuestion(paper, id)
      setCurrentQuestion(id)
      pendingScrollRef.current = id
      if (owner.id !== currentPartId) {
        setCurrentPartId(owner.id)
      } else {
        pendingScrollRef.current = null
        focusQuestion(id)
      }
    },
    [paper, questionIds, currentPartId, focusQuestion],
  )

  const handleSelectPart = useCallback(
    (partId: number) => {
      const part = paper.parts.find((p) => p.id === partId)
      if (!part) return
      setCurrentPartId(partId)
      scrollToQuestion(part.questionNumbers[0])
    },
    [paper.parts, scrollToQuestion],
  )

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

    setAudioStopSignal((n) => n + 1)

    const payload: Record<string, string> = {}
    for (const [key, value] of Object.entries(answers)) {
      payload[String(key)] = value
    }

    setSubmitting(true)
    try {
      const attemptId = await ensureAttemptId(testId)
      const result = await submitListening(testId, {
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
      window.alert(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }, [answers, testId, scoreSummary, submitting])

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

  const handleFinish = useCallback(async () => {
    if (submitting || scoreSummary) return
    const ok = window.confirm('Finish this section and submit your answers?')
    if (!ok) return
    await submitSection()
  }, [scoreSummary, submitSection, submitting])

  const handleExit = useCallback(() => {
    if (scoreSummary) {
      onExit()
      return
    }
    const ok = window.confirm('Exit Listening? Your current answers will not be saved.')
    if (ok) onExit()
  }, [onExit, scoreSummary])

  const rangeLabel = currentPart
    ? `${currentPart.questionNumbers[0]}-${currentPart.questionNumbers[currentPart.questionNumbers.length - 1]}`
    : ''

  const currentAudioError = currentPart ? (audioErrors[currentPart.id] ?? null) : null
  const currentAudioReady = currentPart ? Boolean(audioReadyByPartId[currentPart.id]) : false
  const currentAudioSrc =
    currentPart && currentAudioReady && !currentAudioError ? currentPart.audioSrc : null
  const currentAudioLoading = Boolean(currentPart) && !currentAudioReady && !currentAudioError

  return (
    <div className="exam-shell listening-shell">
      <ListeningTopBar
        candidateId={candidateLabel}
        remainingSeconds={remainingSeconds}
        paused={paused}
        audioSrc={currentAudioSrc}
        audioLoading={currentAudioLoading}
        audioError={currentAudioError}
        audioStopSignal={audioStopSignal}
      />
      <main className="listening-main">
        <div className="listening-pane">
          <div className="listening-pane__inner">
            <div className="listening-part-banner">
              <span className="listening-part-banner__label">{currentPart.label}</span>
              <span className="listening-part-banner__hint">
                Listen and answer questions {rangeLabel}
              </span>
            </div>
            {currentPart.sections.map((section) => (
              <ListeningSectionView
                key={section.title}
                section={section}
                answers={answers}
                currentQuestion={currentQuestion}
                reviewByQuestion={reviewByQuestion}
                onAnswerChange={scoreSummary ? () => undefined : handleAnswerChange}
                onSelectQuestion={setCurrentQuestion}
              />
            ))}
          </div>
        </div>
        <div className="question-pane__nav">
          <button type="button" className="nav-arrow" onClick={handlePrev} aria-label="Previous question">
            ‹
          </button>
          <button
            type="button"
            className="nav-arrow nav-arrow--primary"
            onClick={handleNext}
            aria-label="Next question"
          >
            ›
          </button>
        </div>
      </main>
      <ListeningBottomBar
        parts={paper.parts}
        currentPartId={currentPartId}
        questionNumbers={currentPart.questionNumbers}
        answers={answers}
        currentQuestion={currentQuestion}
        testTitle={testTitle}
        clockLabel={clockLabel}
        paused={paused}
        submitting={submitting}
        reviewByQuestion={
          reviewByQuestion
            ? Object.fromEntries(
                Object.entries(reviewByQuestion).map(([k, v]) => [Number(k), v.correct]),
              )
            : null
        }
        scoreSummary={scoreSummary}
        onSelectPart={handleSelectPart}
        onJump={goToQuestion}
        onFinish={() => {
          void handleFinish()
        }}
        onPause={() => setPaused((p) => !p)}
        onExit={handleExit}
      />
    </div>
  )
}
