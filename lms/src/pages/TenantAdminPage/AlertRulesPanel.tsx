import {useTranslation} from 'react-i18next';
import { useState, type FormEvent } from "react";
import {
  Activity,
  CalendarDays,
  ChartNoAxesColumn,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Flag,
  MinusCircle,
  RefreshCw,
} from "lucide-react";
import { TenantDrawer } from "@/components/TenantWorkspace/TenantDrawer";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  NUMERIC_FIELDS,
  RULE_GROUPS,
  RULE_MODES,
  groupIsDirty,
  ruleSummary,
  toAlertForm,
  type AlertForm,
  type RuleGroup,
} from "./alertRules";
import { useAlertRules } from "./useAlertRules";
import styles from "@/components/TenantWorkspace/workspace.module.scss";
import rulesStyles from "./rules.module.scss";

const RULE_ICONS = [
  Activity,
  CalendarDays,
  CheckCircle2,
  ChartNoAxesColumn,
  Clock3,
  ClipboardList,
  Flag,
  MinusCircle,
];

function RuleEditor({
  group,
  form,
  onApply,
  onClose,
}: {
  group: RuleGroup;
  form: AlertForm;
  onApply: (next: AlertForm) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(form);
  const apply = (event: FormEvent) => {
    event.preventDefault();
    onApply(draft);
  };
  return (
    <TenantDrawer
      title={group.title}
      description={group.description}
      onClose={onClose}
    >
      <form className={`${styles.form} ${rulesStyles.editor}`} onSubmit={apply}>
        <div className={rulesStyles.fields}>
          {group.numeric.map((key) => (
            <label key={key}>
              <span>{NUMERIC_FIELDS[key].label}</span>
              <input
                type="number"
                min="0"
                step={NUMERIC_FIELDS[key].step}
                value={draft[key]}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
        <p className={rulesStyles.editorHint}>
          Apply to your draft, then save changes on the rules page.
        </p>
        <div className={rulesStyles.editorActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={!groupIsDirty(group, draft, form)}
          >
            Apply to draft
          </button>
        </div>
      </form>
    </TenantDrawer>
  );
}

export function AlertRulesPanel() {
  const {t: translate} = useTranslation();
  const {
    rules,
    form,
    baseline,
    dirty,
    save,
    update,
    discard,
    submit,
    refresh: reload,
  } = useAlertRules();
  const [editing, setEditing] = useState<RuleGroup | null>(null);
  const editable = form?.mode === "TENANT_OVERRIDE";
  const refresh = (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={translate("common:refreshControls.alertRules")}
      disabled={dirty || Boolean(editing) || rules.isFetching || save.isPending}
      title={
        dirty
          ? translate("common:refreshControls.unsavedChanges")
          : translate("common:refreshControls.alertRules")
      }
      onClick={reload}
    >
      <RefreshCw size={18} aria-hidden="true" />
    </button>
  );

  return (
    <section aria-label="Tenant alert rules" className={rulesStyles.panel}>
      {rules.isPending ? (
        <p className={styles.status} role="status">
          Loading alert rules…
        </p>
      ) : null}
      {rules.isError ? (
        <div className={styles.errorNotice} role="alert">
          <p>
            {getApiErrorMessage(
              rules.error,
              "Alert rules could not be loaded.",
            )}
          </p>
          <button
            type="button"
            disabled={dirty || save.isPending}
            onClick={reload}
          >
            Try again
          </button>
        </div>
      ) : null}
      {form && baseline ? (
        <>
          <fieldset
            className={rulesStyles.modePicker}
            disabled={save.isPending}
          >
            <legend>Rule mode</legend>
            {RULE_MODES.map((mode) => (
              <label key={mode.value}>
                <input
                  type="radio"
                  name="alert-mode"
                  checked={form.mode === mode.value}
                  onChange={() =>
                    update((current) => ({ ...current, mode: mode.value }))
                  }
                />
                <span>
                  <strong>{mode.title}</strong>
                  <small>{mode.description}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <div>
            <div className={rulesStyles.listHeading}>
              <h2>Alert rules</h2>
              <div className={rulesStyles.headingTools}>
                {editable ? (
                  <span>Edit a rule to adjust its parameters</span>
                ) : null}
                {refresh}
              </div>
            </div>
            {!editable ? (
              <p className={rulesStyles.modeHint}>
                {form.mode === "DISABLED"
                  ? dirty
                    ? "Save changes to pause tenant alert evaluation."
                    : "Tenant alert evaluation is paused. Choose a mode above to resume."
                  : "Managed by the platform. Only returned values are shown; choose Tenant override to customize."}
              </p>
            ) : null}
            <div className={rulesStyles.ruleList}>
              <div className={rulesStyles.columnHeadings} aria-hidden="true">
                <span>Category</span>
                <span>Parameters</span>
                <span>{editable ? "Configure" : ""}</span>
              </div>
              <ul
                className={rulesStyles.rows}
                aria-label="Alert rule categories"
              >
                {RULE_GROUPS.map((group, index) => {
                  const Icon = RULE_ICONS[index];
                  const changed =
                    editable &&
                    groupIsDirty(group, form, toAlertForm(baseline));
                  return (
                    <li key={group.id} className={rulesStyles.row}>
                      <div className={rulesStyles.category}>
                        <Icon size={21} aria-hidden="true" />
                        <span>
                          {group.title}
                          {changed ? (
                            <span
                              className={rulesStyles.changed}
                              aria-label="Unsaved changes"
                              title="Unsaved changes"
                            />
                          ) : null}
                        </span>
                      </div>
                      <p className={rulesStyles.summary}>
                        {ruleSummary(group, form, baseline)}
                      </p>
                      <div className={rulesStyles.rowAction}>
                        {editable ? (
                          group.toggle ? (
                            <button
                              type="button"
                              role="switch"
                              aria-label={group.title}
                              aria-checked={form[group.toggle] === 1}
                              disabled={save.isPending}
                              className={rulesStyles.switchControl}
                              onClick={() => {
                                const key = group.toggle;
                                if (key)
                                  update((current) => ({
                                    ...current,
                                    [key]: current[key] === 1 ? null : 1,
                                  }));
                              }}
                            >
                              <span
                                className={rulesStyles.switchTrack}
                                aria-hidden="true"
                              >
                                <span />
                              </span>
                              <span>
                                {form[group.toggle] === 1
                                  ? "Enabled"
                                  : "Disabled"}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={rulesStyles.editButton}
                              aria-label={`Edit ${group.title.toLowerCase()}`}
                              disabled={save.isPending}
                              onClick={() => {
                                update((current) => current);
                                setEditing(group);
                              }}
                            >
                              Edit
                              <ChevronRight size={18} aria-hidden="true" />
                            </button>
                          )
                        ) : group.toggle &&
                          form.mode === "SYSTEM_DEFAULT" &&
                          baseline.mode === "SYSTEM_DEFAULT" &&
                          baseline[group.toggle] != null ? (
                          <span className={rulesStyles.readOnlyState}>
                            {baseline[group.toggle] === 1
                              ? "Enabled"
                              : "Disabled"}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className={rulesStyles.footer}>
            <span role="status">
              {save.isSuccess
                ? "Changes saved"
                : dirty
                  ? "You have unsaved changes"
                  : `Policy version ${baseline.version}`}
            </span>
            <div className={rulesStyles.footerActions}>
              {dirty ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={save.isPending}
                  onClick={discard}
                >
                  Cancel changes
                </button>
              ) : null}
              <button
                type="button"
                className={styles.primaryButton}
                disabled={!dirty || save.isPending}
                onClick={submit}
              >
                {save.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
          {save.isError ? (
            <div className={styles.errorNotice} role="alert">
              <p>
                {getApiErrorMessage(
                  save.error,
                  "Alert rules could not be saved.",
                )}
              </p>
              <p>
                Your draft is preserved. To load the latest policy, cancel
                changes and refresh.
              </p>
            </div>
          ) : null}
          {editing ? (
            <RuleEditor
              group={editing}
              form={form}
              onClose={() => {
                setEditing(null);
                if (!dirty) discard();
              }}
              onApply={(next) => {
                update((current) => {
                  const result = { ...current };
                  for (const key of editing.numeric) result[key] = next[key];
                  return result;
                });
                setEditing(null);
              }}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
