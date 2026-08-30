import type { QuestionSection } from '../data/types'
import { TFNG_OPTIONS } from '../data/types'
import { assignMultiSelectSlots } from '../utils/multiSelectSlots'
import { QuestionReviewMark, type QuestionReview } from './QuestionReviewMark'

type SectionProps = {
  section: QuestionSection
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
  onAnswerChange,
  onSelectQuestion,
  review,
}: {
  id: number
  value: string
  active: boolean
  onAnswerChange: (id: number, value: string) => void
  onSelectQuestion: (id: number) => void
  review?: QuestionReview | null
}) {
  return (
    <span className="gap-input-wrap">
      <input
        className={`gap-input ${active ? 'is-active' : ''} ${review && !review.correct ? 'is-incorrect-input' : ''}`}
        type="text"
        value={value}
        placeholder={String(id)}
        aria-label={`Question ${id}`}
        onFocus={() => onSelectQuestion(id)}
        onChange={(e) => onAnswerChange(id, e.target.value)}
      />
      <QuestionReviewMark review={review} />
    </span>
  )
}

function LetterChoices({
  id,
  choices,
  value,
  onAnswerChange,
}: {
  id: number
  choices: { key: string; text?: string }[]
  value: string
  onAnswerChange: (id: number, value: string) => void
}) {
  return (
    <div className="match-item__choices" role="radiogroup" aria-label={`Question ${id}`}>
      {choices.map((choice) => (
        <label key={choice.key} className="tfng-option">
          <input
            type="radio"
            name={`choice-${id}`}
            value={choice.key}
            checked={value === choice.key}
            onChange={() => onAnswerChange(id, choice.key)}
          />
          <span>{choice.key}</span>
        </label>
      ))}
    </div>
  )
}

export function SectionView({
  section,
  answers,
  currentQuestion,
  onAnswerChange,
  onSelectQuestion,
  reviewByQuestion = null,
}: SectionProps) {
  if (section.kind === 'notes') {
    return (
      <div className="question-block">
        <h2 className="question-block__title">{section.title}</h2>
        <p className="question-block__instruction">{section.instruction}</p>
        {section.blocks.map((block) => (
          <div key={block.heading} className="note-section">
            <h3 className="note-section__heading">{block.heading}</h3>
            <ul className="note-list">
              {block.blanks.map((blank) => {
                const active = currentQuestion === blank.id
                return (
                  <li
                    key={blank.id}
                    id={`q-${blank.id}`}
                    className={`note-list__item ${active ? 'is-active' : ''}`}
                    onClick={() => onSelectQuestion(blank.id)}
                  >
                    <span>{blank.before} </span>
                    <GapInput
                      id={blank.id}
                      value={answers[blank.id] ?? ''}
                      active={active}
                      onAnswerChange={onAnswerChange}
                      onSelectQuestion={onSelectQuestion}
                      review={reviewByQuestion?.[blank.id]}
                    />
                    {blank.after ? <span> {blank.after}</span> : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  if (section.kind === 'sentenceCompletion') {
    return (
      <div className="question-block">
        <h2 className="question-block__title">{section.title}</h2>
        <p className="question-block__instruction">{section.instruction}</p>
        <ol className="sentence-list">
          {section.questions.map((q) => {
            const active = currentQuestion === q.id
            return (
              <li
                key={q.id}
                id={`q-${q.id}`}
                className={`sentence-list__item ${active ? 'is-active' : ''}`}
                onClick={() => onSelectQuestion(q.id)}
              >
                <span className="tfng-item__num">{q.id}</span>
                <span>{q.before} </span>
                <GapInput
                  id={q.id}
                  value={answers[q.id] ?? ''}
                  active={active}
                  onAnswerChange={onAnswerChange}
                  onSelectQuestion={onSelectQuestion}
                  review={reviewByQuestion?.[q.id]}
                />
                {q.after ? <span> {q.after}</span> : null}
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  if (section.kind === 'summaryBank') {
    return (
      <div className="question-block">
        <h2 className="question-block__title">{section.title}</h2>
        <p className="question-block__instruction">{section.instruction}</p>
        <div className="word-bank">
          <h4 className="choice-box__label">Word bank</h4>
          <div className="word-bank__tags">
            {section.wordBank.map((word) => (
              <span key={word} className="word-bank__tag">
                {word}
              </span>
            ))}
          </div>
        </div>
        <p className="summary-bank-text">
          {section.parts.map((part, index) => {
            if (part.type === 'text') {
              return <span key={`t-${index}`}>{part.value}</span>
            }
            const active = currentQuestion === part.id
            return (
              <span
                key={part.id}
                id={`q-${part.id}`}
                className={`summary-gap-wrap ${active ? 'is-active' : ''}`}
                onClick={() => onSelectQuestion(part.id)}
              >
                <GapInput
                  id={part.id}
                  value={answers[part.id] ?? ''}
                  active={active}
                  onAnswerChange={onAnswerChange}
                  onSelectQuestion={onSelectQuestion}
                  review={reviewByQuestion?.[part.id]}
                />
              </span>
            )
          })}
        </p>
      </div>
    )
  }

  if (section.kind === 'tfng') {
    const options = section.options ?? TFNG_OPTIONS
    const target = section.agreementTarget ?? 'information'
    return (
      <div className="question-block">
        <h2 className="question-block__title">{section.title}</h2>
        <p className="question-block__instruction">{section.instruction}</p>
        <p className="question-block__instruction question-block__instruction--sub">
          {options.map((option, index) => (
            <span key={option}>
              <strong>{option}</strong>
              {index === 0 &&
                (target === 'claims'
                  ? " if the statement agrees with the claims of the writer"
                  : ' if the statement agrees with the information')}
              {index === 1 &&
                (target === 'claims'
                  ? " if the statement contradicts the claims of the writer"
                  : ' if the statement contradicts the information')}
              {index === 2 && ' if there is no information on this'}
              {index < options.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
        {section.questions.map((q) => {
          const active = currentQuestion === q.id
          return (
            <div
              key={q.id}
              id={`q-${q.id}`}
              className={`tfng-item ${active ? 'is-active' : ''}`}
              onClick={() => onSelectQuestion(q.id)}
            >
              <p className="tfng-item__stem">
                <span className="tfng-item__num">{q.id}</span> {q.statement}
              </p>
              <div className="tfng-item__options" role="radiogroup" aria-label={`Question ${q.id}`}>
                {options.map((option) => (
                  <label key={option} className="tfng-option">
                    <input
                      type="radio"
                      name={`choice-${q.id}`}
                      value={option}
                      checked={(answers[q.id] ?? '') === option}
                      onChange={() => onAnswerChange(q.id, option)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <QuestionReviewMark review={reviewByQuestion?.[q.id]} />
            </div>
          )
        })}
      </div>
    )
  }

  if (section.kind === 'mcq') {
    return (
      <div className="question-block">
        <h2 className="question-block__title">{section.title}</h2>
        <p className="question-block__instruction">{section.instruction}</p>
        {section.questions.map((q) => {
          const active = currentQuestion === q.id
          return (
            <div
              key={q.id}
              id={`q-${q.id}`}
              className={`mcq-item ${active ? 'is-active' : ''}`}
              onClick={() => onSelectQuestion(q.id)}
            >
              <p className="mcq-item__stem">
                <span className="tfng-item__num">{q.id}</span> {q.prompt}
              </p>
              <div className="mcq-item__options" role="radiogroup" aria-label={`Question ${q.id}`}>
                {q.options.map((option) => {
                  const value = option.charAt(0)
                  return (
                    <label key={option} className="tfng-option mcq-option">
                      <input
                        type="radio"
                        name={`choice-${q.id}`}
                        value={value}
                        checked={(answers[q.id] ?? '') === value}
                        onChange={() => onAnswerChange(q.id, value)}
                      />
                      <span>{option}</span>
                    </label>
                  )
                })}
              </div>
              <QuestionReviewMark review={reviewByQuestion?.[q.id]} />
            </div>
          )
        })}
      </div>
    )
  }

  if (section.kind === 'multiSelect') {
    const selected = section.questionIds
      .map((id) => answers[id])
      .filter((v): v is string => Boolean(v && v.trim()))
    const active = section.questionIds.includes(currentQuestion)

    const toggle = (letter: string) => {
      const set = new Set(selected)
      if (set.has(letter)) {
        set.delete(letter)
      } else if (set.size < section.chooseCount) {
        set.add(letter)
      } else {
        return
      }
      const slots = assignMultiSelectSlots(section.questionIds, set)
      for (const [id, value] of Object.entries(slots)) {
        onAnswerChange(Number(id), value)
      }
      onSelectQuestion(section.questionIds[0])
    }

    return (
      <div className="question-block">
        <h2 className="question-block__title">{section.title}</h2>
        <p className="question-block__instruction">{section.instruction}</p>
        <div
          id={`q-${section.questionIds[0]}`}
          className={`mcq-item ${active ? 'is-active' : ''}`}
          onClick={() => onSelectQuestion(section.questionIds[0])}
        >
          <p className="mcq-item__stem">
            <span className="tfng-item__num">
              {section.questionIds[0]}–{section.questionIds[section.questionIds.length - 1]}
            </span>{' '}
            {section.prompt}
          </p>
          <div className="multi-select__slots">
            {section.questionIds.map((id) => (
              <span key={id} id={id === section.questionIds[0] ? undefined : `q-${id}`} className="multi-select__slot">
                {id}: <strong>{answers[id] || '—'}</strong>
              </span>
            ))}
          </div>
          <div className="mcq-item__options">
            {section.options.map((option) => {
              const letter = option.charAt(0)
              const checked = selected.includes(letter)
              return (
                <label key={option} className="tfng-option mcq-option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(letter)}
                  />
                  <span>{option}</span>
                </label>
              )
            })}
          </div>
          {section.questionIds.map((id) => (
            <QuestionReviewMark key={id} review={reviewByQuestion?.[id]} />
          ))}
        </div>
      </div>
    )
  }

  if (section.kind === 'matching') {
    return (
      <div className="question-block">
        <h2 className="question-block__title">{section.title}</h2>
        <p className="question-block__instruction">{section.instruction}</p>
        <div className="choice-box">
          <h4 className="choice-box__label">{section.listLabel}</h4>
          <ul className="choice-box__list">
            {section.choices.map((choice) => (
              <li key={choice.key}>
                <strong>{choice.key}</strong> {choice.text}
              </li>
            ))}
          </ul>
        </div>
        {section.questions.map((q) => {
          const active = currentQuestion === q.id
          return (
            <div
              key={q.id}
              id={`q-${q.id}`}
              className={`match-item ${active ? 'is-active' : ''}`}
              onClick={() => onSelectQuestion(q.id)}
            >
              <p className="match-item__stem">
                <span className="tfng-item__num">{q.id}</span> {q.statement}
              </p>
              <LetterChoices
                id={q.id}
                choices={section.choices}
                value={answers[q.id] ?? ''}
                onAnswerChange={onAnswerChange}
              />
              <QuestionReviewMark review={reviewByQuestion?.[q.id]} />
            </div>
          )
        })}
      </div>
    )
  }

  if (section.kind === 'headings') {
    return (
      <div className="question-block">
        <h2 className="question-block__title">{section.title}</h2>
        <p className="question-block__instruction">{section.instruction}</p>
        <div className="choice-box">
          <h4 className="choice-box__label">{section.listLabel}</h4>
          <ul className="choice-box__list">
            {section.headings.map((h) => (
              <li key={h.key}>
                <strong>{h.key}</strong> {h.text}
              </li>
            ))}
          </ul>
        </div>
        {section.questions.map((q) => {
          const active = currentQuestion === q.id
          return (
            <div
              key={q.id}
              id={`q-${q.id}`}
              className={`match-item ${active ? 'is-active' : ''}`}
              onClick={() => onSelectQuestion(q.id)}
            >
              <p className="match-item__stem">
                <span className="tfng-item__num">{q.id}</span> Paragraph {q.paragraphLabel}
              </p>
              <LetterChoices
                id={q.id}
                choices={section.headings}
                value={answers[q.id] ?? ''}
                onAnswerChange={onAnswerChange}
              />
              <QuestionReviewMark review={reviewByQuestion?.[q.id]} />
            </div>
          )
        })}
      </div>
    )
  }

  if (section.kind === 'sentenceEndings') {
    return (
      <div className="question-block">
        <h2 className="question-block__title">{section.title}</h2>
        <p className="question-block__instruction">{section.instruction}</p>
        <div className="choice-box">
          <h4 className="choice-box__label">{section.listLabel}</h4>
          <ul className="choice-box__list">
            {section.endings.map((ending) => (
              <li key={ending.key}>
                <strong>{ending.key}</strong> {ending.text}
              </li>
            ))}
          </ul>
        </div>
        {section.questions.map((q) => {
          const active = currentQuestion === q.id
          return (
            <div
              key={q.id}
              id={`q-${q.id}`}
              className={`match-item ${active ? 'is-active' : ''}`}
              onClick={() => onSelectQuestion(q.id)}
            >
              <p className="match-item__stem">
                <span className="tfng-item__num">{q.id}</span> {q.stem}
              </p>
              <LetterChoices
                id={q.id}
                choices={section.endings}
                value={answers[q.id] ?? ''}
                onAnswerChange={onAnswerChange}
              />
              <QuestionReviewMark review={reviewByQuestion?.[q.id]} />
            </div>
          )
        })}
      </div>
    )
  }

  if (section.kind === 'table') {
    return (
      <div className="question-block">
        <h2 className="question-block__title">{section.title}</h2>
        <p className="question-block__instruction">{section.instruction}</p>
        {section.caption ? <p className="table-caption">{section.caption}</p> : null}
        <div className="exam-table-wrap">
          <table className="exam-table">
            <thead>
              <tr>
                {section.headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>
                      {cell.type === 'text' ? (
                        cell.value
                      ) : (
                        <span
                          id={`q-${cell.id}`}
                          className={currentQuestion === cell.id ? 'is-active-cell' : undefined}
                          onClick={() => onSelectQuestion(cell.id)}
                        >
                          <GapInput
                            id={cell.id}
                            value={answers[cell.id] ?? ''}
                            active={currentQuestion === cell.id}
                            onAnswerChange={onAnswerChange}
                            onSelectQuestion={onSelectQuestion}
                            review={reviewByQuestion?.[cell.id]}
                          />
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (section.kind === 'flowchart') {
    return (
      <div className="question-block">
        <h2 className="question-block__title">{section.title}</h2>
        <p className="question-block__instruction">{section.instruction}</p>
        <div className="flowchart">
          {section.steps.map((step, index) => (
            <div key={index} className="flowchart__row">
              {index > 0 ? <div className="flowchart__arrow" aria-hidden="true">↓</div> : null}
              <div className="flowchart__box">
                {step.type === 'text' ? (
                  step.value
                ) : (
                  <span
                    id={`q-${step.id}`}
                    className={currentQuestion === step.id ? 'is-active-cell' : undefined}
                    onClick={() => onSelectQuestion(step.id)}
                  >
                    {step.before ? <span>{step.before} </span> : null}
                    <GapInput
                      id={step.id}
                      value={answers[step.id] ?? ''}
                      active={currentQuestion === step.id}
                      onAnswerChange={onAnswerChange}
                      onSelectQuestion={onSelectQuestion}
                      review={reviewByQuestion?.[step.id]}
                    />
                    {step.after ? <span> {step.after}</span> : null}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (section.kind === 'diagram') {
    return (
      <div className="question-block">
        <h2 className="question-block__title">{section.title}</h2>
        <p className="question-block__instruction">{section.instruction}</p>
        <p className="table-caption">{section.caption}</p>
        <div className="diagram-split">
          <figure className="diagram-split__figure">
            <img
              className="diagram-split__image"
              src={section.imageSrc}
              alt={section.imageAlt}
            />
          </figure>
          <div className="diagram-split__answers">
            <h4 className="diagram-split__answers-title">Answers</h4>
            {section.labels.map((label) => {
              const active = currentQuestion === label.id
              return (
                <div
                  key={label.id}
                  id={`q-${label.id}`}
                  className={`diagram-split__item ${active ? 'is-active' : ''}`}
                  onClick={() => onSelectQuestion(label.id)}
                >
                  <p className="diagram-split__prompt">
                    <span className="tfng-item__num">{label.id}</span> {label.prompt}
                  </p>
                  <GapInput
                    id={label.id}
                    value={answers[label.id] ?? ''}
                    active={active}
                    onAnswerChange={onAnswerChange}
                    onSelectQuestion={onSelectQuestion}
                    review={reviewByQuestion?.[label.id]}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // shortAnswer
  return (
    <div className="question-block">
      <h2 className="question-block__title">{section.title}</h2>
      <p className="question-block__instruction">{section.instruction}</p>
      {section.questions.map((q) => {
        const active = currentQuestion === q.id
        return (
          <div
            key={q.id}
            id={`q-${q.id}`}
            className={`short-answer-item ${active ? 'is-active' : ''}`}
            onClick={() => onSelectQuestion(q.id)}
          >
            <p className="tfng-item__stem">
              <span className="tfng-item__num">{q.id}</span> {q.prompt}
            </p>
            <GapInput
              id={q.id}
              value={answers[q.id] ?? ''}
              active={active}
              onAnswerChange={onAnswerChange}
              onSelectQuestion={onSelectQuestion}
              review={reviewByQuestion?.[q.id]}
            />
          </div>
        )
      })}
    </div>
  )
}
