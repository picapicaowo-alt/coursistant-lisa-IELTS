import {act, render, screen} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import i18n from '@/i18n';
import {SUPPORTED_LOCALES} from '@/i18n/configuration';
import {ExamRecordSummary} from './ExamRecordSummary';

afterEach(async () => {await act(() => i18n.changeLanguage('en'));});

it('localizes exam metadata across locales while preserving questions and answers', async () => {
  const value = {kind: 'tfng', taskKey: 'custom-writing', seq: 3, sortOrder: 7,
    payload: {statement: 'tfng', answer: 'TRUE'}};
  const original = JSON.stringify(value);
  render(<ExamRecordSummary value={value}/>);
  for (const locale of SUPPORTED_LOCALES) {
    await act(() => i18n.changeLanguage(locale));
    expect(screen.getByText(i18n.t('exams:records.questionType'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('exams:schema.tfng'))).toBeInTheDocument();
    expect(screen.getByText('tfng')).toBeInTheDocument();
    expect(screen.getByText('TRUE')).toBeInTheDocument();
    expect(screen.getByText('custom-writing')).toBeInTheDocument();
    expect(JSON.stringify(value)).toBe(original);
  }
});
