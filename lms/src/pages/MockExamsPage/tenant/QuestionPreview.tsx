import {useTranslation} from 'react-i18next';
import {useState} from 'react';
import {isRecord} from '@/utils/apiError';
import {SectionView} from '@/pages/MockExamSessionPage/runner/components/QuestionSections';
import {ListeningSectionView} from '@/pages/MockExamSessionPage/runner/components/listening/ListeningSections';
import type {QuestionSection} from '@/pages/MockExamSessionPage/runner/data/types';
import type {ListeningSection} from '@/pages/MockExamSessionPage/runner/data/listening/types';
import {questionTitle, type QuestionDraft} from './model';
import {
  contentErrors,
  parseContent,
  questionDefinition,
  type Field,
  type QuestionSubject,
} from './questionSchema';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import styles from './authoring.module.scss';

// Project only validated display fields: imported answer keys and extra metadata
// must never override kind/title or leak into the student-view preview.
function displayContent(field: Field, value: unknown): unknown {
  if (field.type === 'object' && isRecord(value))
    return Object.fromEntries(
      Object.entries(field.fields).map(([key, item]) => [
        key,
        displayContent(item, value[key]),
      ]),
    );
  if (field.type === 'list' && Array.isArray(value))
    return value.map((item) => displayContent(field.item, item));
  if (field.type === 'variant' && isRecord(value)) {
    const result = displayContent(field.variants[String(value.type)], value);
    return {...(isRecord(result) ? result : {}), type: value.type};
  }
  return value;
}
function validPreview(subject: QuestionSubject, value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.kind !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.instruction !== 'string'
  )
    return false;
  const schema = questionDefinition(subject, value.kind)?.schema;
  return (
    Boolean(schema) && contentErrors(subject, value.kind, value).length === 0
  );
}
function isReadingPreview(value: unknown): value is QuestionSection {
  return validPreview('reading', value);
}
function isListeningPreview(value: unknown): value is ListeningSection {
  return validPreview('listening', value);
}
export function QuestionPreview({
  subject,
  question,
}: {
  subject: QuestionSubject;
  question: QuestionDraft;
}) {
  const {t: translate} = useTranslation();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [current, setCurrent] = useState(0);
  const value = parseContent(question.payload);
  const definition = questionDefinition(subject, question.kind);
  if (
    !definition?.schema ||
    contentErrors(subject, question.kind, value).length
  )
    return (
      <p className={ui.hint}>
        {translate("exams:authoring.previewUnavailable")}</p>
    );
  const content = displayContent(definition.schema, value);
  if (!isRecord(content)) return null;
  const data = {
    ...content,
    kind: question.kind,
    title: questionTitle(question),
    instruction: question.instruction,
    questionStart: Number(question.start),
    questionEnd: Number(question.end),
    imageSrc: '',
  };
  // tfng's existing alternate answer labels are a renderer-supported field.
  if (
    question.kind === 'tfng' &&
    isRecord(value) &&
    Array.isArray(value.options) &&
    value.options.every((option) => typeof option === 'string')
  )
    Object.assign(data, {
      options: value.options,
      agreementTarget:
        value.agreementTarget === 'claims' ? 'claims' : 'information',
    });
  const props = {
    answers,
    currentQuestion: current,
    onAnswerChange: (id: number, answer: string) =>
      setAnswers((all) => ({...all, [id]: answer})),
    onSelectQuestion: setCurrent,
  };
  return (
    <div className={styles.preview}>
      <p className={ui.hint}>
        {translate("exams:authoring.previewHelp")}</p>
      {question.kind === 'diagram' ? (
        <p className={ui.hint}>
          {translate("exams:authoring.diagramPreviewHelp")}</p>
      ) : null}
      {subject === 'listening' && isListeningPreview(data) ? (
        <ListeningSectionView section={data} {...props} />
      ) : subject === 'reading' && isReadingPreview(data) ? (
        <SectionView section={data} {...props} />
      ) : null}
    </div>
  );
}
