import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@testing-library/jest-dom';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import type {AssignmentDetail} from '@/apis';

const api = vi.hoisted(() => ({
  createAssignment: vi.fn(),
  patchAssignment: vi.fn(),
  previewDueDateChange: vi.fn(),
  uploadAttachments: vi.fn(),
  publishAssignment: vi.fn(),
}));
const courseApi = vi.hoisted(() => ({listGroupSets: vi.fn(), getCourseWeeks: vi.fn()}));

vi.mock('@/apis/services/assignment-api', () => ({assignmentApiService: api}));
vi.mock('@/apis/services/course-api', () => ({courseApiService: courseApi}));
vi.mock('@/components/RichTextEditor', () => ({
  RichTextEditor: ({
    content,
    onChange,
    ariaLabel,
  }: {
    content?: string;
    onChange?: (value: string) => void;
    ariaLabel?: string;
  }) => (
    <textarea
      aria-label={ariaLabel || 'Assignment description'}
      value={content}
      onChange={event => onChange?.(event.target.value)}
    />
  ),
}));

import {AssignmentEditorForm} from './index';

const draft: AssignmentDetail = {
  id: 88,
  courseId: 31,
  weekId: 8, learningType: 'HOMEWORK',
  title: 'Recovery assignment',
  description: '',
  pointsPossible: 100,
  dueAtLocal: '2026-08-30T10:00:00',
  dueAtUtc: '2026-08-30T17:00:00Z',
  timezone: 'America/Los_Angeles',
  submissionType: 'Individual',
  allowedFileTypes: ['pdf'],
  maxFileCount: 3,
  maxFileSizeBytes: 10 * 1024 * 1024,
  state: 'Draft',
  attachments: [],
  version: 3,
  createdAt: '2026-08-20T00:00:00Z',
  updatedAt: '2026-08-20T00:00:00Z',
};

const response = <T,>(data: T) => ({
  status: 200,
  code: 'SUCCESS',
  message: 'OK',
  timestamp: '2026-08-17T00:00:00Z',
  data,
});

const renderEditor = (assignment?: typeof draft) => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AssignmentEditorForm courseId={31} assignment={assignment}/>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const fillRequiredFields = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Assignment name'), 'Recovery assignment');
  fireEvent.change(screen.getByLabelText('Due time'), {target: {value: '2026-08-30T10:00'}});
  await user.selectOptions(await screen.findByLabelText('Lecture'), '8');
  await user.selectOptions(screen.getByLabelText('Learning category'), 'HOMEWORK');
  return user;
};

describe('AssignmentEditorForm recovery workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    courseApi.getCourseWeeks.mockResolvedValue(response([{id: 8, title: 'Argument structure'}]));
    api.createAssignment.mockResolvedValue(response(draft));
    api.patchAssignment.mockResolvedValue(response(draft));
    api.previewDueDateChange.mockResolvedValue(response({
      currentDueAt: '2026-08-30T10:00:00',
      newDueAt: '2026-08-30T10:00:00',
      timezone: 'America/Los_Angeles',
      shortening: false,
      confirmationRequired: false,
      activeStudentCount: 0,
      submittedCount: 0,
      notSubmittedCount: 0,
      submissionsBecomingLateCount: 0,
      gradedCount: 0,
    }));
    api.publishAssignment.mockResolvedValue(response({...draft, state: 'Published'}));
    courseApi.listGroupSets.mockResolvedValue(response([
      {
        id: 9,
        courseId: 31,
        name: 'Project teams',
        defaultCapacity: 4,
        joinOpensAtLocal: null,
        joinClosesAtLocal: null,
        timezone: 'America/Los_Angeles',
        locked: false,
        openForSelfService: true,
        myGroup: null,
        groups: [{id: 91}, {id: 92}],
      },
    ]));
  });

  it('retries attachment failure against the already-created draft', async () => {
    renderEditor();
    const user = await fillRequiredFields();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(['brief'], 'brief.pdf', {type: 'application/pdf'}));
    api.uploadAttachments
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(response([{id: 501, originalName: 'brief.pdf', sizeBytes: 5}]));

    await user.click(screen.getByRole('button', {name: 'Publish'}));

    expect(await screen.findByText('Draft #88 is already saved.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Retry will continue this same assignment');
    expect(api.createAssignment).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', {name: 'Publish'}));

    await waitFor(() => expect(api.publishAssignment).toHaveBeenCalledTimes(1));
    expect(api.createAssignment).toHaveBeenCalledTimes(1);
    expect(api.patchAssignment).toHaveBeenCalledTimes(1);
    expect(api.patchAssignment).toHaveBeenCalledWith(
      31,
      88,
      expect.objectContaining({expectedVersion: 3}),
      expect.any(String),
    );
  });

  it('does not upload successful attachments again when publish is retried', async () => {
    renderEditor();
    const user = await fillRequiredFields();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(['brief'], 'brief.pdf', {type: 'application/pdf'}));
    api.uploadAttachments.mockResolvedValue(response([{id: 501, originalName: 'brief.pdf', sizeBytes: 5}]));
    api.publishAssignment
      .mockRejectedValueOnce(new Error('publish unavailable'))
      .mockResolvedValueOnce(response({...draft, state: 'Published'}));

    await user.click(screen.getByRole('button', {name: 'Publish'}));

    expect(await screen.findByText('Draft #88 is already saved.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('publishing failed');

    await user.click(screen.getByRole('button', {name: 'Publish'}));

    await waitFor(() => expect(api.publishAssignment).toHaveBeenCalledTimes(2));
    expect(api.uploadAttachments).toHaveBeenCalledTimes(1);
    expect(api.createAssignment).toHaveBeenCalledTimes(1);
    expect(api.patchAssignment).toHaveBeenCalledTimes(1);
  });

  it('uses a named group-set selector for group assignments', async () => {
    renderEditor();
    const user = await fillRequiredFields();

    await user.selectOptions(screen.getByLabelText('Submission type'), 'Group');
    await screen.findByRole('option', {name: 'Project teams (2 groups)'});
    await user.selectOptions(screen.getByLabelText('Group set'), '9');
    await user.click(screen.getByRole('button', {name: 'Publish'}));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await waitFor(() => expect(api.createAssignment).toHaveBeenCalledWith(
      31,
      expect.objectContaining({submissionType: 'Group', groupSetId: 9}),
      expect.any(String),
    ));
  });

  it('reuses the create key when an unchanged assignment is retried after a timeout', async () => {
    api.createAssignment.mockReset();
    api.createAssignment
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(response(draft));
    renderEditor();
    await fillRequiredFields();

    fireEvent.submit(screen.getByRole('button', {name: 'Save draft'}).closest('form')!);
    await waitFor(() => expect(api.createAssignment).toHaveBeenCalledTimes(1));
    await screen.findByText('The assignment could not be created. Your form values are still here.');
    fireEvent.submit(screen.getByRole('button', {name: 'Save draft'}).closest('form')!);

    await waitFor(() => expect(api.createAssignment).toHaveBeenCalledTimes(2));
    expect(api.createAssignment.mock.calls[0][2]).toBe(api.createAssignment.mock.calls[1][2]);
  });

  it('creates with a course-local whole-second deadline and no UTC conversion', async () => {
    renderEditor();
    await fillRequiredFields();

    fireEvent.submit(screen.getByRole('button', {name: 'Save draft'}).closest('form')!);

    await waitFor(() => expect(api.createAssignment).toHaveBeenCalledWith(
      31,
      expect.objectContaining({weekId: 8, learningType: 'HOMEWORK', dueAt: '2026-08-30T10:00:00'}),
      expect.any(String),
    ));
    const request = api.createAssignment.mock.calls[0][1];
    expect(request.dueAt).not.toMatch(/[Z.+-]\d{2}:?\d{2}$|\.\d+$/);
  });

  it('previews and patches changed deadlines in the same course-local coordinate', async () => {
    renderEditor(draft);
    fireEvent.change(screen.getByLabelText('Due time'), {target: {value: '09/20/2026, 11:59 PM'}});

    fireEvent.submit(screen.getByRole('button', {name: 'Save changes'}).closest('form')!);

    await waitFor(() => expect(api.previewDueDateChange).toHaveBeenCalledWith(
      31,
      88,
      {dueAt: '2026-09-20T23:59:00'},
    ));
    expect(api.patchAssignment).toHaveBeenCalledWith(
      31,
      88,
      expect.objectContaining({dueAt: '2026-09-20T23:59:00', expectedVersion: 3}),
      expect.any(String),
    );
  });
  it('sends only changed fields for a structurally locked assignment', async () => {
    renderEditor({...draft, canEditStructure: false});
    const user = userEvent.setup();
    expect(screen.getByLabelText('Submission type')).toBeDisabled();
    await user.clear(screen.getByLabelText('Assignment name'));
    await user.type(screen.getByLabelText('Assignment name'), 'Updated instructions');
    fireEvent.submit(screen.getByRole('button', {name: 'Save changes'}).closest('form')!);
    await waitFor(() => expect(api.patchAssignment).toHaveBeenCalled());
    const request = api.patchAssignment.mock.calls[0][2];
    expect(request).toMatchObject({title: 'Updated instructions', expectedVersion: 3});
    expect(request).not.toHaveProperty('submissionType');
    expect(request).not.toHaveProperty('weekId');
    expect(request).not.toHaveProperty('learningType');
  });

});
