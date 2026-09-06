import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useState} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ReadingImport} from '@/pages/MockExamsPage/tenant/ReadingImport';
import {parseReadingImport, READING_IMPORT_EXAMPLE} from '@/pages/MockExamsPage/tenant/readingJson';
import {QuestionEditor} from '@/pages/MockExamsPage/tenant/QuestionEditor';
import {PassageEditor} from '@/pages/MockExamsPage/tenant/PassageEditor';
import {listeningPayload, newDraft, newQuestion, readingPayload, writingPayload} from '@/pages/MockExamsPage/tenant/model';
import {QUESTION_TYPES, emptyValue, fieldErrors, type Field} from '@/pages/MockExamsPage/tenant/questionSchema';
import {objectiveAnswerErrors} from '@/pages/MockExamsPage/tenant/answerKeys';
import i18n from '.';
import {SUPPORTED_LOCALES} from './configuration';

const mediaApi = vi.hoisted(() => ({listTenantMedia: vi.fn()}));
vi.mock('@/apis/services/mock-exam-api', () => ({mockExamApiService: mediaApi}));
function mountImport(onApply = vi.fn()) {
  render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><ReadingImport templateId={48} versionId={480} draft={newDraft()} disabled={false} onApply={onApply}/></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:import.title')}));
  return onApply;
}

afterEach(async () => {cleanup(); await i18n.changeLanguage('en');});
const changeLocale = async (locale: string) => {await act(() => i18n.changeLanguage(locale));};
const knownKeys = (field: Field): string[] => [field.labelKey, ...(field.hintKey ? [field.hintKey] : []), ...(
  field.type === 'list' ? knownKeys(field.item) : field.type === 'object' ? Object.values(field.fields).flatMap(knownKeys) : field.type === 'variant' ? Object.values(field.variants).flatMap(knownKeys) : []
)];

describe('localized question authoring metadata and drafts', () => {
  it('keeps import JSON, validation errors and the selected input method across locales', async () => {
    const onApply = mountImport(); fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:import.paste')}));
    const raw = '{"totalMinutes": 60, "passages": []}';
    fireEvent.change(screen.getByRole('textbox', {name: i18n.t('exams:import.pasteLabel')}), {target: {value: raw}});
    fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:import.validate')}));
    for (const locale of SUPPORTED_LOCALES) {
      await changeLocale(locale); expect(screen.getByRole('textbox', {name: i18n.t('exams:import.pasteLabel')})).toHaveValue(raw);
      expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('exams:import.itemRequired', {path: 'passages'}));
      expect(screen.getByRole('button', {name: i18n.t('exams:import.paste')})).toHaveAttribute('aria-pressed', 'true');
    }
    expect(onApply).not.toHaveBeenCalled();
  });

  it('re-resolves unavailable-image errors without refetching or translating imported questions', async () => {
    mediaApi.listTenantMedia.mockReset().mockResolvedValue({code: 'SUCCESS', status: 200, data: []});
    const source = structuredClone(READING_IMPORT_EXAMPLE);
    const raw = JSON.stringify({...source, passages: source.passages.map(passage => ({...passage, questions: passage.questions.map(question => ({...question, imageMediaId: 1200}))}))});
    const onApply = mountImport(); fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:import.paste')}));
    fireEvent.change(screen.getByRole('textbox', {name: i18n.t('exams:import.pasteLabel')}), {target: {value: raw}});
    fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:import.validate')}));
    fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:import.load')})); await screen.findByRole('alert');
    for (const locale of SUPPORTED_LOCALES) {
      await changeLocale(locale); expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('exams:import.imageUnavailable', {id: '1,200'}));
      expect(screen.getByRole('textbox', {name: i18n.t('exams:import.pasteLabel')})).toHaveValue(raw);
      const imported = parseReadingImport(raw); expect(imported.errors).toEqual([]);
      expect(imported.draft && readingPayload(imported.draft)).toEqual(JSON.parse(raw));
    }
    expect(mediaApi.listTenantMedia).toHaveBeenCalledExactlyOnceWith(48, 480); expect(onApply).not.toHaveBeenCalled();
  });

  it('localizes invalid file feedback and keeps the original English exam example', async () => {
    const onApply = mountImport();
    fireEvent.change(screen.getByLabelText(i18n.t('exams:import.fileLabel')), {target: {files: [new File(['{}'], 'exam.txt', {type: 'text/plain'})]}});
    fireEvent.click(screen.getByText(i18n.t('exams:import.example')));
    for (const locale of SUPPORTED_LOCALES) {
      await changeLocale(locale); expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('exams:import.fileRule'));
      expect(screen.getByText(/Replace this example statement/).textContent).toBe(JSON.stringify(READING_IMPORT_EXAMPLE, null, 2));
    }
    expect(onApply).not.toHaveBeenCalled();
  });

  it('never translates IELTS exam content or changes serialized requests with the interface locale', async () => {
    const draft = newDraft(); draft.minutes = '60';
    Object.assign(draft.units[0], {paragraphs: '["Libraries serve their communities."]', intro: 'Read carefully.', prompt: 'Write about the following topic.', minWords: '250', mediaId: 1200});
    draft.units[0].questions = [{...newQuestion(), kind: 'tfng', start: '1', end: '1', instruction: 'Choose True, False or Not Given.', payload: JSON.stringify({questions: [{id: 1, statement: 'Libraries serve communities.', answer: 'TRUE'}], options: ['True', 'False', 'Not Given'], metadata: {keep: 'Exam content'}}), mediaId: 1201}];
    const before = structuredClone(draft); const reading = readingPayload(draft), writing = writingPayload(draft);
    const listeningDraft = structuredClone(draft); listeningDraft.units[0].questions[0].kind = 'formCompletion'; listeningDraft.units[0].questions[0].payload = JSON.stringify({formTitle: 'Registration', fields: [{id: 1, label: 'Full name', answers: ['Alice', 'Alice Smith']}], metadata: {retain: true}});
    const listening = listeningPayload(listeningDraft);
    for (const locale of SUPPORTED_LOCALES) {
      await changeLocale(locale); expect(readingPayload(draft)).toEqual(reading); expect(writingPayload(draft)).toEqual(writing); expect(listeningPayload(listeningDraft)).toEqual(listening); expect(draft).toEqual(before);
    }
    expect(reading.passages[0]).toMatchObject({shortLabel: 'Passage 1', intro: 'Read carefully.', paragraphs: ['Libraries serve their communities.'], questions: [{title: 'Questions 1–1', instruction: 'Choose True, False or Not Given.', imageMediaId: 1201}]});
    expect(writing.tasks[0]).toMatchObject({title: 'Task 1', taskKey: 'task-1', prompt: 'Write about the following topic.', minWords: 250, imageMediaId: 1200});
    expect(listening.parts[0]).toMatchObject({label: 'Part 1', audioMediaId: 1200});
  });

  it('has localized keys for every guided and advanced type without translating generated payload fields', async () => {
    const snapshots = new Map<string, unknown>();
    for (const locale of SUPPORTED_LOCALES) {
      await changeLocale(locale);
      for (const subject of ['listening', 'reading'] as const) for (const definition of QUESTION_TYPES[subject]) {
        const schema = 'schema' in definition ? definition.schema : undefined;
        const answerSchema = 'answerSchema' in definition ? definition.answerSchema : undefined;
        for (const key of [definition.labelKey, definition.descriptionKey, ...(schema ? knownKeys(schema) : []), ...(answerSchema ? knownKeys(answerSchema) : [])]) {
          expect(i18n.exists(key, {lng: locale, fallbackLng: false}), `${locale}:${key}`).toBe(true);
          expect(i18n.t(key)).not.toMatch(/exams:|common:|assessment:/);
          if (locale !== 'en') expect(i18n.t(key)).toMatch(/[\u3400-\u9fff]/);
        }
        if (schema) {
          let number = 1200; const payload = emptyValue(schema, () => number++), key = `${subject}:${definition.kind}`;
          if (!snapshots.has(key)) snapshots.set(key, payload); else expect(payload).toEqual(snapshots.get(key));
          expect(JSON.stringify(payload)).not.toMatch(/labelKey|descriptionKey|exams:|[\u3400-\u9fff]/);
        }
      }
    }
    const form = snapshots.get('listening:formCompletion');
    expect(form).toEqual({formTitle: '', fields: [{id: 1200, label: ''}]});
  });

  it('keeps imported answer data and replacement confirmation through language changes', async () => {
    const original = {...newQuestion(), kind: 'formCompletion', payload: JSON.stringify({formTitle: 'Authored form', fields: [{id: 1200, label: 'Authored question', answer: 'Official answer', retained: {source: 'authored'}}], metadata: {keep: true}}), start: '1200', end: '1200'};
    const onChange = vi.fn();
    render(<QuestionEditor subject="listening" question={original} onChange={onChange} suggestedNumber={1201}/>);
    fireEvent.change(screen.getByRole('combobox', {name: i18n.t('common:admin.examFields.questionType')}), {target: {value: 'mcq'}});
    for (const locale of SUPPORTED_LOCALES) {
      await changeLocale(locale);
      expect(screen.getByRole('combobox', {name: i18n.t('common:admin.examFields.questionType')})).toHaveValue('formCompletion');
      expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('exams:authoring.replaceQuestion'));
      expect(screen.getByDisplayValue('Authored form')).toBeVisible(); expect(screen.getByDisplayValue('Official answer')).toBeVisible();
      expect(screen.getByRole('spinbutton')).toHaveValue(1200);
      expect(screen.getByRole('button', {name: i18n.t('exams:authoring.keepType')})).toBeVisible();
    }
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:authoring.keepType')}));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(onChange).not.toHaveBeenCalled();
  });

  it('updates nested validation labels and answer errors without mutating content', async () => {
    const schema = QUESTION_TYPES.listening.find(definition => definition.kind === 'formCompletion')?.schema;
    expect(schema).toBeDefined(); if (!schema) return;
    const content = {formTitle: '', fields: [{id: 1200, label: '', answer: '', answers: ['Keep answer']}]}; const before = structuredClone(content);
    for (const locale of SUPPORTED_LOCALES) {
      await changeLocale(locale);
      const messages = fieldErrors(schema, content);
      expect(messages.join(' ')).toContain(i18n.t('exams:schema.formHeading'));
      expect(objectiveAnswerErrors(schema, content)).toEqual([i18n.t('exams:validation.questionContext', {number: '1,200', error: i18n.t('exams:validation.answerExclusive')})]);
      if (locale !== 'en') expect(messages.join(' ')).not.toMatch(/enter text|Form heading|Question number/);
      expect(content).toEqual(before);
    }
  });

  it('retains paragraph edits and advanced data disclosure across locales', async () => {
    function Editor() {const [raw, setRaw] = useState('["Authored paragraph"]'); return <><PassageEditor value={raw} onChange={setRaw}/><output data-testid="raw">{raw}</output></>;}
    render(<Editor/>); fireEvent.change(screen.getByDisplayValue('Authored paragraph'), {target: {value: 'Keep edited paragraph 草稿'}});
    fireEvent.click(screen.getByText(i18n.t('exams:authoring.advancedParagraphs')));
    for (const locale of SUPPORTED_LOCALES) {
      await changeLocale(locale); expect(screen.getByLabelText(i18n.t('exams:authoring.paragraphData'))).toBeVisible();
      expect(screen.getByDisplayValue('Keep edited paragraph 草稿')).toBeVisible(); expect(screen.getByTestId('raw')).toHaveTextContent('Keep edited paragraph 草稿');
    }
  });
});
