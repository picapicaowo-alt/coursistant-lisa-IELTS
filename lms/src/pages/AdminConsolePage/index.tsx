import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import {Users, GraduationCap, Building2, Settings2} from "lucide-react";
import { unwrapData } from "@/apis";
import { adminApiService } from "@/apis/services/admin-api";
import { useRequiredAuth } from "@/contexts/RequiredAuthContext";
import { TeachingState } from "@/components/TeachingWorkspace";
import { formatNumber } from "@/i18n/formatting";
import { ManagedUsersPanel } from "./components/ManagedUsersPanel";
import { CourseMembershipPanel } from "./components/CourseMembershipPanel";
import { AdminContractOperations } from "./components/AdminContractOperations";
import { AuditedOperations } from "./components/AuditedOperations";
import styles from "./index.module.scss";

const SECTIONS = [
  { id: "users", icon: Users },
  { id: "members", icon: GraduationCap },
  { id: "tenants", icon: Building2 },
  { id: "operations", icon: Settings2 },
] as const;
type Section = (typeof SECTIONS)[number]["id"];
const OPERATIONS = ["directory", "digest", "reassign", "grade"] as const;

export default function AdminConsolePage() {
  const { t } = useTranslation();
  const { user } = useRequiredAuth();
  const [tab, setTab] = useState<Section>("users");
  const [tenant, setTenant] = useState("");
  const [operation, setOperation] =
    useState<(typeof OPERATIONS)[number]>("directory");
  const isSystemAdmin = user.role === "SYSTEM_ADMIN";
  const users = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () =>
      unwrapData(await adminApiService.listUsers(), "listUsers"),
    enabled: isSystemAdmin,
    retry: 1,
  });
  if (!isSystemAdmin) return <Navigate to="/" replace />;
  const accounts = users.data ?? [];
  const tenants = [
    ...new Set(accounts.map((account) => account.tenantId)),
  ].sort((a, b) => a - b);
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>{t("navigation:adminConsole")}</h1>
        <p>{t("common:admin.pageDescription")}</p>
      </header>
      <nav className={styles.tabs} aria-label={t("common:admin.sections")}>
        {SECTIONS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            className={tab === id ? styles.activeTab : ""}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              if (id === "users") setTenant("");
            }}
          >
            <Icon size={19} />
            {t(`common:admin.tabs.${id}`)}
          </button>
        ))}
      </nav>
      <div className={styles.workspace}>
        {tab === "users" ? (
          <ManagedUsersPanel
            key={tenant}
            users={accounts}
            loading={users.isPending}
            error={users.error}
            onRetry={() => void users.refetch()}
            initialTenant={tenant}
          />
        ) : null}
        {tab === "members" ? <CourseMembershipPanel /> : null}
        {tab === "tenants" ? (
          <section className={styles.card}>
            <header className={styles.cardHeader}>
              <div>
                <h2>{t("common:admin.tenantAccounts")}</h2>
                <p>{t("common:admin.tenantAccountsHelp")}</p>
              </div>
            </header>
            {users.isPending || users.isError ? (
              <TeachingState
                loading={users.isPending}
                error={users.error}
                onRetry={() => void users.refetch()}
              />
            ) : tenants.length ? (
              <div className={styles.tenantList}>
                {tenants.map((id) => (
                  <article className={styles.tenantRow} key={id}>
                    <div>
                      <h3>{t("common:admin.tenantNumber", { id })}</h3>
                      <p>
                        {t("common:admin.linkedAccounts", {
                          count: accounts.filter(
                            (account) => account.tenantId === id,
                          ).length,
                        })}
                      </p>
                    </div>
                    <button
                      className={styles.textButton}
                      onClick={() => {
                        setTenant(String(id));
                        setTab("users");
                      }}
                    >
                      {t("common:admin.viewUsers")}

                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <TeachingState empty={t("common:admin.noTenants")} />
            )}
            <p className={styles.sectionNote}>
              {t("common:admin.tenantUnavailable")}
            </p>
          </section>
        ) : null}
        {tab === "operations" ? (
          <div className={styles.operationsLayout}>
            <nav
              className={styles.operationNav}
              aria-label={t("common:admin.operationTasks")}
            >
              {OPERATIONS.map((item) => (
                <button
                  key={item}
                  aria-pressed={operation === item}
                  onClick={() => setOperation(item)}
                >
                  <strong>{t(`common:admin.operations.${item}`)}</strong>
                  <span>{t(`common:admin.operationHelp.${item}`)}</span>
                </button>
              ))}
            </nav>
            <div className={styles.operationBody}>
              {operation === "directory" || operation === "digest" ? (
                <AdminContractOperations
                  key={operation}
                  isSystemAdmin
                  users={accounts}
                  view={operation}
                />
              ) : (
                <AuditedOperations key={operation} view={operation} />
              )}
            </div>
          </div>
        ) : null}
      </div>
      <footer className={styles.workspaceFooter}>
        {t("common:admin.scopeNote")}
        {users.isSuccess ? (
          <span>
            {t("common:admin.loadedAccounts", {
              total: formatNumber(accounts.length),
            })}
          </span>
        ) : null}
      </footer>
    </main>
  );
}
