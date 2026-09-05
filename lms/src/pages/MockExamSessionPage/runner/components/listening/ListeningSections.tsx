import type { ReactNode } from 'react'
import {useTranslation} from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
import type { ListeningSection, TableCell } from '../../data/listening/types'
import { QuestionReviewMark, type QuestionReview } from '../QuestionReviewMark'

type CommonProps = {
  answers: Record<number, string>
  currentQuestion: number
  onAnswerChange: (id: number, value: string) => void
  onSelectQuestion: (id: number) => void
  reviewByQuestion?: Record<number, QuestionReview> | null
}

function GapInput({
  id,
  value,
  active,
  wide,
  onChange,
  onFocus,
  review,
}: {
  id: number
  value: string
  active: boolean
  wide?: boolean
  onChange: (value: string) => void
  onFocus: () => void
  review?: QuestionReview | null
}) {
  const {t: translate} = useTranslation();
  return (
    <span className={`lq-gap ${active ? 'is-active' : ''}`}>
      <span className="lq-gap__num">{id}</span>
      <input
        className={`lq-gap__input ${active ? 'is-active' : ''} ${review && !review.correct ? 'is-incorrect-input' : ''}`}
        style={wide ? { width: 140 } : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        aria-label={translate('common:records.question', {number: formatNumber(id)})}
      />
      <QuestionReviewMark review={review} />
    </span>
  )
}

function renderCell(cell: TableCell, props: CommonProps): ReactNode {
  if (cell.type === 'text') return cell.value
  const active = props.currentQuestion === cell.id
  return (
    <span
      id={`lq-${cell.id}`}
      className={active ? 'is-active-cell' : undefined}
      onClick={() => props.onSelectQuestion(cell.id)}
    >
      <GapInput
        id={cell.id}
        value={props.answers[cell.id] ?? ''}
        active={active}
        onChange={(v) => props.onAnswerChange(cell.id, v)}
        onFocus={() => props.onSelectQuestion(cell.id)}
        review={props.reviewByQuestion?.[cell.id]}
      />
    </span>
  )
}

export function ListeningSectionView({
  section,
  answers,
  currentQuestion,
  onAnswerChange,
  onSelectQuestion,
  reviewByQuestion = null,
}: CommonProps & { section: ListeningSection }) {
  const {t: translate} = useTranslation();
  const common: CommonProps = {
    answers,
    currentQuestion,
    onAnswerChange,
    onSelectQuestion,
    reviewByQuestion,
  }

  return (
    <section className="lq-section">
      <h2 className="lq-section__title">{section.title}</h2>
      <p className="lq-section__instruction">{section.instruction}</p>

      {section.kind === 'tableCompletion' && (
        <>
          {section.caption ? <h3 className="lq-section__caption">{section.caption}</h3> : null}
          <table className="lq-table">
            <thead>
              <tr>
                {section.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{renderCell(cell, common)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {section.kind === 'notesCompletion' && (
        <>
          {section.heading ? <h3 className="lq-section__heading">{section.heading}</h3> : null}
          <ul className="lq-notes">
            {section.blanks.map((blank) => {
              const active = currentQuestion === blank.id
              return (
                <li
                  key={blank.id}
                  id={`lq-${blank.id}`}
                  className={`lq-item ${active ? 'is-active' : ''}`}
                  onClick={() => onSelectQuestion(blank.id)}
                >
                  {blank.before}{' '}
                  <GapInput
                    id={blank.id}
                    value={answers[blank.id] ?? ''}
                    active={active}
                    onChange={(v) => onAnswerChange(blank.id, v)}
                    onFocus={() => onSelectQuestion(blank.id)}
                    review={reviewByQuestion?.[blank.id]}
                  />{' '}
                  {blank.after}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {section.kind === 'formCompletion' && (
        <div className="lq-form">
          <h3 className="lq-form__title">{section.formTitle}</h3>
          {section.fields.map((field) => {
            const active = currentQuestion === field.id
            return (
              <div
                key={field.id}
                id={`lq-${field.id}`}
                className={`lq-form__row lq-item ${active ? 'is-active' : ''}`}
                onClick={() => onSelectQuestion(field.id)}
              >
                <span>{field.label}</span>
                <GapInput
                  id={field.id}
                  value={answers[field.id] ?? ''}
                  active={active}
                  wide
                  onChange={(v) => onAnswerChange(field.id, v)}
                  onFocus={() => onSelectQuestion(field.id)}
                  review={reviewByQuestion?.[field.id]}
                />
              </div>
            )
          })}
        </div>
      )}

      {section.kind === 'flowchartCompletion' && (
        <div className="lq-flow">
          {section.steps.map((step, index) => (
            <div key={index}>
              {index > 0 ? <div className="lq-flow__arrow">↓</div> : null}
              {step.type === 'text' ? (
                <div className="lq-flow__step">{step.value}</div>
              ) : (
                <div
                  id={`lq-${step.id}`}
                  className={`lq-flow__step lq-item ${currentQuestion === step.id ? 'is-active' : ''}`}
                  onClick={() => onSelectQuestion(step.id)}
                >
                  {step.before}{' '}
                  <GapInput
                    id={step.id}
                    value={answers[step.id] ?? ''}
                    active={currentQuestion === step.id}
                    onChange={(v) => onAnswerChange(step.id, v)}
                    onFocus={() => onSelectQuestion(step.id)}
                    review={reviewByQuestion?.[step.id]}
                  />{' '}
                  {step.after}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {section.kind === 'sentenceCompletion' && (
        <div className="lq-sentences">
          {section.questions.map((q) => {
            const active = currentQuestion === q.id
            return (
              <div
                key={q.id}
                id={`lq-${q.id}`}
                className={`lq-item ${active ? 'is-active' : ''}`}
                onClick={() => onSelectQuestion(q.id)}
              >
                {q.before}{' '}
                <GapInput
                  id={q.id}
                  value={answers[q.id] ?? ''}
                  active={active}
                  wide
                  onChange={(v) => onAnswerChange(q.id, v)}
                  onFocus={() => onSelectQuestion(q.id)}
                  review={reviewByQuestion?.[q.id]}
                />{' '}
                {q.after}
              </div>
            )
          })}
        </div>
      )}

      {section.kind === 'summaryBank' && (
        <>
          <div className="lq-bank">
            {section.wordBank.map((w) => (
              <span key={w} className="lq-bank__item">
                {w}
              </span>
            ))}
          </div>
          <div className="lq-summary">
            {section.parts.map((part, index) =>
              part.type === 'text' ? (
                <span key={index}>{part.value}</span>
              ) : (
                <span
                  key={part.id}
                  id={`lq-${part.id}`}
                  className={`lq-summary-gap ${currentQuestion === part.id ? 'is-active' : ''}`}
                  onClick={() => onSelectQuestion(part.id)}
                >
                  <GapInput
                    id={part.id}
                    value={answers[part.id] ?? ''}
                    active={currentQuestion === part.id}
                    onChange={(v) => onAnswerChange(part.id, v)}
                    onFocus={() => onSelectQuestion(part.id)}
                    review={reviewByQuestion?.[part.id]}
                  />
                </span>
              ),
            )}
          </div>
        </>
      )}

      {section.kind === 'mcq' && (
        <div className="lq-mcq">
          {section.questions.map((q) => {
            const active = currentQuestion === q.id
            return (
              <div
                key={q.id}
                id={`lq-${q.id}`}
                className={`lq-mcq__item lq-item ${active ? 'is-active' : ''}`}
                onClick={() => onSelectQuestion(q.id)}
              >
                <p className="lq-mcq__prompt">
                  <strong>{q.id}.</strong> {q.prompt}
                </p>
                <ul className="lq-options">
                  {q.options.map((option) => {
                    const value = option.charAt(0)
                    return (
                      <li key={option}>
                        <label>
                          <input
                            type="radio"
                            name={`lq-mcq-${q.id}`}
                            checked={(answers[q.id] ?? '') === value}
                            onChange={() => {
                              onSelectQuestion(q.id)
                              onAnswerChange(q.id, value)
                            }}
                          />
                          <span>{option}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
                <QuestionReviewMark review={reviewByQuestion?.[q.id]} />
              </div>
            )
          })}
        </div>
      )}

      {section.kind === 'multiSelect' && (
        <div
          id={`lq-${section.questionIds[0]}`}
          className={`lq-mcq lq-item ${section.questionIds.includes(currentQuestion) ? 'is-active' : ''}`}
          onClick={() => onSelectQuestion(section.questionIds[0])}
        >
          {section.questionIds.slice(1).map((id) => (
            <span key={id} id={`lq-${id}`} className="lq-anchor" />
          ))}
          <p className="lq-mcq__prompt">{section.prompt}</p>
          <ul className="lq-options">
            {section.options.map((option) => {
              const letter = option.charAt(0)
              const selected = section.questionIds
                .map((id) => answers[id])
                .filter((v) => Boolean(v && v.trim()))
              const checked = selected.includes(letter)
              return (
                <li key={option}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const set = new Set(selected)
                        if (set.has(letter)) set.delete(letter)
                        else if (set.size < section.chooseCount) set.add(letter)
                        const ordered = [...set].sort()
                        section.questionIds.forEach((id, i) => {
                          onAnswerChange(id, ordered[i] ?? '')
                        })
                        onSelectQuestion(section.questionIds[0])
                      }}
                    />
                    <span>{option}</span>
                  </label>
                </li>
              )
            })}
          </ul>
          <p className="lq-section__instruction">
            {translate('exams:runner.selectedSlots')}{' '}
            {section.questionIds.map((id) => (
              <span key={id} style={{ marginRight: 8 }}>
                {id}: <strong>{answers[id] || '—'}</strong>
              </span>
            ))}
          </p>
          {section.questionIds.map((id) => (
            <QuestionReviewMark key={id} review={reviewByQuestion?.[id]} />
          ))}
        </div>
      )}

      {section.kind === 'matching' && (
        <div className="lq-match">
          <div className="lq-choices">
            <p className="lq-choices__label">{section.listLabel}</p>
            <ul>
              {section.choices.map((c) => (
                <li key={c.key}>
                  {c.key} {c.text}
                </li>
              ))}
            </ul>
          </div>
          {section.questions.map((q) => {
            const active = currentQuestion === q.id
            return (
              <div
                key={q.id}
                id={`lq-${q.id}`}
                className={`lq-match__item lq-item ${active ? 'is-active' : ''}`}
                onClick={() => onSelectQuestion(q.id)}
              >
                <p className="lq-match__prompt">
                  <strong>{q.id}</strong> {q.statement}
                </p>
                <GapInput
                  id={q.id}
                  value={answers[q.id] ?? ''}
                  active={active}
                  onChange={(v) => onAnswerChange(q.id, v.toUpperCase())}
                  onFocus={() => onSelectQuestion(q.id)}
                  review={reviewByQuestion?.[q.id]}
                />
              </div>
            )
          })}
        </div>
      )}

      {section.kind === 'planMap' && (
        <div className="lq-plan">
          <div>
            <h3 className="lq-section__caption">{section.caption}</h3>
            <img className="lq-plan__img" src={section.imageSrc} alt={section.imageAlt} />
          </div>
          <div className="lq-plan__answers">
            <h4>{translate('exams:runner.answerArea')}</h4>
            {section.labels.map((label) => {
              const active = currentQuestion === label.id
              return (
                <div
                  key={label.id}
                  id={`lq-${label.id}`}
                  className={`lq-item ${active ? 'is-active' : ''}`}
                  onClick={() => onSelectQuestion(label.id)}
                >
                  <p className="lq-match__prompt">{label.prompt}</p>
                  <GapInput
                    id={label.id}
                    value={answers[label.id] ?? ''}
                    active={active}
                    onChange={(v) => onAnswerChange(label.id, v.toUpperCase())}
                    onFocus={() => onSelectQuestion(label.id)}
                    review={reviewByQuestion?.[label.id]}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {section.kind === 'shortAnswer' && (
        <div className="lq-short">
          {section.questions.map((q) => {
            const active = currentQuestion === q.id
            return (
              <div
                key={q.id}
                id={`lq-${q.id}`}
                className={`lq-short__item lq-item ${active ? 'is-active' : ''}`}
                onClick={() => onSelectQuestion(q.id)}
              >
                <p className="lq-short__prompt">
                  <strong>{q.id}.</strong> {q.prompt}
                </p>
                <GapInput
                  id={q.id}
                  value={answers[q.id] ?? ''}
                  active={active}
                  wide
                  onChange={(v) => onAnswerChange(q.id, v)}
                  onFocus={() => onSelectQuestion(q.id)}
                  review={reviewByQuestion?.[q.id]}
                />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
