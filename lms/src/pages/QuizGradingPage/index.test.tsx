import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@testing-library/jest-dom';
import {courseApiService} from '@/apis/services/course-api';
import {quizApiService} from '@/apis/services/quiz-api';
import QuizGradingPage from './index';

vi.mock('@/hooks/useCourseAccess', () => ({
  useCourseAccess: () => ({
    isResolved: true,
    canGrade: true,
    canReleaseGrades: true,
  }),
}));

vi.mock('@/apis/services/course-api', () => ({
  courseApiService: {listCourseMembers: vi.fn()},
}));

vi.mock('@/apis/services/quiz-api', () => ({
  quizApiService: {
    getQuiz: vi.fn(),
    getGradingSummary: vi.fn(),
    listQuestions: vi.fn(),
    listAttempts: vi.fn(),
    getAttempt: vi.fn(),
    getAttemptResult: vi.fn(),
    listShortAnswers: vi.fn(),
    gradeAnswer: vi.fn(),
    releaseGrades: vi.fn(),
    retractGrades: vi.fn(),
  },
}));

const response = <T,>(data: T) => ({
  status: 200,
  code: 'SUCCESS',
  message: 'Success',
  timestamp: '2026-08-24T12:00:00Z',
  data,
});

const renderPage = () => {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/course/37/quizzes/12/grading']}>
        <Routes>
          <Route path="/course/:courseId/quizzes/:quizId/grading" element={<QuizGradingPage/>}/>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('QuizGradingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(quizApiService.getQuiz).mockResolvedValue(response({
      id: 12,
      courseId: 37,
      title: 'Testing Quiz',
      instructions: null,
      opensAtUtc: '2026-08-24T09:00:00Z',
      opensAtLocal: '2026-08-24T02:00:00',
      closesAtUtc: '2026-08-25T09:00:00Z',
      closesAtLocal: '2026-08-25T02:00:00',
      timezone: 'America/Los_Angeles',
      timeLimitSeconds: null,
      attemptsAllowed: 1,
      resultVisibility: 'AfterRelease',
      state: 'Published',
      version: 1,
      totalPoints: 10,
      questionCount: 1,
      hasAttempts: true,
      hasOpenAttempt: null,
      createdAt: '2026-08-24T08:00:00Z',
      updatedAt: '2026-08-24T08:00:00Z',
    }));
    vi.mocked(quizApiService.getGradingSummary).mockResolvedValue(response({
      submittedAttemptCount: 2,
      pendingShortAnswerCount: 0,
      manualIncompleteAttemptCount: 0,
      releasedUserCount: 0,
    }));
    vi.mocked(quizApiService.listQuestions).mockResolvedValue(response([{
      id: 501,
      quizId: 12,
      type: 'SingleChoice',
      stem: 'Which option is correct?',
      points: 10,
      position: 1,
      options: [
        {id: 1, label: 'Option A', position: 1, isCorrect: true},
        {id: 2, label: 'Option B', position: 2, isCorrect: false},
      ],
    }]));
    vi.mocked(courseApiService.listCourseMembers).mockResolvedValue(response({
      items: [
        {id: 1, courseId: 37, userId: 101, userName: 'Student One', userEmail: 'one@example.com', courseRole: 'Student', active: true},
        {id: 2, courseId: 37, userId: 102, userName: 'Student Two', userEmail: 'two@example.com', courseRole: 'Student', active: true},
        {id: 3, courseId: 37, userId: 103, userName: 'Student Three', userEmail: 'three@example.com', courseRole: 'Student', active: true},
      ],
      total: 3,
      page: 0,
      size: 100,
    }));
    vi.mocked(quizApiService.listAttempts).mockImplementation(async (_courseId, _quizId, options) => response(
      options?.userId === 101
        ? [{id: 1001, attemptNumber: 1, status: 'Submitted', closeReason: null, startedAt: '2026-08-24T10:00:00Z', submittedAt: '2026-08-24T10:10:00Z', receiptId: 'r1'}]
        : options?.userId === 102
          ? [{id: 1002, attemptNumber: 1, status: 'Submitted', closeReason: null, startedAt: '2026-08-24T10:00:00Z', submittedAt: '2026-08-24T10:12:00Z', receiptId: 'r2'}]
          : [],
    ));
    vi.mocked(quizApiService.getAttempt).mockResolvedValue(response({
      id: 1001,
      quizId: 12,
      userId: 101,
      attemptNumber: 1,
      status: 'Submitted',
      closeReason: null,
      receiptId: 'r1',
      startedAt: '2026-08-24T10:00:00Z',
      deadlineAt: '2026-08-24T11:00:00Z',
      submittedAt: '2026-08-24T10:10:00Z',
      serverNowUtc: '2026-08-24T12:00:00Z',
      autoScore: 7,
      manualScore: 0,
      totalScore: 7,
      manualGradingComplete: true,
      answers: [{questionId: 501, selectedOptionIds: [2], textAnswer: null, revision: 1, savedAt: '2026-08-24T10:09:00Z'}],
    }));
    vi.mocked(quizApiService.getAttemptResult).mockResolvedValue(response({
      quizId: 12,
      countedAttemptId: 1001,
      gradeStatus: 'Entered',
      closeReason: null,
      receiptId: 'r1',
      autoScore: null,
      manualScore: null,
      totalScore: null,
      manualGradingPending: false,
      showCorrectAnswers: true,
      releasedAt: null,
      questions: [{
        questionId: 501,
        type: 'SingleChoice',
        points: 10,
        score: null,
        selectedOptionIds: [2],
        textAnswer: null,
      }],
    }));
  });

  it('uses the existing per-student API and lets the teacher review an unreleased result', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Student One');
    expect(quizApiService.listAttempts).toHaveBeenCalledTimes(3);
    expect(quizApiService.listAttempts).toHaveBeenCalledWith(37, 12, {userId: 101, page: 1, pageSize: 100});
    expect(quizApiService.listAttempts).toHaveBeenCalledWith(37, 12, {userId: 102, page: 1, pageSize: 100});
    expect(quizApiService.listAttempts).toHaveBeenCalledWith(37, 12, {userId: 103, page: 1, pageSize: 100});

    await user.click(screen.getByRole('button', {name: 'Review result for Student One'}));

    await waitFor(() => expect(quizApiService.getAttemptResult).toHaveBeenCalledWith(37, 12, 1001));
    expect(quizApiService.getAttempt).toHaveBeenCalledWith(37, 12, 1001);
    const dialog = screen.getByRole('dialog', {name: 'Student One'});
    expect(dialog).toHaveTextContent('one@example.com');
    expect(dialog.closest('main')).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(await screen.findByText('7 / 10')).toBeInTheDocument();
    expect(screen.getByText('Which option is correct?')).toBeInTheDocument();
    expect(screen.getByText('Student answer')).toBeInTheDocument();
    expect(screen.getByText('Correct answer')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', {name: 'Student One'})).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('button', {name: 'Review result for Student One'})).toHaveFocus();
  });

  it('provides explicit select-all and clear-all controls', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Student One');

    await user.click(screen.getByRole('button', {name: 'Select all eligible (2)'}));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Student One')).toBeChecked();
    expect(screen.getByLabelText('Select Student Two')).toBeChecked();

    await user.click(screen.getByRole('button', {name: 'Clear all'}));
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Student One')).not.toBeChecked();
  });

  it('keeps successful rows usable when one learner attempt request fails', async () => {
    vi.mocked(quizApiService.listAttempts).mockImplementation(async (_courseId, _quizId, options) => {
      if (options?.userId === 102) throw new Error('temporary learner lookup failure');
      return response(options?.userId === 101
        ? [{id: 1001, attemptNumber: 1, status: 'Submitted', closeReason: null, startedAt: '2026-08-24T10:00:00Z', submittedAt: '2026-08-24T10:10:00Z', receiptId: 'r1'}]
        : []);
    });

    renderPage();

    expect(await screen.findByText('Attempt history could not be loaded for 1 learner.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Review result for Student One'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Review result for Student Two'})).not.toBeInTheDocument();
  });

  it('continues loading a learner attempt history when a response fills a batch', async () => {
    const fullPage = Array.from({length: 100}, (_, index) => ({
      id: 2_000 + index,
      attemptNumber: 1,
      status: 'Submitted' as const,
      closeReason: null,
      startedAt: '2026-08-24T10:00:00Z',
      submittedAt: '2026-08-24T10:10:00Z',
      receiptId: `bulk-${index}`,
    }));
    vi.mocked(quizApiService.listAttempts).mockImplementation(async (_courseId, _quizId, options) => {
      if (options?.userId === 101 && options.page === 1) return response(fullPage);
      return response([]);
    });

    renderPage();
    await screen.findByText('Student One');

    expect(quizApiService.listAttempts).toHaveBeenCalledWith(37, 12, {userId: 101, page: 1, pageSize: 100});
    expect(quizApiService.listAttempts).toHaveBeenCalledWith(37, 12, {userId: 101, page: 2, pageSize: 100});
  });
});
