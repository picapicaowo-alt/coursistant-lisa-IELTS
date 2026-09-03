import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, RefreshCw } from "lucide-react";
import type { TenantAlertRuleMode, TenantAlertRuleResponse } from "@/apis";
import { unwrapData } from "@/apis";
import { courseOperationsApiService } from "@/apis/services/course-operations-api";
import { getApiErrorMessage } from "@/utils/apiError";
import styles from "@/components/TenantWorkspace/workspace.module.scss";
import rulesStyles from "./rules.module.scss";

type NumericField =
  | "deadlineWindowDays"
  | "absenceCount"
  | "absenceWindowDays"
  | "completionPercentage"
  | "completionWindowDays"
  | "completionMinimumSample"
  | "inactivityDays"
  | "performancePercentage"
  | "performanceMinimumGradedSample"
  | "gradingDelayDays";
type ToggleField =
  "negativeHoursEnabled" | "overdueTaskEnabled" | "checkpointIncompleteEnabled";
type AlertForm = { mode: TenantAlertRuleMode } & Record<NumericField, string> &
  Record<ToggleField, boolean>;

const emptyForm: AlertForm = {
  mode: "SYSTEM_DEFAULT",
  deadlineWindowDays: "",
  absenceCount: "",
  absenceWindowDays: "",
  completionPercentage: "",
  completionWindowDays: "",
  completionMinimumSample: "",
  inactivityDays: "",
  performancePercentage: "",
  performanceMinimumGradedSample: "",
  gradingDelayDays: "",
  negativeHoursEnabled: false,
  overdueTaskEnabled: false,
  checkpointIncompleteEnabled: false,
};
const numericFields: { key: NumericField; label: string; step?: string }[] = [
  { key: "deadlineWindowDays", label: "Deadline window (days)" },
  { key: "absenceCount", label: "Absence count" },
  { key: "absenceWindowDays", label: "Absence window (days)" },
  { key: "completionPercentage", label: "Completion percentage", step: "0.01" },
  { key: "completionWindowDays", label: "Completion window (days)" },
  { key: "completionMinimumSample", label: "Completion minimum sample" },
  { key: "inactivityDays", label: "Inactivity (days)" },
  {
    key: "performancePercentage",
    label: "Performance percentage",
    step: "0.01",
  },
  { key: "performanceMinimumGradedSample", label: "Minimum graded sample" },
  { key: "gradingDelayDays", label: "Grading delay (days)" },
];
const toggleFields: { key: ToggleField; label: string }[] = [
  { key: "negativeHoursEnabled", label: "Negative hours" },
  { key: "overdueTaskEnabled", label: "Overdue tasks" },
  { key: "checkpointIncompleteEnabled", label: "Incomplete checkpoints" },
];

type RuleGroup = {
  title: string;
  description: string;
  numeric: NumericField[];
  toggle?: ToggleField;
};
const ruleGroups: RuleGroup[] = [
  {
    title: "Learning inactivity",
    description: "Set the inactivity window used by alert evaluation.",
    numeric: ["inactivityDays"],
  },
  {
    title: "Attendance",
    description: "Review absence count within a defined window.",
    numeric: ["absenceCount", "absenceWindowDays"],
  },
  {
    title: "Completion",
    description: "Set completion thresholds and the minimum sample.",
    numeric: [
      "completionPercentage",
      "completionWindowDays",
      "completionMinimumSample",
    ],
  },
  {
    title: "Performance",
    description: "Set a performance percentage and minimum graded sample.",
    numeric: ["performancePercentage", "performanceMinimumGradedSample"],
  },
  {
    title: "Deadlines and grading",
    description: "Configure deadline and grading-delay windows.",
    numeric: ["deadlineWindowDays", "gradingDelayDays"],
  },
  {
    title: "Overdue tasks",
    description: "Include overdue tasks in tenant alert evaluation.",
    numeric: [],
    toggle: "overdueTaskEnabled",
  },
  {
    title: "Incomplete checkpoints",
    description: "Include incomplete study-plan checkpoints.",
    numeric: [],
    toggle: "checkpointIncompleteEnabled",
  },
  {
    title: "Negative hours",
    description: "Include negative course-hour balances.",
    numeric: [],
    toggle: "negativeHoursEnabled",
  },
];

const toForm = (data: TenantAlertRuleResponse): AlertForm => {
  const form = { ...emptyForm, mode: data.mode };
  numericFields.forEach(({ key }) => {
    form[key] = data[key] == null ? "" : String(data[key]);
  });
  toggleFields.forEach(({ key }) => {
    form[key] = data[key] === 1;
  });
  return form;
};
const numberOrNull = (value: string): number | null =>
  value.trim() ? Number(value) : null;

const ruleSummary = (
  group: RuleGroup,
  form: AlertForm,
  data: TenantAlertRuleResponse,
) => {
  if (form.mode === "DISABLED") return "Tenant alert evaluation is disabled.";
  if (form.mode === "SYSTEM_DEFAULT") {
    // An unsaved mode switch must not present the previous override as a system value.
    if (data.mode !== "SYSTEM_DEFAULT")
      return "System default values unavailable until the policy is saved.";
    if (group.toggle)
      return data[group.toggle] == null
        ? "System default value unavailable."
        : `System default: ${data[group.toggle] === 1 ? "Enabled" : "Disabled"}`;
  }
  if (group.toggle)
    return form[group.toggle]
      ? "Included in tenant alert evaluation."
      : "Not included in tenant alert evaluation.";
  return group.numeric
    .map((key) => {
      const value = form.mode === "SYSTEM_DEFAULT" ? data[key] : form[key];
      return `${numericFields.find((field) => field.key === key)?.label}: ${value == null || value === "" ? (form.mode === "SYSTEM_DEFAULT" ? "Unavailable" : "Not configured") : value}`;
    })
    .join(" · ");
};

const groupIsDirty = (group: RuleGroup, form: AlertForm, saved: AlertForm) =>
  form.mode !== saved.mode ||
  (form.mode === "TENANT_OVERRIDE" &&
    (group.numeric.some(
      (key) => numberOrNull(form[key]) !== numberOrNull(saved[key]),
    ) ||
      (group.toggle !== undefined &&
        form[group.toggle] !== saved[group.toggle])));

export const AlertRulesPanel = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AlertForm>(emptyForm);
  const [saved, setSaved] = useState(false);
  const rules = useQuery({
    queryKey: ["tenant", "alert-rules"],
    queryFn: async () =>
      unwrapData(
        await courseOperationsApiService.getTenantAlertRules(),
        "tenantAlertRules",
      ),
    retry: false,
  });
  useEffect(() => {
    if (rules.data) setForm(toForm(rules.data));
  }, [rules.data]);
  const save = useMutation({
    mutationFn: () =>
      courseOperationsApiService.putTenantAlertRules(
        form.mode === "TENANT_OVERRIDE"
          ? {
              mode: form.mode,
              ...(rules.data ? { expectedVersion: rules.data.version } : {}),
              ...Object.fromEntries(
                numericFields.map(({ key }) => [key, numberOrNull(form[key])]),
              ),
              ...Object.fromEntries(
                toggleFields.map(({ key }) => [key, form[key] ? 1 : null]),
              ),
            }
          : {
              mode: form.mode,
              ...(rules.data ? { expectedVersion: rules.data.version } : {}),
            },
      ),
    onSuccess: async (response) => {
      const latest = unwrapData(response, "tenantPutAlertRules");
      setSaved(true);
      setForm(toForm(latest));
      queryClient.setQueryData(["tenant", "alert-rules"], latest);
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    save.mutate();
  };

  return (
    <section aria-label="Tenant alert rules">
      <div className={styles.sectionHeading}>
        <div>
          <h2>Rule configurations</h2>
          <p className={styles.hint}>
            Configure tenant policy without opening individual student risk
            records.
          </p>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Refresh alert rules"
          onClick={() => void rules.refetch()}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      {rules.isPending ? (
        <p className={styles.status}>Loading alert rules…</p>
      ) : null}
      {rules.isError ? (
        <div className={styles.errorNotice} role="alert">
          <p>
            {getApiErrorMessage(
              rules.error,
              "Alert rules could not be loaded.",
            )}
          </p>
          <button type="button" onClick={() => void rules.refetch()}>
            Try again
          </button>
        </div>
      ) : null}
      {rules.data ? (
        <form className={styles.form} onSubmit={submit}>
          <fieldset className={rulesStyles.modePicker}>
            <legend>Rule mode</legend>
            <label>
              <input
                type="radio"
                name="mode"
                checked={form.mode === "SYSTEM_DEFAULT"}
                onChange={() => {
                  setSaved(false);
                  setForm((current) => ({
                    ...current,
                    mode: "SYSTEM_DEFAULT",
                  }));
                }}
              />
              <span>
                <strong>System default</strong>
                <small>Platform-managed thresholds</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="mode"
                checked={form.mode === "TENANT_OVERRIDE"}
                onChange={() => {
                  setSaved(false);
                  setForm((current) => ({
                    ...current,
                    mode: "TENANT_OVERRIDE",
                  }));
                }}
              />
              <span>
                <strong>Tenant override</strong>
                <small>Customize your thresholds</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="mode"
                checked={form.mode === "DISABLED"}
                onChange={() => {
                  setSaved(false);
                  setForm((current) => ({ ...current, mode: "DISABLED" }));
                }}
              />
              <span>
                <strong>Disabled</strong>
                <small>Pause tenant evaluation</small>
              </span>
            </label>
          </fieldset>
          <div className={rulesStyles.rules}>
            {ruleGroups.map((group) => (
              <details className={rulesStyles.rule} key={group.title}>
                <summary>
                  <span>
                    <strong>{group.title}</strong>
                    <small>{ruleSummary(group, form, rules.data)}</small>
                  </span>
                  <span className={rulesStyles.ruleMeta}>
                    {groupIsDirty(group, form, toForm(rules.data)) ? (
                      <span className={rulesStyles.unsaved}>
                        Unsaved changes
                      </span>
                    ) : null}
                    {form.mode === "TENANT_OVERRIDE" && group.toggle ? (
                      <span
                        className={rulesStyles.checkState}
                        data-enabled={form[group.toggle]}
                      >
                        {form[group.toggle] ? "Enabled" : "Disabled"}
                      </span>
                    ) : null}
                    <ChevronDown size={18} />
                  </span>
                </summary>
                <fieldset
                  disabled={form.mode !== "TENANT_OVERRIDE"}
                  className={rulesStyles.fields}
                >
                  <legend className={styles.srOnly}>
                    {group.title} settings
                  </legend>
                  <p className={rulesStyles.description}>{group.description}</p>
                  {numericFields
                    .filter((field) => group.numeric.includes(field.key))
                    .map(({ key, label, step }) => (
                      <label key={key}>
                        <span>{label}</span>
                        <input
                          type="number"
                          min="0"
                          step={step ?? "1"}
                          value={form[key]}
                          onChange={(event) => {
                            setSaved(false);
                            setForm((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }));
                          }}
                        />
                      </label>
                    ))}
                  {toggleFields
                    .filter((field) => field.key === group.toggle)
                    .map(({ key, label }) => (
                      <label className={rulesStyles.toggle} key={key}>
                        <input
                          type="checkbox"
                          checked={form[key]}
                          onChange={(event) => {
                            setSaved(false);
                            setForm((current) => ({
                              ...current,
                              [key]: event.target.checked,
                            }));
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                </fieldset>
                {form.mode !== "TENANT_OVERRIDE" ? (
                  <p className={rulesStyles.modeHint}>
                    Select Tenant override to configure this check. Custom
                    values are not used in the current mode.
                  </p>
                ) : null}
              </details>
            ))}
          </div>
          <div className={styles.formFooter}>
            <span>
              Current version {rules.data.version}
              {rules.data.updatedAt
                ? ` · updated ${new Date(rules.data.updatedAt).toLocaleString()}`
                : ""}
            </span>
            <button className={styles.primaryButton} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save alert rules"}
            </button>
          </div>
          {save.isError ? (
            <p className={styles.inlineError} role="alert">
              {getApiErrorMessage(
                save.error,
                "Alert rules could not be saved. Refresh the latest version and try again.",
              )}
            </p>
          ) : null}
          {saved ? (
            <p className={styles.inlineSuccess} role="status">
              Alert rules saved from the latest server response.
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
};
