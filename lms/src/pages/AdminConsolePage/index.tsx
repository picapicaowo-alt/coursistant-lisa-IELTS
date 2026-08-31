import React, {FormEvent, useMemo, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Navigate} from 'react-router-dom';
import {
  AdminTenant,
  AdminTenantPayload,
  AssignmentGradeCorrectionRequest,
  ChangeManagedUserRoleRequest,
  CreateManagedUserRequest,
  ManagedUser,
  UserLevel,
  unwrapData,
} from '@/apis';
import {adminApiService} from '@/apis/services/admin-api';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {getManagedUserCreateError} from './adminFeedback';
import {CourseMembershipPanel} from './components/CourseMembershipPanel';
import {AdminContractOperations} from './components/AdminContractOperations';
import styles from './index.module.scss';
import {normalizeManagedUsers} from './adminDirectory';
import {formatPersonName} from '@/utils/personName';

type ManagedRole = CreateManagedUserRequest['role'];
type ManagedLevel = Exclude<UserLevel, 'NOT_APPLICABLE'>;
const SYSTEM_MANAGED_LEVEL_OPTIONS: ManagedLevel[] = ['STUDENT', 'PARENT', 'INSTRUCTOR', 'COUNSELLOR', 'ADVISOR', 'INSTRUCTOR_ADVISOR'];
const TENANT_MANAGED_LEVEL_OPTIONS: ManagedLevel[] = ['INSTRUCTOR', 'COUNSELLOR', 'ADVISOR', 'INSTRUCTOR_ADVISOR'];
const asManagedLevel = (level: string, fallback: ManagedLevel): ManagedLevel =>
  SYSTEM_MANAGED_LEVEL_OPTIONS.includes(level as ManagedLevel) ? level as ManagedLevel : fallback;
const levelSelect = (
  value: ManagedLevel,
  onChange: (level: ManagedLevel) => void,
  options: ManagedLevel[],
) => (
  <label>
    <span>Level</span>
    <select value={value} onChange={event => onChange(event.target.value as ManagedLevel)}>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);
type PageFeedback = {tone: 'success' | 'error'; text: string};

const TenantRow = ({tenant, busy, onSave, onDelete}: {
  tenant: AdminTenant;
  busy: boolean;
  onSave: (id: number, payload: AdminTenantPayload) => void;
  onDelete: (id: number) => void;
}) => {
  const [name, setName] = useState(tenant.name);
  const [timezone, setTimezone] = useState(tenant.timezone);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <article className={styles.listRow}>
      <div className={styles.rowIdentity}>
        <strong>{tenant.name}</strong>
        <span>Tenant #{tenant.id} · {tenant.timezone}</span>
      </div>
      <details className={styles.details}>
        <summary>Edit</summary>
        <div className={styles.inlineForm}>
          <label><span>Name</span><input value={name} onChange={event => setName(event.target.value)}/></label>
          <label><span>Timezone</span><input value={timezone} onChange={event => setTimezone(event.target.value)}/></label>
          <button type="button" className={styles.primaryButton} disabled={busy || !name.trim() || !timezone.trim()} onClick={() => onSave(tenant.id, {name: name.trim(), timezone: timezone.trim()})}>Save</button>
          {confirmDelete ? <><button type="button" className={styles.dangerButton} disabled={busy} onClick={() => onDelete(tenant.id)}>Confirm delete</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmDelete(false)}>Cancel</button></> : <button type="button" className={styles.dangerLink} onClick={() => setConfirmDelete(true)}>Delete tenant</button>}
        </div>
      </details>
    </article>
  );
};

const ManagedUserRow = ({account, tenants, busy, systemScope, onUpdate, onDisable, onEnable, onMoveTenant}: {
  account: ManagedUser;
  tenants: AdminTenant[];
  busy: boolean;
  systemScope: boolean;
  onUpdate: (id: number, request: ChangeManagedUserRoleRequest) => void;
  onDisable: (id: number) => void;
  onEnable: (id: number) => void;
  onMoveTenant: (id: number, tenantId: number) => void;
}) => {
  const [role, setRole] = useState<ManagedRole>(account.role === 'TENANT_ADMIN' ? 'TENANT_ADMIN' : 'USER');
  const [level, setLevel] = useState<ManagedLevel>(asManagedLevel(account.level, systemScope ? 'STUDENT' : 'INSTRUCTOR'));
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [targetTenantId, setTargetTenantId] = useState(String(account.tenantId));
  const [confirmMove, setConfirmMove] = useState(false);
  const immutableTenantIdentity = !systemScope && (account.level === 'STUDENT' || account.level === 'PARENT');

  return (
    <article className={styles.listRow}>
      <div className={styles.rowIdentity}>
        <strong>{formatPersonName(account, account.name || account.email)}</strong>
        <span>{account.email} · User #{account.id} · Tenant #{account.tenantId}</span>
        <small>{account.role}{account.role === 'USER' ? ` / ${account.level}` : ''} · {account.status}</small>
      </div>
      <details className={styles.details}>
        <summary>Manage</summary>
        <div className={styles.inlineForm}>
          {immutableTenantIdentity ? <p>Student and Parent identities cannot be changed through managed-user role transitions.</p> : <>
            <label><span>Account role</span><select value={role} onChange={event => setRole(event.target.value as ManagedRole)}><option value="USER">User</option><option value="TENANT_ADMIN">Tenant admin</option></select></label>
            {role === 'USER' ? levelSelect(level, setLevel, systemScope ? SYSTEM_MANAGED_LEVEL_OPTIONS : TENANT_MANAGED_LEVEL_OPTIONS) : null}
            <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => onUpdate(account.id, {role, level: role === 'USER' ? level : 'NOT_APPLICABLE'})}>Update role</button>
          </>}
          {systemScope ? <><div className={styles.operationDivider}/>
          <label><span>Tenant</span><select value={targetTenantId} onChange={event => { setTargetTenantId(event.target.value); setConfirmMove(false); }}>{tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name} (#{tenant.id})</option>)}</select></label>
          {Number(targetTenantId) !== account.tenantId ? confirmMove ? (
            <div className={styles.confirmStack}>
              <p>Move this identity to tenant #{targetTenantId}? Active course memberships or responsibilities may prevent the move.</p>
              <div className={styles.confirmRow}><button type="button" className={styles.dangerButton} disabled={busy} onClick={() => onMoveTenant(account.id, Number(targetTenantId))}>Confirm tenant move</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmMove(false)}>Cancel</button></div>
            </div>
          ) : <button type="button" className={styles.dangerLink} disabled={busy} onClick={() => setConfirmMove(true)}>Move to another tenant</button> : null}</> : null}
          {account.status !== 'DISABLED' ? confirmDisable ? <><button type="button" className={styles.dangerButton} disabled={busy} onClick={() => onDisable(account.id)}>Confirm disable</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmDisable(false)}>Cancel</button></> : <button type="button" className={styles.dangerLink} onClick={() => setConfirmDisable(true)}>Disable account</button> : !systemScope ? <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => onEnable(account.id)}>Enable account</button> : null}
        </div>
      </details>
    </article>
  );
};

const AdminConsolePage: React.FC = () => {
  const {user} = useRequiredAuth();
  const queryClient = useQueryClient();
  const isSystemAdmin = user.role === 'SYSTEM_ADMIN';
  const isTenantAdmin = user.role === 'TENANT_ADMIN';
  // Scope is derived from authenticated context, never from an editable form;
  // the API still performs the authoritative permission and tenant checks.
  const scope = isSystemAdmin ? 'system' : 'tenant';
  const [tab, setTab] = useState<'users' | 'members' | 'tenants' | 'operations'>('users');
  const [message, setMessage] = useState<PageFeedback | null>(null);
  const [search, setSearch] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantTimezone, setTenantTimezone] = useState('America/Los_Angeles');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<ManagedRole>('USER');
  const [level, setLevel] = useState<ManagedLevel>(isSystemAdmin ? 'STUDENT' : 'INSTRUCTOR');
  const [tenantId, setTenantId] = useState('');
  const [managedUserId, setManagedUserId] = useState('');
  const [manualRole, setManualRole] = useState<ManagedRole>('USER');
  const [manualLevel, setManualLevel] = useState<ManagedLevel>('INSTRUCTOR');
  const [confirmManualDisable, setConfirmManualDisable] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [primaryInstructorUserId, setPrimaryInstructorUserId] = useState('');
  const [confirmReassignment, setConfirmReassignment] = useState(false);
  const [correction, setCorrection] = useState<AssignmentGradeCorrectionRequest>({assignmentId: 0, studentUserId: 0, score: 0, reason: ''});
  const [confirmCorrection, setConfirmCorrection] = useState(false);

  const tenantsQuery = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: async () => unwrapData(await adminApiService.listTenants(), 'listTenants'),
    enabled: isSystemAdmin,
    retry: 1,
  });
  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => unwrapData(await adminApiService.listUsers(), 'listUsers'),
    enabled: isSystemAdmin,
    retry: 1,
  });
  const tenantUsersQuery = useQuery({
    queryKey: ['tenant', 'users'],
    queryFn: async () => normalizeManagedUsers(
      unwrapData(await adminApiService.listTenantUsers({page: 0, size: 100}), 'listTenantUsers'),
    ),
    enabled: isTenantAdmin,
    retry: 1,
  });

  const createTenant = useMutation({
    mutationFn: (payload: AdminTenantPayload) => adminApiService.createTenant(payload),
    onSuccess: async () => {
      setTenantName('');
      setMessage({tone: 'success', text: 'Tenant created.'});
      await queryClient.invalidateQueries({queryKey: ['admin', 'tenants']});
    },
    onError: () => setMessage({tone: 'error', text: 'The tenant could not be created.'}),
  });
  const updateTenant = useMutation({
    mutationFn: ({id, payload}: {id: number; payload: AdminTenantPayload}) => adminApiService.updateTenant(id, payload),
    onSuccess: async () => {
      setMessage({tone: 'success', text: 'Tenant updated.'});
      await queryClient.invalidateQueries({queryKey: ['admin', 'tenants']});
    },
    onError: () => setMessage({tone: 'error', text: 'The tenant could not be updated.'}),
  });
  const deleteTenant = useMutation({
    mutationFn: (id: number) => adminApiService.deleteTenant(id),
    onSuccess: async () => {
      setMessage({tone: 'success', text: 'Tenant deleted.'});
      await queryClient.invalidateQueries({queryKey: ['admin', 'tenants']});
    },
    onError: () => setMessage({tone: 'error', text: 'The tenant could not be deleted. Remove its dependent records first.'}),
  });
  const createUser = useMutation({
    mutationFn: (request: CreateManagedUserRequest) => adminApiService.createManagedUser(scope, request),
    onSuccess: async response => {
      const id = unwrapData(response, 'createManagedUser');
      setManagedUserId(String(id));
      setEmail('');
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setMessage({tone: 'success', text: `Managed user #${id} created. They must use Forgot Password to establish their first password.`});
      await queryClient.invalidateQueries({queryKey: isSystemAdmin ? ['admin', 'users'] : ['tenant', 'users']});
    },
    onError: error => setMessage({tone: 'error', text: getManagedUserCreateError(error)}),
  });
  const changeRole = useMutation({
    mutationFn: ({id, request}: {id: number; request: ChangeManagedUserRoleRequest}) => adminApiService.changeManagedUserRole(scope, id, request),
    onSuccess: async () => {
      setMessage({tone: 'success', text: 'User role updated. Existing sessions have been signed out.'});
      await queryClient.invalidateQueries({queryKey: isSystemAdmin ? ['admin', 'users'] : ['tenant', 'users']});
    },
    onError: () => setMessage({tone: 'error', text: 'The role could not be changed. Check tenant scope and active course responsibilities.'}),
  });
  const disableUser = useMutation({
    mutationFn: (id: number) => adminApiService.disableManagedUser(scope, id),
    onSuccess: async () => {
      setConfirmManualDisable(false);
      setMessage({tone: 'success', text: 'User disabled and active enrolments withdrawn.'});
      await queryClient.invalidateQueries({queryKey: isSystemAdmin ? ['admin', 'users'] : ['tenant', 'users']});
    },
    onError: () => setMessage({tone: 'error', text: 'The user could not be disabled.'}),
  });
  const enableUser = useMutation({
    mutationFn: (id: number) => adminApiService.enableTenantManagedUser(id),
    onSuccess: async () => {
      setMessage({tone: 'success', text: 'User enabled. Previous assignments and enrolments were not restored.'});
      await queryClient.invalidateQueries({queryKey: ['tenant', 'users']});
    },
    onError: () => setMessage({tone: 'error', text: 'The user could not be enabled.'}),
  });
  const moveTenant = useMutation({
    mutationFn: ({id, targetTenantId}: {id: number; targetTenantId: number}) => adminApiService.changeUserTenant(id, {tenantId: targetTenantId}),
    onSuccess: async () => {
      setMessage({tone: 'success', text: 'User moved to the selected tenant. Existing sessions have been signed out.'});
      await queryClient.invalidateQueries({queryKey: ['admin', 'users']});
    },
    onError: () => setMessage({tone: 'error', text: 'The user could not be moved. Resolve active course responsibilities or duplicate tenant identity first.'}),
  });
  const reassignInstructor = useMutation({
    mutationFn: () => adminApiService.reassignPrimaryInstructor(Number(courseId), {primaryInstructorUserId: Number(primaryInstructorUserId)}),
    onSuccess: () => {
      setConfirmReassignment(false);
      setMessage({tone: 'success', text: 'Primary instructor reassigned. The change was added to the course audit log.'});
    },
    onError: () => setMessage({tone: 'error', text: 'The primary instructor could not be reassigned. Confirm course, tenant, role, and enrolment constraints.'}),
  });
  const correctGrade = useMutation({
    mutationFn: () => adminApiService.correctAssignmentGrade({...correction, reason: correction.reason.trim()}),
    onSuccess: () => {
      setConfirmCorrection(false);
      setMessage({tone: 'success', text: 'Assignment grade corrected and written to the system audit log.'});
    },
    onError: () => setMessage({tone: 'error', text: 'The grade could not be corrected. Confirm that an existing grade row matches this assignment and student.'}),
  });

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const source = isSystemAdmin ? usersQuery.data ?? [] : tenantUsersQuery.data ?? [];
    if (!needle) return source;
    return source.filter(account => `${formatPersonName(account, account.name)} ${account.email} ${account.id} ${account.tenantId}`.toLowerCase().includes(needle));
  }, [isSystemAdmin, search, tenantUsersQuery.data, usersQuery.data]);

  if (!isSystemAdmin && !isTenantAdmin) return <Navigate to="/" replace/>;

  const submitUser = (event: FormEvent) => {
    event.preventDefault();
    const resolvedTenantId = Number(tenantId || tenantsQuery.data?.[0]?.id);
    createUser.mutate({
      email: email.trim(),
      firstName: firstName.trim(),
      ...(middleName.trim() ? {middleName: middleName.trim()} : {}),
      lastName: lastName.trim(),
      role,
      level: role === 'USER' ? level : 'NOT_APPLICABLE',
      ...(isSystemAdmin ? {tenantId: resolvedTenantId} : {}),
    });
  };
  const busy = changeRole.isPending || disableUser.isPending || enableUser.isPending || moveTenant.isPending;
  const manualId = Number(managedUserId);

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>{isSystemAdmin ? 'System administration' : 'Tenant administration'}</p><h1>Admin Console</h1><p>Identity and tenant operations are isolated from course authoring.</p></div>
      </header>

      <nav className={styles.tabs} aria-label="Admin sections">
        <button type="button" aria-pressed={tab === 'users'} className={tab === 'users' ? styles.activeTab : ''} onClick={() => setTab('users')}>Managed users</button>
        <button type="button" aria-pressed={tab === 'members'} className={tab === 'members' ? styles.activeTab : ''} onClick={() => setTab('members')}>Course members</button>
        {isSystemAdmin ? <button type="button" aria-pressed={tab === 'tenants'} className={tab === 'tenants' ? styles.activeTab : ''} onClick={() => setTab('tenants')}>Tenants</button> : null}
        <button type="button" aria-pressed={tab === 'operations'} className={tab === 'operations' ? styles.activeTab : ''} onClick={() => setTab('operations')}>Operations</button>
      </nav>

      {message ? <p className={message.tone === 'error' ? styles.errorMessage : styles.message} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {tab === 'tenants' && isSystemAdmin ? (
        <div className={styles.contentGrid}>
          <section className={styles.card} aria-labelledby="create-tenant-title">
            <h2 id="create-tenant-title">Create tenant</h2>
            <form className={styles.form} onSubmit={event => { event.preventDefault(); createTenant.mutate({name: tenantName.trim(), timezone: tenantTimezone.trim()}); }}>
              <label><span>Name</span><input required value={tenantName} onChange={event => setTenantName(event.target.value)}/></label>
              <label><span>IANA timezone</span><input required value={tenantTimezone} onChange={event => setTenantTimezone(event.target.value)} placeholder="America/Los_Angeles"/></label>
              <button className={styles.primaryButton} disabled={createTenant.isPending || !tenantName.trim() || !tenantTimezone.trim()}>{createTenant.isPending ? 'Creating…' : 'Create tenant'}</button>
            </form>
          </section>
          <section className={`${styles.card} ${styles.listCard}`} aria-labelledby="tenant-list-title">
            <div className={styles.cardHeader}><h2 id="tenant-list-title">Tenants</h2><span>{tenantsQuery.data?.length ?? 0}</span></div>
            {tenantsQuery.isPending ? <p className={styles.status}>Loading tenants…</p> : null}
            {tenantsQuery.isError ? <p className={styles.errorMessage}>Tenants could not be loaded.</p> : null}
            <div className={styles.list}>{tenantsQuery.data?.map(tenant => <TenantRow key={tenant.id} tenant={tenant} busy={updateTenant.isPending || deleteTenant.isPending} onSave={(id, payload) => updateTenant.mutate({id, payload})} onDelete={id => deleteTenant.mutate(id)}/>)}</div>
          </section>
        </div>
      ) : null}

      {tab === 'users' ? (
        <div className={styles.contentGrid}>
          <section className={styles.card} aria-labelledby="create-user-title">
            <h2 id="create-user-title">Create managed user</h2>
            <form className={styles.form} onSubmit={submitUser}>
              <label><span>First name</span><input required maxLength={100} value={firstName} onChange={event => setFirstName(event.target.value)}/></label>
              <label><span>Middle name</span><input maxLength={100} value={middleName} onChange={event => setMiddleName(event.target.value)}/></label>
              <label><span>Last name</span><input required maxLength={100} value={lastName} onChange={event => setLastName(event.target.value)}/></label>
              <label><span>Email</span><input required type="email" value={email} onChange={event => setEmail(event.target.value)}/></label>
              {isSystemAdmin ? <label><span>Tenant</span><select required value={tenantId || tenantsQuery.data?.[0]?.id || ''} onChange={event => setTenantId(event.target.value)}>{tenantsQuery.data?.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name} (#{tenant.id})</option>)}</select></label> : null}
              <label><span>Account role</span><select value={role} onChange={event => setRole(event.target.value as ManagedRole)}><option value="USER">User</option><option value="TENANT_ADMIN">Tenant admin</option></select></label>
              {role === 'USER' ? levelSelect(level, setLevel, isSystemAdmin ? SYSTEM_MANAGED_LEVEL_OPTIONS : TENANT_MANAGED_LEVEL_OPTIONS) : null}
              <button className={styles.primaryButton} disabled={createUser.isPending || !firstName.trim() || !lastName.trim() || !email.trim() || (isSystemAdmin && !Number(tenantId || tenantsQuery.data?.[0]?.id))}>{createUser.isPending ? 'Creating…' : 'Create user'}</button>
            </form>
            <p className={styles.hint}>{isSystemAdmin ? 'New accounts must establish their password through Forgot Password before signing in.' : 'Create staff here. Students use Student intake; parents use the Parent link flow.'}</p>
          </section>

          <section className={`${styles.card} ${styles.listCard}`} aria-labelledby="managed-users-title">
              <div className={styles.cardHeader}><div><h2 id="managed-users-title">{isSystemAdmin ? 'System users' : 'Tenant user directory'}</h2><p>{isSystemAdmin ? 'Read access is system-admin only.' : 'Users are limited to your authenticated tenant.'}</p></div><span>{filteredUsers.length}</span></div>
              <label className={styles.search}><span>Search users</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, user ID, or tenant ID"/></label>
              {(isSystemAdmin ? usersQuery.isPending : tenantUsersQuery.isPending) ? <p className={styles.status}>Loading users…</p> : null}
              {(isSystemAdmin ? usersQuery.isError : tenantUsersQuery.isError) ? <p className={styles.errorMessage}>Users could not be loaded.</p> : null}
              <div className={styles.list}>{filteredUsers.map(account => <ManagedUserRow key={`${account.id}-${account.tenantId}`} account={account} tenants={tenantsQuery.data ?? []} busy={busy} systemScope={isSystemAdmin} onUpdate={(id, request) => changeRole.mutate({id, request})} onDisable={id => disableUser.mutate(id)} onEnable={id => enableUser.mutate(id)} onMoveTenant={(id, targetTenantId) => moveTenant.mutate({id, targetTenantId})}/>)}</div>
            </section>
          {!isSystemAdmin ? (
            <section className={styles.card} aria-labelledby="manage-user-title">
              <h2 id="manage-user-title">Manage an existing user</h2>
              <p className={styles.hint}>Enter the user ID shown when the account was created.</p>
              <div className={styles.form}>
                <label><span>User ID</span><input type="number" min="1" value={managedUserId} onChange={event => setManagedUserId(event.target.value)}/></label>
                <label><span>Account role</span><select value={manualRole} onChange={event => setManualRole(event.target.value as ManagedRole)}><option value="USER">User</option><option value="TENANT_ADMIN">Tenant admin</option></select></label>
                {manualRole === 'USER' ? levelSelect(manualLevel, setManualLevel, TENANT_MANAGED_LEVEL_OPTIONS) : null}
                <button type="button" className={styles.primaryButton} disabled={busy || !Number.isInteger(manualId) || manualId < 1} onClick={() => changeRole.mutate({id: manualId, request: {role: manualRole, level: manualRole === 'USER' ? manualLevel : 'NOT_APPLICABLE'}})}>Update role</button>
                {confirmManualDisable ? <div className={styles.confirmRow}><button type="button" className={styles.dangerButton} disabled={busy} onClick={() => disableUser.mutate(manualId)}>Confirm disable</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmManualDisable(false)}>Cancel</button></div> : <button type="button" className={styles.dangerLink} disabled={!Number.isInteger(manualId) || manualId < 1} onClick={() => setConfirmManualDisable(true)}>Disable user</button>}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === 'members' ? <CourseMembershipPanel/> : null}

      {tab === 'operations' ? (
        <div className={styles.operationsGrid}>
          <AdminContractOperations isSystemAdmin={isSystemAdmin} users={filteredUsers}/>
          {isSystemAdmin ? <section className={styles.card} aria-labelledby="reassign-instructor-title">
            <h2 id="reassign-instructor-title">Reassign primary instructor</h2>
            <p className={styles.hint}>Use this administrative path when the current primary instructor must be replaced. The target must satisfy the course tenant and enrolment rules.</p>
            <div className={styles.form}>
              <label><span>Course ID</span><input type="number" min="1" value={courseId} onChange={event => { setCourseId(event.target.value); setConfirmReassignment(false); }}/></label>
              <label><span>New instructor user ID</span><input type="number" min="1" value={primaryInstructorUserId} onChange={event => { setPrimaryInstructorUserId(event.target.value); setConfirmReassignment(false); }}/></label>
              {confirmReassignment ? (
                <div className={styles.confirmStack}>
                  <p>Replace the primary instructor for course #{courseId} with user #{primaryInstructorUserId}?</p>
                  <div className={styles.confirmRow}><button type="button" className={styles.dangerButton} disabled={reassignInstructor.isPending} onClick={() => reassignInstructor.mutate()}>{reassignInstructor.isPending ? 'Reassigning…' : 'Confirm reassignment'}</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmReassignment(false)}>Cancel</button></div>
                </div>
              ) : <button type="button" className={styles.primaryButton} disabled={!Number(courseId) || !Number(primaryInstructorUserId)} onClick={() => setConfirmReassignment(true)}>Review reassignment</button>}
            </div>
          </section> : null}

          {isSystemAdmin ? <section className={styles.card} aria-labelledby="correct-grade-title">
            <h2 id="correct-grade-title">Correct assignment grade</h2>
            <p className={styles.hint}>Emergency system correction only—not daily grading. It updates an existing grade and writes before/after values plus your reason to the audit log.</p>
            <div className={styles.form}>
              <label><span>Assignment ID</span><input type="number" min="1" value={correction.assignmentId || ''} onChange={event => { setCorrection(current => ({...current, assignmentId: Number(event.target.value)})); setConfirmCorrection(false); }}/></label>
              <label><span>Student user ID</span><input type="number" min="1" value={correction.studentUserId || ''} onChange={event => { setCorrection(current => ({...current, studentUserId: Number(event.target.value)})); setConfirmCorrection(false); }}/></label>
              <label><span>Corrected score</span><input type="number" min="0" step="0.01" value={correction.score} onChange={event => { setCorrection(current => ({...current, score: Number(event.target.value)})); setConfirmCorrection(false); }}/></label>
              <label><span>Audit reason</span><textarea required value={correction.reason} onChange={event => { setCorrection(current => ({...current, reason: event.target.value})); setConfirmCorrection(false); }} placeholder="Required: explain why this correction is authorized"/></label>
              {confirmCorrection ? (
                <div className={styles.confirmStack}>
                  <p>Set assignment #{correction.assignmentId}, student #{correction.studentUserId} to {correction.score} points?</p>
                  <div className={styles.confirmRow}><button type="button" className={styles.dangerButton} disabled={correctGrade.isPending} onClick={() => correctGrade.mutate()}>{correctGrade.isPending ? 'Correcting…' : 'Confirm audited correction'}</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmCorrection(false)}>Cancel</button></div>
                </div>
              ) : <button type="button" className={styles.primaryButton} disabled={correction.assignmentId < 1 || correction.studentUserId < 1 || !Number.isFinite(correction.score) || !correction.reason.trim()} onClick={() => setConfirmCorrection(true)}>Review correction</button>}
            </div>
          </section> : null}
        </div>
      ) : null}
    </main>
  );
};

export default AdminConsolePage;
