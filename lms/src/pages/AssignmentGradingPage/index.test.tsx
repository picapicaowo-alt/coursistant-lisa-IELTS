import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@testing-library/jest-dom';
import type {GradingRosterItem, SubmissionVersion} from '@/apis';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {GradeDialog} from './index';

vi.mock('@/apis/services/assignment-api', () => ({
  assignmentApiService: {
    listSubmissionVersions: vi.fn(),
    downloadSubmissionFile: vi.fn(),
    previewSubmissionFile: vi.fn(),
    getStudentGradingView: vi.fn(),
    getGroupGradingView: vi.fn(),
  },
}));

const row: GradingRosterItem = {
  studentUserId: 389,
  studentName: 'Eden Brooks',
  studentEmail: 'regtest5@example.com',
  submissionStatus: 'Submitted',
  submissionId: 30,
  submissionVersionId: 37,
  versionNo: 1,
  submittedAt: '2026-08-18T10:34:30Z',
  fileCount: 1,
  gradeStatus: 'Ungraded',
};

const versions: SubmissionVersion[] = [{
  id: 37,
  submissionId: 30,
  assignmentId: 48,
  ownerUserId: 389,
  versionNo: 1,
  submittedAt: '2026-08-18T10:34:30Z',
  usedGraceBuffer: false,
  submissionStatus: 'Submitted',
  fileCount: 1,
  files: [{
    id: 46,
    submissionVersionId: 37,
    originalName: 'regtest5-postgresql-setup-report.pdf',
    contentType: 'application/pdf',
    sizeBytes: 2180,
    checksumSha256: 'checksum',
    sortOrder: 0,
    previewAvailable: true,
    downloadUrl: '/download',
    previewUrl: '/preview',
    createdAt: '2026-08-18T10:34:30Z',
  }],
}];

const response = <T,>(data: T) => ({
  status: 200,
  code: 'SUCCESS',
  message: 'Success',
  timestamp: '2026-08-18T12:00:00Z',
  data,
});

describe('GradeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assignmentApiService.listSubmissionVersions).mockResolvedValue(response(versions));
    vi.mocked(assignmentApiService.getStudentGradingView).mockResolvedValue(response({
      assignmentId: 48,
      grade: {id: 1, assignmentId: 48, studentUserId: 389, score: 16, feedbackHtml: '<p>Clearer thesis.</p>', status: 'Entered'},
    }));
  });

  it('shows structured learner names and submission files before grading', async () => {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(
      <QueryClientProvider client={queryClient}>
        <GradeDialog
          courseId={34}
          assignmentId={48}
          row={{...row, studentName: undefined, studentFirstName: 'Eden', studentMiddleName: 'J', studentLastName: 'Brooks'}}
          pointsPossible={20}
          isSaving={false}
          error={null}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', {name: 'Eden J Brooks'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Submitted files'})).toBeInTheDocument();
    await waitFor(() => {
      expect(assignmentApiService.listSubmissionVersions).toHaveBeenCalledWith(34, 48, 30);
      expect(screen.getByText('regtest5-postgresql-setup-report.pdf')).toBeInTheDocument();
    });
  });

  it('prefills existing feedback from the grading view', async () => {
    const gradedRow: GradingRosterItem = {...row, gradeStatus: 'Entered', score: 16};
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(
      <QueryClientProvider client={queryClient}>
        <GradeDialog
          courseId={34}
          assignmentId={48}
          row={gradedRow}
          pointsPossible={20}
          isSaving={false}
          error={null}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(assignmentApiService.getStudentGradingView).toHaveBeenCalledWith(34, 48, 389);
      expect(screen.getByLabelText('Feedback for the learner')).toHaveTextContent('Clearer thesis.');
    });
  });

  it('shows a prominent upload action and lets the grader clear a selected file', () => {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(
      <QueryClientProvider client={queryClient}>
        <GradeDialog
          courseId={34}
          assignmentId={48}
          row={row}
          pointsPossible={20}
          isSaving={false}
          error={null}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      </QueryClientProvider>
    );

    expect(screen.getByRole('button', {name: /upload annotated file/i})).toBeInTheDocument();
    const file = new File(['marked feedback'], 'Eden-feedback.pdf', {type: 'application/pdf'});
    fireEvent.change(screen.getByLabelText('Choose annotated feedback file'), {target: {files: [file]}});

    expect(screen.getByText('Eden-feedback.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Remove selected file Eden-feedback.pdf'}));
    expect(screen.queryByText('Eden-feedback.pdf')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: /upload annotated file/i})).toBeInTheDocument();
  });

  it('offers replacement without presenting an unsupported saved-file delete action', () => {
    const gradedRow: GradingRosterItem = {...row, gradeStatus: 'Entered', score: 16, hasAnnotatedFile: true};
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    render(
      <QueryClientProvider client={queryClient}>
        <GradeDialog
          courseId={34}
          assignmentId={48}
          row={gradedRow}
          pointsPossible={20}
          isSaving={false}
          error={null}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Current annotated feedback file')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Replace'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Delete'})).not.toBeInTheDocument();
  });
});
