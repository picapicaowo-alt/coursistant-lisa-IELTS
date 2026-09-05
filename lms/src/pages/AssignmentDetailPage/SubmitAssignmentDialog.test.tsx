import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {AssignmentDetail, SubmissionState} from '@/apis';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {SubmitAssignmentDialog} from './SubmitAssignmentDialog';

vi.mock('react-i18next', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: () => ({t: (key: string) => key}),
}));

vi.mock('@/apis/services/assignment-api', () => ({
  assignmentApiService: {
    deleteStagingFile: vi.fn(),
  },
}));

const assignment = {
  id: 48,
  allowedFileTypes: ['pdf'],
  attachments: [],
} as unknown as AssignmentDetail;

const submission = {
  assignmentId: 48,
  ownerUserId: 389,
  submissionStatus: 'Submitted',
  dueAtUtc: '2026-08-22T23:59:00Z',
  dueAtLocal: '2026-08-22T23:59:00',
  timezone: 'America/Los_Angeles',
  windowOpen: true,
  acceptingSubmissions: true,
  graceWindowActive: false,
  submitFrozen: false,
  totalVersions: 1,
  stagingFiles: [{
    id: 88,
    assignmentId: 48,
    originalName: 'Testing doc.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    checksumSha256: 'checksum',
    createdAt: '2026-08-18T12:00:00Z',
    expiresAt: '2026-08-19T12:00:00Z',
  }],
} as SubmissionState;

describe('SubmitAssignmentDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a staged upload and refreshes the submission state', async () => {
    vi.mocked(assignmentApiService.deleteStagingFile).mockResolvedValue({
      status: 200,
      code: 'SUCCESS',
      data: null,
      message: 'Success',
      timestamp: '2026-08-18T12:00:00Z',
    });
    const onStaged = vi.fn().mockResolvedValue(undefined);

    render(
      <SubmitAssignmentDialog
        assignment={assignment}
        courseId={34}
        submission={submission}
        onClose={vi.fn()}
        onStaged={onStaged}
        onSubmitted={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', {name: 'Delete Testing doc.pdf'}));

    await waitFor(() => {
      expect(assignmentApiService.deleteStagingFile).toHaveBeenCalledWith(34, 48, 88);
      expect(onStaged).toHaveBeenCalledOnce();
    });
  });
});
