import React, {FormEvent, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ADVISING_ERROR_CODES, unwrapData} from '@/apis';
import {counsellorApiService} from '@/apis/services/counsellor-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorCode, isNotFound} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';

const CounsellorAssignAdvisorPage: React.FC = () => {
  const {intakeId} = useParams();
  const numericId = Number(intakeId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [advisorUserId, setAdvisorUserId] = useState('');
  const [page, setPage] = useState(0);

  const intake = useQuery({
    queryKey: advisingQueryKeys.counsellorIntake(numericId),
    queryFn: async () => unwrapData(await counsellorApiService.getStudentIntake(numericId), 'getIntake'),
    enabled: Number.isInteger(numericId),
    retry: false,
  });
  const advisors = useQuery({
    queryKey: advisingQueryKeys.counsellorAdvisors(page, 20),
    queryFn: async () => unwrapData(await counsellorApiService.listAdvisors(page, 20), 'listAdvisors'),
  });

  const assign = useMutation({
    mutationFn: async () => {
      const payload = {
        advisorUserId: Number(advisorUserId),
        expectedIntakeVersion: intake.data?.intakeVersion ?? 0,
      };
      const key = idempotency.keyFor(`assign-${numericId}`, idempotencyFingerprint(payload));
      return unwrapData(await counsellorApiService.assignAdvisor(numericId, payload, key), 'assignAdvisor');
    },
    onSuccess: async () => {
      queryClient.removeQueries({queryKey: advisingQueryKeys.counsellorIntake(numericId)});
      await queryClient.invalidateQueries({queryKey: ['counsellor']});
      await queryClient.invalidateQueries({queryKey: ['advisor', 'students']});
      navigate('/counsellor/intakes', {replace: true});
    },
  });

  const handover = (intake.isError && isNotFound(intake.error))
    || getApiErrorCode(assign.error) === ADVISING_ERROR_CODES.alreadyAssigned
    || getApiErrorCode(assign.error) === ADVISING_ERROR_CODES.intakeNotFound;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    assign.mutate();
  };

  if (handover) {
    return (
      <main className={styles.page}>
        <p className={styles.success} role="status">This student has left the counsellor queue. First assignment is complete.</p>
        <Link className={styles.link} to="/counsellor/intakes">Back to unassigned queue</Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Counsellor</p>
          <h1>Assign advisor</h1>
          <p className={styles.lede}>
            {intake.data ? `${intake.data.name ?? 'Student'} · version ${intake.data.intakeVersion}` : 'Load the current intake version, then assign. You cannot cancel or reassign afterwards.'}
          </p>
        </div>
        <Link className={styles.link} to={`/counsellor/intakes/${numericId}`}>Back to intake</Link>
      </header>
      {assign.isError && !handover ? <p className={styles.error} role="alert">{advisingErrorMessage(assign.error, 'Assignment failed.')}</p> : null}
      {intake.isError && !handover ? <p className={styles.error} role="alert">{advisingErrorMessage(intake.error, 'Intake could not be loaded.')}</p> : null}
      <section className={styles.card}>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.list}>
            {(advisors.data?.items ?? []).map(advisor => (
              <label key={advisor.advisorUserId} className={styles.row}>
                <div className={styles.identity}>
                  <strong>{advisor.name}</strong>
                  <span>{advisor.email}</span>
                  <small>{advisor.level}</small>
                </div>
                <input
                  type="radio"
                  name="advisor"
                  value={advisor.advisorUserId}
                  checked={advisorUserId === String(advisor.advisorUserId)}
                  onChange={event => setAdvisorUserId(event.target.value)}
                />
              </label>
            ))}
          </div>
          {!advisors.isPending && (advisors.data?.items.length ?? 0) === 0 ? (
            <p className={styles.status}>This tenant has no active advisors. Ask backend to provision one.</p>
          ) : null}
          {advisors.data && advisors.data.total > 20 ? (
            <nav className={styles.pagination}>
              <button type="button" className={styles.secondary} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
              <button type="button" className={styles.secondary} disabled={(page + 1) * 20 >= advisors.data.total} onClick={() => setPage(page + 1)}>Next</button>
            </nav>
          ) : null}
          <button className={styles.primary} disabled={assign.isPending || !Number(advisorUserId) || !intake.data}>
            {assign.isPending ? 'Assigning…' : 'Assign advisor'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default CounsellorAssignAdvisorPage;
