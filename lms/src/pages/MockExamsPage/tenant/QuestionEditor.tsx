import {useId, useState} from 'react';
import type {QuestionDraft} from './model';
import {ContentFields} from './ContentFields';
import {
  QUESTION_TYPES,
  emptyValue,
  fitsField,
  parseContent,
  questionDefinition,
  questionNumbers,
  type QuestionSubject,
} from './questionSchema';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './authoring.module.scss';

export function QuestionEditor({
  subject,
  question,
  onChange,
  suggestedNumber,
}: {
  subject: QuestionSubject;
  question: QuestionDraft;
  onChange: (patch: Partial<QuestionDraft>) => void;
  suggestedNumber: number;
}) {
  const definition = questionDefinition(subject, question.kind);
  const helpId = useId();
  const content = parseContent(question.payload);
  const guided = Boolean(
    definition?.schema && fitsField(definition.schema, content),
  );
  const [advanced, setAdvanced] = useState(false);
  const [pendingKind, setPendingKind] = useState<string | null>(null);
  const nextNumber = () =>
    Math.max(
      suggestedNumber - 1,
      ...questionNumbers(content, definition?.schema),
    ) + 1;
  const updateContent = (value: unknown) => {
    const numbers = questionNumbers(value, definition?.schema);
    onChange({
      payload: JSON.stringify(value, null, 2),
      ...(numbers.length
        ? {
            start: String(Math.min(...numbers)),
            end: String(Math.max(...numbers)),
          }
        : {}),
    });
  };
  const chooseType = (kind: string) => {
    const schema = questionDefinition(subject, kind)?.schema;
    let next =
      Number(question.start) > 0 ? Number(question.start) : suggestedNumber;
    const value = schema ? emptyValue(schema, () => next++) : {};
    const numbers = questionNumbers(value, schema);
    onChange({
      kind,
      payload: JSON.stringify(value, null, 2),
      start: numbers.length ? String(Math.min(...numbers)) : question.start,
      end: numbers.length ? String(Math.max(...numbers)) : question.end,
    });
    setPendingKind(null);
    setAdvanced(!schema);
  };
  return (
    <div className={styles.fields}>
      <label>
        <span>Question type</span>
        <select
          aria-label="Question type"
          aria-describedby={helpId}
          value={definition ? question.kind : question.kind ? '__custom' : ''}
          onChange={(event) => {
            if (event.target.value === '__custom') {
              setAdvanced(true);
              return;
            }
            if (
              question.payload.trim() !== '{}' &&
              question.payload.trim() !== ''
            )
              setPendingKind(event.target.value);
            else chooseType(event.target.value);
          }}
        >
          <option value="" disabled>
            Select a question type
          </option>
          {QUESTION_TYPES[subject].map((item) => (
            <option key={item.kind} value={item.kind}>
              {item.label}
            </option>
          ))}
          <option value="__custom">Custom type · advanced data</option>
        </select>
        <small id={helpId}>
          {definition?.description ??
            'Choose how students will answer this group of questions.'}
        </small>
      </label>
      {pendingKind !== null ? (
        <div className={styles.notice} role="alert">
          <strong>Replace the question content?</strong>
          <p>
            Changing the type starts a new content form. Existing question
            content and any answer data in this group will be removed. The
            title, instructions and attached image stay.
          </p>
          <div className={ui.actions}>
            <button
              className={ui.secondaryButton}
              type="button"
              onClick={() => chooseType(pendingKind)}
            >
              Replace content
            </button>
            <button
              className={ui.textButton}
              type="button"
              onClick={() => setPendingKind(null)}
            >
              Keep current type
            </button>
          </div>
        </div>
      ) : null}
      {guided && definition?.schema ? (
        <>
          <p className={ui.hint}>
            Question numbers update the group range automatically. Use a
            different number for every answer.
          </p>
          <ContentFields
            field={definition.schema}
            value={content}
            onChange={updateContent}
            nextNumber={nextNumber}
          />
        </>
      ) : question.kind ? (
        <p className={styles.notice}>
          This content needs Advanced data. Nothing has been changed or
          discarded. Use a payload verified by your content or integration team.
        </p>
      ) : null}
      <details
        open={advanced || Boolean(question.kind && !guided)}
        onToggle={(event) => setAdvanced(event.currentTarget.open)}
        className={styles.advanced}
      >
        <summary>Advanced data and answer keys</summary>
        <p className={ui.hint}>
          For imported content, custom types and existing answer keys. Extra
          fields are preserved when you edit the form. Answer-key and scoring
          formats are not specified by the supplied API.
        </p>
        <label>
          <span>Question type code</span>
          <input
            value={question.kind}
            onChange={(event) => onChange({kind: event.target.value})}
            placeholder="Use a verified type code"
          />
        </label>
        <label>
          <span>Question data (JSON)</span>
          <textarea
            className={styles.code}
            value={question.payload}
            onChange={(event) => onChange({payload: event.target.value})}
            spellCheck={false}
          />
        </label>
        {content === undefined ? (
          <p className={ui.inlineError} role="alert">
            The JSON cannot be read. Check quotes, commas and brackets. Your
            text is preserved.
          </p>
        ) : null}
      </details>
    </div>
  );
}
