import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const {useQueryMock} = vi.hoisted(() => ({useQueryMock: vi.fn()}));

vi.mock('@tanstack/react-query', () => ({useQuery: useQueryMock}));
vi.mock('../hooks/useCourseList', () => ({
  useCourseList: () => ({courses: [], isLoading: false, isError: false, error: null, refetch: vi.fn()}),
}));
vi.mock('../hooks/useDashboardAssignments', () => ({
  useDashboardAssignments: () => ({rows: [], isInstructor: false, isLoading: false, isError: false, refetch: vi.fn()}),
}));
vi.mock('@/sections/learning_schedule/LearningScheduleComponent', () => ({
  default: () => <div>Schedule fixture</div>,
}));

import {Dashboard} from './Dashboard';
import {dashboardExamActionLabel, resolveDashboardExamRoute} from './dashboardExam';

describe('Dashboard exam actions', () => {
  it('opens a concrete exam section only when the contract identifies one', () => {
    expect(resolveDashboardExamRoute({studentMockExamId: 71, listeningSelected: true}))
      .toBe('/mock-exams/71/listening');
    expect(resolveDashboardExamRoute({studentMockExamId: 71}))
      .toBe('/mock-exams');
  });

  it('uses honest fallback copy when a direct exam destination is unavailable', () => {
    expect(dashboardExamActionLabel('InProgress', undefined, true)).toBe('Continue the exam');
    expect(dashboardExamActionLabel('Graded', 88, true)).toBe('View feedback');
    expect(dashboardExamActionLabel('InProgress', undefined, false)).toBe('Open exams');
  });
});

describe('Dashboard region states', () => {
  beforeEach(() => {
    useQueryMock.mockImplementation(({queryKey}: {queryKey: string[]}) => {
      if (queryKey.includes('advising-study-plan')) {
        return {data: undefined, isPending: false, isError: true, error: new Error('This section could not be loaded.'), refetch: vi.fn()};
      }
      if (queryKey.includes('mock-exams')) {
        return {data: {items: []}, isPending: false, isError: false, refetch: vi.fn()};
      }
      return {data: undefined, isPending: true, isError: false, refetch: vi.fn()};
    });
  });

  it('keeps loading, error, and empty states independent across panels', () => {
    render(<MemoryRouter><Dashboard/></MemoryRouter>);

    expect(screen.getByText('No active courses')).toBeInTheDocument();
    expect(screen.getByText('This section could not be loaded.')).toBeInTheDocument();
    expect(screen.getByText('No mock exams have been assigned.')).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.getByText('Schedule fixture')).toBeInTheDocument();
  });
});
