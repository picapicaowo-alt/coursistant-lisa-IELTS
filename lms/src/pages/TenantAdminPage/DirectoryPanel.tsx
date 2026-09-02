import {FormEvent, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ChevronRight, RefreshCw, Search, UserPlus} from 'lucide-react';
import type {ManagedUser, UserLevel} from '@/apis';
import {unwrapData} from '@/apis';
import {adminApiService} from '@/apis/services/admin-api';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {getApiErrorMessage, isRecord} from '@/utils/apiError';
import {formatPersonName} from '@/utils/personName';
import styles from './index.module.scss';

const PAGE_SIZE = 20;
const STAFF_LEVELS = ['COUNSELLOR', 'ADVISOR', 'INSTRUCTOR', 'INSTRUCTOR_ADVISOR'] as const;

type StaffLevel = typeof STAFF_LEVELS[number];
type DirectoryFilters = {
  q: string;
  role: '' | 'USER' | 'TENANT_ADMIN';
  level: '' | UserLevel;
  status: '' | 'ACTIVE' | 'DISABLED';
};

const emptyFilters: DirectoryFilters = {q: '', role: '', level: '', status: ''};

const transitionTargets = (account: ManagedUser): StaffLevel[] => {
  if (account.role !== 'USER') return [];
  if (account.level === 'INSTRUCTOR' || account.level === 'ADVISOR') return ['INSTRUCTOR_ADVISOR'];
  if (account.level === 'INSTRUCTOR_ADVISOR') return ['INSTRUCTOR', 'ADVISOR'];
  return [];
};

const blockerGuidance: Record<string, string> = {
  ACTIVE_STUDENT_ASSIGNMENTS: 'Reassign the user’s active students in Student intakes.',
  ACTIVE_COURSE_OWNERSHIP: 'Transfer their courses in Course ownership.',
  ACTIVE_INSTRUCTOR_ENROLLMENTS: 'Active instructor enrolments must be resolved by an authorized teaching operator.',
  ACTIVE_STUDENT_ENROLLMENTS: 'Active student enrolments must be resolved by an authorized teaching operator.',
  ACTIVE_TA_ENROLLMENTS: 'Active teaching-assistant enrolments must be resolved by an authorized teaching operator.',
  ACTIVE_PARENT_LINKS: 'Unlink active Parent relationships from the relevant student record.',
};

const getBlockers = (error: unknown): string[] => {
  if (!isRecord(error) || !isRecord(error.details) || !isRecord(error.details.data)) return [];
  const blockers = error.details.data.blockers;
  return Array.isArray(blockers) ? blockers.filter((value): value is string => typeof value === 'string') : [];
};

export const DirectoryPanel = () => {
  const {user: currentUser} = useRequiredAuth();
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<DirectoryFilters>(emptyFilters);
  const [filters, setFilters] = useState<DirectoryFilters>(emptyFilters);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({email: '', firstName: '', middleName: '', lastName: '', role: 'USER' as 'USER' | 'TENANT_ADMIN', level: 'COUNSELLOR' as StaffLevel});
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [transitionLevel, setTransitionLevel] = useState<StaffLevel | ''>('');
  const [feedback, setFeedback] = useState<string>('');

  const directory = useQuery({
    queryKey: ['tenant', 'users', filters, page, PAGE_SIZE],
    queryFn: async () => unwrapData(await adminApiService.listTenantUsers({
      q: filters.q || undefined,
      role: filters.role || undefined,
      level: filters.level || undefined,
      status: filters.status || undefined,
      page,
      size: PAGE_SIZE,
    }), 'tenantUserDirectory'),
    retry: false,
  });
  const detail = useQuery({
    queryKey: ['tenant', 'user', selectedId],
    queryFn: async () => unwrapData(await adminApiService.getTenantUser(selectedId as number), 'tenantUserDetail'),
    enabled: selectedId !== null,
    retry: false,
  });

  const refresh = async (message?: string) => {
    if (message) setFeedback(message);
    await Promise.all([
      queryClient.invalidateQueries({queryKey: ['tenant', 'users']}),
      ...(selectedId ? [queryClient.invalidateQueries({queryKey: ['tenant', 'user', selectedId]})] : []),
    ]);
  };
  const create = useMutation({
    mutationFn: () => adminApiService.createTenantManagedUser({
      email: createForm.email.trim().toLowerCase(),
      firstName: createForm.firstName.trim(),
      ...(createForm.middleName.trim() ? {middleName: createForm.middleName.trim()} : {}),
      lastName: createForm.lastName.trim(),
      role: createForm.role,
      level: createForm.role === 'TENANT_ADMIN' ? 'NOT_APPLICABLE' : createForm.level,
    }),
    onSuccess: async response => {
      const id = unwrapData(response, 'tenantManagedUserCreate');
      setCreateForm({email: '', firstName: '', middleName: '', lastName: '', role: 'USER', level: 'COUNSELLOR'});
      setSelectedId(id);
      await refresh('Account created. The user can set their first password through Forgot password.');
    },
  });
  const disable = useMutation({
    mutationFn: (id: number) => adminApiService.disableTenantManagedUser(id),
    onSuccess: async () => {
      setConfirmDisable(false);
      await refresh('Account disabled. Responsibilities are not automatically reassigned.');
    },
  });
  const enable = useMutation({
    mutationFn: (id: number) => adminApiService.enableTenantManagedUser(id),
    onSuccess: async () => refresh('Login restored. Previous assignments, enrolments, Parent links, and course ownership were not restored.'),
  });
  const changeRole = useMutation({
    mutationFn: ({id, level}: {id: number; level: StaffLevel}) => adminApiService.changeTenantManagedUserRole(id, {role: 'USER', level}),
    onSuccess: async () => {
      setTransitionLevel('');
      await refresh('Identity updated. Existing sessions were signed out.');
    },
  });

  const submitFilters = (event: FormEvent) => {
    event.preventDefault();
    setPage(0);
    setFilters({...draftFilters, q: draftFilters.q.trim()});
  };
  const selected = detail.data;
  const isSelf = selected?.id === currentUser.id;
  const targets = selected ? transitionTargets(selected) : [];
  const operationError = create.error || disable.error || enable.error || changeRole.error;
  const blockers = getBlockers(disable.error);

  return (
    <div className={styles.directoryLayout}>
      <section className={styles.primaryPanel} aria-labelledby="directory-title">
        <div className={styles.panelHeading}>
          <div><h2 id="directory-title">User directory</h2><p>Search and filter people in your tenant. Search covers names and email only.</p></div>
          <button type="button" className={styles.iconButton} aria-label="Refresh directory" onClick={() => void directory.refetch()}><RefreshCw size={18}/></button>
        </div>
        <form className={styles.filterBar} onSubmit={submitFilters}>
          <label className={styles.searchField}><span>Search by name or email</span><div><Search size={17}/><input value={draftFilters.q} onChange={event => setDraftFilters(current => ({...current, q: event.target.value}))} placeholder="Name or email"/></div></label>
          <label><span>Account</span><select value={draftFilters.role} onChange={event => setDraftFilters(current => ({...current, role: event.target.value as DirectoryFilters['role']}))}><option value="">All</option><option value="USER">Staff and users</option><option value="TENANT_ADMIN">Tenant admins</option></select></label>
          <label><span>Identity</span><select value={draftFilters.level} onChange={event => setDraftFilters(current => ({...current, level: event.target.value as DirectoryFilters['level']}))}><option value="">All</option><option value="STUDENT">Student</option><option value="PARENT">Parent</option>{STAFF_LEVELS.map(level => <option value={level} key={level}>{level}</option>)}</select></label>
          <label><span>Status</span><select value={draftFilters.status} onChange={event => setDraftFilters(current => ({...current, status: event.target.value as DirectoryFilters['status']}))}><option value="">All</option><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option></select></label>
          <button className={styles.primaryButton}>Apply filters</button>
        </form>

        {directory.isPending ? <p className={styles.status} role="status">Loading directory…</p> : null}
        {directory.isError ? <div className={styles.errorNotice} role="alert"><p>{getApiErrorMessage(directory.error, 'The directory could not be loaded.')}</p><button type="button" onClick={() => void directory.refetch()}>Try again</button></div> : null}
        {!directory.isPending && !directory.isError && directory.data.items.length === 0 ? <p className={styles.empty}>No users match these filters.</p> : null}
        <div className={styles.recordList}>
          {directory.data?.items.map(account => (
            <button type="button" className={selectedId === account.id ? styles.selectedRecord : styles.record} key={account.id} onClick={() => { setSelectedId(account.id); setConfirmDisable(false); setTransitionLevel(''); setFeedback(''); }}>
              <span><strong>{formatPersonName(account, `User #${account.id}`)}</strong><small>{account.email}</small></span>
              <span className={styles.recordMeta}><em>{account.role === 'TENANT_ADMIN' ? 'TENANT ADMIN' : account.level}</em><small>{account.status}</small></span>
              <ChevronRight size={18}/>
            </button>
          ))}
        </div>
        {directory.data && directory.data.total > PAGE_SIZE ? <nav className={styles.pagination} aria-label="Directory pages"><button type="button" disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</button><span>Page {page + 1} · {directory.data.total} users</span><button type="button" disabled={(page + 1) * PAGE_SIZE >= directory.data.total} onClick={() => setPage(current => current + 1)}>Next</button></nav> : null}
      </section>

      <aside className={styles.sideColumn}>
        <section className={styles.secondaryPanel} aria-labelledby="create-account-title">
          <div className={styles.panelHeading}><div><h2 id="create-account-title">Create account</h2><p>Staff and additional Tenant Admins only.</p></div><UserPlus size={20}/></div>
          <form className={styles.form} onSubmit={event => { event.preventDefault(); create.mutate(); }}>
            <label><span>Account type</span><select value={createForm.role} onChange={event => setCreateForm(current => ({...current, role: event.target.value as 'USER' | 'TENANT_ADMIN'}))}><option value="USER">Staff</option><option value="TENANT_ADMIN">Tenant admin</option></select></label>
            {createForm.role === 'USER' ? <label><span>Staff identity</span><select value={createForm.level} onChange={event => setCreateForm(current => ({...current, level: event.target.value as StaffLevel}))}>{STAFF_LEVELS.map(level => <option value={level} key={level}>{level}</option>)}</select></label> : null}
            <div className={styles.nameGrid}><label><span>First name</span><input required maxLength={100} value={createForm.firstName} onChange={event => setCreateForm(current => ({...current, firstName: event.target.value}))}/></label><label><span>Middle name</span><input maxLength={100} value={createForm.middleName} onChange={event => setCreateForm(current => ({...current, middleName: event.target.value}))}/></label><label><span>Last name</span><input required maxLength={100} value={createForm.lastName} onChange={event => setCreateForm(current => ({...current, lastName: event.target.value}))}/></label></div>
            <label><span>Email</span><input required type="email" value={createForm.email} onChange={event => setCreateForm(current => ({...current, email: event.target.value}))}/></label>
            <p className={styles.hint}>Students are created through Student intake. Parents are created or reused from a student’s Parent links.</p>
            <button className={styles.primaryButton} disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create account'}</button>
          </form>
          {create.isError ? <p className={styles.inlineError} role="alert">{getApiErrorMessage(create.error, 'The account could not be created.')}</p> : null}
        </section>

        {selectedId !== null ? <section className={styles.secondaryPanel} aria-labelledby="account-detail-title">
          <div className={styles.panelHeading}><div><h2 id="account-detail-title">Account details</h2><p>Identity and lifecycle governance.</p></div></div>
          {detail.isPending ? <p className={styles.status}>Loading account…</p> : null}
          {detail.isError ? <div className={styles.errorNotice} role="alert"><p>{getApiErrorMessage(detail.error, 'This account is unavailable.')}</p><button type="button" onClick={() => void detail.refetch()}>Try again</button></div> : null}
          {selected ? <>
            <dl className={styles.detailList}><dt>Name</dt><dd>{formatPersonName(selected, `User #${selected.id}`)}</dd><dt>Email</dt><dd>{selected.email}</dd><dt>Identity</dt><dd>{selected.role} / {selected.level}</dd><dt>Status</dt><dd>{selected.status}</dd></dl>
            {isSelf ? <p className={styles.hint}>You cannot disable, enable, or change your own Tenant Admin identity.</p> : <div className={styles.governanceActions}>
              {targets.length > 0 ? <form className={styles.form} onSubmit={event => { event.preventDefault(); if (transitionLevel) changeRole.mutate({id: selected.id, level: transitionLevel}); }}><label><span>Convert identity</span><select required value={transitionLevel} onChange={event => setTransitionLevel(event.target.value as StaffLevel)}><option value="">Choose allowed target</option>{targets.map(level => <option value={level} key={level}>{level}</option>)}</select></label><button className={styles.secondaryButton} disabled={!transitionLevel || changeRole.isPending}>{changeRole.isPending ? 'Updating…' : 'Confirm identity change'}</button></form> : <p className={styles.hint}>This identity has no permitted conversion.</p>}
              {selected.status === 'DISABLED' ? <button type="button" className={styles.primaryButton} disabled={enable.isPending} onClick={() => enable.mutate(selected.id)}>{enable.isPending ? 'Restoring…' : 'Restore login'}</button> : confirmDisable ? <div className={styles.confirmBox}><p>Disable this account? The backend will return any unresolved responsibility blockers.</p><div><button type="button" className={styles.dangerButton} disabled={disable.isPending} onClick={() => disable.mutate(selected.id)}>{disable.isPending ? 'Disabling…' : 'Confirm disable'}</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmDisable(false)}>Cancel</button></div></div> : <button type="button" className={styles.dangerLink} onClick={() => setConfirmDisable(true)}>Disable account</button>}
            </div>}
          </> : null}
          {feedback ? <p className={styles.inlineSuccess} role="status">{feedback}</p> : null}
          {operationError && !create.error ? <p className={styles.inlineError} role="alert">{getApiErrorMessage(operationError, 'The account operation could not be completed.')}</p> : null}
          {blockers.length > 0 ? <div className={styles.blockers} role="alert"><strong>Resolve these responsibilities, then retry:</strong><ul>{blockers.map(blocker => <li key={blocker}><code>{blocker}</code><span>{blockerGuidance[blocker] ?? 'Resolve this responsibility in its owning workflow.'}</span></li>)}</ul></div> : null}
        </section> : null}
      </aside>
    </div>
  );
};
