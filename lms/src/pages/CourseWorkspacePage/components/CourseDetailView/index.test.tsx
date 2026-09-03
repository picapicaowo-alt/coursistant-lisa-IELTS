import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CourseDetailView} from '.';
import {useCourseWorkspaceData} from '../../hooks/useCourseWorkspaceData';

vi.mock('../../hooks/useCourseWorkspaceData', () => ({
  useCourseWorkspaceData: vi.fn(),
}));

const emptyWorkspace = {
  courseId: 37,
  course: undefined,
  weeks: [],
  sessions: [],
  assignments: [],
  quizzes: [],
  events: [],
  groupSets: [],
  announcements: [],
  isLoading: false,
  isError: true,
  isUnavailable: false,
  sessionsFailed: false,
  assignmentsFailed: false,
  quizzesFailed: false,
  eventsFailed: false,
  groupSetsFailed: false,
  announcementsFailed: false,
  refetch: vi.fn(),
};

describe('CourseDetailView errors', () => {
  beforeEach(() => {
    vi.mocked(useCourseWorkspaceData).mockReturnValue({...emptyWorkspace});
  });

  it('does not disclose whether an unavailable course is missing or forbidden', () => {
    vi.mocked(useCourseWorkspaceData).mockReturnValue({...emptyWorkspace, isUnavailable: true});

    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><MemoryRouter><CourseDetailView/></MemoryRouter></QueryClientProvider>);

    expect(screen.getByRole('alert')).toHaveTextContent('This course does not exist, or you do not have access.');
    expect(screen.queryByRole('button', {name: 'Try again'})).not.toBeInTheDocument();
  });

  it('keeps the retry action for transient loading failures', () => {
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><MemoryRouter><CourseDetailView/></MemoryRouter></QueryClientProvider>);

    expect(screen.getByRole('alert')).toHaveTextContent("This course couldn't be loaded.");
    expect(screen.getByRole('button', {name: 'Try again'})).toBeInTheDocument();
  });
});
