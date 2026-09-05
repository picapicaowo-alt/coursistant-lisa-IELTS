import { useTranslation } from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
import {parseInputDateTime} from '@/i18n/dateInput';
import { TenantUserPicker } from "@/components/TenantUserPicker";
import { PersonCell } from "@/components/TenantWorkspace/PersonCell";
import { ResponsiveFilters } from "@/components/TenantWorkspace/ResponsiveFilters";
import { useTenantPeople } from "@/components/TenantWorkspace/useTenantPeople";
import {
  tenantAuditValue,
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
  const { t: translate } = useTranslation();
  const [draft, setDraft] = useState<AuditDraft>(emptyDraft);
  const [filters, setFilters] = useState<TenantAuditEventParams>({
    page: 0,
    size: PAGE_SIZE,
  });
  const [filterFeedback, setFilterFeedback] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const [filterResetVersion, setFilterResetVersion] = useState(0);
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
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invalidId = [draft.actorUserId, draft.targetUserId].some(value => value !== '' && (!Number.isSafeInteger(Number(value)) || Number(value) <= 0));
    const invalidInput = Array.from(event.currentTarget.elements).find((field): field is HTMLInputElement => field instanceof HTMLInputElement && !field.validity.valid);
    // Date inputs keep incomplete display drafts separate from canonical values.
    // Validate that visible draft before treating an empty API value as no filter.
    const invalidDateDraft = ['from', 'to'].some(name => {
      const field = event.currentTarget.elements.namedItem(name);
      return field instanceof HTMLInputElement && field.value.trim() !== '' && !parseInputDateTime(field.value);
    });
    if (invalidId || invalidInput?.type === 'number') {setValidation('operations:audit.invalidUserId'); return;}
    if (invalidInput || invalidDateDraft || [draft.from, draft.to].some(value => value && !Number.isFinite(Date.parse(value))) || (draft.from && draft.to && Date.parse(draft.to) < Date.parse(draft.from))) {setValidation('operations:audit.invalidDates'); return;}
    setValidation(null);
    setFilterFeedback("operations:audit.applied");
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
    // Explicit clear also resets an incomplete date display whose API value is
    // already empty. Locale changes never alter this editor identity.
    setFilterResetVersion(current => current + 1);
    setDraft(emptyDraft);
    setActor(null);
    setFilters({ page: 0, size: PAGE_SIZE });
    setValidation(null);
    setFilterFeedback("operations:audit.cleared");
  };
  const page = filters.page ?? 0;

  return (
    <section className={styles.surface} aria-label={translate("operations:audit.title")}>
      <div className={styles.sectionHeading}>
        <h2 className={styles.srOnly}>{translate("operations:audit.title")}</h2>
        <TenantUserPicker
          variant="filter"
          title={translate("operations:audit.chooseActor")}
          description={translate("operations:audit.actorHelp")}
          levels={[]}
          includeAllAccounts
          selectedUser={actor}
          triggerLabel={translate("operations:audit.allUsers")}
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
            setFilterFeedback("operations:audit.actorApplied");
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
        <form className={styles.filterBar} noValidate onSubmit={apply}>
          <label>
            <span>{translate("advising:counsellor.action")}</span>
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
            <span>{translate("operations:audit.resourceType")}</span>
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
            <span>{translate("operations:from")}</span>
            <EnglishDateTimeInput
              key={`from-${filterResetVersion}`}
              name="from"
              aria-label={translate('operations:from')}
              value={draft.from}
              onChangeValue={(value) =>
                setDraft((current) => ({ ...current, from: value }))
              }
            />
          </label>
          <label className={auditStyles.dateTimeField}>
            <span>{translate("operations:to")}</span>
            <EnglishDateTimeInput
              key={`to-${filterResetVersion}`}
              name="to"
              aria-label={translate('operations:to')}
              value={draft.to}
              onChangeValue={(value) =>
                setDraft((current) => ({ ...current, to: value }))
              }
            />
          </label>
          <button className={styles.primaryButton}>
            <Search size={17} />
            {translate("operations:directory.applyFilters")}</button>
          {hasFilters ? <button
            type="button"
            className={styles.secondaryButton}
            onClick={clear}
          >
            {translate("common:actions.clearFilters")}</button> : null}
          <details className={auditStyles.advanced}>
            <summary>{translate("operations:audit.filterId")}</summary>
            <div className={styles.filterBar}>
              <label>
                <span>{translate("operations:audit.actorId")}</span>
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
                <span>{translate("operations:audit.targetId")}</span>
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
          {translate(filterFeedback)}
        </p>
      ) : null}
      {validation ? <p className={styles.inlineError} role="alert">{translate(validation)}</p> : null}
      {audit.isPending ? (
        <p className={styles.status}>{translate("operations:audit.loading")}</p>
      ) : null}
      {audit.isError ? (
        <div className={styles.errorNotice} role="alert">
          <p>
            {getApiErrorMessage(
              audit.error,
              translate("operations:audit.failed"),
            )}
          </p>
          <button type="button" onClick={() => void audit.refetch()}>
            {translate("common:actions.tryAgain")}</button>
        </div>
      ) : null}
      {!audit.isPending && !audit.isError && audit.data.items.length === 0 ? (
        <p className={styles.empty}>
          {translate("operations:audit.empty")}</p>
      ) : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{translate("operations:audit.timestamp")}</th>
              <th>{translate("common:roles.USER")}</th>
              <th>{translate("advising:counsellor.action")}</th>
              <th>{translate("learning:plan.target")}</th>
              <th>{translate("common:fields.details")}</th>
            </tr>
          </thead>
          <tbody>
            {audit.data?.items.map((event) => (
              <tr key={event.eventId}>
                <td data-label={translate("operations:audit.timestamp")}>
                  <time dateTime={event.createdAt} className={styles.muted}>
                    {tenantDate(event.createdAt, true)}
                  </time>
                </td>
                <td data-label={translate("common:roles.USER")}>
                  <PersonCell
                    person={
                      people.get(event.actorUserId ?? -1) ?? {
                        id: event.actorUserId,
                      }
                    }
                  />
                </td>
                <td data-label={translate("advising:counsellor.action")}>
                  {tenantAuditValue(event.action)}
                  <small>{tenantAuditValue(event.resourceType, 'resources')}</small>
                </td>
                <td data-label={translate("learning:plan.target")}>
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
                      <summary>{translate("operations:audit.viewChanges")}</summary>
                      {event.before ? (
                        <div>
                          <strong>{translate("operations:audit.before")}</strong>
                          <pre>{JSON.stringify(event.before, null, 2)}</pre>
                        </div>
                      ) : null}
                      {event.after ? (
                        <div>
                          <strong>{translate("operations:audit.after")}</strong>
                          <pre>{JSON.stringify(event.after, null, 2)}</pre>
                        </div>
                      ) : null}
                      <small>{translate('operations:audit.event', {id: event.eventId})}</small>
                    </details>
                  ) : (
                    <span className={styles.muted}>{translate("operations:audit.noChange")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {audit.data && audit.data.total > PAGE_SIZE ? (
        <nav className={styles.pagination} aria-label={translate("operations:audit.pages")}>
          <button
            type="button"
            disabled={page === 0}
            onClick={() =>
              setFilters((current) => ({ ...current, page: page - 1 }))
            }
          >
            {translate("common:actions.previous")}</button>
          <span>
            {translate('operations:audit.pageSummary', {count: audit.data.total, page: formatNumber(page + 1), number: formatNumber(audit.data.total)})}
          </span>
          <button
            type="button"
            disabled={(page + 1) * PAGE_SIZE >= audit.data.total}
            onClick={() =>
              setFilters((current) => ({ ...current, page: page + 1 }))
            }
          >
            {translate("common:actions.next")}</button>
        </nav>
      ) : null}
    </section>
  );
};
