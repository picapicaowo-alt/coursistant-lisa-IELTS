import {useTranslation} from 'react-i18next';
import { TenantUserPicker } from "@/components/TenantUserPicker";
import { PersonCell } from "@/components/TenantWorkspace/PersonCell";
import { ResponsiveFilters } from "@/components/TenantWorkspace/ResponsiveFilters";
import { useTenantPeople } from "@/components/TenantWorkspace/useTenantPeople";
import {
  readableValue,
  tenantDate,
} from "@/components/TenantWorkspace/presentation";
import { TENANT_PAGE_SIZE } from "@/configs/tenantNavigation";
import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import type { ManagedUser, TenantAuditEventParams } from "@/apis";
import { unwrapData } from "@/apis";
import { adminApiService } from "@/apis/services/admin-api";
import { getApiErrorMessage } from "@/utils/apiError";
import { EnglishDateTimeInput } from "@/components/EnglishDateInput";
import styles from "@/components/TenantWorkspace/workspace.module.scss";
import auditStyles from "./audit.module.scss";

const PAGE_SIZE = TENANT_PAGE_SIZE;
type AuditDraft = {
  actorUserId: string;
  targetUserId: string;
  action: string;
  resourceType: string;
  from: string;
  to: string;
};
const emptyDraft: AuditDraft = {
  actorUserId: "",
  targetUserId: "",
  action: "",
  resourceType: "",
  from: "",
  to: "",
};
const dateTimeParam = (value: string) =>
  value ? new Date(value).toISOString() : undefined;

export const AuditPanel = () => {
  const {t: translate} = useTranslation();
  const [draft, setDraft] = useState<AuditDraft>(emptyDraft);
  const [filters, setFilters] = useState<TenantAuditEventParams>({
    page: 0,
    size: PAGE_SIZE,
  });
  const [filterFeedback, setFilterFeedback] = useState("");
  const [actor, setActor] = useState<ManagedUser | null>(null);
  const audit = useQuery({
    queryKey: ["tenant", "audit-events", filters],
    queryFn: async () =>
      unwrapData(
        await adminApiService.listTenantAuditEvents(filters),
        "tenantAuditEvents",
      ),
    retry: false,
  });
  const people = useTenantPeople(
    (audit.data?.items ?? []).flatMap((event) => [
      event.actorUserId,
      event.targetUserId,
    ]),
  );
  const apply = (event: FormEvent) => {
    event.preventDefault();
    setFilterFeedback("Filters applied.");
    setFilters({
      actorUserId: draft.actorUserId ? Number(draft.actorUserId) : undefined,
      targetUserId: draft.targetUserId ? Number(draft.targetUserId) : undefined,
      action: draft.action.trim() || undefined,
      resourceType: draft.resourceType.trim() || undefined,
      from: dateTimeParam(draft.from),
      to: dateTimeParam(draft.to),
      page: 0,
      size: PAGE_SIZE,
    });
  };
  const hasFilters = Object.values(draft).some(Boolean) || Object.entries(filters).some(
    ([key, value]) => key !== 'page' && key !== 'size' && value != null && value !== '',
  );
  const clear = () => {
    setDraft(emptyDraft);
    setActor(null);
    setFilters({ page: 0, size: PAGE_SIZE });
    setFilterFeedback("Filters cleared. Showing all governance events.");
  };
  const page = filters.page ?? 0;

  return (
    <section className={styles.surface} aria-label="Governance audit">
      <div className={styles.sectionHeading}>
        <h2 className={styles.srOnly}>Governance audit</h2>
        <TenantUserPicker
          variant="filter"
          title="Choose audit actor"
          description="Search accounts in this tenant, including disabled accounts."
          levels={[]}
          includeAllAccounts
          selectedUser={actor}
          triggerLabel="All users"
          onSelect={(person) => {
            setActor(person);
            setDraft((current) => ({
              ...current,
              actorUserId: String(person.id),
            }));
            setFilters((current) => ({
              ...current,
              actorUserId: person.id,
              page: 0,
            }));
            setFilterFeedback("Actor filter applied.");
          }}
        />
        <button
          type="button"
          className={styles.iconButton}
          aria-label={translate('common:refreshControls.audit')}
            title={translate('common:refreshControls.audit')}
          onClick={() => void audit.refetch()}
        >
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </div>
      <ResponsiveFilters>
        <form className={styles.filterBar} onSubmit={apply}>
          <label>
            <span>Action</span>
            <input
              value={draft.action}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  action: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Resource type</span>
            <input
              value={draft.resourceType}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  resourceType: event.target.value,
                }))
              }
            />
          </label>
          <label className={auditStyles.dateTimeField}>
            <span>From</span>
            <EnglishDateTimeInput
              value={draft.from}
              onChangeValue={(value) =>
                setDraft((current) => ({ ...current, from: value }))
              }
            />
          </label>
          <label className={auditStyles.dateTimeField}>
            <span>To</span>
            <EnglishDateTimeInput
              value={draft.to}
              onChangeValue={(value) =>
                setDraft((current) => ({ ...current, to: value }))
              }
            />
          </label>
          <button className={styles.primaryButton}>
            <Search size={17} />
            Apply filters
          </button>
          {hasFilters ? <button
            type="button"
            className={styles.secondaryButton}
            onClick={clear}
          >{translate("common:actions.clearFilters")}</button> : null}
          <details className={auditStyles.advanced}>
            <summary>Filter by user ID</summary>
            <div className={styles.filterBar}>
              <label>
                <span>Actor user ID</span>
                <input
                  type="number"
                  min="1"
                  value={draft.actorUserId}
                  onChange={(event) => {
                    setActor(null);
                    setDraft((current) => ({
                      ...current,
                      actorUserId: event.target.value,
                    }));
                  }}
                />
              </label>
              <label>
                <span>Target user ID</span>
                <input
                  type="number"
                  min="1"
                  value={draft.targetUserId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      targetUserId: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </details>
        </form>
      </ResponsiveFilters>
      {filterFeedback ? (
        <p className={styles.srStatus} role="status">
          {filterFeedback}
        </p>
      ) : null}
      {audit.isPending ? (
        <p className={styles.status}>Loading audit events…</p>
      ) : null}
      {audit.isError ? (
        <div className={styles.errorNotice} role="alert">
          <p>
            {getApiErrorMessage(
              audit.error,
              "Audit events could not be loaded.",
            )}
          </p>
          <button type="button" onClick={() => void audit.refetch()}>
            Try again
          </button>
        </div>
      ) : null}
      {!audit.isPending && !audit.isError && audit.data.items.length === 0 ? (
        <p className={styles.empty}>
          No governance events match these filters.
        </p>
      ) : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Target</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {audit.data?.items.map((event) => (
              <tr key={event.eventId}>
                <td data-label="Timestamp">
                  <time dateTime={event.createdAt} className={styles.muted}>
                    {tenantDate(event.createdAt, true)}
                  </time>
                </td>
                <td data-label="User">
                  <PersonCell
                    person={
                      people.get(event.actorUserId ?? -1) ?? {
                        id: event.actorUserId,
                      }
                    }
                  />
                </td>
                <td data-label="Action">
                  {readableValue(event.action)}
                  <small>{readableValue(event.resourceType)}</small>
                </td>
                <td data-label="Target">
                  {event.targetUserId ? (
                    <PersonCell
                      person={
                        people.get(event.targetUserId) ?? {
                          id: event.targetUserId,
                        }
                      }
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {event.before || event.after ? (
                    <details className={auditStyles.change}>
                      <summary>View changes</summary>
                      {event.before ? (
                        <div>
                          <strong>Before</strong>
                          <pre>{JSON.stringify(event.before, null, 2)}</pre>
                        </div>
                      ) : null}
                      {event.after ? (
                        <div>
                          <strong>After</strong>
                          <pre>{JSON.stringify(event.after, null, 2)}</pre>
                        </div>
                      ) : null}
                      <small>Event {event.eventId}</small>
                    </details>
                  ) : (
                    <span className={styles.muted}>No projected change</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {audit.data && audit.data.total > PAGE_SIZE ? (
        <nav className={styles.pagination} aria-label="Audit pages">
          <button
            type="button"
            disabled={page === 0}
            onClick={() =>
              setFilters((current) => ({ ...current, page: page - 1 }))
            }
          >
            Previous
          </button>
          <span>
            Page {page + 1} · {audit.data.total} events
          </span>
          <button
            type="button"
            disabled={(page + 1) * PAGE_SIZE >= audit.data.total}
            onClick={() =>
              setFilters((current) => ({ ...current, page: page + 1 }))
            }
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  );
};
