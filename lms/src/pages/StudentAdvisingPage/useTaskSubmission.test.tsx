import type {PropsWithChildren} from 'react';
import {act, renderHook} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {advisorApiService as api} from '@/apis/services/advisor-api';
import {advisingQueryKeys} from '../advising/queryKeys';
import {TASK_FILE_RULES, useTaskSubmission, validateTaskFile} from './useTaskSubmission';

vi.mock('@/apis/services/advisor-api', () => ({advisorApiService: {uploadOwnTaskSubmission: vi.fn(), startOwnAdvisorTask: vi.fn(), completeOwnAdvisorTask: vi.fn()}}));
const envelope = <T,>(data: T) => ({status: 200, code: 'SUCCESS', message: '', timestamp: '2026-09-05T12:00:00Z', data});
const file = {taskId: 24, originalName: 'work.pdf', contentType: 'application/pdf', sizeBytes: 4, previewAvailable: true};

describe('task file version lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses the upload response version for a subsequent file-only completion', async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
    client.setQueryData(advisingQueryKeys.studentStudyPlan, {plan: {checkpoints: [{tasks: [{id: 24, version: 7, status: 'IN_PROGRESS'}]}]}});
    vi.mocked(api.uploadOwnTaskSubmission).mockResolvedValue(envelope({...file, taskVersion: 8}));
    vi.mocked(api.completeOwnAdvisorTask).mockResolvedValue(envelope({id: 24, version: 9, status: 'COMPLETED', submissionFile: file}));
    const wrapper = ({children}: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const {result} = renderHook(() => useTaskSubmission({}), {wrapper});
    await act(async () => {await result.current.mutateAsync({action: 'upload', taskId: 24, version: 7, file: new File(['work'], 'work.pdf')});});
    await act(async () => {await result.current.mutateAsync({action: 'complete', taskId: 24, version: 8});});
    expect(api.completeOwnAdvisorTask).toHaveBeenCalledWith(24, {expectedVersion: 8, submissionText: undefined}, expect.any(String));
    expect(JSON.stringify(client.getQueryData(advisingQueryKeys.studentStudyPlan))).toContain('work.pdf');
    expect(vi.mocked(api.completeOwnAdvisorTask).mock.calls[0][1]).not.toHaveProperty('fileObjectKey');
  });
  it('rejects a stale version and empty completion before sending a request', async () => {
    const client = new QueryClient();
    client.setQueryData(advisingQueryKeys.studentStudyPlan, {plan: {checkpoints: [{tasks: [{id: 24, version: 8}]}]}});
    const wrapper = ({children}: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const {result} = renderHook(() => useTaskSubmission({}), {wrapper});
    await act(async () => {await expect(result.current.mutateAsync({action: 'complete', taskId: 24, version: 7})).rejects.toThrow();});
    await act(async () => {await expect(result.current.mutateAsync({action: 'complete', taskId: 24, version: 8})).rejects.toThrow();});
    expect(api.completeOwnAdvisorTask).not.toHaveBeenCalled();
  });
  it('enforces the provided format and 100 MiB limit', () => {
    for (const extension of TASK_FILE_RULES.extensions) expect(() => validateTaskFile({name: `file.${extension.toUpperCase()}`, size: TASK_FILE_RULES.maxBytes})).not.toThrow();
    expect(() => validateTaskFile({name: 'file.pdf', size: TASK_FILE_RULES.maxBytes + 1})).toThrow();
    expect(() => validateTaskFile({name: 'file.exe', size: 2})).toThrow();
  });
});
