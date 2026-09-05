import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/formatting";
import {
  statusLabel,
  quizQuestionTypeLabel,
} from "@/i18n/presentation";
import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  CreateQuizQuestionRequest,
  PatchQuizAnswerKeyRequest,
  QuizQuestion,
  QuizQuestionType,
  QuizResultVisibility,
} from "@/apis";
import { unwrapData } from "@/apis";
import { quizApiService } from "@/apis/services/quiz-api";
import { DurationSelect } from "@/components/DurationSelect";
import { TeachingState } from "@/components/TeachingWorkspace";
import { EnglishDateTimeInput } from "@/components/EnglishDateInput";
import MarkdownMessage from "@/components/MarkdownMessage";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import {
  idempotencyFingerprint,
  useIdempotencyCheckpoint,
} from "@/hooks/useIdempotencyCheckpoint";
import {
  addMinutesToDateTimeValue,
  dateTimeDurationMinutes,
  defaultDateTimeRange,
  DEFAULT_DURATION_MINUTES,
  LONG_DURATION_OPTIONS,
  presetDuration,
} from "@/utils/dateTimeRange";
import styles from "./index.module.scss";

const defaultQuestion = (): CreateQuizQuestionRequest => ({
  type: "SingleChoice",
  stem: "",
  points: 1,
  options: [
    { label: "", isCorrect: true, position: 1 },
    { label: "", isCorrect: false, position: 2 },
  ],
});

const questionToDraft = (
  question: QuizQuestion,
): CreateQuizQuestionRequest => ({
  type: question.type,
  stem: question.stem,
  points: question.points,
  options: question.options.map((option) => ({ ...option })),
});

const normalizedQuestion = (
  draft: CreateQuizQuestionRequest,
): CreateQuizQuestionRequest => ({
  ...draft,
  stem: draft.stem.trim(),
  options:
    draft.type === "ShortAnswer"
      ? []
      : draft.options?.map((option, index) => ({
          ...option,
          label: option.label.trim(),
          position: index + 1,
        })),
});

const isQuestionValid = (draft: CreateQuizQuestionRequest) => {
  if (!draft.stem.trim() || !Number.isFinite(draft.points) || draft.points < 0)
    return false;
  if (draft.type === "ShortAnswer") return true;
  const options = draft.options ?? [];
  if (options.length < 2 || options.some((option) => !option.label.trim()))
    return false;
  const correctCount = options.filter((option) => option.isCorrect).length;
  return draft.type === "MultipleSelect"
    ? correctCount > 0
    : correctCount === 1;
};

interface QuestionFieldsProps {
  draft: CreateQuizQuestionRequest;
  setDraft: Dispatch<SetStateAction<CreateQuizQuestionRequest>>;
  canChangeType: boolean;
}

const QuestionFields = ({
  draft,
  setDraft,
  canChangeType,
}: QuestionFieldsProps) => {
  const { t: translate } = useTranslation();
  const setQuestionType = (type: QuizQuestionType) => {
    setDraft((current) => ({
      ...current,
      type,
      options:
        type === "ShortAnswer"
          ? []
          : type === "TrueFalse"
            ? // These are IELTS answer content, not interface copy. Preserve the original labels in every locale.
              [
                { label: "True", isCorrect: true, position: 1 },
                { label: "False", isCorrect: false, position: 2 },
              ]
            : [
                { label: "", isCorrect: true, position: 1 },
                { label: "", isCorrect: false, position: 2 },
              ],
    }));
  };

  return (
    <>
      <div className={styles.formGrid}>
        <label>
          <span>{translate("common:fields.type")}</span>
          <select
            value={draft.type}
            disabled={!canChangeType}
            onChange={(event) =>
              setQuestionType(event.target.value as QuizQuestionType)
            }
          >
            <option value="SingleChoice">
              {translate("assessment:quiz.singleChoice")}
            </option>
            <option value="MultipleSelect">
              {translate("assessment:quiz.multipleSelect")}
            </option>
            <option value="TrueFalse">
              {translate("assessment:quiz.trueFalse")}
            </option>
            <option value="ShortAnswer">
              {translate("assessment:quiz.shortAnswer")}
            </option>
          </select>
        </label>
        <label>
          <span>{translate("assessment:points")}</span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={draft.points}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                points: Number(event.target.value),
              }))
            }
          />
        </label>
        <div className={`${styles.full} ${styles.markdownField}`}>
          <span>{translate("assessment:quiz.question")}</span>
          <RichTextEditor
            content={draft.stem}
            onChange={(stem) => setDraft((current) => ({ ...current, stem }))}
            placeholder={translate("assessment:quiz.questionPlaceholder")}
            ariaLabel={translate("assessment:quiz.questionAria")}
          />
        </div>
      </div>
      {draft.type !== "ShortAnswer" ? (
        <fieldset className={styles.optionEditor}>
          <legend>{translate("assessment:quiz.options")}</legend>
          {draft.options?.map((option, index) => (
            <div key={option.id ?? index}>
              <input
                type={draft.type === "MultipleSelect" ? "checkbox" : "radio"}
                name={`correct-option-${canChangeType ? "new" : "edit"}`}
                aria-label={translate("assessment:quiz.markCorrect", {
                  number: formatNumber(index + 1),
                })}
                checked={Boolean(option.isCorrect)}
                onChange={() =>
                  setDraft((current) => ({
                    ...current,
                    options: current.options?.map((item, optionIndex) => ({
                      ...item,
                      isCorrect:
                        current.type === "MultipleSelect"
                          ? optionIndex === index
                            ? !item.isCorrect
                            : item.isCorrect
                          : optionIndex === index,
                    })),
                  }))
                }
              />
              <RichTextEditor
                className={styles.optionMarkdownEditor}
                variant="inline"
                showToolbar={false}
                content={option.label}
                disabled={draft.type === "TrueFalse"}
                placeholder={translate("assessment:quiz.optionNumber", {
                  number: formatNumber(index + 1),
                })}
                ariaLabel={translate("assessment:quiz.optionNumber", {
                  number: formatNumber(index + 1),
                })}
                onChange={draft.type === 'TrueFalse' ? undefined : (label) =>
                  setDraft((current) => ({
                    ...current,
                    options: current.options?.map((item, optionIndex) =>
                      optionIndex === index ? { ...item, label } : item,
                    ),
                  }))
                }
              />
              {draft.type !== "TrueFalse" &&
              (draft.options?.length ?? 0) > 2 ? (
                <button
                  type="button"
                  aria-label={translate("assessment:quiz.removeOption", {
                    number: formatNumber(index + 1),
                  })}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      options: current.options?.filter(
                        (_, optionIndex) => optionIndex !== index,
                      ),
                    }))
                  }
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          ))}
          {draft.type !== "TrueFalse" ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  options: [
                    ...(current.options ?? []),
                    {
                      label: "",
                      isCorrect: false,
                      position: (current.options?.length ?? 0) + 1,
                    },
                  ],
                }))
              }
            >
              <Plus size={16} /> {translate("assessment:quiz.addOption")}
            </button>
          ) : null}
        </fieldset>
      ) : null}
    </>
  );
};

const QuizEditorPage = () => {
  const { t: translate } = useTranslation();
  const { courseId: courseIdParam, quizId: quizIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const quizId = quizIdParam ? Number(quizIdParam) : null;
  const isNew = quizId === null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useCourseAccess(Number.isInteger(courseId) ? courseId : null);
  const idempotency = useIdempotencyCheckpoint();
  const defaultRange = useMemo(() => defaultDateTimeRange(), []);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [opensAt, setOpensAt] = useState(defaultRange.start);
  const [closesAt, setClosesAt] = useState(defaultRange.end);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState("");
  const [attemptsAllowed, setAttemptsAllowed] = useState(1);
  const [resultVisibility, setResultVisibility] =
    useState<QuizResultVisibility>("AfterRelease");
  const [questionDraft, setQuestionDraft] = useState(defaultQuestion);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(
    null,
  );
  const [editingQuestionDraft, setEditingQuestionDraft] =
    useState<CreateQuizQuestionRequest>(defaultQuestion);
  const [answerKeyQuestionId, setAnswerKeyQuestionId] = useState<number | null>(
    null,
  );
  const [answerKeyOptionIds, setAnswerKeyOptionIds] = useState<number[]>([]);
  const [answerKeyReason, setAnswerKeyReason] = useState("");
  const [confirmDeleteQuestionId, setConfirmDeleteQuestionId] = useState<
    number | null
  >(null);
  const [confirmDeleteQuiz, setConfirmDeleteQuiz] = useState(false);
  const [message, setMessage] = useState<{
    key: string;
    tone: "error" | "success";
  } | null>(null);

  const quizQuery = useQuery({
    queryKey: ["quiz", courseId, quizId],
    queryFn: async () =>
      unwrapData(await quizApiService.getQuiz(courseId, quizId!), "getQuiz"),
    enabled: !isNew && Number.isInteger(courseId) && Number.isInteger(quizId),
    retry: 1,
  });
  const questionsQuery = useQuery({
    queryKey: ["quiz-questions", courseId, quizId],
    queryFn: async () =>
      unwrapData(
        await quizApiService.listQuestions(courseId, quizId!),
        "listQuestions",
      ),
    enabled: !isNew && Number.isInteger(courseId) && Number.isInteger(quizId),
    retry: 1,
  });

  useEffect(() => {
    const quiz = quizQuery.data;
    if (!quiz) return;
    setTitle(quiz.title);
    setInstructions(quiz.instructions ?? "");
    setOpensAt(quiz.opensAtLocal.slice(0, 16));
    setClosesAt(quiz.closesAtLocal.slice(0, 16));
    setTimeLimitMinutes(
      quiz.timeLimitSeconds
        ? String(Math.round(quiz.timeLimitSeconds / 60))
        : "",
    );
    setAttemptsAllowed(quiz.attemptsAllowed);
    setResultVisibility(quiz.resultVisibility);
    // Rehydrate only when the quiz identity/version changes, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizQuery.data?.id, quizQuery.data?.version]);

  const settingsPayload = useMemo(
    () => ({
      title: title.trim(),
      instructions: instructions.trim(),
      opensAt,
      closesAt,
      timeLimitSeconds: timeLimitMinutes
        ? Math.round(Number(timeLimitMinutes) * 60)
        : null,
      attemptsAllowed,
      resultVisibility,
    }),
    [
      attemptsAllowed,
      closesAt,
      instructions,
      opensAt,
      resultVisibility,
      timeLimitMinutes,
      title,
    ],
  );

  const saveQuiz = useMutation({
    mutationFn: () => {
      const operation = isNew
        ? `quiz-create-${courseId}`
        : `quiz-update-${courseId}-${quizId}`;
      if (isNew) {
        const key = idempotency.keyFor(
          operation,
          idempotencyFingerprint(settingsPayload),
        );
        return quizApiService.createQuiz(courseId, settingsPayload, key);
      }
      const request = {
        ...settingsPayload,
        expectedVersion: quizQuery.data!.version,
      };
      const key = idempotency.keyFor(
        operation,
        idempotencyFingerprint(request),
      );
      return quizApiService.patchQuiz(courseId, quizId, request, key);
    },
    onSuccess: async (response) => {
      const saved = unwrapData(response, "saveQuiz");
      const operation = isNew
        ? `quiz-create-${courseId}`
        : `quiz-update-${courseId}-${quizId}`;
      const request = isNew
        ? settingsPayload
        : { ...settingsPayload, expectedVersion: quizQuery.data!.version };
      idempotency.completeFingerprint(
        operation,
        idempotencyFingerprint(request),
      );
      await queryClient.invalidateQueries({
        queryKey: ["course-quizzes", courseId],
      });
      setMessage({ key: "assessment:quiz.settingsSaved", tone: "success" });
      if (isNew)
        navigate(`/course/${courseId}/quizzes/${saved.id}/edit`, {
          replace: true,
        });
      else
        await queryClient.invalidateQueries({
          queryKey: ["quiz", courseId, quizId],
        });
    },
    onError: () =>
      setMessage({ key: "assessment:quiz.settingsFailed", tone: "error" }),
  });

  const addQuestion = useMutation({
    mutationFn: () => {
      const request = normalizedQuestion(questionDraft);
      const operation = `quiz-question-create-${courseId}-${quizId}`;
      return quizApiService.createQuestion(
        courseId,
        quizId!,
        request,
        idempotency.keyFor(operation, idempotencyFingerprint(request)),
      );
    },
    onSuccess: async () => {
      const request = normalizedQuestion(questionDraft);
      const operation = `quiz-question-create-${courseId}-${quizId}`;
      idempotency.completeFingerprint(
        operation,
        idempotencyFingerprint(request),
      );
      setQuestionDraft(defaultQuestion());
      setMessage({ key: "assessment:quiz.questionAdded", tone: "success" });
      await queryClient.invalidateQueries({
        queryKey: ["quiz-questions", courseId, quizId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["quiz", courseId, quizId],
      });
    },
    onError: () =>
      setMessage({ key: "assessment:quiz.addFailed", tone: "error" }),
  });

  const saveQuestion = useMutation({
    mutationFn: ({
      questionId,
      expectedVersion,
    }: {
      questionId: number;
      expectedVersion: number;
    }) => {
      const request = {
        ...normalizedQuestion(editingQuestionDraft),
        expectedVersion,
      };
      const operation = `quiz-question-update-${courseId}-${quizId}-${questionId}`;
      return quizApiService.patchQuestion(
        courseId,
        quizId!,
        questionId,
        request,
        idempotency.keyFor(operation, idempotencyFingerprint(request)),
      );
    },
    onSuccess: async (_, { questionId, expectedVersion }) => {
      const request = {
        ...normalizedQuestion(editingQuestionDraft),
        expectedVersion,
      };
      const operation = `quiz-question-update-${courseId}-${quizId}-${questionId}`;
      idempotency.completeFingerprint(
        operation,
        idempotencyFingerprint(request),
      );
      setEditingQuestionId(null);
      setMessage({ key: "assessment:quiz.questionUpdated", tone: "success" });
      await queryClient.invalidateQueries({
        queryKey: ["quiz-questions", courseId, quizId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["quiz", courseId, quizId],
      });
    },
    onError: () =>
      setMessage({ key: "assessment:quiz.updateFailed", tone: "error" }),
  });

  const correctAnswerKey = useMutation({
    mutationFn: ({
      questionId,
      request,
    }: {
      questionId: number;
      request: PatchQuizAnswerKeyRequest;
    }) => {
      const operation = `quiz-answer-key-${courseId}-${quizId}-${questionId}`;
      return quizApiService.patchAnswerKey(
        courseId,
        quizId!,
        questionId,
        request,
        idempotency.keyFor(operation, idempotencyFingerprint(request)),
      );
    },
    onSuccess: async (_, { questionId, request }) => {
      const operation = `quiz-answer-key-${courseId}-${quizId}-${questionId}`;
      idempotency.completeFingerprint(
        operation,
        idempotencyFingerprint(request),
      );
      setAnswerKeyQuestionId(null);
      setAnswerKeyOptionIds([]);
      setAnswerKeyReason("");
      setMessage({ key: "assessment:quiz.keyCorrected", tone: "success" });
      // A correction can change authoring totals, grading progress, historical
      // results, learner gradebooks, and list summaries in one operation.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["quiz-questions", courseId, quizId],
        }),
        queryClient.invalidateQueries({ queryKey: ["quiz", courseId, quizId] }),
        queryClient.invalidateQueries({
          queryKey: ["quiz-grading-summary", courseId, quizId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["quiz-attempts", courseId, quizId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["quiz-my-result", courseId, quizId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["quiz-attempt-result", courseId, quizId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["course-my-grades", courseId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["course-quizzes", courseId],
        }),
      ]);
    },
    onError: () =>
      setMessage({ key: "assessment:quiz.keyFailed", tone: "error" }),
  });

  const deleteQuestion = useMutation({
    mutationFn: (questionId: number) =>
      quizApiService.deleteQuestion(courseId, quizId!, questionId),
    onSuccess: async () => {
      setConfirmDeleteQuestionId(null);
      await queryClient.invalidateQueries({
        queryKey: ["quiz-questions", courseId, quizId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["quiz", courseId, quizId],
      });
    },
  });

  const deleteQuiz = useMutation({
    mutationFn: () => quizApiService.deleteQuiz(courseId, quizId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["course-quizzes", courseId],
      });
      navigate(`/course/${courseId}`, { replace: true });
    },
    onError: () =>
      setMessage({ key: "assessment:quiz.deleteFailed", tone: "error" }),
  });

  const reorderQuestions = useMutation({
    mutationFn: (questionIds: number[]) => {
      const operation = `quiz-questions-reorder-${courseId}-${quizId}`;
      return quizApiService.reorderQuestions(
        courseId,
        quizId!,
        questionIds,
        idempotency.keyFor(operation, idempotencyFingerprint(questionIds)),
      );
    },
    onSuccess: async (_, questionIds) => {
      const operation = `quiz-questions-reorder-${courseId}-${quizId}`;
      idempotency.completeFingerprint(
        operation,
        idempotencyFingerprint(questionIds),
      );
      await queryClient.invalidateQueries({
        queryKey: ["quiz-questions", courseId, quizId],
      });
    },
  });

  const publishQuiz = useMutation({
    mutationFn: () => {
      const action =
        quizQuery.data?.state === "Published" ? "unpublish" : "publish";
      const operation = `quiz-${action}-${courseId}-${quizId}`;
      const key = idempotency.keyFor(operation, operation);
      return action === "unpublish"
        ? quizApiService.unpublishQuiz(courseId, quizId!, key)
        : quizApiService.publishQuiz(courseId, quizId!, key);
    },
    onSuccess: async () => {
      const action =
        quizQuery.data?.state === "Published" ? "unpublish" : "publish";
      const operation = `quiz-${action}-${courseId}-${quizId}`;
      idempotency.completeFingerprint(operation, operation);
      await queryClient.invalidateQueries({
        queryKey: ["quiz", courseId, quizId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["course-quizzes", courseId],
      });
    },
  });

  const moveQuestion = (index: number, offset: -1 | 1) => {
    const questions = questionsQuery.data ?? [];
    const target = index + offset;
    if (target < 0 || target >= questions.length) return;
    // Reordering is persisted as the full permutation so the API never has to
    // infer position from a stale client-side index.
    const ids = questions.map((question) => question.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderQuestions.mutate(ids);
  };

  const submitSettings = (event: FormEvent) => {
    event.preventDefault();
    if (invalidSettings) {
      setMessage({ key: "assessment:quiz.invalidSettings", tone: "error" });
      return;
    }
    setMessage(null);
    saveQuiz.mutate();
  };

  if (access.isResolved && !access.canConfigureAssignments) {
    return (
      <main className={styles.page}>
        <p className={styles.error} role="alert">
          {translate("assessment:quiz.permissionDenied")}
        </p>
      </main>
    );
  }

  const questions = questionsQuery.data ?? [];
  const answerKeyQuestion =
    questions.find((question) => question.id === answerKeyQuestionId) ?? null;
  const answerKeyIsValid = Boolean(
    answerKeyQuestion &&
    answerKeyReason.trim() &&
    (answerKeyQuestion.type === "MultipleSelect"
      ? answerKeyOptionIds.length > 0
      : answerKeyOptionIds.length === 1),
  );
  const rangeDuration = dateTimeDurationMinutes(opensAt, closesAt);
  const selectedDuration = presetDuration(rangeDuration, LONG_DURATION_OPTIONS);
  const invalidWindow = Boolean(opensAt && closesAt && closesAt <= opensAt);
  const invalidSettings =
    !title.trim() ||
    !opensAt ||
    !closesAt ||
    invalidWindow ||
    !Number.isInteger(attemptsAllowed) ||
    attemptsAllowed < 1 ||
    Boolean(
      timeLimitMinutes &&
      (!Number.isInteger(Number(timeLimitMinutes)) ||
        Number(timeLimitMinutes) < 1),
    );
  const changeOpensAt = (value: string) => {
    const duration = rangeDuration ?? DEFAULT_DURATION_MINUTES;
    setOpensAt(value);
    if (value) setClosesAt(addMinutesToDateTimeValue(value, duration));
  };
  const changeDuration = (minutes: number) => {
    if (opensAt) setClosesAt(addMinutesToDateTimeValue(opensAt, minutes));
  };

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <Link
          to={
            isNew
              ? `/course/${courseId}`
              : `/course/${courseId}/quizzes/${quizId}`
          }
          className={styles.backLink}
          aria-label={translate("common:actions.back")}
          title={translate("common:actions.back")}
        >
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <div>
          <p className={styles.eyebrow}>
            {isNew
              ? translate("assessment:quiz.new")
              : quizQuery.data?.state
                ? statusLabel(quizQuery.data.state)
                : translate("assessment:quiz.editor")}
          </p>
          <h1>
            {isNew
              ? translate("assessment:quiz.createHeading")
              : translate("assessment:quiz.editNamed", {
                  title:
                    quizQuery.data?.title || translate("calendar:kinds.Quiz"),
                })}
          </h1>
        </div>
      </div>

      {!isNew && quizQuery.isError ? (
        <TeachingState
          error={quizQuery.error}
          onRetry={() => void quizQuery.refetch()}
        />
      ) : null}
      <form noValidate className={styles.card} onSubmit={submitSettings}>
        <div className={styles.cardHeader}>
          <div>
            <h2>{translate("assessment:quiz.settings")}</h2>
            <p>{translate("assessment:quiz.timeHelp")}</p>
          </div>
          <button
            className={styles.primaryButton}
            disabled={
              saveQuiz.isPending ||
              invalidSettings ||
              (!isNew && !quizQuery.data)
            }
          >
            {saveQuiz.isPending
              ? translate("common:actions.saving")
              : isNew
                ? translate("assessment:quiz.create")
                : translate("assessment:quiz.saveSettings")}
          </button>
        </div>
        <div className={styles.formGrid}>
          <label className={styles.full}>
            <span>{translate("common:fields.title")}</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
          <div className={`${styles.full} ${styles.markdownField}`}>
            <span>{translate("common:admin.examFields.instructions")}</span>
            <RichTextEditor
              content={instructions}
              onChange={setInstructions}
              placeholder={translate("assessment:quiz.instructionsPlaceholder")}
              ariaLabel={translate("assessment:quiz.instructionsAria")}
            />
          </div>
          <label>
            <span>{translate("assessment:quiz.opens")}</span>
            <EnglishDateTimeInput
              aria-label={translate('assessment:quiz.opens')}
              value={opensAt}
              onChangeValue={changeOpensAt}
              required
            />
          </label>
          <label>
            <span>{translate("assessment:quiz.closes")}</span>
            <EnglishDateTimeInput
              aria-label={translate('assessment:quiz.closes')}
              value={closesAt}
              onChangeValue={setClosesAt}
              required
            />
          </label>
          <DurationSelect
            minutes={selectedDuration}
            options={LONG_DURATION_OPTIONS}
            onChange={changeDuration}
          />
          <span />
          <label>
            <span>{translate("assessment:quiz.timeLimit")}</span>
            <input
              type="number"
              min="1"
              value={timeLimitMinutes}
              onChange={(event) => setTimeLimitMinutes(event.target.value)}
              placeholder={translate("assessment:quiz.unlimited")}
            />
          </label>
          <label>
            <span>{translate("assessment:quiz.attempts")}</span>
            <input
              type="number"
              min="1"
              value={attemptsAllowed}
              onChange={(event) =>
                setAttemptsAllowed(Math.max(1, Number(event.target.value)))
              }
            />
          </label>
          <label className={styles.full}>
            <span>{translate("assessment:quiz.visibility")}</span>
            <select
              value={resultVisibility}
              onChange={(event) =>
                setResultVisibility(event.target.value as QuizResultVisibility)
              }
            >
              <option value="AfterRelease">
                {translate("course:grades.afterRelease")}
              </option>
              <option value="InstantAutoScore">
                {translate("course:grades.instant")}
              </option>
            </select>
          </label>
        </div>
        {invalidWindow ? (
          <p className={styles.error} role="alert">
            {translate("assessment:quiz.invalidTime")}
          </p>
        ) : null}
        {message ? (
          <p
            className={message.tone === "error" ? styles.error : styles.success}
            role={message.tone === "error" ? "alert" : "status"}
          >
            {translate(message.key)}
          </p>
        ) : null}
      </form>

      {!isNew ? (
        <>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>{translate("common:admin.examFields.questions")}</h2>
                <p>
                  {translate("assessment:quiz.summary", {
                    count: questions.length,
                    number: formatNumber(questions.length),
                    points: formatNumber(quizQuery.data?.totalPoints ?? 0),
                  })}
                </p>
              </div>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => publishQuiz.mutate()}
                disabled={
                  publishQuiz.isPending ||
                  (!questions.length && quizQuery.data?.state !== "Published")
                }
              >
                {quizQuery.data?.state === "Published"
                  ? translate("assessment:quiz.unpublish")
                  : translate("assessment:quiz.publish")}
              </button>
            </div>
            {publishQuiz.isError ||
            reorderQuestions.isError ||
            deleteQuestion.isError ? (
              <p className={styles.error} role="alert">
                {translate("assessment:quiz.actionFailed")}
              </p>
            ) : null}
            {quizQuery.data?.hasAttempts ? (
              <p className={styles.lockedNotice}>
                {translate("assessment:quiz.lockedHelp")}
              </p>
            ) : null}
            {questionsQuery.isError ? (
              <TeachingState
                error={questionsQuery.error}
                onRetry={() => void questionsQuery.refetch()}
              />
            ) : questionsQuery.isPending ? (
              <TeachingState loading />
            ) : questions.length ? (
              <ol className={styles.questionList}>
                {questions.map((question, index) => (
                  <li key={question.id}>
                    <div>
                      <MarkdownMessage content={question.stem} />
                      <small>
                        {quizQuestionTypeLabel(question.type)} ·{" "}
                        {formatNumber(question.points)}{" "}
                        {translate("course:assignmentSubmissionDetail.points")}
                      </small>
                    </div>
                    <div className={styles.rowActions}>
                      {quizQuery.data?.hasAttempts &&
                      question.type !== "ShortAnswer" ? (
                        <button
                          type="button"
                          className={styles.answerKeyButton}
                          aria-label={translate(
                            "assessment:quiz.correctNamed",
                            { title: question.stem },
                          )}
                          onClick={() => {
                            setAnswerKeyQuestionId(question.id);
                            setAnswerKeyOptionIds(
                              question.options
                                .filter((option) => option.isCorrect)
                                .map((option) => option.id),
                            );
                            setAnswerKeyReason("");
                            setEditingQuestionId(null);
                            setMessage(null);
                          }}
                        >
                          <KeyRound size={16} />
                          <span>{translate("assessment:quiz.correctKey")}</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={translate(
                          "assessment:quiz.editQuestionNamed",
                          { title: question.stem },
                        )}
                        disabled={quizQuery.data?.hasAttempts}
                        onClick={() => {
                          setEditingQuestionId(question.id);
                          setEditingQuestionDraft(questionToDraft(question));
                          setAnswerKeyQuestionId(null);
                          setMessage(null);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={translate("assessment:quiz.moveUp", {
                          title: question.stem,
                        })}
                        disabled={index === 0 || quizQuery.data?.hasAttempts}
                        onClick={() => moveQuestion(index, -1)}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={translate("assessment:quiz.moveDown", {
                          title: question.stem,
                        })}
                        disabled={
                          index === questions.length - 1 ||
                          quizQuery.data?.hasAttempts
                        }
                        onClick={() => moveQuestion(index, 1)}
                      >
                        <ArrowDown size={16} />
                      </button>
                      {confirmDeleteQuestionId === question.id ? (
                        <>
                          <button
                            type="button"
                            className={styles.dangerText}
                            onClick={() => deleteQuestion.mutate(question.id)}
                          >
                            {translate("common:actions.confirm")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteQuestionId(null)}
                          >
                            {translate("common:actions.cancel")}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          aria-label={translate(
                            "assessment:quiz.deleteQuestionNamed",
                            { title: question.stem },
                          )}
                          disabled={quizQuery.data?.hasAttempts}
                          onClick={() =>
                            setConfirmDeleteQuestionId(question.id)
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.empty}>
                {translate("assessment:quiz.firstQuestion")}
              </p>
            )}
          </section>

          {answerKeyQuestion ? (
            <section className={styles.card} aria-labelledby="answer-key-title">
              <div className={styles.cardHeader}>
                <div>
                  <h2 id="answer-key-title">
                    {translate("assessment:quiz.correctKeyHeading")}
                  </h2>
                  <p>{translate("assessment:quiz.correctKeyHelp")}</p>
                </div>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={translate("assessment:quiz.closeCorrection")}
                  onClick={() => setAnswerKeyQuestionId(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <MarkdownMessage content={answerKeyQuestion.stem} />
              <fieldset className={styles.answerKeyEditor}>
                <legend>
                  {translate(
                    answerKeyQuestion.type === "MultipleSelect"
                      ? "assessment:quiz.correctAnswers"
                      : "common:admin.examFields.correctAnswer",
                  )}
                </legend>
                {answerKeyQuestion.options.map((option) => (
                  <label key={option.id}>
                    <input
                      type={
                        answerKeyQuestion.type === "MultipleSelect"
                          ? "checkbox"
                          : "radio"
                      }
                      name={`answer-key-${answerKeyQuestion.id}`}
                      checked={answerKeyOptionIds.includes(option.id)}
                      onChange={() =>
                        setAnswerKeyOptionIds((current) =>
                          answerKeyQuestion.type === "MultipleSelect"
                            ? current.includes(option.id)
                              ? current.filter((id) => id !== option.id)
                              : [...current, option.id]
                            : [option.id],
                        )
                      }
                    />
                    <span>
                      <MarkdownMessage
                        content={option.label}
                      />
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className={styles.reasonField}>
                <span>{translate("common:admin.auditReason")}</span>
                <textarea
                  value={answerKeyReason}
                  onChange={(event) => setAnswerKeyReason(event.target.value)}
                  placeholder={translate("assessment:quiz.reasonPlaceholder")}
                  required
                />
              </label>
              <p className={styles.regradeWarning}>
                {translate("assessment:quiz.regradeWarning")}
              </p>
              <div className={styles.footer}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={correctAnswerKey.isPending || !answerKeyIsValid}
                  onClick={() =>
                    correctAnswerKey.mutate({
                      questionId: answerKeyQuestion.id,
                      request: {
                        options: answerKeyQuestion.options.map((option) => ({
                          optionId: option.id,
                          isCorrect: answerKeyOptionIds.includes(option.id),
                        })),
                        reason: answerKeyReason.trim(),
                        expectedVersion: answerKeyQuestion.version ?? 1,
                      },
                    })
                  }
                >
                  {correctAnswerKey.isPending
                    ? translate("assessment:quiz.regrading")
                    : translate("assessment:quiz.correctAndRegrade")}
                </button>
              </div>
            </section>
          ) : null}

          {editingQuestionId !== null ? (
            <section
              className={styles.card}
              aria-labelledby="edit-question-title"
            >
              <div className={styles.cardHeader}>
                <div>
                  <h2 id="edit-question-title">
                    {translate("assessment:quiz.editQuestion")}
                  </h2>
                  <p>{translate("assessment:quiz.typeLocked")}</p>
                </div>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={translate("assessment:quiz.closeQuestion")}
                  onClick={() => setEditingQuestionId(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <QuestionFields
                draft={editingQuestionDraft}
                setDraft={setEditingQuestionDraft}
                canChangeType={false}
              />
              <div className={styles.footer}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={
                    saveQuestion.isPending ||
                    !isQuestionValid(editingQuestionDraft)
                  }
                  onClick={() => {
                    const question = questions.find(
                      (item) => item.id === editingQuestionId,
                    );
                    if (question)
                      saveQuestion.mutate({
                        questionId: question.id,
                        expectedVersion: question.version ?? 1,
                      });
                  }}
                >
                  {saveQuestion.isPending
                    ? translate("common:actions.saving")
                    : translate("assessment:quiz.saveQuestion")}
                </button>
              </div>
            </section>
          ) : null}

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>{translate("assessment:quiz.addQuestion")}</h2>
                <p>{translate("assessment:quiz.gradingHelp")}</p>
              </div>
            </div>
            <QuestionFields
              draft={questionDraft}
              setDraft={setQuestionDraft}
              canChangeType
            />
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={
                  Boolean(quizQuery.data?.hasAttempts) ||
                  addQuestion.isPending ||
                  !isQuestionValid(questionDraft)
                }
                onClick={() => addQuestion.mutate()}
              >
                {addQuestion.isPending
                  ? translate("assessment:quiz.adding")
                  : translate("assessment:quiz.addQuestion")}
              </button>
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.dangerZone}`}
            aria-labelledby="delete-quiz-title"
          >
            <div>
              <h2 id="delete-quiz-title">
                {translate("assessment:quiz.delete")}
              </h2>
              <p>{translate("assessment:quiz.deleteWarning")}</p>
            </div>
            {confirmDeleteQuiz ? (
              <div className={styles.dangerActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setConfirmDeleteQuiz(false)}
                >
                  {translate("common:actions.cancel")}
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  disabled={deleteQuiz.isPending}
                  onClick={() => deleteQuiz.mutate()}
                >
                  {deleteQuiz.isPending
                    ? translate("common:actions.deleting")
                    : translate("assessment:quiz.confirmDelete")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => setConfirmDeleteQuiz(true)}
              >
                {translate("assessment:quiz.delete")}
              </button>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
};

export default QuizEditorPage;
