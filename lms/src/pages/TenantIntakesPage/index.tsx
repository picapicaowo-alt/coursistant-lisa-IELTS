import React, {FormEvent, useState} from 'react';
import {Link} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {IntakeAssignmentStatus, IntakeLifecycleStatus, unwrapData} from '@/apis';
import {tenantAdvisingApiService} from '@/apis/services/tenant-advising-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';

const TenantIntakesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [page, setPage] = useState(0);
  const [lifecycleStatus, setLifecycleStatus] = useState<IntakeLifecycleStatus | ''>('');
  const [assignmentStatus, setAssignmentStatus] = useState<IntakeAssignmentStatus | ''>('');
  const [selectedIntakeId, setSelectedIntakeId] = useState<number | null>(null);
  const [advisorUserId, setAdvisorUserId] = useState('');
  const [reason, setReason] = useState('');

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
    await queryClient.invalidateQueries({queryKey: ['tenant', 'intakes']});
    await queryClient.invalidateQueries({queryKey: ['advisor', 'students']});
    await queryClient.invalidateQueries({queryKey: ['counsellor']});
  };

  const assign = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select an intake');
      const payload = {advisorUserId: Number(advisorUserId), expectedIntakeVersion: selected.intakeVersion};
      const key = idempotency.keyFor(`tenant-assign-${selected.intakeId}`, idempotencyFingerprint(payload));
      return unwrapData(await tenantAdvisingApiService.assignAdvisor(selected.intakeId, payload, key), 'tenantAssign');
    },
    onSuccess: refresh,
  });
  const reassign = useMutation({
    mutationFn: async () => {
      if (!selected?.studentUserId) throw new Error('Select an assigned intake');
      const payload = {
        advisorUserId: Number(advisorUserId),
        expectedAssignmentVersion: selected.assignmentVersion ?? 0,
        ...(reason.trim() ? {reason: reason.trim()} : {}),
      };
      const key = idempotency.keyFor(`tenant-reassign-${selected.studentUserId}`, idempotencyFingerprint(payload));
      return unwrapData(await tenantAdvisingApiService.reassignAdvisor(selected.studentUserId, payload, key), 'tenantReassign');
    },
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select an intake');
      const payload = {expectedIntakeVersion: selected.intakeVersion, reason: reason.trim()};
      const key = idempotency.keyFor(`tenant-cancel-${selected.intakeId}`, idempotencyFingerprint(payload));
      return unwrapData(await tenantAdvisingApiService.cancelStudentIntake(selected.intakeId, payload, key), 'tenantCancel');
    },
    onSuccess: refresh,
  });

  const busy = assign.isPending || reassign.isPending || cancel.isPending;
  const mutationError = assign.error || reassign.error || cancel.error;
  const onAssign = (event: FormEvent) => {
    event.preventDefault();
    if (selected?.assignmentStatus === 'ASSIGNED') reassign.mutate();
    else assign.mutate();
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Tenant admin</p>
          <h1>Student intakes</h1>
          <p className={styles.lede}>Cancel unassigned intakes or reassign advisors. Counsellors cannot do these operations.</p>
        </div>
      </header>
      {mutationError ? <p className={styles.error} role="alert">{advisingErrorMessage(mutationError, 'The operation failed.')}</p> : null}
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
              <strong>{intake.name || `Intake #${intake.intakeId}`}</strong>
              <span>{intake.email}</span>
              <small>{intake.lifecycleStatus} · {intake.assignmentStatus} · student {intake.studentUserId}</small>
            </div>
            <div className={styles.actions}>
              {intake.studentUserId ? <Link className={styles.link} to={`/admin/students/${intake.studentUserId}`}>View record</Link> : null}
              <button type="button" className={styles.secondary} onClick={() => setSelectedIntakeId(intake.intakeId)}>Select</button>
            </div>
          </article>
        ))}
      </div>
      {selected ? (
        <section className={styles.card}>
          <h2>{selected.assignmentStatus === 'ASSIGNED' ? 'Reassign advisor' : 'Assign advisor'}</h2>
          <form className={styles.form} onSubmit={onAssign}>
            <label>
              <span>Advisor user ID</span>
              <input required type="number" min="1" value={advisorUserId} onChange={event => setAdvisorUserId(event.target.value)}/>
            </label>
            <label><span>Reason {selected.assignmentStatus === 'UNASSIGNED' ? '(required to cancel)' : '(optional for reassignment)'}</span><textarea value={reason} onChange={event => setReason(event.target.value)}/></label>
            <div className={styles.actions}>
              <button className={styles.primary} disabled={busy || !advisorUserId}>{busy ? 'Saving…' : selected.assignmentStatus === 'ASSIGNED' ? 'Reassign' : 'Assign'}</button>
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
