import type {
  TenantAlertRuleMode,
  TenantAlertRuleRequest,
  TenantAlertRuleResponse,
} from "@/apis";

export type NumericField =
  | "inactivityDays"
  | "absenceCount"
  | "absenceWindowDays"
  | "completionPercentage"
  | "completionWindowDays"
  | "completionMinimumSample"
  | "performancePercentage"
  | "performanceMinimumGradedSample"
  | "deadlineWindowDays"
  | "gradingDelayDays";
export type ToggleField =
  | "overdueTaskEnabled"
  | "checkpointIncompleteEnabled"
  | "negativeHoursEnabled";
export type AlertForm = { mode: TenantAlertRuleMode } & Record<
  NumericField,
  string
> &
  Record<ToggleField, number | null>;
export type RuleGroup = {
  id: string;
  title: string;
  description: string;
  numeric: NumericField[];
  toggle?: ToggleField;
};

export const RULE_MODES: {
  value: TenantAlertRuleMode;
  title: string;
  description: string;
}[] = [
  {
    value: "SYSTEM_DEFAULT",
    title: "System default",
    description: "Platform-managed thresholds",
  },
  {
    value: "TENANT_OVERRIDE",
    title: "Tenant override",
    description: "Customize your thresholds",
  },
  {
    value: "DISABLED",
    title: "Disabled",
    description: "Pause tenant evaluation",
  },
];
export const NUMERIC_FIELDS: Record<
  NumericField,
  { label: string; step: string }
> = {
  inactivityDays: { label: "Inactivity (days)", step: "1" },
  absenceCount: { label: "Absence count", step: "1" },
  absenceWindowDays: { label: "Absence window (days)", step: "1" },
  completionPercentage: { label: "Completion percentage", step: "0.01" },
  completionWindowDays: { label: "Completion window (days)", step: "1" },
  completionMinimumSample: { label: "Completion minimum sample", step: "1" },
  performancePercentage: { label: "Performance percentage", step: "0.01" },
  performanceMinimumGradedSample: { label: "Minimum graded sample", step: "1" },
  deadlineWindowDays: { label: "Deadline window (days)", step: "1" },
  gradingDelayDays: { label: "Grading delay (days)", step: "1" },
};
export const RULE_GROUPS: RuleGroup[] = [
  {
    id: "inactivity",
    title: "Learning inactivity",
    description: "Time since the last learning activity.",
    numeric: ["inactivityDays"],
  },
  {
    id: "attendance",
    title: "Attendance",
    description: "Absences within a defined period.",
    numeric: ["absenceCount", "absenceWindowDays"],
  },
  {
    id: "completion",
    title: "Completion",
    description: "Completion rate and minimum sample size.",
    numeric: [
      "completionPercentage",
      "completionWindowDays",
      "completionMinimumSample",
    ],
  },
  {
    id: "performance",
    title: "Performance",
    description: "Performance threshold and graded samples.",
    numeric: ["performancePercentage", "performanceMinimumGradedSample"],
  },
  {
    id: "deadlines",
    title: "Deadlines and grading",
    description: "Upcoming deadlines and grading delays.",
    numeric: ["deadlineWindowDays", "gradingDelayDays"],
  },
  {
    id: "overdue",
    title: "Overdue tasks",
    description: "Include overdue tasks in evaluation.",
    numeric: [],
    toggle: "overdueTaskEnabled",
  },
  {
    id: "checkpoints",
    title: "Incomplete checkpoints",
    description: "Include incomplete study-plan checkpoints.",
    numeric: [],
    toggle: "checkpointIncompleteEnabled",
  },
  {
    id: "hours",
    title: "Negative hours",
    description: "Include negative course-hour balances.",
    numeric: [],
    toggle: "negativeHoursEnabled",
  },
];

export function toAlertForm(data: TenantAlertRuleResponse): AlertForm {
  return {
    mode: data.mode,
    ...(Object.fromEntries(
      Object.keys(NUMERIC_FIELDS).map((key) => {
        const value = data[key as NumericField];
        return [key, value == null ? "" : String(value)];
      }),
    ) as Record<NumericField, string>),
    overdueTaskEnabled: data.overdueTaskEnabled ?? null,
    checkpointIncompleteEnabled: data.checkpointIncompleteEnabled ?? null,
    negativeHoursEnabled: data.negativeHoursEnabled ?? null,
  };
}
export const numberOrNull = (value: string): number | null =>
  value.trim() ? Number(value) : null;

export function groupIsDirty(
  group: RuleGroup,
  form: AlertForm,
  baseline: AlertForm,
) {
  return (
    group.numeric.some(
      (key) => numberOrNull(form[key]) !== numberOrNull(baseline[key]),
    ) ||
    (group.toggle !== undefined &&
      form[group.toggle] !== baseline[group.toggle])
  );
}
export const formIsDirty = (form: AlertForm, baseline: AlertForm) =>
  form.mode !== baseline.mode ||
  (form.mode === "TENANT_OVERRIDE" &&
    RULE_GROUPS.some((group) => groupIsDirty(group, form, baseline)));

export function toAlertRequest(
  form: AlertForm,
  version: number,
): TenantAlertRuleRequest {
  const request: TenantAlertRuleRequest = {
    mode: form.mode,
    expectedVersion: version,
  };
  if (form.mode !== "TENANT_OVERRIDE") return request;
  for (const key of Object.keys(NUMERIC_FIELDS) as NumericField[])
    request[key] = numberOrNull(form[key]);
  // Preserve untouched flags and the established 1 / null representation for
  // switch edits. This UI does not invent per-category enable fields.
  for (const group of RULE_GROUPS)
    if (group.toggle) request[group.toggle] = form[group.toggle];
  return request;
}

export function ruleSummary(
  group: RuleGroup,
  form: AlertForm,
  baseline: TenantAlertRuleResponse,
) {
  if (form.mode === "DISABLED") return group.description;
  // A local switch to system mode cannot turn an earlier override into defaults.
  if (form.mode === "SYSTEM_DEFAULT" && baseline.mode !== "SYSTEM_DEFAULT")
    return group.description;
  const values = form.mode === "SYSTEM_DEFAULT" ? toAlertForm(baseline) : form;
  if (group.toggle) return group.description;
  if (group.numeric.every((key) => values[key] === "")) {
    return form.mode === "SYSTEM_DEFAULT"
      ? group.description
      : "Not configured";
  }
  const value = (key: NumericField) => values[key] || "—";
  switch (group.id) {
    case "inactivity":
      return `Inactivity: ${value("inactivityDays")} days`;
    case "attendance":
      return `${value("absenceCount")} absences within ${value("absenceWindowDays")} days`;
    case "completion":
      return `${value("completionPercentage")}% completion · ${value("completionWindowDays")} days · min. ${value("completionMinimumSample")} samples`;
    case "performance":
      return `${value("performancePercentage")}% threshold · min. ${value("performanceMinimumGradedSample")} graded`;
    case "deadlines":
      return `Deadline window: ${value("deadlineWindowDays")} days · grading delay: ${value("gradingDelayDays")} days`;
    default:
      return group.description;
  }
}
