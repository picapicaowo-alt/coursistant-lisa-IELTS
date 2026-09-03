import React, {FormEvent, useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ChevronDown, ChevronUp, Search, X} from 'lucide-react';
import {
  IntakeAssignmentStatus,
  IntakeLifecycleStatus,
  type ManagedUser,
  type PatchStudentIntakeRequest,
  type StudentIntakeResponse,
  type TenantIntakeListParams,
  unwrapData,
} from '@/apis';
import {StudentIntakeFormFields} from '@/components/StudentIntakeFormFields';
import {TenantUserPicker} from '@/components/TenantUserPicker';
import {emptyStudentIntakeForm, type StudentIntakeFormValue} from '@/components/StudentIntakeFormFields/model';
import {tenantAdvisingApiService} from '@/apis/services/tenant-advising-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import {formatPersonName} from '@/utils/personName';
import {getApiErrorCode} from '@/utils/apiError';

const PAGE_SIZE = 20;

type FilterDraft = {
  q: string;
  lifecycleStatus: IntakeLifecycleStatus | '';
  assignmentStatus: IntakeAssignmentStatus | '';
};

const emptyFilters: FilterDraft = {q: '', lifecycleStatus: '', assignmentStatus: ''};

const formFromIntake = (intake: StudentIntakeResponse): StudentIntakeFormValue => ({
  firstName: intake.firstName ?? '',
  middleName: intake.middleName ?? '',
  lastName: intake.lastName ?? '',
  email: intake.email ?? '',
  studentType: intake.studentType ?? 'STANDARD',
  courseRequest: intake.courseRequest ?? '',
  contactPhone: intake.contactPhone ?? '',
  basicBackground: intake.basicBackground ?? '',
});

const TenantIntakesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const manageRef = useRef<HTMLElement>(null);
  const [page, setPage] = useState(0);
  const [draftFilters, setDraftFilters] = useState<FilterDraft>(emptyFilters);
  const [filters, setFilters] = useState<FilterDraft>(emptyFilters);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedIntakeId, setSelectedIntakeId] = useState<number | null>(null);
  const [advisor, setAdvisor] = useState<ManagedUser | null>(null);
  const [reason, setReason] = useState('');
  const [createForm, setCreateForm] = useState(emptyStudentIntakeForm);
  const [editForm, setEditForm] = useState<StudentIntakeFormValue>(emptyStudentIntakeForm);

  const params: TenantIntakeListParams = {
    page,
    size: PAGE_SIZE,
    ...(filters.q ? {q: filters.q} : {}),
    ...(filters.lifecycleStatus ? {lifecycleStatus: filters.lifecycleStatus} : {}),
    ...(filters.assignmentStatus ? {assignmentStatus: filters.assignmentStatus} : {}),
  };
  const intakes = useQuery({
    queryKey: advisingQueryKeys.tenantIntakes(params),
    queryFn: async () => unwrapData(await tenantAdvisingApiService.listStudentIntakes(params), 'tenantIntakes'),
    retry: false,
  });
  const detail = useQuery({
    queryKey: ['tenant', 'intake', selectedIntakeId],
    queryFn: async () => unwrapData(await tenantAdvisingApiService.getStudentIntake(selectedIntakeId as number), 'tenantIntakeDetail'),
    enabled: selectedIntakeId !== null,
    retry: false,
  });
  const selected = detail.data;

  useEffect(() => {
    if (selected) setEditForm(formFromIntake(selected));
  }, [selected]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({queryKey: ['tenant', 'intakes']}),
      ...(selectedIntakeId ? [queryClient.invalidateQueries({queryKey: ['tenant', 'intake', selectedIntakeId]})] : []),
      queryClient.invalidateQueries({queryKey: ['advisor', 'students']}),
      queryClient.invalidateQueries({queryKey: ['counsellor']}),
    ]);
  };

  const assign = useMutation({
    mutationFn: async () => {
      if (!selected || !advisor) throw new Error('Select an eligible advisor.');
      const payload = {advisorUserId: advisor.id, expectedIntakeVersion: selected.intakeVersion};
      const key = idempotency.keyFor(`tenant-assign-${selected.intakeId}`, idempotencyFingerprint(payload));
      return unwrapData(await tenantAdvisingApiService.assignAdvisor(selected.intakeId, payload, key), 'tenantAssign');
    },
    onSuccess: async () => { setAdvisor(null); setReason(''); await refresh(); },
  });
  const reassign = useMutation({
    mutationFn: async () => {
      if (!selected?.studentUserId || !advisor) throw new Error('Select an eligible advisor.');
      const payload = {
        advisorUserId: advisor.id,
        expectedAssignmentVersion: selected.assignmentVersion ?? 0,
        ...(reason.trim() ? {reason: reason.trim()} : {}),
      };
      const key = idempotency.keyFor(`tenant-reassign-${selected.studentUserId}`, idempotencyFingerprint(payload));
      return unwrapData(await tenantAdvisingApiService.reassignAdvisor(selected.studentUserId, payload, key), 'tenantReassign');
    },
    onSuccess: async () => { setAdvisor(null); setReason(''); await refresh(); },
  });
  const cancel = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select an intake.');
      const payload = {expectedIntakeVersion: selected.intakeVersion, reason: reason.trim()};
      const key = idempotency.keyFor(`tenant-cancel-${selected.intakeId}`, idempotencyFingerprint(payload));
      return unwrapData(await tenantAdvisingApiService.cancelStudentIntake(selected.intakeId, payload, key), 'tenantCancel');
    },
    onSuccess: async () => { setAdvisor(null); setReason(''); await refresh(); },
  });
  const patchIntake = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select an intake.');
      const payload: PatchStudentIntakeRequest = {expectedIntakeVersion: selected.intakeVersion};
      const fields = {
        firstName: editForm.firstName.trim(),
        middleName: editForm.middleName.trim(),
        lastName: editForm.lastName.trim(),
        studentType: editForm.studentType,
        courseRequest: editForm.courseRequest.trim(),
        contactPhone: editForm.contactPhone.trim(),
        basicBackground: editForm.basicBackground.trim(),
      };
      if (fields.firstName !== (selected.firstName ?? '')) payload.firstName = fields.firstName;
      if (fields.middleName !== (selected.middleName ?? '')) payload.middleName = fields.middleName;
      if (fields.lastName !== (selected.lastName ?? '')) payload.lastName = fields.lastName;
      if (fields.studentType !== selected.studentType) payload.studentType = fields.studentType;
      if (fields.courseRequest !== (selected.courseRequest ?? '')) payload.courseRequest = fields.courseRequest;
      if (fields.contactPhone !== (selected.contactPhone ?? '')) payload.contactPhone = fields.contactPhone;
      if (fields.basicBackground !== (selected.basicBackground ?? '')) payload.basicBackground = fields.basicBackground;
      if (Object.keys(payload).length === 1) throw new Error('Change at least one intake field before saving.');
      const key = idempotency.keyFor(`tenant-patch-intake-${selected.intakeId}`, idempotencyFingerprint(payload));
      return unwrapData(await tenantAdvisingApiService.patchStudentIntake(selected.intakeId, payload, key), 'tenantPatchStudentIntake');
    },
    onSuccess: refresh,
  });
  const createIntake = useMutation({
    mutationFn: async () => {
      const payload = {
        firstName: createForm.firstName.trim(),
        ...(createForm.middleName.trim() ? {middleName: createForm.middleName.trim()} : {}),
        lastName: createForm.lastName.trim(),
        email: createForm.email.trim().toLowerCase(),
        studentType: createForm.studentType,
        courseRequest: createForm.courseRequest.trim(),
        ...(createForm.contactPhone.trim() ? {contactPhone: createForm.contactPhone.trim()} : {}),
        ...(createForm.basicBackground.trim() ? {basicBackground: createForm.basicBackground.trim()} : {}),
      };
      const key = idempotency.keyFor('tenant-create-intake', idempotencyFingerprint(payload));
      return unwrapData(await tenantAdvisingApiService.createStudentIntake(payload, key), 'tenantCreateIntake');
    },
    onSuccess: async created => {
      setCreateForm(emptyStudentIntakeForm);
      setCreateOpen(false);
      setSelectedIntakeId(created.intakeId);
      await refresh();
      requestAnimationFrame(() => manageRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'}));
    },
  });

  const busy = assign.isPending || reassign.isPending || cancel.isPending || patchIntake.isPending || createIntake.isPending;
  const mutationError = assign.error || reassign.error || cancel.error || patchIntake.error || createIntake.error;
  const intakeConflict = getApiErrorCode(patchIntake.error || assign.error || cancel.error) === 'STUDENT_INTAKE_VERSION_CONFLICT';
  const hasIntakeChanges = Boolean(selected && (
    editForm.firstName.trim() !== (selected.firstName ?? '')
    || editForm.middleName.trim() !== (selected.middleName ?? '')
    || editForm.lastName.trim() !== (selected.lastName ?? '')
    || editForm.studentType !== selected.studentType
    || editForm.courseRequest.trim() !== (selected.courseRequest ?? '')
    || editForm.contactPhone.trim() !== (selected.contactPhone ?? '')
    || editForm.basicBackground.trim() !== (selected.basicBackground ?? '')
  ));
  const onAssign = (event: FormEvent) => {
    event.preventDefault();
    if (selected?.assignmentStatus === 'ASSIGNED') reassign.mutate();
    else assign.mutate();
  };
  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setPage(0);
    setFilters({...draftFilters, q: draftFilters.q.trim()});
  };
  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setPage(0);
  };
  const manage = (intakeId: number) => {
    setSelectedIntakeId(intakeId);
    setAdvisor(null);
    setReason('');
    requestAnimationFrame(() => manageRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'}));
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Tenant admin</p><h1>Student intakes</h1><p className={styles.lede}>Search, correct, assign, reassign, or cancel intake records within the governance boundary.</p></div>
        <div className={styles.headerActions}>
          <button type="button" className={createOpen ? styles.secondary : styles.primary} onClick={() => setCreateOpen(open => !open)} aria-expanded={createOpen}>{createOpen ? <ChevronUp size={17}/> : <ChevronDown size={17}/>} {createOpen ? 'Close create form' : 'Create student intake'}</button>
          <Link className={styles.secondaryLink} to="/admin">Back to governance</Link>
        </div>
      </header>
      {mutationError ? <p className={styles.error} role="alert">{advisingErrorMessage(mutationError, 'The operation failed.')}</p> : null}

      {createOpen ? <section className={`${styles.card} ${styles.wideCard}`}>
        <div className={styles.sectionHeading}><div><h2>Create student intake</h2><p className={styles.muted}>The student activates the account through Forgot password.</p></div><button type="button" className={styles.iconOnly} aria-label="Close create form" onClick={() => setCreateOpen(false)}><X size={18}/></button></div>
        <form className={`${styles.form} ${styles.formColumns}`} onSubmit={event => { event.preventDefault(); createIntake.mutate(); }}><StudentIntakeFormFields value={createForm} onChange={setCreateForm}/><button className={`${styles.primary} ${styles.fullWidth}`} disabled={createIntake.isPending}>{createIntake.isPending ? 'Creating…' : 'Create intake'}</button></form>
      </section> : null}

      <form className={styles.intakeFilters} onSubmit={applyFilters}>
        <label className={styles.filterSearch}><span>Search name, email, intake ID, student ID, or advisor</span><div><Search size={17}/><input value={draftFilters.q} onChange={event => setDraftFilters(current => ({...current, q: event.target.value}))} placeholder="Search intakes"/></div></label>
        <label><span>Lifecycle</span><select value={draftFilters.lifecycleStatus} onChange={event => setDraftFilters(current => ({...current, lifecycleStatus: event.target.value as FilterDraft['lifecycleStatus']}))}><option value="">All</option><option value="OPEN">Open</option><option value="CANCELLED">Cancelled</option></select></label>
        <label><span>Assignment</span><select value={draftFilters.assignmentStatus} onChange={event => setDraftFilters(current => ({...current, assignmentStatus: event.target.value as FilterDraft['assignmentStatus']}))}><option value="">All</option><option value="UNASSIGNED">Unassigned</option><option value="ASSIGNED">Assigned</option></select></label>
        <button className={styles.primary}>Apply filters</button><button type="button" className={styles.secondary} onClick={clearFilters}>Clear filters</button>
      </form>

      {intakes.isPending ? <p className={styles.status}>Loading intakes…</p> : null}
      {intakes.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(intakes.error, 'Intakes could not be loaded.')}</p> : null}
      {!intakes.isPending && !intakes.isError && intakes.data?.items.length === 0 ? <p className={styles.status}>No intakes match these filters.</p> : null}
      <div className={`${styles.list} ${styles.wideCard}`}>
        {(intakes.data?.items ?? []).map(intake => <article key={intake.intakeId} className={selectedIntakeId === intake.intakeId ? styles.selectedRow : styles.row}><div className={styles.identity}><strong>{formatPersonName(intake, `Intake #${intake.intakeId}`)}</strong><span>{intake.email}</span><small>{intake.lifecycleStatus} · {intake.assignmentStatus} · student {intake.studentUserId}</small></div><div className={styles.actions}>{intake.studentUserId ? <Link className={styles.secondaryLink} to={`/admin/students/${intake.studentUserId}`}>View record</Link> : null}<button type="button" className={styles.secondary} onClick={() => manage(intake.intakeId)}>Manage</button></div></article>)}
      </div>
      {intakes.data && intakes.data.total > PAGE_SIZE ? <nav className={styles.pagination} aria-label="Intake pages"><button type="button" className={styles.secondary} disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</button><span>Page {page + 1} · {intakes.data.total} intakes</span><button type="button" className={styles.secondary} disabled={(page + 1) * PAGE_SIZE >= intakes.data.total} onClick={() => setPage(current => current + 1)}>Next</button></nav> : null}

      {selectedIntakeId !== null ? <section ref={manageRef} className={`${styles.card} ${styles.wideCard} ${styles.managePanel}`}>
        <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Selected intake</p><h2>{selected ? formatPersonName(selected, `Intake #${selectedIntakeId}`) : `Intake #${selectedIntakeId}`}</h2></div><button type="button" className={styles.iconOnly} aria-label="Close intake management" onClick={() => setSelectedIntakeId(null)}><X size={18}/></button></div>
        {detail.isPending ? <p className={styles.status}>Loading intake details…</p> : null}
        {detail.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(detail.error, 'Intake details could not be loaded.')}</p> : null}
        {intakeConflict ? <div className={styles.dashboardNotice} role="alert"><strong>This intake changed on the server.</strong><p>Your current form values are preserved. Load the latest intake only when you are ready to review the newer version.</p><button type="button" className={styles.secondary} onClick={() => void detail.refetch()}>Load latest intake</button></div> : null}
        {selected ? <div className={styles.manageGrid}>
          <section><h3>Intake profile</h3>{selected.lifecycleStatus === 'OPEN' && selected.assignmentStatus === 'UNASSIGNED' ? <form className={styles.form} onSubmit={event => { event.preventDefault(); patchIntake.mutate(); }}><StudentIntakeFormFields value={editForm} onChange={setEditForm} emailDisabled/><p className={styles.muted}>Student email cannot be changed from an intake.</p><button className={styles.primary} disabled={patchIntake.isPending || !hasIntakeChanges}>{patchIntake.isPending ? 'Saving…' : 'Save intake changes'}</button></form> : <dl className={styles.readonly}><dt>Status</dt><dd>{selected.lifecycleStatus} / {selected.assignmentStatus}</dd><dt>Course request</dt><dd>{selected.courseRequest || '—'}</dd><dt>Contact phone</dt><dd>{selected.contactPhone || '—'}</dd><dt>Background</dt><dd>{selected.basicBackground || '—'}</dd></dl>}</section>
          <section><h3>{selected.assignmentStatus === 'ASSIGNED' ? 'Reassign advisor' : 'Assign advisor'}</h3>{selected.lifecycleStatus === 'CANCELLED' ? <p className={styles.status}>Cancelled intakes cannot be assigned or edited.</p> : <form className={styles.form} onSubmit={onAssign}><div className={styles.pickerField}><span>Eligible advisor</span><TenantUserPicker title={selected.assignmentStatus === 'ASSIGNED' ? 'Choose the replacement advisor' : 'Choose an advisor'} description="Searches active Advisor and Instructor Advisor identities in this tenant." triggerLabel="Choose advisor" levels={['ADVISOR', 'INSTRUCTOR_ADVISOR']} selectedUser={advisor} onSelect={setAdvisor}/></div><label><span>Reason {selected.assignmentStatus === 'UNASSIGNED' ? '(required only when cancelling)' : '(recommended for reassignment)'}</span><textarea value={reason} onChange={event => setReason(event.target.value)}/></label><div className={styles.actions}><button className={styles.primary} disabled={busy || !advisor}>{busy ? 'Saving…' : selected.assignmentStatus === 'ASSIGNED' ? 'Reassign advisor' : 'Assign advisor'}</button>{selected.assignmentStatus === 'UNASSIGNED' ? <button type="button" className={styles.danger} disabled={busy || !reason.trim()} onClick={() => cancel.mutate()}>Cancel intake</button> : null}</div></form>}</section>
        </div> : null}
      </section> : null}
    </div>
  );
};

export default TenantIntakesPage;
