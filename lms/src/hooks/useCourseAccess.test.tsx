import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {renderHook, waitFor} from '@testing-library/react';
import type {PropsWithChildren} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  getMyCourses: vi.fn(),
  user: {id: 1, role: 'SYSTEM_ADMIN'} as {id: number; role: 'USER' | 'SYSTEM_ADMIN'},
}));

vi.mock('@/contexts/RequiredAuthContext', () => ({
  useRequiredAuth: () => ({user: mocks.user}),
}));

vi.mock('@/apis/services/dashboard-api', () => ({
  DASHBOARD_LIMITS: {coursePageSize: {max: 100}},
  dashboardApiService: {getMyCourses: mocks.getMyCourses},
}));

import {useCourseAccess} from './useCourseAccess';

const wrapper = ({children}: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
    {children}
  </QueryClientProvider>
);

describe('useCourseAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {id: 1, role: 'SYSTEM_ADMIN'};
  });

  it('does not call the USER-only my-courses endpoint for a system admin', () => {
    const {result} = renderHook(() => useCourseAccess(31), {wrapper});

    expect(result.current.isResolved).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(mocks.getMyCourses).not.toHaveBeenCalled();
  });

  it('resolves course-scoped capabilities from a USER membership', async () => {
    mocks.user = {id: 2, role: 'USER'};
    mocks.getMyCourses.mockResolvedValue({
      status: 200,
      code: 'SUCCESS',
      message: 'Success',
      timestamp: '2026-09-01T00:00:00Z',
      data: {
        items: [{id: 31, courseId: 31, courseRole: 'Instructor'}],
        page: 0,
        size: 100,
        total: 1,
      },
    });

    const {result} = renderHook(() => useCourseAccess(31), {wrapper});
    await waitFor(() => expect(result.current.isResolved).toBe(true));

    expect(result.current.canConfigureAssignments).toBe(true);
    expect(mocks.getMyCourses).toHaveBeenCalledWith({page: 0, size: 100});
  });
});
