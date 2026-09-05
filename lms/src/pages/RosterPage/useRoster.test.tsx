import {renderHook, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {describe, expect, it, vi} from 'vitest';
import type {ApiResponse, CourseMemberPage} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {useRoster} from './useRoster';
import React from 'react';

vi.mock('@/apis/services/course-api', () => ({
  courseApiService: {
    listCourseMembers: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const Wrapper = ({children}: {children: React.ReactNode}) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/course/10/roster']}>
        <Routes>
          <Route path="/course/:courseId/roster" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  Wrapper.displayName = 'RosterTestWrapper';
  return Wrapper;
};

describe('useRoster sorting', () => {
  it('rejects membership mutations for a read-only roster before calling the API', async () => {
    const {result} = renderHook(() => useRoster({enabled: false}), {wrapper: createWrapper()});
    await expect(result.current.enrol.mutateAsync(['student@example.test'])).rejects.toThrow();
  });

  it('sorts members client-side by role priority (Instructor -> TA -> Student)', async () => {
    const mockMembers: ApiResponse<CourseMemberPage> = {
      status: 200,
      code: 'SUCCESS',
      message: 'Success',
      timestamp: '2026-08-01T00:00:00Z',
      data: {
        items: [
          {
            id: 1,
            courseId: 10,
            userId: 101,
            courseRole: 'Student',
            userName: 'Student A',
            userEmail: 'student@example.com',
            active: true,
            joinedAt: '2026-08-01T00:00:00Z',
          },
          {
            id: 2,
            courseId: 10,
            userId: 102,
            courseRole: 'TA',
            userName: 'TA A',
            userEmail: 'ta@example.com',
            active: true,
            joinedAt: '2026-08-01T00:00:00Z',
          },
          {
            id: 3,
            courseId: 10,
            userId: 103,
            courseRole: 'Instructor',
            userName: 'Instructor A',
            userEmail: 'instructor@example.com',
            active: true,
            joinedAt: '2026-08-01T00:00:00Z',
          },
        ],
        total: 3,
        page: 0,
        size: 20,
      },
    };

    vi.mocked(courseApiService.listCourseMembers).mockResolvedValue(mockMembers);

    const {result} = renderHook(() => useRoster(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.members).toHaveLength(3);
    expect(result.current.members[0].courseRole).toBe('Instructor');
    expect(result.current.members[1].courseRole).toBe('TA');
    expect(result.current.members[2].courseRole).toBe('Student');
  });
});
