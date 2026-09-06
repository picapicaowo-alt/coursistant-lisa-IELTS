import type {
  TenantAlertRuleMode,
  TenantAlertRuleRequest,
  TenantAlertRuleResponse,
} from "@/apis";
import i18n from '@/i18n';
import {formatNumericText, formatPercent} from '@/i18n/formatting';

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
  titleKey: string;
  descriptionKey: string;
  numeric: NumericField[];
  toggle?: ToggleField;
};

export const RULE_MODES: {
  value: TenantAlertRuleMode;
  titleKey: string;
  descriptionKey: string;
}[] = [
  {
    value: "SYSTEM_DEFAULT",
    titleKey: "operations:alertRules.modes.system.title",
    descriptionKey: "operations:alertRules.modes.system.description",
  },
  {
    value: "TENANT_OVERRIDE",
    titleKey: "operations:alertRules.modes.override.title",
    descriptionKey: "operations:alertRules.modes.override.description",
  },
  {
    value: "DISABLED",
    titleKey: "common:admin.status.DISABLED",
    descriptionKey: "operations:alertRules.modes.disabled.description",
  },
];
export const NUMERIC_FIELDS: Record<
  NumericField,
  { labelKey: string; step: string }
> = {
  inactivityDays: { labelKey: "operations:alertRules.fields.inactivityDays", step: "1" },
  absenceCount: { labelKey: "common:admin.absenceCount", step: "1" },
  absenceWindowDays: { labelKey: "operations:alertRules.fields.absenceWindowDays", step: "1" },
  completionPercentage: { labelKey: "operations:alertRules.fields.completionPercentage", step: "0.01" },
  completionWindowDays: { labelKey: "operations:alertRules.fields.completionWindowDays", step: "1" },
  completionMinimumSample: { labelKey: "operations:alertRules.fields.completionMinimumSample", step: "1" },
  performancePercentage: { labelKey: "operations:alertRules.fields.performancePercentage", step: "0.01" },
  performanceMinimumGradedSample: { labelKey: "operations:alertRules.fields.performanceMinimumGradedSample", step: "1" },
  deadlineWindowDays: { labelKey: "operations:alertRules.fields.deadlineWindowDays", step: "1" },
  gradingDelayDays: { labelKey: "operations:alertRules.fields.gradingDelayDays", step: "1" },
};
export const RULE_GROUPS: RuleGroup[] = [
  {
    id: "inactivity",
    titleKey: "operations:alertRules.groups.inactivity.title",
    descriptionKey: "operations:alertRules.groups.inactivity.description",
    numeric: ["inactivityDays"],
  },
  {
    id: "attendance",
    titleKey: "operations:tabs.attendance",
    descriptionKey: "operations:alertRules.groups.attendance.description",
    numeric: ["absenceCount", "absenceWindowDays"],
  },
  {
    id: "completion",
    titleKey: "operations:alertRules.groups.completion.title",
    descriptionKey: "operations:alertRules.groups.completion.description",
    numeric: [
      "completionPercentage",
      "completionWindowDays",
      "completionMinimumSample",
    ],
  },
  {
    id: "performance",
    titleKey: "operations:alertRules.groups.performance.title",
    descriptionKey: "operations:alertRules.groups.performance.description",
    numeric: ["performancePercentage", "performanceMinimumGradedSample"],
  },
  {
    id: "deadlines",
    titleKey: "operations:alertRules.groups.deadlines.title",
    descriptionKey: "operations:alertRules.groups.deadlines.description",
    numeric: ["deadlineWindowDays", "gradingDelayDays"],
  },
  {
    id: "overdue",
    titleKey: "operations:alertRules.groups.overdue.title",
    descriptionKey: "operations:alertRules.groups.overdue.description",
    numeric: [],
    toggle: "overdueTaskEnabled",
  },
  {
    id: "checkpoints",
    titleKey: "operations:alertRules.groups.checkpoints.title",
    descriptionKey: "operations:alertRules.groups.checkpoints.description",
    numeric: [],
    toggle: "checkpointIncompleteEnabled",
  },
  {
    id: "hours",
    titleKey: "operations:alertRules.groups.hours.title",
    descriptionKey: "operations:alertRules.groups.hours.description",
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
  if (form.mode === "DISABLED") return i18n.t(group.descriptionKey);
  // A local switch to system mode cannot turn an earlier override into defaults.
  if (form.mode === "SYSTEM_DEFAULT" && baseline.mode !== "SYSTEM_DEFAULT")
    return i18n.t(group.descriptionKey);
  const values = form.mode === "SYSTEM_DEFAULT" ? toAlertForm(baseline) : form;
  if (group.toggle) return i18n.t(group.descriptionKey);
  if (group.numeric.every((key) => values[key] === "")) {
    return form.mode === "SYSTEM_DEFAULT"
      ? i18n.t(group.descriptionKey)
      : i18n.t('operations:alertRules.notConfigured');
  }
  const value = (key: NumericField) => formatNumericText(values[key]) || "—";
  const percentage = (key: NumericField) => values[key] === '' ? '—' : formatPercent(Number(values[key]) / 100, {maximumFractionDigits: 2});
  switch (group.id) {
    case "inactivity":
      return i18n.t('operations:alertRules.summary.inactivity', {count: Number(values.inactivityDays), number: value('inactivityDays')});
    case "attendance":
      return i18n.t('operations:alertRules.summary.attendance', {absences: value('absenceCount'), days: value('absenceWindowDays')});
    case "completion":
      return i18n.t('operations:alertRules.summary.completion', {percentage: percentage('completionPercentage'), days: value('completionWindowDays'), samples: value('completionMinimumSample')});
    case "performance":
      return i18n.t('operations:alertRules.summary.performance', {percentage: percentage('performancePercentage'), samples: value('performanceMinimumGradedSample')});
    case "deadlines":
      return i18n.t('operations:alertRules.summary.deadlines', {deadline: value('deadlineWindowDays'), grading: value('gradingDelayDays')});
    default:
      return i18n.t(group.descriptionKey);
  }
}
