import React, {FormEvent, useState} from 'react';
import {Link} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {IntakeAssignmentStatus, IntakeLifecycleStatus, type ManagedUser, unwrapData} from '@/apis';
import {StudentIntakeFormFields} from '@/components/StudentIntakeFormFields';
import {TenantUserPicker} from '@/components/TenantUserPicker';
import {emptyStudentIntakeForm} from '@/components/StudentIntakeFormFields/model';
import {tenantAdvisingApiService} from '@/apis/services/tenant-advising-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import {formatPersonName} from '@/utils/personName';

const TenantIntakesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [page, setPage] = useState(0);
  const [lifecycleStatus, setLifecycleStatus] = useState<IntakeLifecycleStatus | ''>('');
  const [assignmentStatus, setAssignmentStatus] = useState<IntakeAssignmentStatus | ''>('');
  const [selectedIntakeId, setSelectedIntakeId] = useState<number | null>(null);
  const [advisor, setAdvisor] = useState<ManagedUser | null>(null);
  const [reason, setReason] = useState('');
  const [createForm, setCreateForm] = useState(emptyStudentIntakeForm);

  const params = {
    page,
    size: 20,
    ...(lifecycleStatus ? {lifecycleStatus} : {}),
    ...(assignmentStatus ? {assignmentStatus} : {}),
  };
  const intakes = useQuery({
    queryKey: advisingQueryKeys.tenantIntakes(params),
    queryFn: async () => unwrapData(await tenantAdvisingApiService.listStudentIntakes(params), 'tenantIntakes'),
  });
  const selected = intakes.data?.items.find(item => item.intakeId === selectedIntakeId);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({queryKey: ['tenant', 'intakes']}),
      queryClient.invalidateQueries({queryKey: ['advisor', 'students']}),
      queryClient.invalidateQueries({queryKey: ['counsellor']}),
    ]);
  };

  const assign = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select an intake');
      if (!advisor) throw new Error('Select an eligible advisor');
      const payload = {advisorUserId: advisor.id, expectedIntakeVersion: selected.intakeVersion};
      const key = idempotency.keyFor(`tenant-assign-${selected.intakeId}`, idempotencyFingerprint(payload));
      return unwrapData(await tenantAdvisingApiService.assignAdvisor(selected.intakeId, payload, key), 'tenantAssign');
    },
    onSuccess: async () => { setAdvisor(null); setReason(''); await refresh(); },
  });
  const reassign = useMutation({
    mutationFn: async () => {
      if (!selected?.studentUserId) throw new Error('Select an assigned intake');
      if (!advisor) throw new Error('Select an eligible advisor');
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
      if (!selected) throw new Error('Select an intake');
      const payload = {expectedIntakeVersion: selected.intakeVersion, reason: reason.trim()};
      const key = idempotency.keyFor(`tenant-cancel-${selected.intakeId}`, idempotencyFingerprint(payload));
      return unwrapData(await tenantAdvisingApiService.cancelStudentIntake(selected.intakeId, payload, key), 'tenantCancel');
    },
    onSuccess: async () => { setAdvisor(null); setReason(''); await refresh(); },
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
    onSuccess: async () => {
      setCreateForm(emptyStudentIntakeForm);
      await refresh();
    },
  });

  const busy = assign.isPending || reassign.isPending || cancel.isPending || createIntake.isPending;
  const mutationError = assign.error || reassign.error || cancel.error || createIntake.error;
  const onAssign = (event: FormEvent) => {
    event.preventDefault();
    if (selected?.assignmentStatus === 'ASSIGNED') reassign.mutate();
    else assign.mutate();
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Student intakes</h1>
          <p className={styles.lede}>Create Student accounts, assign the first Advisor, reassign ownership, or cancel an unassigned intake.</p>
        </div>
        <Link className={styles.secondaryLink} to="/admin">Back to governance</Link>
      </header>
      {mutationError ? <p className={styles.error} role="alert">{advisingErrorMessage(mutationError, 'The operation failed.')}</p> : null}
      <section className={styles.card}>
        <h2>Create student intake</h2>
        <p className={styles.muted}>Student accounts are created through intake. The student activates access with Forgot password.</p>
        <form className={styles.form} onSubmit={event => { event.preventDefault(); createIntake.mutate(); }}>
          <StudentIntakeFormFields value={createForm} onChange={setCreateForm}/>
          <button className={styles.primary} disabled={createIntake.isPending}>
            {createIntake.isPending ? 'Creating…' : 'Create intake'}
          </button>
        </form>
      </section>
      <div className={styles.toolbar}>
        <label>
          <span className={styles.muted}>Lifecycle</span>
          <select value={lifecycleStatus} onChange={event => { setLifecycleStatus(event.target.value as IntakeLifecycleStatus | ''); setPage(0); }}>
            <option value="">All</option>
            <option value="OPEN">OPEN</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>
        <label>
          <span className={styles.muted}>Assignment</span>
          <select value={assignmentStatus} onChange={event => { setAssignmentStatus(event.target.value as IntakeAssignmentStatus | ''); setPage(0); }}>
            <option value="">All</option>
            <option value="UNASSIGNED">UNASSIGNED</option>
            <option value="ASSIGNED">ASSIGNED</option>
          </select>
        </label>
      </div>
      {intakes.isPending ? <p className={styles.status}>Loading intakes…</p> : null}
      {intakes.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(intakes.error, 'Intakes could not be loaded.')}</p> : null}
      <div className={styles.list}>
        {(intakes.data?.items ?? []).map(intake => (
          <article key={intake.intakeId} className={styles.row}>
            <div className={styles.identity}>
              <strong>{formatPersonName(intake, `Intake #${intake.intakeId}`)}</strong>
              <span>{intake.email}</span>
              <small>{intake.lifecycleStatus} · {intake.assignmentStatus} · student {intake.studentUserId}</small>
            </div>
            <div className={styles.actions}>
              {intake.studentUserId ? <Link className={styles.link} to={`/admin/students/${intake.studentUserId}`}>View record</Link> : null}
              <button type="button" className={styles.secondary} onClick={() => { setSelectedIntakeId(intake.intakeId); setAdvisor(null); setReason(''); }}>Manage</button>
            </div>
          </article>
        ))}
      </div>
      {intakes.data && intakes.data.total > 20 ? <nav className={styles.pagination} aria-label="Intake pages"><button type="button" className={styles.secondary} disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</button><span>Page {page + 1} · {intakes.data.total} intakes</span><button type="button" className={styles.secondary} disabled={(page + 1) * 20 >= intakes.data.total} onClick={() => setPage(current => current + 1)}>Next</button></nav> : null}
      {selected ? (
        <section className={styles.card}>
          <h2>{selected.assignmentStatus === 'ASSIGNED' ? 'Reassign advisor' : 'Assign advisor'}</h2>
          <form className={styles.form} onSubmit={onAssign}>
            <div className={styles.pickerField}><span>Eligible advisor</span><TenantUserPicker title={selected.assignmentStatus === 'ASSIGNED' ? 'Choose the replacement advisor' : 'Choose an advisor'} description="Searches active Advisor and Instructor Advisor identities in this tenant." triggerLabel="Choose advisor" levels={['ADVISOR', 'INSTRUCTOR_ADVISOR']} selectedUser={advisor} onSelect={setAdvisor}/></div>
            <label><span>Reason {selected.assignmentStatus === 'UNASSIGNED' ? '(required to cancel)' : '(optional for reassignment)'}</span><textarea value={reason} onChange={event => setReason(event.target.value)}/></label>
            <div className={styles.actions}>
              <button className={styles.primary} disabled={busy || !advisor}>{busy ? 'Saving…' : selected.assignmentStatus === 'ASSIGNED' ? 'Reassign advisor' : 'Assign advisor'}</button>
              {selected.assignmentStatus === 'UNASSIGNED' ? (
                <button type="button" className={styles.danger} disabled={busy || !reason.trim()} onClick={() => cancel.mutate()}>Cancel intake</button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}
    </main>
  );
};

export default TenantIntakesPage;
