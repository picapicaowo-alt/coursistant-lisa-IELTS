import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {AssignmentDetail, SubmissionState} from '@/apis';
import {assignmentApiService} from '@/apis/services/assignment-api';
import {SubmitAssignmentDialog} from './SubmitAssignmentDialog';
import i18n from '@/i18n';
import type {TOptions} from 'i18next';

vi.mock('react-i18next', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: () => ({t: (key: string, options?: TOptions) => key.startsWith('common:files.') || key.startsWith('common:actions.') ? i18n.t(key, options) : key}),
}));

vi.mock('@/apis/services/assignment-api', () => ({
  assignmentApiService: {
    deleteStagingFile: vi.fn(),
    submitStagedFiles: vi.fn(),
    uploadStagingFiles: vi.fn(),
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

  it('keeps a retry key for the same files and changes it when the selected files change', async () => {
    vi.mocked(assignmentApiService.submitStagedFiles).mockRejectedValue(new Error('Network unavailable'));
    const props = {assignment, courseId: 34, submission, onClose: vi.fn(), onStaged: vi.fn(), onSubmitted: vi.fn()};
    const {rerender} = render(<SubmitAssignmentDialog {...props}/>);
    const submit = screen.getByRole('button', {name: 'assessment:submission.submitFiles'});
    fireEvent.click(submit);
    await screen.findByRole('alert');
    const firstKey = vi.mocked(assignmentApiService.submitStagedFiles).mock.calls[0][3];
    fireEvent.click(submit);
    await waitFor(() => expect(assignmentApiService.submitStagedFiles).toHaveBeenCalledTimes(2));
    await screen.findByRole('alert');
    expect(vi.mocked(assignmentApiService.submitStagedFiles).mock.calls[1][3]).toBe(firstKey);
    rerender(<SubmitAssignmentDialog {...props} submission={{...submission, stagingFiles: [{...submission.stagingFiles[0], id: 89}]}}/>);
    fireEvent.click(submit);
    await waitFor(() => expect(assignmentApiService.submitStagedFiles).toHaveBeenCalledTimes(3));
    expect(vi.mocked(assignmentApiService.submitStagedFiles).mock.calls[2][3]).not.toBe(firstKey);
    expect(vi.mocked(assignmentApiService.submitStagedFiles).mock.calls[2][2]).toEqual({stagingFileIds: [89]});
  });

  it('prevents changing staged files while their submission is pending', async () => {
    vi.mocked(assignmentApiService.submitStagedFiles).mockReturnValue(new Promise(() => {}));
    const {container} = render(<SubmitAssignmentDialog assignment={assignment} courseId={34} submission={submission} onClose={vi.fn()} onStaged={vi.fn()} onSubmitted={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', {name: 'assessment:submission.submitFiles'}));
    await waitFor(() => expect(assignmentApiService.submitStagedFiles).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', {name: 'Delete Testing doc.pdf'})).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('waits for a new upload and staging readback before allowing submission', async () => {
    vi.mocked(assignmentApiService.uploadStagingFiles).mockReturnValue(new Promise(() => {}));
    const {container} = render(<SubmitAssignmentDialog assignment={assignment} courseId={34} submission={submission} onClose={vi.fn()} onStaged={vi.fn()} onSubmitted={vi.fn()}/>);
    fireEvent.change(container.querySelector('input[type="file"]')!, {target: {files: [new File(['new work'], 'new.pdf', {type: 'application/pdf'})]}});
    await waitFor(() => expect(assignmentApiService.uploadStagingFiles).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', {name: 'assessment:submission.submitFiles'})).toBeDisabled();
    expect(assignmentApiService.submitStagedFiles).not.toHaveBeenCalled();
  });

  it('keeps submission blocked after a staging read failure and recovers through a read-only retry', async () => {
    vi.mocked(assignmentApiService.uploadStagingFiles).mockResolvedValue({status: 200, code: 'SUCCESS', data: [{...submission.stagingFiles[0], id: 89, originalName: 'new.pdf'}], message: '', timestamp: ''});
    let releaseRead: () => void = () => {};
    const onStaged = vi.fn().mockRejectedValueOnce(new Error('Read unavailable'))
      .mockImplementationOnce(() => new Promise<void>(resolve => {releaseRead = resolve;}));
    const {container, rerender} = render(<SubmitAssignmentDialog assignment={assignment} courseId={34} submission={submission} onClose={vi.fn()} onStaged={onStaged} onSubmitted={vi.fn()}/>);
    fireEvent.change(container.querySelector('input[type="file"]')!, {target: {files: [new File(['work'], 'new.pdf', {type: 'application/pdf'})]}});
    await screen.findByRole('alert');
    expect(screen.getByRole('button', {name: 'assessment:submission.submitFiles'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await waitFor(() => expect(onStaged).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', {name: 'assessment:submission.submitFiles'})).toBeDisabled();
    rerender(<SubmitAssignmentDialog assignment={assignment} courseId={34} submission={{...submission, stagingFiles: [...submission.stagingFiles, {...submission.stagingFiles[0], id: 89, originalName: 'new.pdf'}]}} onClose={vi.fn()} onStaged={onStaged} onSubmitted={vi.fn()}/>);
    await act(async () => {releaseRead();});
    await waitFor(() => expect(screen.getByRole('button', {name: 'assessment:submission.submitFiles'})).toBeEnabled());
    expect(assignmentApiService.uploadStagingFiles).toHaveBeenCalledOnce();
    expect(assignmentApiService.submitStagedFiles).not.toHaveBeenCalled();
  });

  it('retries only status reads after the server accepts a submission', async () => {
    vi.mocked(assignmentApiService.submitStagedFiles).mockResolvedValue({status: 200, code: 'SUCCESS', data: {...submission, stagingFiles: [], totalVersions: 2}, message: '', timestamp: ''});
    const onSubmitted = vi.fn().mockRejectedValueOnce(new Error('Read unavailable')).mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<SubmitAssignmentDialog assignment={assignment} courseId={34} submission={submission} onClose={onClose} onStaged={vi.fn()} onSubmitted={onSubmitted}/>);
    fireEvent.click(screen.getByRole('button', {name: 'assessment:submission.submitFiles'}));
    await screen.findByRole('alert');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSubmitted).toHaveBeenCalledTimes(2);
    expect(assignmentApiService.submitStagedFiles).toHaveBeenCalledOnce();
  });

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
