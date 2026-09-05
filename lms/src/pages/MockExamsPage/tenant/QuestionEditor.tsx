import {useTranslation} from 'react-i18next';
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
  const {t: translate} = useTranslation();
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
        <span>{translate("common:admin.examFields.questionType")}</span>
        <select
          aria-label={translate("common:admin.examFields.questionType")}
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
            {translate("exams:authoring.selectType")}</option>
          {QUESTION_TYPES[subject].map((item) => (
            <option key={item.kind} value={item.kind}>
              {translate(item.labelKey)}
            </option>
          ))}
          <option value="__custom">{translate("exams:authoring.customType")}</option>
        </select>
        <small id={helpId}>
          {definition ? translate(definition.descriptionKey) :
            translate("exams:authoring.chooseTypeHelp")}
        </small>
      </label>
      {pendingKind !== null ? (
        <div className={styles.notice} role="alert">
          <strong>{translate("exams:authoring.replaceQuestion")}</strong>
          <p>
            {translate("exams:authoring.replaceQuestionHelp")}</p>
          <div className={ui.actions}>
            <button
              className={ui.secondaryButton}
              type="button"
              onClick={() => chooseType(pendingKind)}
            >
              {translate("exams:authoring.replaceContent")}</button>
            <button
              className={ui.textButton}
              type="button"
              onClick={() => setPendingKind(null)}
            >
              {translate("exams:authoring.keepType")}</button>
          </div>
        </div>
      ) : null}
      {guided && definition?.schema ? (
        <>
          <p className={ui.hint}>
            {translate("exams:authoring.questionNumbersHelp")}</p>
          <ContentFields
            field={definition.schema}
            value={content}
            onChange={updateContent}
            nextNumber={nextNumber}
          />
        </>
      ) : question.kind ? (
        <p className={styles.notice}>
          {translate("exams:authoring.advancedRequired")}</p>
      ) : null}
      <details
        open={advanced || Boolean(question.kind && !guided)}
        onToggle={(event) => setAdvanced(event.currentTarget.open)}
        className={styles.advanced}
      >
        <summary>{translate(guided ? 'exams:authoring.advancedOptional' : 'exams:authoring.advanced')}</summary>
        <p className={ui.hint}>
          {translate("exams:authoring.advancedHelp")}</p>
        <label>
          <span>{translate("exams:authoring.typeCode")}</span>
          <input
            value={question.kind}
            onChange={(event) => onChange({kind: event.target.value})}
            placeholder={translate("exams:authoring.typeCodeHint")}
          />
        </label>
        <label>
          <span>{translate("exams:authoring.questionData")}</span>
          <textarea
            className={styles.code}
            value={question.payload}
            onChange={(event) => onChange({payload: event.target.value})}
            spellCheck={false}
          />
        </label>
        {content === undefined ? (
          <p className={ui.inlineError} role="alert">
            {translate("exams:authoring.invalidJsonPreserved")}</p>
        ) : null}
      </details>
    </div>
  );
}
