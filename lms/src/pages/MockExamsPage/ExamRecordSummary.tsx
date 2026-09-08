import i18n from '@/i18n';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {displayScalar, recordFieldLabel} from '@/components/RecordSummaryList/recordPresentation';
import {questionDefinition} from './tenant/questionSchema';

const FIELD_KEYS: Record<string, string> = {
  kind: 'exams:records.questionType',
  payload: 'exams:records.questionContent',
  seq: 'exams:records.sequence',
  sortOrder: 'exams:records.displayOrder',
  taskKey: 'exams:records.taskReference',
};

const fieldLabel = (key: string) => {
  const examKey = FIELD_KEYS[key] ?? `exams:records.${key}`;
  return i18n.exists(examKey) ? i18n.t(examKey) : recordFieldLabel(key);
};
const scalar = (value: unknown, key?: string): string | null => {
  if (key === 'kind' && typeof value === 'string') {
    const definition = questionDefinition('reading', value) ?? questionDefinition('listening', value);
    if (definition) return i18n.t(definition.labelKey);
  }
  // Only platform metadata is localized. Prompts, answer codes and authored
  // content must retain their exact values, even when they resemble enums.
  return displayScalar(value, key);
};

export function ExamRecordSummary({value, emptyMessage}: {value: unknown; emptyMessage?: string}) {
  return <RecordSummaryList value={value} emptyMessage={emptyMessage} fieldLabel={fieldLabel} scalar={scalar}/>;
}
