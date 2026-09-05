import { useTranslation } from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
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
  const { t: translate } = useTranslation();
  const [draft, setDraft] = useState(form);
  const [invalid, setInvalid] = useState(false);
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasInvalidInput = !event.currentTarget.checkValidity();
    setInvalid(hasInvalidInput);
    if (hasInvalidInput) return;
    onApply(draft);
  };
  return (
    <TenantDrawer
      title={translate(group.titleKey)}
      description={translate(group.descriptionKey)}
      onClose={onClose}
    >
      <form className={`${styles.form} ${rulesStyles.editor}`} noValidate onSubmit={apply}>
        <div className={rulesStyles.fields}>
          {group.numeric.map((key) => (
            <label key={key}>
              <span>{translate(NUMERIC_FIELDS[key].labelKey)}</span>
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
        {invalid ? <p className={styles.inlineError} role="alert">{translate('operations:alertRules.invalidNumber')}</p> : null}
        <p className={rulesStyles.editorHint}>
          {translate("operations:alertRules.editorHint")}</p>
        <div className={rulesStyles.editorActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClose}
          >
            {translate("common:actions.cancel")}</button>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={!groupIsDirty(group, draft, form)}
          >
            {translate("operations:alertRules.applyDraft")}</button>
        </div>
      </form>
    </TenantDrawer>
  );
}

export function AlertRulesPanel() {
  const { t: translate } = useTranslation();
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
    <section aria-label={translate("common:admin.alertRules")} className={rulesStyles.panel}>
      {rules.isPending ? (
        <p className={styles.status} role="status">
          {translate("common:admin.loadingAlerts")}</p>
      ) : null}
      {rules.isError ? (
        <div className={styles.errorNotice} role="alert">
          <p>
            {getApiErrorMessage(
              rules.error,
              translate("common:admin.alertsFailed"),
            )}
          </p>
          <button
            type="button"
            disabled={dirty || save.isPending}
            onClick={reload}
          >
            {translate("common:actions.tryAgain")}</button>
        </div>
      ) : null}
      {form && baseline ? (
        <>
          <fieldset
            className={rulesStyles.modePicker}
            disabled={save.isPending}
          >
            <legend>{translate("operations:alertRules.mode")}</legend>
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
                  <strong>{translate(mode.titleKey)}</strong>
                  <small>{translate(mode.descriptionKey)}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <div>
            <div className={rulesStyles.listHeading}>
              <h2>{translate("operations:governance.alerts")}</h2>
              <div className={rulesStyles.headingTools}>
                {editable ? (
                  <span>{translate("operations:alertRules.editHelp")}</span>
                ) : null}
                {refresh}
              </div>
            </div>
            {!editable ? (
              <p className={rulesStyles.modeHint}>
                {form.mode === "DISABLED"
                  ? dirty
                    ? translate("operations:alertRules.pausePending")
                    : translate("operations:alertRules.paused")
                  : translate("operations:alertRules.defaultHelp")}
              </p>
            ) : null}
            <div className={rulesStyles.ruleList}>
              <div className={rulesStyles.columnHeadings} aria-hidden="true">
                <span>{translate("calendar:details.category")}</span>
                <span>{translate("operations:alertRules.parameters")}</span>
                <span>{editable ? translate("operations:alertRules.configure") : ""}</span>
              </div>
              <ul
                className={rulesStyles.rows}
                aria-label={translate("operations:alertRules.categories")}
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
                          {translate(group.titleKey)}
                          {changed ? (
                            <span
                              className={rulesStyles.changed}
                              aria-label={translate("operations:alertRules.unsaved")}
                              title={translate("operations:alertRules.unsaved")}
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
                              aria-label={translate(group.titleKey)}
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
                                  ? translate("settings:profile.enabled")
                                  : translate("common:admin.status.DISABLED")}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={rulesStyles.editButton}
                              aria-label={translate('operations:alertRules.editRule', {name: translate(group.titleKey)})}
                              disabled={save.isPending}
                              onClick={() => {
                                update((current) => current);
                                setEditing(group);
                              }}
                            >
                              {translate("common:actions.edit")}<ChevronRight size={18} aria-hidden="true" />
                            </button>
                          )
                        ) : group.toggle &&
                          form.mode === "SYSTEM_DEFAULT" &&
                          baseline.mode === "SYSTEM_DEFAULT" &&
                          baseline[group.toggle] != null ? (
                          <span className={rulesStyles.readOnlyState}>
                            {baseline[group.toggle] === 1
                              ? translate("settings:profile.enabled")
                              : translate("common:admin.status.DISABLED")}
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
                ? translate("operations:alertRules.saved")
                : dirty
                  ? translate("operations:alertRules.unsavedHelp")
                  : translate('operations:alertRules.policyVersion', {number: formatNumber(baseline.version)})}
            </span>
            <div className={rulesStyles.footerActions}>
              {dirty ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={save.isPending}
                  onClick={discard}
                >
                  {translate("operations:alertRules.cancelChanges")}</button>
              ) : null}
              <button
                type="button"
                className={styles.primaryButton}
                disabled={!dirty || save.isPending}
                onClick={submit}
              >
                {save.isPending ? translate("common:actions.saving") : translate("common:actions.saveChanges")}
              </button>
            </div>
          </div>
          {save.isError ? (
            <div className={styles.errorNotice} role="alert">
              <p>
                {getApiErrorMessage(
                  save.error,
                  translate("operations:alertRules.saveFailed"),
                )}
              </p>
              <p>
                {translate("operations:alertRules.draftPreserved")}</p>
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
