import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {CourseResponse} from '@/apis';
import {useCourseWorkspaceStore} from '../stores/useCourseWorkspaceStore';
import {useCourseWorkspaceData} from './useCourseWorkspaceData';
import {useCourseEdit} from './useCourseEdit';

vi.mock('./useCourseWorkspaceData', () => ({
  useCourseWorkspaceData: vi.fn(),
}));

const course: CourseResponse = {
  id: 31,
  courseId: 31,
  tenantId: 1,
  courseCode: 'S3-LIVE',
  title: 'S3 live course',
  name: 'S3 live course',
  description: '',
  termStartDate: '2026-08-01',
  termEndDate: '2026-12-01',
  location: null,
  primaryInstructor: null,
  state: 'Active',
  status: 'Active',
  archivedAt: null,
  gradingGraceEndsAt: null,
  instructorId: null,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
};

describe('useCourseEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCourseWorkspaceStore.setState({workspaceMode: 'view'});
  });

  it('does not reload course data for unrelated workspace store updates', () => {
    const loadCourseInfo = vi.fn();
    useCourseWorkspaceStore.setState({loadCourseInfo});
    vi.mocked(useCourseWorkspaceData).mockReturnValue({
      courseId: 31,
      course,
      weeks: [],
    sessions: [],
      assignments: [],
      events: [],
      groupSets: [],
      announcements: [],
      isLoading: false,
      isError: false,
      isUnavailable: false,
      sessionsFailed: false,
      assignmentsFailed: false,
      eventsFailed: false,
      groupSetsFailed: false,
      announcementsFailed: false,
      refetch: vi.fn(),
    });

    renderHook(() => useCourseEdit());
    expect(loadCourseInfo).toHaveBeenCalledTimes(1);

    act(() => useCourseWorkspaceStore.setState({workspaceMode: 'edit'}));

    expect(loadCourseInfo).toHaveBeenCalledTimes(1);
  });
});
