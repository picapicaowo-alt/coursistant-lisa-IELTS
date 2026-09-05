export type QuizState = 'Draft' | 'Published' | 'Closed';
export type QuizResultVisibility = 'AfterRelease' | 'InstantAutoScore';
export type QuizQuestionType = 'SingleChoice' | 'MultipleSelect' | 'TrueFalse' | 'ShortAnswer';

export interface QuizResponse {
  id: number;
  courseId: number;
  title: string;
  instructions: string | null;
  opensAtUtc: string;
  opensAtLocal: string;
  closesAtUtc: string;
  closesAtLocal: string;
  timezone: string;
  timeLimitSeconds: number | null;
  attemptsAllowed: number;
  resultVisibility: QuizResultVisibility;
  state: QuizState;
  /** True when server now is within [opensAt, closesAt). Independent of Draft/Published. */
  windowOpen?: boolean;
  version: number;
  totalPoints: number;
  questionCount: number;
  hasAttempts: boolean;
  /**
   * For student: true if caller has open attempt, false if not.
   * For staff: null.
   */
  hasOpenAttempt: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuizRequest {
  title: string;
  instructions?: string;
  opensAt: string;
  closesAt: string;
  timeLimitSeconds?: number | null;
  attemptsAllowed?: number;
  resultVisibility?: QuizResultVisibility;
}

export interface PatchQuizRequest extends Partial<CreateQuizRequest> {
  expectedVersion: number;
}

export interface QuizOptionInput {
  id?: number;
  label: string;
  isCorrect?: boolean;
  position?: number;
}

export interface CreateQuizQuestionRequest {
  type: QuizQuestionType;
  stem: string;
  points: number;
  options?: QuizOptionInput[];
}

export interface PatchQuizQuestionRequest {
  expectedVersion: number;
  stem?: string;
  points?: number;
  options?: QuizOptionInput[];
}

/**
 * The deliberately narrow correction contract used after attempts exist.
 * It changes only correctness flags and lets the server regrade atomically.
 */
export interface PatchQuizAnswerKeyRequest {
  options: Array<{optionId: number; isCorrect: boolean}>;
  reason: string;
  expectedVersion: number;
}

export interface QuizOption {
  id: number;
  label: string;
  position: number;
  /** Instructor-only answer-key field. */
  isCorrect?: boolean;
}

export interface QuizQuestion {
  id: number;
  quizId: number;
  type: QuizQuestionType;
  stem: string;
  points: number;
  position: number;
  /** Instructor-only optimistic concurrency field. */
  version?: number;
  options: QuizOption[];
}

export type QuizAttemptStatus = 'InProgress' | 'Submitted' | 'AutoSubmitted' | 'Closed';

export interface QuizAttemptAnswer {
  questionId: number;
  selectedOptionIds: number[];
  textAnswer: string | null;
  revision: number;
  savedAt: string;
}

export interface QuizAttempt {
  id: number;
  quizId: number;
  userId: number;
  attemptNumber: number;
  status: QuizAttemptStatus;
  closeReason: string | null;
  receiptId: string | null;
  startedAt: string;
  deadlineAt: string | null;
  submittedAt: string | null;
  serverNowUtc: string;
  autoScore: number | null;
  manualScore: number | null;
  totalScore: number | null;
  manualGradingComplete: boolean;
  answers: QuizAttemptAnswer[];
}

export interface QuizAttemptSummary {
  id: number;
  /** The current backend omits this from list responses; staff roster code adds it from the userId filter. */
  userId?: number;
  attemptNumber: number;
  status: QuizAttemptStatus;
  closeReason: string | null;
  startedAt: string;
  submittedAt: string | null;
  receiptId: string | null;
}

export interface QuizAutosaveResponse {
  attemptId: number;
  questionId: number;
  revision: number;
  savedAtUtc: string;
  serverNowUtc: string;
  deadlineAtUtc: string | null;
}

export interface QuizReceipt {
  attemptId: number;
  receiptId: string;
  submittedAt: string;
}

export interface QuizResult {
  quizId: number;
  countedAttemptId: number;
  gradeStatus: string;
  closeReason: string | null;
  receiptId: string | null;
  autoScore: number | null;
  manualScore: number | null;
  totalScore: number | null;
  manualGradingPending: boolean;
  showCorrectAnswers: boolean;
  releasedAt: string | null;
  questions: Array<{
    questionId: number;
    type: QuizQuestionType;
    points: number;
    score: number | null;
    selectedOptionIds: number[];
    textAnswer: string | null;
    correctOptionIds?: number[];
  }>;
}

export interface QuizGradingSummary {
  pendingShortAnswerCount: number;
  submittedAttemptCount: number;
  releasedUserCount: number;
  manualIncompleteAttemptCount: number;
}

/** Result summaries do not contain the attempt metadata required by history. */
export type QuizAttemptResultSummary = Pick<QuizResult,
  'quizId' | 'countedAttemptId' | 'gradeStatus' | 'closeReason' | 'receiptId' | 'releasedAt'>;

export interface QuizShortAnswerGradingItem {
  attemptId: number;
  userId: number;
  questionId: number;
  textAnswer: string | null;
  score: number | null;
  pendingManual: boolean;
  feedback: string | null;
}
