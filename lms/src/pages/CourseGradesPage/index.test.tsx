import '@testing-library/jest-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  getCourse: vi.fn(),
  listMyGrades: vi.fn(),
  listQuizzes: vi.fn(),
  getMyResult: vi.fn(),
}));

vi.mock('@/hooks/useCourseAccess', () => ({
  useCourseAccess: () => ({isStudent: true, isResolved: true, isLoading: false, isError: false}),
}));
vi.mock('@/apis/services/course-api', () => ({courseApiService: {getCourse: mocks.getCourse}}));
vi.mock('@/apis/services/assignment-api', () => ({assignmentApiService: {listMyGrades: mocks.listMyGrades}}));
vi.mock('@/apis/services/quiz-api', () => ({quizApiService: {
  listQuizzes: mocks.listQuizzes,
  getMyResult: mocks.getMyResult,
}}));

import CourseGradesPage from './index';

describe('CourseGradesPage', () => {
  it('shows assignment grades without requesting the excluded Quiz module', async () => {
    mocks.getCourse.mockResolvedValue({data: {id: 37, courseCode: 'CSCI-570', title: 'Algorithms'}});
    mocks.listMyGrades.mockResolvedValue({data: [
      {assignmentId: 57, assignmentTitle: 'Homework 1', dueAtUtc: '2026-08-28T03:59:00', submissionStatus: 'Submitted', released: true, gradeDisplay: 'Released', pointsEarned: 10, pointsPossible: 10},
      {assignmentId: 58, assignmentTitle: 'Homework 2', dueAtUtc: '2026-09-04T03:59:00', submissionStatus: 'Submitted', released: false, gradeDisplay: 'NotGradedYet'},
    ]});
    mocks.listQuizzes.mockResolvedValue({data: [
      {id: 20, courseId: 37, title: 'Release quiz', resultVisibility: 'AfterRelease', totalPoints: 1},
      {id: 21, courseId: 37, title: 'Instant quiz', resultVisibility: 'InstantAutoScore', totalPoints: 1},
    ]});
    mocks.getMyResult.mockImplementation((_courseId: number, quizId: number) => Promise.resolve({data: {
      quizId,
      countedAttemptId: quizId,
      gradeStatus: 'Entered',
      autoScore: 1,
      manualScore: null,
      totalScore: null,
      manualGradingPending: false,
      questions: [],
    }}));
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/course/37/grades']}>
          <Routes><Route path="/course/:courseId/grades" element={<CourseGradesPage/>}/></Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('heading', {name: 'Grades'})).toBeInTheDocument();
    expect(await screen.findByRole('link', {name: /Homework 1/})).toHaveAttribute('href', '/course/37/assignments/57');
    expect(screen.getByText('10 / 10')).toBeInTheDocument();
    expect(screen.getAllByText('Not graded yet')).toHaveLength(1);
    expect(mocks.listQuizzes).not.toHaveBeenCalled();
    expect(mocks.getMyResult).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', {name: 'Quizzes'})).not.toBeInTheDocument();
    expect(screen.getByText(/does not calculate a course total/i)).toBeInTheDocument();
  });
});
