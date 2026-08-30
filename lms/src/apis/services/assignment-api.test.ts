import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AssignmentApiService} from './assignment-api';
import type {V2ApiClient} from '@/apis';

const binaryClient = {get: vi.fn()};
const client = {
  getClient: vi.fn(() => binaryClient),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

const service = new AssignmentApiService(client as unknown as typeof V2ApiClient);

describe('AssignmentApiService 8081 routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads an assignment inside its course scope', async () => {
    client.get.mockResolvedValue({status: 200, data: {id: 9}});

    await service.getAssignment(4, 9);

    expect(client.get).toHaveBeenCalledWith('/v2/courses/4/assignments/9');
  });

  it('loads the full assignment collection and attachment manifest', async () => {
    client.get.mockResolvedValue({status: 200, data: []});

    await service.listAssignments(4);
    await service.listAssignmentAttachmentManifest(4);

    expect(client.get).toHaveBeenNthCalledWith(1, '/v2/courses/4/assignments');
    expect(client.get).toHaveBeenNthCalledWith(2, '/v2/courses/4/assignment-attachments');
  });

  it('loads the current student released-grade feed for dashboard averages', async () => {
    client.get.mockResolvedValue({status: 200, data: []});
    await service.listMyGrades(4);
    expect(client.get).toHaveBeenCalledWith('/v2/courses/4/my-grades');
  });

  it('patches an assignment with PATCH rather than a legacy edit POST', async () => {
    const payload = {title: 'Revised assignment', expectedVersion: 3};
    client.patch.mockResolvedValue({status: 200, data: {id: 9}});

    await service.patchAssignment(4, 9, payload);

    expect(client.patch).toHaveBeenCalledWith(
      '/v2/courses/4/assignments/9',
      payload,
      expect.objectContaining({headers: expect.objectContaining({'Idempotency-Key': expect.any(String)})}),
    );
  });

  it('uploads submission files to staging before hand-in', async () => {
    const file = new File(['answer'], 'answer.pdf', {type: 'application/pdf'});
    client.post.mockResolvedValue({status: 200, data: [{id: 101}]});

    await service.uploadStagingFiles(4, 9, [file]);

    const [url, body] = client.post.mock.calls[0];
    expect(url).toBe('/v2/courses/4/assignments/9/submission-staging-files');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).getAll('files')).toEqual([file]);
  });

  it('lists staged files even before a formal submission exists', async () => {
    client.get.mockResolvedValue({status: 200, data: []});

    await service.listStagingFiles(4, 9);

    expect(client.get).toHaveBeenCalledWith(
      '/v2/courses/4/assignments/9/submission-staging-files'
    );
  });

  it('submits staged files through the idempotent submissions endpoint', async () => {
    const payload = {stagingFileIds: [101, 102]};
    client.post.mockResolvedValue({status: 200, data: {submissionId: 20}});

    await service.submitStagedFiles(4, 9, payload, 'submit-attempt-1');

    expect(client.post).toHaveBeenCalledWith(
      '/v2/courses/4/assignments/9/submissions',
      payload,
      {headers: {'Idempotency-Key': 'submit-attempt-1'}}
    );
  });

  it('uses DELETE for staged and instructor attachment removal', async () => {
    client.delete.mockResolvedValue({status: 200, data: null});

    await service.deleteStagingFile(4, 9, 101);
    await service.deleteAttachment(4, 9, 33);

    expect(client.delete).toHaveBeenNthCalledWith(
      1,
      '/v2/courses/4/assignments/9/submission-staging-files/101'
    );
    expect(client.delete).toHaveBeenNthCalledWith(
      2,
      '/v2/courses/4/assignments/9/attachments/33',
      expect.objectContaining({headers: expect.objectContaining({'Idempotency-Key': expect.any(String)})}),
    );
  });

  it('loads instructor attachment preview and download bytes through the authenticated client', async () => {
    const blob = new Blob(['brief'], {type: 'application/pdf'});
    binaryClient.get.mockResolvedValue({data: blob});

    await expect(service.previewAttachment(4, 9, 33)).resolves.toBe(blob);
    await expect(service.downloadAttachment(4, 9, 33)).resolves.toBe(blob);
    expect(binaryClient.get.mock.calls.map(call => call[0])).toEqual([
      '/v2/courses/4/assignments/9/attachments/33/preview',
      '/v2/courses/4/assignments/9/attachments/33/download',
    ]);
  });

  it('publishes through the assignment lifecycle endpoint', async () => {
    client.post.mockResolvedValue({status: 200, data: {id: 9, state: 'Published'}});

    await service.publishAssignment(4, 9);

    expect(client.post).toHaveBeenCalledWith(
      '/v2/courses/4/assignments/9/publish',
      undefined,
      expect.objectContaining({headers: expect.objectContaining({'Idempotency-Key': expect.any(String)})}),
    );
  });

  it('loads the instructor grading roster in the assignment course scope', async () => {
    client.get.mockResolvedValue({status: 200, data: {assignmentId: 9, items: []}});

    await service.getGradingRoster(4, 9);

    expect(client.get).toHaveBeenCalledWith('/v2/courses/4/assignments/9/grading-roster');
  });

  it('loads a notification-targeted submission history and authenticated file bytes', async () => {
    client.get.mockResolvedValue({status: 200, data: []});
    const blob = new Blob(['submission'], {type: 'application/pdf'});
    binaryClient.get.mockResolvedValue({data: blob});

    await service.listSubmissionVersions(4, 9, 21);
    await expect(service.previewSubmissionFile(4, 9, 21, 31)).resolves.toBe(blob);

    expect(client.get).toHaveBeenCalledWith('/v2/courses/4/assignments/9/submissions/21/versions');
    expect(binaryClient.get).toHaveBeenCalledWith(
      '/v2/courses/4/assignments/9/submissions/21/files/31/preview',
      {responseType: 'blob'},
    );
  });

  it('upserts an individual grade with PUT', async () => {
    const payload = {score: 92, submissionVersionId: 30};
    client.put.mockResolvedValue({status: 200, data: {id: 2, score: 92}});

    await service.upsertStudentGrade(4, 9, 385, payload);

    expect(client.put).toHaveBeenCalledWith(
      '/v2/courses/4/assignments/9/students/385/grade',
      payload
    );
  });

  it('releases every entered grade through the idempotent backend operation', async () => {
    client.post.mockResolvedValue({status: 200, data: {assignmentId: 9}});

    await service.releaseAllGrades(4, 9, 'release-all-1');

    expect(client.post).toHaveBeenCalledWith(
      '/v2/courses/4/assignments/9/grades/release-all',
      undefined,
      {headers: {'Idempotency-Key': 'release-all-1'}},
    );
  });

  it('sends retry-stable idempotency keys for selected grade release and retract', async () => {
    const selection = {studentUserIds: [385]};
    client.post.mockResolvedValue({status: 200, data: {changedCount: 1}});

    await service.releaseGrades(4, 9, selection, 'release-selected-1');
    await service.retractGrades(4, 9, selection, 'retract-selected-1');

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/v2/courses/4/assignments/9/grades/release',
      selection,
      {headers: {'Idempotency-Key': 'release-selected-1'}},
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/v2/courses/4/assignments/9/grades/retract',
      selection,
      {headers: {'Idempotency-Key': 'retract-selected-1'}},
    );
  });

  it('covers assignment deletion, unpublish, and due-date impact preview', async () => {
    client.post.mockResolvedValue({status: 200, data: {}});
    client.delete.mockResolvedValue({status: 200, data: null});
    const preview = {dueAt: '2026-09-01T10:00', clearLateUntil: true};
    await service.unpublishAssignment(4, 9);
    await service.previewDueDateChange(4, 9, preview);
    await service.deleteAssignment(4, 9);
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/v2/courses/4/assignments/9/unpublish',
      undefined,
      expect.objectContaining({headers: expect.objectContaining({'Idempotency-Key': expect.any(String)})}),
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/v2/courses/4/assignments/9/due-date-change-preview',
      {dueAt: '2026-09-01T10:00:00', clearLateUntil: true},
    );
    expect(client.delete).toHaveBeenCalledWith(
      '/v2/courses/4/assignments/9',
      expect.objectContaining({headers: expect.objectContaining({'Idempotency-Key': expect.any(String)})}),
    );
  });

  it('sends assignment deadlines as normalized course-local wall-clock values', async () => {
    client.post.mockResolvedValue({status: 200, data: {id: 9}});

    await service.createAssignment(4, {
      title: 'Local deadline',
      dueAt: '2026-09-20T23:59',
      lateUntil: '2026-09-22T23:59:00',
    }, 'create-local-deadline');

    expect(client.post).toHaveBeenCalledWith(
      '/v2/courses/4/assignments',
      {
        title: 'Local deadline',
        dueAt: '2026-09-20T23:59:00',
        lateUntil: '2026-09-22T23:59:00',
      },
      {headers: {'Idempotency-Key': 'create-local-deadline'}},
    );
  });

  it.each([
    '2026-09-21T06:59:00Z',
    '2026-09-20T23:59:00-07:00',
    '2026-09-20T23:59:00.123',
    '2026-02-29T23:59:00',
  ])('does not send an invalid assignment deadline: %s', async dueAt => {
    await expect(service.createAssignment(4, {title: 'Invalid deadline', dueAt})).rejects.toThrow(
      'dueAt must be a valid course-local date-time',
    );
    expect(client.post).not.toHaveBeenCalled();
  });

  it('does not patch an assignment without expectedVersion', async () => {
    await expect(service.patchAssignment(
      4,
      9,
      {title: 'Missing version'} as {title: string; expectedVersion: number},
    )).rejects.toThrow('expectedVersion is required');
    expect(client.patch).not.toHaveBeenCalled();
  });

  it('uploads, previews, downloads, and restores versioned rubric files', async () => {
    const file = new File(['rubric'], 'rubric.pdf', {type: 'application/pdf'});
    const blob = new Blob(['rubric'], {type: 'application/pdf'});
    client.post.mockResolvedValue({status: 200, data: {posted: true}});
    binaryClient.get.mockResolvedValue({data: blob});
    await service.uploadRubric(4, 9, file, true);
    await expect(service.previewRubric(4, 9)).resolves.toBe(blob);
    await expect(service.downloadRubric(4, 9)).resolves.toBe(blob);
    await service.restorePreviousRubric(4, 9, true);
    const upload = client.post.mock.calls[0];
    expect(upload[0]).toBe('/v2/courses/4/assignments/9/rubric');
    expect((upload[1] as FormData).get('file')).toBe(file);
    expect(upload[2]).toEqual({params: {confirmReplaceAfterGrading: true}});
    expect(binaryClient.get.mock.calls.map(call => call[0])).toEqual([
      '/v2/courses/4/assignments/9/rubric/preview',
      '/v2/courses/4/assignments/9/rubric/download',
    ]);
    expect(client.post).toHaveBeenNthCalledWith(2, '/v2/courses/4/assignments/9/rubric/restore-previous', undefined, {params: {confirmReplaceAfterGrading: true}});
  });

  it('uses the existing student and group annotated-file upload and download routes', async () => {
    const file = new File(['feedback'], 'feedback.pdf', {type: 'application/pdf'});
    const blob = new Blob(['feedback'], {type: 'application/pdf'});
    client.post.mockResolvedValue({status: 200, data: {}});
    binaryClient.get.mockResolvedValue({data: blob});
    await service.uploadStudentAnnotatedFile(4, 9, 385, file);
    await service.uploadGroupAnnotatedFile(4, 9, 21, file);
    await service.downloadStudentAnnotatedFile(4, 9, 385);
    await service.downloadGroupAnnotatedFile(4, 9, 21);
    expect(client.post.mock.calls.map(call => call[0])).toEqual([
      '/v2/courses/4/assignments/9/students/385/grade/annotated-file',
      '/v2/courses/4/assignments/9/groups/21/grade/annotated-file',
    ]);
    expect(binaryClient.get.mock.calls.map(call => call[0])).toEqual([
      '/v2/courses/4/assignments/9/students/385/grade/annotated-file',
      '/v2/courses/4/assignments/9/groups/21/grade/annotated-file',
    ]);
  });

  it('loads a student or group grading view for existing-feedback prefill', async () => {
    client.get.mockResolvedValue({status: 200, data: {assignmentId: 9}});
    await service.getStudentGradingView(4, 9, 385);
    await service.getGroupGradingView(4, 9, 21);
    expect(client.get).toHaveBeenCalledWith('/v2/courses/4/assignments/9/students/385/grading');
    expect(client.get).toHaveBeenCalledWith('/v2/courses/4/assignments/9/groups/21/grading');
  });
});
