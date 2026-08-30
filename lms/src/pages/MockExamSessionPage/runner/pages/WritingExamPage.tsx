import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { submitWriting, writingTaskImageUrl } from '../api/writings'
import { ensureAttemptId } from '../api/tests'
import type { ApiWritingDetail, WritingSubmissionResult } from '../api/types'
import { TopBar } from '../components/TopBar'
import { countWords } from '../utils/countWords'

type WritingExamPageProps = {
  writing: ApiWritingDetail
  testId: number
  testTitle: string
  candidateLabel: string
  onExit: () => void
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function WritingExamPage({ writing, testId, testTitle, candidateLabel, onExit }: WritingExamPageProps) {
  const tasks = writing.tasks
  const firstSeq = tasks[0]?.seq ?? 1

  const [contents, setContents] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const t of tasks) init[t.taskKey] = ''
    return init
  })
  const [currentSeq, setCurrentSeq] = useState(firstSeq)
  const [remainingSeconds, setRemainingSeconds] = useState(writing.totalMinutes * 60)
  const [paused, setPaused] = useState(false)
  const [clockLabel, setClockLabel] = useState(() => formatClock(new Date()))
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<WritingSubmissionResult | null>(null)
  const timeUpTriggered = useRef(false)
  const submitSectionRef = useRef<() => Promise<void>>(async () => {})

  const currentTask = useMemo(
    () => tasks.find((t) => t.seq === currentSeq) ?? tasks[0],
    [tasks, currentSeq],
  )

  useEffect(() => {
    const id = window.setInterval(() => {
      setClockLabel(formatClock(new Date()))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const wordCount = countWords(contents[currentTask?.taskKey ?? ''] ?? '')
  const minWords = currentTask?.minWords ?? 0
  const belowMin = wordCount > 0 && wordCount < minWords

  const handleContentChange = useCallback(
    (value: string) => {
      if (!currentTask || result) return
      setContents((prev) => ({ ...prev, [currentTask.taskKey]: value }))
    },
    [currentTask, result],
  )

  const submitSection = useCallback(async () => {
    if (submitting || result) return

    setSubmitting(true)
    try {
      const attemptId = await ensureAttemptId(testId)
      const saved = await submitWriting(testId, {
        attemptId,
        tasks: tasks.map((t) => ({
          taskKey: t.taskKey,
          content: contents[t.taskKey] ?? '',
        })),
      })
      setResult(saved)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }, [contents, result, submitting, tasks, testId])

  submitSectionRef.current = submitSection

  useEffect(() => {
    if (paused || result) return
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
  }, [paused, result])

  const handleFinish = useCallback(async () => {
    if (submitting || result) return
    const ok = window.confirm('Finish this section and submit your essays?')
    if (!ok) return
    await submitSection()
  }, [result, submitSection, submitting])

  const handleExit = useCallback(() => {
    if (result) {
      onExit()
      return
    }
    const ok = window.confirm('Exit Writing? Your current work will not be saved.')
    if (ok) onExit()
  }, [onExit, result])

  if (!currentTask) {
    return null
  }

  return (
    <div className="exam-shell writing-shell">
      <TopBar candidateId={candidateLabel} remainingSeconds={remainingSeconds} paused={paused} />
      <main className="writing-main">
        <aside className="writing-prompt">
          <div className="writing-prompt__inner">
            <p className="writing-prompt__eyebrow">{currentTask.title}</p>
            <div className="writing-prompt__body">
              {currentTask.prompt.split('\n').map((line, i) =>
                line.trim() ? <p key={i}>{line}</p> : <br key={i} />,
              )}
            </div>
            {currentTask.hasImage ? (
              <figure className="writing-prompt__figure">
                <img
                  src={writingTaskImageUrl(writing.id, currentTask.seq)}
                  alt={`${currentTask.title} chart`}
                />
              </figure>
            ) : null}
          </div>
        </aside>
        <section className="writing-editor">
          <div className="writing-editor__toolbar">
            <span
              className={`writing-wordcount ${belowMin ? 'is-low' : ''} ${
                wordCount >= minWords ? 'is-ok' : ''
              }`}
            >
              Words: {wordCount}
              {minWords > 0 ? ` / min ${minWords}` : ''}
            </span>
          </div>
          <textarea
            className="writing-textarea"
            value={contents[currentTask.taskKey] ?? ''}
            onChange={(e) => handleContentChange(e.target.value)}
            readOnly={Boolean(result)}
            placeholder="Type your answer here…"
            spellCheck
          />
          {result ? (
            <ul className="writing-result">
              {result.tasks.map((t) => (
                <li key={t.taskKey}>
                  {t.taskKey}: {t.wordCount} words ({t.contentLength} chars)
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>
      <footer className="bottom-bar writing-bottom">
        <div className="bottom-bar__left">
          <div className="question-nav">
            <span className="question-nav__label">Tasks</span>
            {tasks.map((t) => {
              const answered = Boolean((contents[t.taskKey] ?? '').trim())
              const active = t.seq === currentSeq
              return (
                <button
                  key={t.taskKey}
                  type="button"
                  className={`q-chip writing-task-chip ${answered ? 'is-answered' : ''} ${active ? 'is-active' : ''}`}
                  onClick={() => setCurrentSeq(t.seq)}
                >
                  Task {t.seq}
                </button>
              )
            })}
          </div>
          <div className="bottom-bar__meta">
            <span>{testTitle}</span>
            <span className="muted">Writing · {writing.totalMinutes} min</span>
          </div>
        </div>
        <div className="bottom-bar__right">
          <span className="bottom-bar__clock">{clockLabel}</span>
          <button
            type="button"
            className="bar-btn"
            onClick={() => void handleFinish()}
            disabled={submitting || Boolean(result)}
          >
            {submitting ? 'Submitting…' : result ? 'Submitted' : 'Finish section'}
          </button>
          <button type="button" className="bar-btn" onClick={() => setPaused((p) => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="bar-btn bar-btn--danger" onClick={handleExit}>
            Exit
          </button>
        </div>
      </footer>
    </div>
  )
}
