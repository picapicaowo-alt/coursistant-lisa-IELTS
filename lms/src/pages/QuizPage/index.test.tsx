import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@testing-library/jest-dom';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

const quizApi = vi.hoisted(() => ({
  getQuiz: vi.fn(),
  listQuestions: vi.fn(),
  getCurrentAttempt: vi.fn(),
  getMyResult: vi.fn(),
  listAttempts: vi.fn(),
  listMyAttempts: vi.fn(),
  getAttemptReceipt: vi.fn(),
  startAttempt: vi.fn(),
  autosaveAnswer: vi.fn(),
  submitAttempt: vi.fn(),
  publishQuiz: vi.fn(),
  unpublishQuiz: vi.fn(),
  getAttemptResult: vi.fn(),
}));

vi.mock('@/apis/services/quiz-api', () => ({quizApiService: quizApi}));
vi.mock('@/hooks/useCourseAccess', () => ({
  useCourseAccess: () => ({
    isResolved: true,
    isStudent: true,
    isInstructor: false,
    isTa: false,
    canConfigureAssignments: false,
    canGrade: false,
    canReleaseGrades: false,
  }),
}));

import QuizPage from './index';

const quizData = {
  id: 10,
  courseId: 5,
  title: 'Midterm Exam',
  instructions: 'Answer all questions',
  opensAtUtc: '2026-08-01T00:00:00Z',
  opensAtLocal: '2026-08-01T00:00:00',
  closesAtUtc: '2026-09-01T00:00:00Z',
  closesAtLocal: '2026-09-01T00:00:00',
  timezone: 'America/Los_Angeles',
  timeLimitSeconds: 3600,
  attemptsAllowed: 1,
  resultVisibility: 'AfterRelease',
  state: 'Published',
  windowOpen: true,
  version: 1,
  totalPoints: 100,
  questionCount: 1,
  hasAttempts: false,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
};

const questionsData = [
  {
    id: 101,
    quizId: 10,
    type: 'SingleChoice',
    stem: 'What is 2 + 2?',
    points: 100,
    orderPosition: 0,
    options: [
      {id: 1, label: '3'},
      {id: 2, label: '4'},
    ],
  },
];

const response = <T,>(data: T) => ({
  status: 200,
  code: 'SUCCESS',
  message: 'OK',
  timestamp: '2026-08-17T00:00:00Z',
  data,
});

describe('QuizPage Question Attempt Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quizApi.getQuiz.mockResolvedValue(response(quizData));
    quizApi.listAttempts.mockResolvedValue(response([]));
    quizApi.listMyAttempts.mockResolvedValue(response([]));
    quizApi.getMyResult.mockRejectedValue({code: 404, details: {code: 'QUIZ_ATTEMPT_NOT_FOUND'}});
  });

  it('does NOT fetch questions on initial mount before student starts attempt', async () => {
    quizApi.getQuiz.mockResolvedValue(response({...quizData, instructions: ''}));
    quizApi.getCurrentAttempt.mockRejectedValue({code: 404, details: {code: 'QUIZ_ATTEMPT_NOT_FOUND'}});

    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/course/5/quizzes/10']}>
          <Routes>
            <Route path="/course/:courseId/quizzes/:quizId" element={<QuizPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('button', {name: 'Start attempt'})).toBeInTheDocument();
    expect(screen.queryByText(/creates an attempt|begin(?:s)? the (?:quiz )?timer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no instructions (?:were )?provided/i)).not.toBeInTheDocument();
    // Verify listQuestions was NEVER called because no attempt is in progress
    expect(quizApi.listQuestions).not.toHaveBeenCalled();
  });

  it('fetches questions only after student starts an attempt', async () => {
    quizApi.getCurrentAttempt.mockRejectedValue({code: 404, details: {code: 'QUIZ_ATTEMPT_NOT_FOUND'}});
    const activeAttempt = {
      id: 501,
      quizId: 10,
      userId: 1,
      attemptNumber: 1,
      status: 'InProgress',
      score: null,
      startedAt: '2026-08-20T10:00:00Z',
      submittedAt: null,
      answers: [],
    };
    quizApi.startAttempt.mockResolvedValue(response(activeAttempt));
    quizApi.listQuestions.mockResolvedValue(response(questionsData));

    const user = userEvent.setup();
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/course/5/quizzes/10']}>
          <Routes>
            <Route path="/course/:courseId/quizzes/:quizId" element={<QuizPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const startButton = await screen.findByRole('button', {name: 'Start attempt'});
    await user.click(startButton);

    await waitFor(() => {
      expect(quizApi.startAttempt).toHaveBeenCalledWith(5, 10, expect.any(String));
    });

    await waitFor(() => {
      expect(quizApi.listQuestions).toHaveBeenCalledWith(5, 10);
    });

    expect(await screen.findByText(/What is 2 \+ 2\?/)).toBeInTheDocument();
  });

  it('renders releasedAt when available on quiz result', async () => {
    quizApi.getCurrentAttempt.mockRejectedValue({code: 404, details: {code: 'QUIZ_ATTEMPT_NOT_FOUND'}});
    const result = {
      quizId: 10,
      countedAttemptId: 501,
      gradeStatus: 'Released',
      closeReason: null,
      receiptId: 'REC-999',
      autoScore: 100,
      manualScore: null,
      totalScore: 100,
      manualGradingPending: false,
      showCorrectAnswers: true,
      releasedAt: '2026-08-22T14:30:00',
      questions: [],
    };
    quizApi.getMyResult.mockResolvedValue(response(result));

    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/course/5/quizzes/10']}>
          <Routes>
            <Route path="/course/:courseId/quizzes/:quizId" element={<QuizPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Quiz submitted')).toBeInTheDocument();
    });

    expect(screen.getByText(/Grade released on/i)).toBeInTheDocument();
  });

  it('shows an instant auto-score before instructor release', async () => {
    quizApi.getQuiz.mockResolvedValue(response({...quizData, resultVisibility: 'InstantAutoScore'}));
    quizApi.getCurrentAttempt.mockRejectedValue({code: 404, details: {code: 'QUIZ_ATTEMPT_NOT_FOUND'}});
    quizApi.getMyResult.mockResolvedValue(response({
      quizId: 10,
      countedAttemptId: 501,
      gradeStatus: 'Entered',
      closeReason: 'MANUAL',
      receiptId: 'REC-AUTO',
      autoScore: 100,
      manualScore: null,
      totalScore: null,
      manualGradingPending: false,
      showCorrectAnswers: false,
      releasedAt: null,
      questions: [],
    }));

    render(
      <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <MemoryRouter initialEntries={['/course/5/quizzes/10']}>
          <Routes>
            <Route path="/course/:courseId/quizzes/:quizId" element={<QuizPage/>}/>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('100 / 100')).toBeInTheDocument();
    expect(screen.queryByText('Waiting for grading')).not.toBeInTheDocument();
  });
});
