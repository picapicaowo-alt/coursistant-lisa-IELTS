import i18n from "./index";

/** Only known identity codes are localized; unknown server values remain diagnosable. */
export function roleLabel(value?: string | null): string {
  if (!value) return "";
  const key = `common:roles.${value.toUpperCase()}`;
  if (value.toUpperCase() === "TA")
    return i18n.t("common:admin.courseRoles.TA");
  return i18n.exists(key) ? i18n.t(key) : value;
}

const statusAliases: Record<string, string> = {
  PENDING: "pending",
  IN_PROGRESS: "inProgress",
  RESOLVED: "resolved",
};

const statusKeys: Record<string, string> = {
  DISABLED: "common:admin.status.DISABLED",
  MID_TERM: "operations:midTermReport",
  FINAL: "operations:finalReport",
  INDIVIDUAL: "assessment:assignment.individual",
  GROUP: "course:assignmentSubmissionDetail.group",
  UNGRADED: "course:assignmentSubmissionDetail.ungraded",
  SUBMITTED_LATE: "assessment:submission.submittedLate",
  NOT_SUBMITTED_CLOSED: "assessment:submission.closed",
  UNASSIGNED: "advising:studentIntake.unassigned",
  PRE_CLASS: "auth:preview.preClass",
  HOMEWORK: "auth:preview.homework",
  PRACTICE: "auth:preview.practice",
  ONE_ON_ONE: "advising:studentCourses.oneToOne",
};

/** Translate known presentation codes without modifying their API representation. */
export function statusLabel(value?: string | null): string {
  if (!value) return i18n.t("common:feedback.notProvided");
  const code = value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
  const key =
    statusKeys[code] ?? `common:status.${statusAliases[code] ?? code}`;
  if (i18n.exists(key)) return i18n.t(key);
  const taskTypeKey = `advising:actionTasks.types.${code}`;
  return i18n.exists(taskTypeKey) ? i18n.t(taskTypeKey) : value;
}

const questionTypeKeys: Record<string, string> = {
  SingleChoice: "assessment:quiz.singleChoice",
  MultipleSelect: "assessment:quiz.multipleSelect",
  TrueFalse: "assessment:quiz.trueFalse",
  ShortAnswer: "assessment:quiz.shortAnswer",
};

export function quizQuestionTypeLabel(value: string): string {
  return questionTypeKeys[value] ? i18n.t(questionTypeKeys[value]) : value;
}
