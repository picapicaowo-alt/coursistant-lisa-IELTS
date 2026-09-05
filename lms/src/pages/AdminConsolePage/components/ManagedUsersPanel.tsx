import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import type { ManagedUser } from "@/apis";
import { PersonCell } from "@/components/PersonCell";
import { TeachingState } from "@/components/TeachingWorkspace";
import { formatPersonName } from "@/utils/personName";
import { formatNumber } from "@/i18n/formatting";
import { ManagedUserDialog } from "./ManagedUserDialog";
import { CreateManagedUserDialog } from "./CreateManagedUserDialog";
import styles from "../index.module.scss";

const PAGE_SIZE = 10;
export function ManagedUsersPanel({
  users,
  loading,
  error,
  onRetry,
  initialTenant = "",
}: {
  users: ManagedUser[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  initialTenant?: string;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [tenant, setTenant] = useState(initialTenant);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // This endpoint returns an array. Filtering and paging are local to that response.
  const needle = search.trim().toLowerCase();
  const filtered = users.filter(
    (user) =>
      (!tenant || String(user.tenantId) === tenant) &&
      (!status || user.status === status) &&
      (!needle ||
        `${formatPersonName(user, user.name)} ${user.email} ${user.id} ${user.tenantId}`
          .toLowerCase()
          .includes(needle)),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1),
  );
  const tenants = [...new Set(users.map((user) => user.tenantId))].sort(
    (a, b) => a - b,
  );
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <div>
          <h2>{t("common:admin.systemUsers")}</h2>
          <p>{t("common:admin.directoryHelp")}</p>
        </div>
        <button
          className={styles.primaryButton}
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={18} />
          {t("common:admin.createUser")}
        </button>
      </header>
      <div className={styles.directoryFilters}>
        <label className={styles.search}>
          <span>{t("common:admin.searchUsers")}</span>
          <input
            type="search"
            value={search}
            placeholder={t("common:admin.searchPlaceholder")}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className={styles.search}>
          <span>{t("common:admin.tenant")}</span>
          <select
            value={tenant}
            onChange={(event) => {
              setTenant(event.target.value);
              setPage(0);
            }}
          >
            <option value="">{t("common:admin.allTenants")}</option>
            {tenants.map((id) => (
              <option key={id} value={id}>
                {t("common:admin.tenantNumber", { id })}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.search}>
          <span>{t("common:fields.status")}</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
          >
            <option value="">{t("common:admin.allStatuses")}</option>
            {[...new Set(users.map((user) => user.status))].map((value) => (
              <option key={value} value={value}>
                {t(`common:admin.status.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading || error ? (
        <TeachingState loading={loading} error={error} errorMessage={t("common:admin.usersFailed")} onRetry={onRetry} />
      ) : (
        <>
          <p className={styles.resultCount}>
            {t("common:admin.resultCount", { count: filtered.length })}
          </p>
          {!filtered.length ? (
            <TeachingState empty={t("common:admin.noUsers")} />
          ) : (
            <div
              className={styles.directoryTable}
              role="table"
              aria-label={t("common:admin.systemUsers")}
            >
              <div role="row" className={styles.directoryHead}>
                <span role="columnheader">{t("common:fields.name")}</span>
                <span role="columnheader">{t("common:admin.identity")}</span>
                <span role="columnheader">{t("common:admin.tenant")}</span>
                <span role="columnheader">{t("common:fields.status")}</span>
                <span role="columnheader">{t("common:admin.actions")}</span>
              </div>
              {filtered
                .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                .map((account) => (
                  <div
                    key={account.id}
                    role="row"
                    className={styles.directoryRow}
                  >
                    <div role="cell">
                      <PersonCell person={account} />
                    </div>
                    <div role="cell" className={styles.identityCell}>
                      {t(
                        `common:roles.${account.role === "USER" ? account.level : account.role}`,
                      )}
                    </div>
                    <div role="cell">
                      {t("common:admin.tenantNumber", { id: account.tenantId })}
                    </div>
                    <div role="cell">
                      <span
                        className={styles.statusBadge}
                        data-active={account.status === "ACTIVE"}
                      >
                        {t(`common:admin.status.${account.status}`)}
                      </span>
                    </div>
                    <div role="cell">
                      <button
                        className={styles.textButton}
                        aria-label={t("common:admin.managePerson", {
                          name: formatPersonName(account, account.name),
                        })}
                        onClick={() => setSelected(account)}
                      >
                        {t("common:admin.manage")}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
          {filtered.length > PAGE_SIZE ? (
            <nav
              className={styles.pagination}
              aria-label={t("common:admin.directoryPages")}
            >
              <button
                className={styles.secondaryButton}
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                {t("common:actions.previous")}
              </button>
              <span>
                {formatNumber(currentPage + 1)} /{" "}
                {formatNumber(Math.ceil(filtered.length / PAGE_SIZE))}
              </span>
              <button
                className={styles.secondaryButton}
                disabled={(currentPage + 1) * PAGE_SIZE >= filtered.length}
                onClick={() => setPage(currentPage + 1)}
              >
                {t("common:actions.next")}
              </button>
            </nav>
          ) : null}
        </>
      )}
      {createOpen ? (
        <CreateManagedUserDialog onClose={() => setCreateOpen(false)} />
      ) : null}
      {selected ? (
        <ManagedUserDialog
          account={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}
