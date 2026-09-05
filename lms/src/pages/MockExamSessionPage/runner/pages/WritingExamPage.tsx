import { useTranslation } from 'react-i18next';
import {formatDateTime, formatNumber} from '@/i18n/formatting';
import {getApiErrorMessage} from '@/utils/apiError';
import {useConfirmationDialog} from '@/components/TeachingWorkspace/useConfirmationDialog';
import {ExamSubmissionDialog} from '../components/ExamSubmissionDialog';
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
  return formatDateTime(date, { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function WritingExamPage({ writing, testId, testTitle, candidateLabel, onExit }: WritingExamPageProps) {
  const { t: translate } = useTranslation();
  const {confirm, dialog: exitDialog} = useConfirmationDialog();
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
  const [clock, setClock] = useState(() => new Date())
  const [submitting, setSubmitting] = useState(false)
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [submissionError, setSubmissionError] = useState<unknown>()
  const [result, setResult] = useState<WritingSubmissionResult | null>(null)
  const timeUpTriggered = useRef(false)
  const submitSectionRef = useRef<() => Promise<void>>(async () => {})

  const currentTask = useMemo(
    () => tasks.find((t) => t.seq === currentSeq) ?? tasks[0],
    [tasks, currentSeq],
  )

  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(new Date())
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
    setSubmissionOpen(true)
    setSubmissionError('')
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
      setSubmissionError(err)
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

  const handleFinish = useCallback(() => {
    if (submitting || result) return
    setSubmissionOpen(true)
  }, [result, submitting])

  const handleExit = useCallback(async () => {
    if (result) {
      onExit()
      return
    }
    const ok = await confirm({titleKey: 'exams:runner.exit', messageKey: 'exams:runner.exitConfirm'})
    if (ok) onExit()
  }, [confirm, onExit, result])

  if (!currentTask) {
    return null
  }

  return (
    <div className="exam-shell writing-shell">
      {exitDialog}
      <ExamSubmissionDialog open={submissionOpen} pending={submitting} submitted={Boolean(result)} error={submissionError ? getApiErrorMessage(submissionError, translate('exams:submission.failed')) : ''} onSubmit={() => void submitSection()} onClose={() => setSubmissionOpen(false)}/>
      <TopBar testTitle={testTitle} candidateId={candidateLabel} remainingSeconds={remainingSeconds} paused={paused} />
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
                  alt={translate('exams:runner.taskImage', {task: currentTask.title})}
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
              {translate('exams:runner.words', {number: formatNumber(wordCount)})}
              {minWords > 0 ? <> / {translate('exams:runner.minimumWords', {number: formatNumber(minWords)})}</> : null}
            </span>
          </div>
          <textarea
            className="writing-textarea"
            value={contents[currentTask.taskKey] ?? ''}
            onChange={(e) => handleContentChange(e.target.value)}
            readOnly={Boolean(result)}
            placeholder={translate('exams:runner.writingPlaceholder')}
            aria-label={translate('exams:runner.writingAnswer')}
            spellCheck
          />
          {result ? (
            <ul className="writing-result">
              {result.tasks.map((t) => (
                <li key={t.taskKey}>
                  {translate('exams:runner.writingResult', {task: tasks.find(task => task.taskKey === t.taskKey)?.title || t.taskKey, words: formatNumber(t.wordCount), characters: formatNumber(t.contentLength)})}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>
      <footer className="bottom-bar writing-bottom">
        <div className="bottom-bar__left">
          <h2 className="exam-navigation-title">{translate("common:status.WRITING")}</h2>
          <div className="question-nav">
            <span className="question-nav__label">{translate('records:fields.tasks')}</span>
            {tasks.map((t) => {
              const answered = Boolean((contents[t.taskKey] ?? '').trim())
              const active = t.seq === currentSeq
              return (
                <button
                  key={t.taskKey}
                  type="button"
                  className={`q-chip writing-task-chip ${answered ? 'is-answered' : ''} ${active ? 'is-active' : ''}`}
                  onClick={() => setCurrentSeq(t.seq)}
                  aria-current={active ? 'step' : undefined}
                >
                  {translate('exams:authoring.taskNumber', {number: formatNumber(t.seq)})}
                </button>
              )
            })}
          </div>
          <div className="bottom-bar__meta">
            <span>{testTitle}</span>
            <span className="muted">{translate('common:status.WRITING')} · {translate('assessment:attempt.duration', {count: writing.totalMinutes, number: formatNumber(writing.totalMinutes)})}</span>
          </div>
        </div>
        <div className="bottom-bar__right">
          <span className="bottom-bar__clock">{formatClock(clock)}</span>
          <button
            type="button"
            className="bar-btn bar-btn--primary"
            onClick={() => void handleFinish()}
            disabled={submitting || Boolean(result)}
          >
            {submitting ? translate("common:actions.submitting") : result ? translate('common:status.SUBMITTED') : translate('exams:runner.finishSection')}
          </button>
          <button type="button" className="bar-btn" onClick={() => setPaused((p) => !p)}>
            {paused ? translate('exams:runner.resume') : translate('exams:runner.pause')}
          </button>
          <button type="button" className="bar-btn bar-btn--danger" onClick={handleExit}>
            {translate('exams:runner.exit')}
          </button>
        </div>
      </footer>
    </div>
  )
}
