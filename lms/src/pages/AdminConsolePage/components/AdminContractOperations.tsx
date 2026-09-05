import { useTranslation } from "react-i18next";
import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unwrapData, type ManagedUser } from "@/apis";
import { PersonCell } from "@/components/PersonCell";
import { EnglishDateInput } from "@/components/EnglishDateInput";
import { adminApiService } from "@/apis/services/admin-api";
import { courseOperationsApiService } from "@/apis/services/course-operations-api";
import { notificationApiService } from "@/apis/services/notification-api";
import styles from "../index.module.scss";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const numberValue = (
  record: Record<string, unknown> | null,
  ...keys: string[]
): number | undefined => {
  for (const key of keys)
    if (record && typeof record[key] === "number") return record[key] as number;
  return undefined;
};

export const AdminContractOperations: React.FC<{
  isSystemAdmin: boolean;
  users: ManagedUser[];
  view?: "directory" | "digest";
}> = ({ isSystemAdmin, users, view }) => {
  const { t: translate } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedAdminId, setSelectedAdminId] = useState<number>();
  const adminDetail = useQuery({
    queryKey: ["admin", "directory-detail", selectedAdminId],
    queryFn: async () =>
      unwrapData(
        await adminApiService.getAdmin(selectedAdminId!),
        "adminDetail",
      ),
    enabled: isSystemAdmin && selectedAdminId != null,
    retry: false,
  });
  const [adminSearch, setAdminSearch] = useState("");
  const [submittedAdminSearch, setSubmittedAdminSearch] = useState("");
  const [digest, setDigest] = useState({ date: "", tenantId: "" });
  const [alerts, setAlerts] = useState({
    version: "",
    inactivityDays: "",
    gradingDelayDays: "",
    absenceCount: "",
    absenceWindowDays: "",
  });

  const directory = useQuery({
    queryKey: ["admin", "directory", submittedAdminSearch],
    queryFn: async () =>
      unwrapData(
        await adminApiService.listAdmins({
          email: submittedAdminSearch || undefined,
          name: submittedAdminSearch || undefined,
          username: submittedAdminSearch || undefined,
        }),
        "adminDirectory",
      ),
    enabled: isSystemAdmin && view !== "digest",
    retry: false,
  });
  const alertRules = useQuery({
    queryKey: ["tenant", "alert-rules"],
    queryFn: async () =>
      unwrapData(
        await courseOperationsApiService.getTenantAlertRules(),
        "tenantAlertRules",
      ),
    enabled: !isSystemAdmin,
    retry: false,
  });

  useEffect(() => {
    const record = asRecord(alertRules.data);
    if (!record) return;
    const field = (key: string) =>
      typeof record[key] === "number" ? String(record[key]) : "";
    setAlerts({
      version: String(
        numberValue(record, "version", "alertRulesVersion") ?? "",
      ),
      inactivityDays: field("inactivityDays"),
      gradingDelayDays: field("gradingDelayDays"),
      absenceCount: field("absenceCount"),
      absenceWindowDays: field("absenceWindowDays"),
    });
  }, [alertRules.data]);

  const digestMutation = useMutation({
    mutationFn: () =>
      notificationApiService.runAdminDigest({
        digestDate: digest.date,
        tenantId: digest.tenantId ? Number(digest.tenantId) : undefined,
      }),
  });
  const alertMutation = useMutation({
    mutationFn: () =>
      courseOperationsApiService.putTenantAlertRules({
        mode: "TENANT_OVERRIDE",
        expectedVersion: Number(alerts.version),
        inactivityDays: alerts.inactivityDays
          ? Number(alerts.inactivityDays)
          : undefined,
        gradingDelayDays: alerts.gradingDelayDays
          ? Number(alerts.gradingDelayDays)
          : undefined,
        absenceCount: alerts.absenceCount
          ? Number(alerts.absenceCount)
          : undefined,
        absenceWindowDays: alerts.absenceWindowDays
          ? Number(alerts.absenceWindowDays)
          : undefined,
      }),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["tenant", "alert-rules"] }),
  });

  const selectedAdministrator = asRecord(adminDetail.data);
  const directoryRecord = asRecord(directory.data);
  const directoryItems = Array.isArray(directory.data)
    ? directory.data
    : Array.isArray(directoryRecord?.items)
      ? directoryRecord.items
      : [];
  const administratorRows = directoryItems.flatMap((value) => {
    const row = asRecord(value);
    const id = numberValue(row, "id", "adminId");
    return id == null
      ? []
      : [
          {
            id,
            person: {
              id,
              name: typeof row?.name === "string" ? row.name : undefined,
              firstName:
                typeof row?.firstName === "string" ? row.firstName : undefined,
              lastName:
                typeof row?.lastName === "string" ? row.lastName : undefined,
              email: typeof row?.email === "string" ? row.email : undefined,
            },
          },
        ];
  });

  return (
    <>
      {isSystemAdmin && view !== "digest" ? (
        <section className={styles.card}>
          <h2>{translate("common:admin.operations.directory")}</h2>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              if (submittedAdminSearch === adminSearch.trim())
                void directory.refetch();
              else {
                setSelectedAdminId(undefined);
                setSubmittedAdminSearch(adminSearch.trim());
              }
            }}
          >
            <label>
              <span>{translate("common:admin.adminSearch")}</span>
              <input
                value={adminSearch}
                onChange={(event) => setAdminSearch(event.target.value)}
              />
            </label>
            <button className={styles.primaryButton}>
              {translate("common:admin.searchAdmins")}
            </button>
          </form>
          {directory.isPending ? (
            <p role="status">{translate("common:admin.loadingAdmins")}</p>
          ) : directory.isError ? (
            <p role="alert" className={styles.errorMessage}>
              {translate("common:admin.adminsFailed")}{" "}
              <button type="button" onClick={() => void directory.refetch()}>
                {translate("common:actions.retry")}
              </button>
            </p>
          ) : (
            <div className={styles.adminDirectoryWorkspace}>
              <div
                className={styles.adminDirectoryList}
                aria-label={translate("common:admin.administrators")}
              >
                {administratorRows.length ? (
                  administratorRows.map((row) => (
                    <button
                      type="button"
                      key={row.id}
                      aria-pressed={selectedAdminId === row.id}
                      onClick={() => setSelectedAdminId(row.id)}
                    >
                      <PersonCell person={row.person} />
                    </button>
                  ))
                ) : (
                  <p>{translate("common:admin.noAdmins")}</p>
                )}
              </div>
              <section aria-label={translate("common:admin.adminDetails")}>
                {selectedAdminId != null ? (
                  adminDetail.isPending ? (
                    <p role="status">
                      {translate("common:admin.loadingAdmin")}
                    </p>
                  ) : adminDetail.isError ? (
                    <p role="alert">
                      {translate("common:admin.adminDetailFailed")}
                      <button
                        type="button"
                        onClick={() => void adminDetail.refetch()}
                      >
                        {translate("common:admin.retryDetails")}
                      </button>
                    </p>
                  ) : (
                    <dl className={styles.accountFacts}>
                      {["name", "email", "username"].map((field) =>
                        typeof selectedAdministrator?.[field] === "string" ? (
                          <div key={field}>
                            <dt>
                              {translate(`common:admin.adminFields.${field}`)}
                            </dt>
                            <dd>{String(selectedAdministrator[field])}</dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                  )
                ) : (
                  <p>{translate("common:admin.selectAdmin")}</p>
                )}
              </section>
            </div>
          )}
        </section>
      ) : null}

      {!isSystemAdmin ? (
        <section className={styles.card}>
          <h2>{translate("common:admin.alertRules")}</h2>
          {alertRules.isPending ? (
            <p className={styles.status}>
              {translate("common:admin.loadingAlerts")}
            </p>
          ) : null}
          {alertRules.isError ? (
            <p className={styles.errorMessage}>
              {translate("common:admin.alertsFailed")}
            </p>
          ) : null}
          {alerts.version ? (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                alertMutation.mutate();
              }}
            >
              <label>
                <span>{translate("common:admin.inactivityDays")}</span>
                <input
                  type="number"
                  min="0"
                  value={alerts.inactivityDays}
                  onChange={(event) =>
                    setAlerts((current) => ({
                      ...current,
                      inactivityDays: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>{translate("common:admin.gradingDelayDays")}</span>
                <input
                  type="number"
                  min="0"
                  value={alerts.gradingDelayDays}
                  onChange={(event) =>
                    setAlerts((current) => ({
                      ...current,
                      gradingDelayDays: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>{translate("common:admin.absenceCount")}</span>
                <input
                  type="number"
                  min="0"
                  value={alerts.absenceCount}
                  onChange={(event) =>
                    setAlerts((current) => ({
                      ...current,
                      absenceCount: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>{translate("common:admin.absenceWindowDays")}</span>
                <input
                  type="number"
                  min="0"
                  value={alerts.absenceWindowDays}
                  onChange={(event) =>
                    setAlerts((current) => ({
                      ...current,
                      absenceWindowDays: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                className={styles.primaryButton}
                disabled={alertMutation.isPending}
              >
                {translate("common:admin.saveAlerts")}
              </button>
            </form>
          ) : !alertRules.isPending && !alertRules.isError ? (
            <p className={styles.hint}>
              {translate("common:admin.alertsUnavailable")}
            </p>
          ) : null}
        </section>
      ) : null}

      {isSystemAdmin && view !== "directory" ? (
        <section className={styles.card}>
          <h2>{translate("common:admin.operations.digest")}</h2>
          <p className={styles.hint}>{translate("common:admin.digestHelp")}</p>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              digestMutation.mutate();
            }}
          >
            <label>
              <span>{translate("common:admin.digestDate")}</span>
              <EnglishDateInput
                required
                value={digest.date}
                onChangeValue={(date) =>
                  setDigest((current) => ({ ...current, date }))
                }
              />
            </label>
            <label>
              <span>{translate("common:admin.tenant")}</span>
              <select
                value={digest.tenantId}
                onChange={(event) =>
                  setDigest((current) => ({
                    ...current,
                    tenantId: event.target.value,
                  }))
                }
              >
                <option value="">{translate("common:admin.allTenants")}</option>
                {[
                  ...new Map(
                    users.map((user) => [user.tenantId, user.tenantId]),
                  ).values(),
                ].map((tenantId) => (
                  <option key={tenantId} value={tenantId}>
                    {translate("common:admin.tenantNumber", { id: tenantId })}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={styles.primaryButton}
              disabled={!digest.date || digestMutation.isPending}
            >
              {translate("common:admin.runDigest")}
            </button>
          </form>
          {digestMutation.isError ? (
            <p role="alert" className={styles.errorMessage}>
              {translate("common:admin.digestFailed")}
            </p>
          ) : digestMutation.isSuccess ? (
            <p role="status" className={styles.message}>
              {translate("common:admin.digestSuccess")}
            </p>
          ) : null}
        </section>
      ) : null}
      {alertMutation.isError ? (
        <p role="alert" className={styles.errorMessage}>
          {translate("common:admin.alertsSaveFailed")}
        </p>
      ) : alertMutation.isSuccess ? (
        <p role="status" className={styles.message}>
          {translate("common:admin.alertsSaved")}
        </p>
      ) : null}
    </>
  );
};
