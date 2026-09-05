import type {StudentMockExamDetail} from '@/apis';

export type MockExamSection = 'listening' | 'reading' | 'writing';

/** A section can be submitted while the other selected sections remain open. */
export function isSectionSubmitted(exam: StudentMockExamDetail, section: MockExamSection): boolean {
  if (exam.status === 'COMPLETED' || exam.attempt?.status === 'SUBMITTED') return true;
  if (section === 'reading') return typeof exam.readingCorrect === 'number';
  if (section === 'listening') return typeof exam.listeningCorrect === 'number';
  return Boolean(exam.writingTasks?.length) || typeof exam.writingScore === 'number'
    || exam.writingGradeStatus === 'PENDING' || exam.writingGradeStatus === 'GRADED';
}
