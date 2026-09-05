/** Exact reviewed exceptions, never a blanket exemption for an exam component. */
export const copyExceptions = [
  {file: 'src/layouts/Sidebar.tsx', text: 'X—LEARN', reason: 'Product wordmark'},
  {file: 'src/components/AuthShell/index.tsx', text: 'X-Learn', reason: 'Product wordmark'},
  {file: 'src/pages/LmsHomePage/components/Dashboard.tsx', text: 'IELTS', reason: 'Official examination name'},
  {file: 'src/pages/CourseWorkspacePage/components/SyllabusCard.tsx', text: 'PDF', reason: 'Standard file-format symbol'},
  {file: 'src/pages/QuizEditorPage/index.tsx', text: 'True', reason: 'Canonical serialized quiz answer, separate from its UI label'},
  {file: 'src/pages/QuizEditorPage/index.tsx', text: 'False', reason: 'Canonical serialized quiz answer, separate from its UI label'},
  {file: 'src/pages/MockExamSessionPage/runner/components/QuestionSections.tsx', text: 'Word bank', reason: 'Original IELTS paper instruction; must not translate'},
  {file: 'src/pages/MockExamSessionPage/runner/components/QuestionSections.tsx', text: 'Paragraph', reason: 'Original IELTS paper prompt; must not translate'},
  {file: 'src/pages/MockExamSessionPage/runner/pages/ListeningExamPage.tsx', text: 'Listen and answer questions', reason: 'Original IELTS paper direction; must not translate'},
  {file: 'src/pages/MockExamsPage/tenant/readingJson.ts', text: 'Example passage', reason: 'English sample examination content, not platform controls'},
  {file: 'src/pages/MockExamsPage/tenant/readingJson.ts', text: 'Questions 1–1', reason: 'English sample examination content, not platform controls'},
] as const;

export const visibleCopyAttributes = new Set([
  'placeholder', 'title', 'subtitle', 'aria-label', 'ariaLabel', 'alt', 'label',
  'description', 'detail', 'hint', 'emptyMessage', 'actionLabel', 'summary',
  'triggerLabel', 'data-label', 'data-tooltip', 'helperText', 'tooltip',
  'loadingText', 'emptyText', 'confirmLabel', 'cancelLabel', 'secondary',
  'eyebrow', 'warningText', 'panelName', 'successMessage', 'errorMessage',
]);

export function isReviewedCopy(candidate: {file: string; text: string}): boolean {
  return copyExceptions.some(exception => exception.file === candidate.file && exception.text === candidate.text);
}
