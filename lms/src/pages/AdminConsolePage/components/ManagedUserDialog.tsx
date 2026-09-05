import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  unwrapData,
  type ManagedUser,
  type ChangeManagedUserRoleRequest,
} from "@/apis";
import { adminApiService } from "@/apis/services/admin-api";
import { TeachingDialog, TeachingState } from "@/components/TeachingWorkspace";
import { PersonCell } from "@/components/PersonCell";
import { getApiErrorMessage } from "@/utils/apiError";
import { LevelSelect } from "./ManagedUserFields";
import {
  SYSTEM_MANAGED_LEVEL_OPTIONS,
  type ManagedLevel,
} from "../managedUserOptions";
import styles from "../index.module.scss";

type AccountAction =
  | { type: "role"; request: ChangeManagedUserRoleRequest }
  | { type: "move"; tenantId: number }
  | { type: "disable" };

export function ManagedUserDialog({
  account,
  onClose,
}: {
  account: ManagedUser;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [role, setRole] = useState<ChangeManagedUserRoleRequest["role"]>(
    account.role === "TENANT_ADMIN" ? "TENANT_ADMIN" : "USER",
  );
  const [level, setLevel] = useState<ManagedLevel>(
    SYSTEM_MANAGED_LEVEL_OPTIONS.includes(account.level as ManagedLevel)
      ? (account.level as ManagedLevel)
      : "STUDENT",
  );
  const [tenant, setTenant] = useState(String(account.tenantId));
  const [section, setSection] = useState<"role" | "move" | "access">("role");
  const [review, setReview] = useState<AccountAction | null>(null);
  const [message, setMessage] = useState("");
  const detail = useQuery({
    queryKey: ["admin", "user-detail", true, account.id],
    queryFn: async () =>
      unwrapData(await adminApiService.getUser(account.id), "userDetail"),
    retry: false,
  });
  const current = detail.data ?? account;
  const mutation = useMutation({
    mutationFn: async (action: AccountAction) => {
      if (action.type === "role")
        await adminApiService.changeManagedUserRole(
          "system",
          account.id,
          action.request,
        );
      else if (action.type === "move")
        await adminApiService.changeUserTenant(account.id, {
          tenantId: action.tenantId,
        });
      else await adminApiService.disableManagedUser("system", account.id);
    },
    onSuccess: async (_data, action) => {
      setReview(null);
      setMessage(t(`common:admin.${action.type}Success`));
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin", "users"] }),
        client.invalidateQueries({
          queryKey: ["admin", "user-detail", true, account.id],
        }),
      ]);
    },
  });
  return (
    <TeachingDialog
      title={t("common:admin.accountDetails")}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <PersonCell person={current} />
      <dl className={styles.accountFacts}>
        <div>
          <dt>{t("common:admin.userId")}</dt>
          <dd>{current.id}</dd>
        </div>
        <div>
          <dt>{t("common:admin.tenant")}</dt>
          <dd>{t("common:admin.tenantNumber", { id: current.tenantId })}</dd>
        </div>
        <div>
          <dt>{t("common:admin.identity")}</dt>
          <dd>
            {t(
              `common:roles.${current.role === "USER" ? current.level : current.role}`,
            )}
          </dd>
        </div>
        <div>
          <dt>{t("common:fields.status")}</dt>
          <dd>{t(`common:admin.status.${current.status}`)}</dd>
        </div>
      </dl>
      {detail.isPending || detail.isError ? (
        <TeachingState
          compact
          loading={detail.isPending}
          error={detail.error}
          onRetry={() => void detail.refetch()}
        />
      ) : null}
      <nav
        className={styles.taskTabs}
        aria-label={t("common:admin.accountActions")}
      >
        {(["role", "move", "access"] as const).map((item) => (
          <button
            key={item}
            aria-pressed={section === item}
            onClick={() => {
              setSection(item);
              setReview(null);
              setMessage("");
              mutation.reset();
            }}
          >
            {t(`common:admin.action.${item}`)}
          </button>
        ))}
      </nav>
      <div className={styles.form}>
        {section === "role" ? (
          <>
            <label>
              <span>{t("settings:accountRole")}</span>
              <select
                value={role}
                onChange={(event) => {
                  setRole(
                    event.target.value as ChangeManagedUserRoleRequest["role"],
                  );
                  setReview(null);
                }}
              >
                <option value="USER">{t("common:roles.USER")}</option>
                <option value="TENANT_ADMIN">
                  {t("common:roles.TENANT_ADMIN")}
                </option>
              </select>
            </label>
            {role === "USER" ? (
              <LevelSelect
                value={level}
                onChange={(value) => {
                  setLevel(value);
                  setReview(null);
                }}
              />
            ) : null}
            <button
              className={styles.primaryButton}
              disabled={mutation.isPending || !detail.isSuccess}
              onClick={() =>
                setReview({
                  type: "role",
                  request: {
                    role,
                    level: role === "USER" ? level : "NOT_APPLICABLE",
                  },
                })
              }
            >
              {t("common:admin.reviewRole")}
            </button>
          </>
        ) : section === "move" ? (
          <>
            <label>
              <span>{t("common:admin.targetTenant")}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={tenant}
                onChange={(event) => {
                  setTenant(event.target.value);
                  setReview(null);
                }}
              />
            </label>
            <p className={styles.hint}>{t("common:admin.moveHelp")}</p>
            <button
              className={styles.secondaryButton}
              disabled={
                mutation.isPending ||
                !detail.isSuccess ||
                !Number.isSafeInteger(Number(tenant)) ||
                Number(tenant) < 1 ||
                Number(tenant) === current.tenantId
              }
              onClick={() =>
                setReview({ type: "move", tenantId: Number(tenant) })
              }
            >
              {t("common:admin.reviewMove")}
            </button>
          </>
        ) : (
          <>
            <p className={styles.hint}>{t("common:admin.disableHelp")}</p>
            <button
              className={styles.dangerButton}
              disabled={
                mutation.isPending ||
                !detail.isSuccess ||
                current.status === "DISABLED"
              }
              onClick={() => setReview({ type: "disable" })}
            >
              {t("common:admin.disableAccount")}
            </button>
          </>
        )}
        {review ? (
          <div className={styles.confirmStack}>
            <p>
              {review.type === "move"
                ? t("common:admin.confirmMove", { id: review.tenantId })
                : t(`common:admin.confirm.${review.type}`)}
            </p>
            <div className={styles.confirmRow}>
              <button
                className={styles.dangerButton}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(review)}
              >
                {t("common:actions.confirm")}
              </button>
              <button
                className={styles.secondaryButton}
                disabled={mutation.isPending}
                onClick={() => setReview(null)}
              >
                {t("common:actions.cancel")}
              </button>
            </div>
          </div>
        ) : null}
        {mutation.isError ? (
          <p role="alert" className={styles.errorMessage}>
            {getApiErrorMessage(mutation.error, t("common:admin.actionFailed"))}
          </p>
        ) : null}
        {message ? (
          <p role="status" className={styles.message}>
            {message}
          </p>
        ) : null}
      </div>
    </TeachingDialog>
  );
}
