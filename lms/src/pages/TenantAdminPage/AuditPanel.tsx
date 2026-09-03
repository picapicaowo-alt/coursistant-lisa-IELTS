import {WorkspaceSection as CollapsibleSection} from '@/components/WorkspaceSection';
import {FormEvent, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {RefreshCw, Search} from 'lucide-react';
import type {TenantAuditEventParams} from '@/apis';
import {unwrapData} from '@/apis';
import {adminApiService} from '@/apis/services/admin-api';
import {getApiErrorMessage} from '@/utils/apiError';
import {EnglishDateTimeInput} from '@/components/EnglishDateInput';
import styles from './index.module.scss';

const PAGE_SIZE = 20;
type AuditDraft = {actorUserId: string; targetUserId: string; action: string; resourceType: string; from: string; to: string};
const emptyDraft: AuditDraft = {actorUserId: '', targetUserId: '', action: '', resourceType: '', from: '', to: ''};
const dateTimeParam = (value: string) => value ? new Date(value).toISOString() : undefined;

export const AuditPanel = () => {
  const [draft, setDraft] = useState<AuditDraft>(emptyDraft);
  const [filters, setFilters] = useState<TenantAuditEventParams>({page: 0, size: PAGE_SIZE});
  const [filterFeedback, setFilterFeedback] = useState('');
  const audit = useQuery({queryKey: ['tenant', 'audit-events', filters], queryFn: async () => unwrapData(await adminApiService.listTenantAuditEvents(filters), 'tenantAuditEvents'), retry: false});
  const apply = (event: FormEvent) => {
    event.preventDefault();
    setFilterFeedback('Filters applied.');
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
  const clear = () => {
    const alreadyClear = Object.values(draft).every(value => value === '')
      && Object.keys(filters).every(key => key === 'page' || key === 'size');
    setDraft(emptyDraft);
    setFilters({page: 0, size: PAGE_SIZE});
    setFilterFeedback('Filters cleared. Showing all governance events.');
    if (alreadyClear) void audit.refetch();
  };
  const page = filters.page ?? 0;

  return <CollapsibleSection title="Governance audit" headingId="audit-title" summary="Review account, ownership, and policy changes for your institution.">
    <div className={styles.panelHeading}><button type="button" className={styles.iconButton} aria-label="Refresh audit" onClick={() => void audit.refetch()}><RefreshCw size={18}/></button></div>
    <form className={styles.auditFilters} onSubmit={apply}>
      <label><span>Actor user ID</span><input type="number" min="1" value={draft.actorUserId} onChange={event => setDraft(current => ({...current, actorUserId: event.target.value}))}/></label>
      <label><span>Target user ID</span><input type="number" min="1" value={draft.targetUserId} onChange={event => setDraft(current => ({...current, targetUserId: event.target.value}))}/></label>
      <label><span>Action</span><input value={draft.action} onChange={event => setDraft(current => ({...current, action: event.target.value}))}/></label>
      <label><span>Resource type</span><input value={draft.resourceType} onChange={event => setDraft(current => ({...current, resourceType: event.target.value}))}/></label>
      <label><span>From</span><EnglishDateTimeInput value={draft.from} onChangeValue={value => setDraft(current => ({...current, from: value}))}/></label>
      <label><span>To</span><EnglishDateTimeInput value={draft.to} onChangeValue={value => setDraft(current => ({...current, to: value}))}/></label>
      <button className={styles.primaryButton}><Search size={17}/>Apply filters</button>
      <button type="button" className={styles.secondaryButton} onClick={clear}>Clear filters</button>
    </form>
    {filterFeedback ? <p className={styles.srStatus} role="status">{filterFeedback}</p> : null}
    {audit.isPending ? <p className={styles.status}>Loading audit events…</p> : null}
    {audit.isError ? <div className={styles.errorNotice} role="alert"><p>{getApiErrorMessage(audit.error, 'Audit events could not be loaded.')}</p><button type="button" onClick={() => void audit.refetch()}>Try again</button></div> : null}
    {!audit.isPending && !audit.isError && audit.data.items.length === 0 ? <p className={styles.empty}>No governance events match these filters.</p> : null}
    <div className={styles.auditList}>{audit.data?.items.map(event => <article key={event.eventId} className={styles.auditEvent}><div className={styles.auditSummary}><span><strong>{event.action}</strong><small>{event.resourceType} · {event.sourceType ?? 'governance'}</small></span><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></div><dl className={styles.auditMeta}><dt>Event</dt><dd>{event.eventId}</dd><dt>Actor</dt><dd>{event.actorUserId ?? '—'}</dd><dt>Target</dt><dd>{event.targetUserId ?? '—'}</dd></dl>{event.before || event.after ? <details className={styles.changeDetails}><summary>View projected change</summary><div>{event.before ? <section><h3>Before</h3><pre>{JSON.stringify(event.before, null, 2)}</pre></section> : null}{event.after ? <section><h3>After</h3><pre>{JSON.stringify(event.after, null, 2)}</pre></section> : null}</div></details> : null}</article>)}</div>
    {audit.data && audit.data.total > PAGE_SIZE ? <nav className={styles.pagination} aria-label="Audit pages"><button type="button" disabled={page === 0} onClick={() => setFilters(current => ({...current, page: page - 1}))}>Previous</button><span>Page {page + 1} · {audit.data.total} events</span><button type="button" disabled={(page + 1) * PAGE_SIZE >= audit.data.total} onClick={() => setFilters(current => ({...current, page: page + 1}))}>Next</button></nav> : null}
  </CollapsibleSection>;
};
