import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {useState} from 'react';
import {MemoryRouter} from 'react-router-dom';
import {SectionView} from '@/pages/MockExamSessionPage/runner/components/QuestionSections';
import {ListeningSectionView} from '@/pages/MockExamSessionPage/runner/components/listening/ListeningSections';
import {ExamPage} from '@/pages/MockExamSessionPage/runner/pages/ExamPage';
import {WritingExamPage} from '@/pages/MockExamSessionPage/runner/pages/WritingExamPage';
import {parseReadingDetail, parseListeningDetail, parseWritingDetail} from '@/pages/MockExamSessionPage/runner/api/runtimeData';
import {mapReadingDetail} from '@/pages/MockExamSessionPage/runner/api/mapReading';
import {getApiErrorMessage} from '@/utils/apiError';
import type {QuestionSection} from '@/pages/MockExamSessionPage/runner/data/types';
import i18n from './index';
import {SUPPORTED_LOCALES} from './configuration';

const api = vi.hoisted(() => ({ensureAttemptId: vi.fn(), submitReading: vi.fn(), submitWriting: vi.fn()}));
vi.mock('@/pages/MockExamSessionPage/runner/api/tests', () => ({ensureAttemptId: api.ensureAttemptId}));
vi.mock('@/pages/MockExamSessionPage/runner/api/readings', () => ({submitReading: api.submitReading}));
vi.mock('@/pages/MockExamSessionPage/runner/api/writings', () => ({submitWriting: api.submitWriting, writingTaskImageUrl: () => '/original-exam-image.png'}));
const tfng: QuestionSection = {kind: 'tfng', title: 'Questions 1–1', instruction: 'Choose True, False or Not Given.', questions: [{id: 1, statement: 'Libraries serve communities.'}], options: ['True', 'False', 'Not Given']};
const readingInput = {id: 77, totalMinutes: 60, passages: [{seq: 1, title: 'Original IELTS passage', intro: 'Read carefully.', paragraphs: ['Libraries serve their communities.'], questions: [{kind: 'shortAnswer', questionStart: 9, questionEnd: 9, instruction: 'Write ONE WORD ONLY.', payload: {questions: [{id: 9, prompt: 'What serves communities?', answer: 'libraries'}]}}]}]};
const writing = parseWritingDetail({totalMinutes: 60, tasks: [{seq: 3, taskKey: 'original-task-key', title: 'Writing Task 3', prompt: 'Discuss the role of public libraries.', minWords: 250, hasImage: true}]}, 77);
const cycle = async (check: () => void) => {for (const locale of SUPPORTED_LOCALES) {await act(() => i18n.changeLanguage(locale)); check();}};
beforeEach(async () => {vi.resetAllMocks(); await i18n.changeLanguage('en'); api.ensureAttemptId.mockResolvedValue(81); api.submitReading.mockRejectedValue(new Error('Opaque diagnostic')); api.submitWriting.mockRejectedValue(new Error('Opaque diagnostic'));});
afterEach(async () => {cleanup(); vi.restoreAllMocks(); await i18n.changeLanguage('en');});

it('preserves original IELTS statements, instructions, option text and answer codes in every locale', async () => {
  function Example() {const [answers, setAnswers] = useState<Record<number, string>>({}); return <SectionView section={tfng} answers={answers} currentQuestion={1} onAnswerChange={(id, value) => setAnswers(previous => ({...previous, [id]: value}))} onSelectQuestion={() => undefined}/>;}
  const before = structuredClone(tfng); render(<Example/>); fireEvent.click(screen.getByRole('radio', {name: 'True'}));
  await cycle(() => {
    expect(screen.getByRole('heading', {name: 'Questions 1–1'})).toBeVisible(); expect(screen.getByText('Choose True, False or Not Given.')).toBeVisible(); expect(screen.getByText(/if the statement agrees with the information/)).toBeVisible();
    expect(screen.getByText(/Libraries serve communities/)).toBeVisible(); expect(screen.getByRole('radiogroup', {name: i18n.t('common:records.question', {number: '1'})})).toBeVisible();
    expect(screen.getByRole('radio', {name: 'True'})).toBeChecked(); expect(screen.getByRole('radio', {name: 'True'})).toHaveAttribute('value', 'True');
  }); expect(tfng).toEqual(before);
});

it('localizes diagram answer controls without replacing authored image bytes, descriptions or listening answers', async () => {
  const onAnswerChange = vi.fn(); render(<ListeningSectionView section={{kind: 'planMap', title: 'Questions 11–11', instruction: 'Label the map.', questionStart: 11, questionEnd: 11, caption: 'The original map', imageSrc: '/original-exam-image.png', imageAlt: 'Original map text', labels: [{id: 11, prompt: 'Library'}]}} answers={{11: 'A'}} currentQuestion={11} onAnswerChange={onAnswerChange} onSelectQuestion={() => undefined}/>);
  await cycle(() => {expect(screen.getByRole('heading', {name: i18n.t('exams:runner.answerArea')})).toBeVisible(); expect(screen.getByRole('img', {name: 'Original map text'})).toHaveAttribute('src', '/original-exam-image.png'); expect(screen.getByRole('textbox', {name: i18n.t('common:records.question', {number: '11'})})).toHaveValue('A'); expect(screen.getByText('Label the map.')).toBeVisible();});
  expect(onAnswerChange).not.toHaveBeenCalled();
});

it('keeps reading answers and note drafts through translated exit confirmation and failed submission', async () => {
  const onExit = vi.fn(); render(<MemoryRouter><ExamPage reading={mapReadingDetail(parseReadingDetail(readingInput, 77))} testId={77} testTitle="Authored paper" candidateLabel="Original candidate" onExit={onExit}/></MemoryRouter>);
  fireEvent.change(screen.getByRole('textbox', {name: i18n.t('common:records.question', {number: '9'})}), {target: {value: 'libraries'}});
  fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:schema.notes')})); fireEvent.change(screen.getByRole('textbox', {name: i18n.t('exams:schema.notes')}), {target: {value: 'Original note draft'}});
  fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:runner.exit')}));
  await cycle(() => {expect(screen.getByRole('dialog', {name: i18n.t('exams:runner.exit')})).toHaveTextContent(i18n.t('exams:runner.exitConfirm'));});
  fireEvent.click(screen.getByRole('button', {name: i18n.t('common:actions.cancel')})); expect(onExit).not.toHaveBeenCalled();
  await cycle(() => {expect(screen.getByRole('textbox', {name: i18n.t('common:records.question', {number: '9'})})).toHaveValue('libraries'); expect(screen.getByRole('textbox', {name: i18n.t('exams:schema.notes')})).toHaveValue('Original note draft');});
  fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:runner.finishSection')})); fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:runner.submitSection')})); await screen.findByRole('alert');
  await cycle(() => {expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('exams:submission.failed')); expect(screen.queryByText('Opaque diagnostic')).not.toBeInTheDocument();});
  expect(api.submitReading).toHaveBeenCalledWith(77, {attemptId: 81, answers: {'9': 'libraries'}});
});

it('retains writing content, task identity and original prompt through submission retries and language changes', async () => {
  render(<MemoryRouter><WritingExamPage writing={writing} testId={77} testTitle="Original IELTS paper" candidateLabel="Original candidate" onExit={() => undefined}/></MemoryRouter>);
  fireEvent.change(screen.getByRole('textbox', {name: i18n.t('exams:runner.writingAnswer')}), {target: {value: 'Libraries are important to the community.'}});
  await cycle(() => {expect(screen.getByRole('textbox', {name: i18n.t('exams:runner.writingAnswer')})).toHaveValue('Libraries are important to the community.'); expect(screen.getByText('Discuss the role of public libraries.')).toBeVisible(); expect(screen.getByRole('img')).toHaveAttribute('src', '/original-exam-image.png'); expect(screen.getByText(`${i18n.t('common:status.WRITING')} · ${i18n.t('assessment:attempt.duration', {count: 60, number: '60'})}`)).toBeVisible();});
  fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:runner.finishSection')})); fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:runner.submitSection')})); await screen.findByRole('alert');
  await cycle(() => expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('exams:submission.failed')));
  fireEvent.click(screen.getByRole('button', {name: i18n.t('exams:runner.submitSection')}));
  await act(async () => {}); expect(api.submitWriting).toHaveBeenCalledTimes(2); expect(api.submitWriting.mock.calls[1]).toEqual(api.submitWriting.mock.calls[0]);
  expect(api.submitWriting.mock.calls[0]).toEqual([77, {attemptId: 81, tasks: [{taskKey: 'original-task-key', content: 'Libraries are important to the community.'}]}]);
  expect(within(screen.getByRole('dialog')).queryByText('Opaque diagnostic')).not.toBeInTheDocument();
});

it('parses the exact same original paper in every locale and resolves retained validation errors at render time', async () => {
  const original = structuredClone(readingInput), expected = parseReadingDetail(readingInput, 77);
  const listeningInput = {totalMinutes: 30, parts: [{seq: 3, sections: [{kind: 'notesCompletion', questionStart: 8, questionEnd: 8, instruction: 'Write ONE WORD.', payload: {blanks: [{id: 8, before: 'Original', after: 'prompt', answer: 'source'}]}}]}]};
  const listeningExpected = parseListeningDetail(listeningInput, 77); let failure: unknown;
  try {parseReadingDetail({passages: [{questions: []}]}, 77);} catch (error) {failure = error;}
  for (const locale of SUPPORTED_LOCALES) {
    await i18n.changeLanguage(locale); expect(parseReadingDetail(readingInput, 77)).toEqual(expected); expect(parseListeningDetail(listeningInput, 77)).toEqual(listeningExpected);
    expect(getApiErrorMessage(failure, '')).toBe(i18n.t('exams:session.invalidTiming'));
  }
  expect(readingInput).toEqual(original); expect(expected.passages[0].shortLabel).toBe('Passage 1'); expect(listeningExpected.parts[0].label).toBe('Part 3');
});
