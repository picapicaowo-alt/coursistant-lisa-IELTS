import {
  ApiResponse,
  CreateQuizQuestionRequest,
  CreateQuizRequest,
  idempotent,
  PatchQuizAnswerKeyRequest,
  PatchQuizQuestionRequest,
  PatchQuizRequest,
  QuizAttempt,
  QuizAttemptSummary,
  QuizAttemptResultSummary,
  QuizAutosaveResponse,
  QuizGradingSummary,
  QuizQuestion,
  QuizReceipt,
  QuizResponse,
  QuizResult,
  QuizShortAnswerGradingItem,
  V2ApiClient,
} from '@/apis';

/**
 * Thin transport boundary for the quiz contract.
 *
 * Multi-step workflows and Query cache coordination stay in page hooks so
 * this service remains a predictable mapping from typed calls to endpoints.
 */
export class QuizApiService {
  private apiClient = V2ApiClient;

  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) this.apiClient = apiClient;
  }

  listQuizzes(courseId: number): Promise<ApiResponse<QuizResponse[]>> {
    return this.apiClient.get(`/v2/courses/${courseId}/quizzes`);
  }

  getQuiz(courseId: number, quizId: number): Promise<ApiResponse<QuizResponse>> {
    return this.apiClient.get(`/v2/courses/${courseId}/quizzes/${quizId}`);
  }

  createQuiz(
    courseId: number,
    request: CreateQuizRequest,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<QuizResponse>> {
    return this.apiClient.post(`/v2/courses/${courseId}/quizzes`, request, idempotent(idempotencyKey));
  }

  /** `request.expectedVersion` protects staff edits from overwriting a newer draft. */
  patchQuiz(
    courseId: number,
    quizId: number,
    request: PatchQuizRequest,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<QuizResponse>> {
    return this.apiClient.patch(`/v2/courses/${courseId}/quizzes/${quizId}`, request, idempotent(idempotencyKey));
  }

  deleteQuiz(courseId: number, quizId: number): Promise<ApiResponse<void>> {
    return this.apiClient.delete(`/v2/courses/${courseId}/quizzes/${quizId}`, {params: {confirm: true}});
  }

  publishQuiz(courseId: number, quizId: number, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<QuizResponse>> {
    return this.apiClient.post(`/v2/courses/${courseId}/quizzes/${quizId}/publish`, undefined, idempotent(idempotencyKey));
  }

  unpublishQuiz(courseId: number, quizId: number, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<QuizResponse>> {
    return this.apiClient.post(`/v2/courses/${courseId}/quizzes/${quizId}/unpublish`, undefined, idempotent(idempotencyKey));
  }

  listQuestions(courseId: number, quizId: number): Promise<ApiResponse<QuizQuestion[]>> {
    return this.apiClient.get(`/v2/courses/${courseId}/quizzes/${quizId}/questions`);
  }

  createQuestion(
    courseId: number,
    quizId: number,
    request: CreateQuizQuestionRequest,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<QuizQuestion>> {
    return this.apiClient.post(`/v2/courses/${courseId}/quizzes/${quizId}/questions`, request, idempotent(idempotencyKey));
  }

  patchQuestion(
    courseId: number,
    quizId: number,
    questionId: number,
    request: PatchQuizQuestionRequest,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<QuizQuestion>> {
    return this.apiClient.patch(
      `/v2/courses/${courseId}/quizzes/${quizId}/questions/${questionId}`,
      request,
      idempotent(idempotencyKey),
    );
  }

  patchAnswerKey(
    courseId: number,
    quizId: number,
    questionId: number,
    request: PatchQuizAnswerKeyRequest,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<QuizQuestion>> {
    // Answer-key correction is deliberately separate from question editing:
    // existing attempts may need their automatic scores recalculated.
    return this.apiClient.patch(
      `/v2/courses/${courseId}/quizzes/${quizId}/questions/${questionId}/answer-key`,
      request,
      idempotent(idempotencyKey),
    );
  }

  deleteQuestion(courseId: number, quizId: number, questionId: number): Promise<ApiResponse<void>> {
    return this.apiClient.delete(`/v2/courses/${courseId}/quizzes/${quizId}/questions/${questionId}`);
  }

  reorderQuestions(
    courseId: number,
    quizId: number,
    questionIds: number[],
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<QuizQuestion[]>> {
    // The endpoint accepts the complete ordered permutation, not a single move.
    return this.apiClient.put(
      `/v2/courses/${courseId}/quizzes/${quizId}/questions/order`,
      {questionIds},
      idempotent(idempotencyKey),
    );
  }

  startAttempt(
    courseId: number,
    quizId: number,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<QuizAttempt>> {
    // A stable key prevents retries or double-clicks from opening two attempts.
    return this.apiClient.post(
      `/v2/courses/${courseId}/quizzes/${quizId}/attempts`,
      undefined,
      idempotent(idempotencyKey),
    );
  }

  getCurrentAttempt(courseId: number, quizId: number): Promise<ApiResponse<QuizAttempt>> {
    // The API reports “no active attempt” as a domain error. Student pages may
    // normalize that specific response to null; staff callers must not.
    return this.apiClient.get(`/v2/courses/${courseId}/quizzes/${quizId}/attempts/current`);
  }

  getAttempt(courseId: number, quizId: number, attemptId: number): Promise<ApiResponse<QuizAttempt>> {
    return this.apiClient.get(`/v2/courses/${courseId}/quizzes/${quizId}/attempts/${attemptId}`);
  }

  listAttempts(
    courseId: number,
    quizId: number,
    options?: {userId?: number; page?: number; pageSize?: number},
  ): Promise<ApiResponse<QuizAttemptSummary[]>> {
    // `userId` is an optional staff-side roster filter. Authorization remains
    // owned by the API; this client only forwards the requested scope.
    return this.apiClient.get(`/v2/courses/${courseId}/quizzes/${quizId}/attempts`, {
      params: options,
    });
  }

  getAttemptResult(courseId: number, quizId: number, attemptId: number): Promise<ApiResponse<QuizResult>> {
    return this.apiClient.get(
      `/v2/courses/${courseId}/quizzes/${quizId}/attempts/${attemptId}/result`,
    );
  }

  listMyAttempts(courseId: number, quizId: number): Promise<ApiResponse<QuizAttemptResultSummary[]>> {
    return this.apiClient.get(`/v2/courses/${courseId}/quizzes/${quizId}/my-attempts`);
  }

  getAttemptReceipt(courseId: number, quizId: number, attemptId: number): Promise<ApiResponse<QuizReceipt>> {
    return this.apiClient.get(`/v2/courses/${courseId}/quizzes/${quizId}/attempts/${attemptId}/receipt`);
  }

  autosaveAnswer(
    courseId: number,
    quizId: number,
    attemptId: number,
    questionId: number,
    answer: {selectedOptionIds?: number[]; textAnswer?: string},
  ): Promise<ApiResponse<QuizAutosaveResponse>> {
    // PUT makes each question its own replaceable checkpoint. Consumers should
    // use the returned revision/deadline data as the authoritative save state.
    return this.apiClient.put(
      `/v2/courses/${courseId}/quizzes/${quizId}/attempts/${attemptId}/answers/${questionId}`,
      answer,
    );
  }

  submitAttempt(
    courseId: number,
    quizId: number,
    attemptId: number,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<QuizReceipt>> {
    // Submission is terminal for an attempt, so retries reuse one idempotency key.
    return this.apiClient.post(
      `/v2/courses/${courseId}/quizzes/${quizId}/attempts/${attemptId}/submit`,
      undefined,
      idempotent(idempotencyKey),
    );
  }

  getMyResult(courseId: number, quizId: number): Promise<ApiResponse<QuizResult>> {
    // Result availability is controlled by the quiz visibility/release policy;
    // callers must handle a valid “not available yet” response as an empty state.
    return this.apiClient.get(`/v2/courses/${courseId}/quizzes/${quizId}/my-result`);
  }

  getGradingSummary(courseId: number, quizId: number): Promise<ApiResponse<QuizGradingSummary>> {
    return this.apiClient.get(`/v2/courses/${courseId}/quizzes/${quizId}/grading-summary`);
  }

  listShortAnswers(
    courseId: number,
    quizId: number,
    questionId: number,
  ): Promise<ApiResponse<QuizShortAnswerGradingItem[]>> {
    return this.apiClient.get(
      `/v2/courses/${courseId}/quizzes/${quizId}/grading/questions/${questionId}/answers`,
    );
  }

  gradeAnswer(
    courseId: number,
    quizId: number,
    attemptId: number,
    questionId: number,
    request: {score: number; feedback?: string; reason?: string},
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<QuizShortAnswerGradingItem>> {
    return this.apiClient.put(
      `/v2/courses/${courseId}/quizzes/${quizId}/attempts/${attemptId}/answers/${questionId}/grade`,
      request,
      idempotent(idempotencyKey),
    );
  }

  releaseGrades(
    courseId: number,
    quizId: number,
    userIds?: number[],
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<void>> {
    // Omitting userIds means all currently eligible users; a supplied list is a
    // targeted release. Preserve that distinction instead of sending `[]`.
    return this.apiClient.post(
      `/v2/courses/${courseId}/quizzes/${quizId}/grades/release`,
      userIds ? {userIds} : {},
      idempotent(idempotencyKey),
    );
  }

  retractGrades(
    courseId: number,
    quizId: number,
    userIds?: number[],
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<void>> {
    // As with release, no userIds means the whole applicable set.
    return this.apiClient.post(
      `/v2/courses/${courseId}/quizzes/${quizId}/grades/retract`,
      userIds ? {userIds} : {},
      idempotent(idempotencyKey),
    );
  }
}

export const quizApiService = new QuizApiService();
