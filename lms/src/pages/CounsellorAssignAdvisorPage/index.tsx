import React, {FormEvent, useDeferredValue, useMemo, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ADVISING_ERROR_CODES, unwrapData} from '@/apis';
import {counsellorApiService} from '@/apis/services/counsellor-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorCode, isNotFound} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import {formatPersonName} from '@/utils/personName';
import {Search} from 'lucide-react';

const PAGE_SIZE = 100;

const CounsellorAssignAdvisorPage: React.FC = () => {
  const {intakeId} = useParams();
  const numericId = Number(intakeId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [advisorUserId, setAdvisorUserId] = useState('');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const intake = useQuery({
    queryKey: advisingQueryKeys.counsellorIntake(numericId),
    queryFn: async () => unwrapData(await counsellorApiService.getStudentIntake(numericId), 'getIntake'),
    enabled: Number.isInteger(numericId),
    retry: false,
  });
  const advisors = useQuery({
    queryKey: advisingQueryKeys.counsellorAdvisors(page, PAGE_SIZE),
    queryFn: async () => unwrapData(await counsellorApiService.listAdvisors(page, PAGE_SIZE), 'listAdvisors'),
    retry: false,
  });
  const visibleAdvisors = useMemo(() => {
    const items = advisors.data?.items ?? [];
    if (!deferredSearch) return items;
    return items.filter(advisor => `${formatPersonName(advisor, '')} ${advisor.email}`.toLowerCase().includes(deferredSearch));
  }, [advisors.data?.items, deferredSearch]);

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
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['counsellor']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'students']}),
      ]);
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
      <div className={styles.page}>
        <p className={styles.success} role="status">This student has left the counsellor queue. First assignment is complete.</p>
        <Link className={styles.link} to="/counsellor/intakes">Back to unassigned queue</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Assign advisor</h1>
          <p className={styles.lede}>
            {intake.data ? `${formatPersonName(intake.data, 'Student')} · version ${intake.data.intakeVersion}` : 'Load the current intake version, then assign. You cannot cancel or reassign afterwards.'}
          </p>
        </div>
        <Link className={styles.link} to={`/counsellor/intakes/${numericId}`}>Back to intake</Link>
      </header>
      {assign.isError && !handover ? <p className={styles.error} role="alert">{advisingErrorMessage(assign.error, 'Assignment failed.')}</p> : null}
      {intake.isError && !handover ? <p className={styles.error} role="alert">{advisingErrorMessage(intake.error, 'Intake could not be loaded.')}</p> : null}
      <section className={styles.card}>
        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.advisorSearch}><span>Search advisors by name or email</span><div><Search size={18}/><input aria-label="Search advisors by name or email" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or email"/></div><small>The counsellor contract provides a paged advisor directory; search filters the loaded page.</small></label>
          {advisors.isPending ? <p className={styles.status} role="status">Loading eligible advisors…</p> : null}
          {advisors.isError ? <div className={styles.error} role="alert"><p>{advisingErrorMessage(advisors.error, 'Eligible advisors could not be loaded.')}</p><button type="button" className={styles.secondary} onClick={() => void advisors.refetch()}>Try again</button></div> : null}
          <div className={styles.list}>
            {visibleAdvisors.map(advisor => (
              <label key={advisor.advisorUserId} className={styles.row}>
                <div className={styles.identity}>
                  <strong>{formatPersonName(advisor, `Advisor #${advisor.advisorUserId}`)}</strong>
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
          {!advisors.isPending && !advisors.isError && visibleAdvisors.length === 0 ? (
            <p className={styles.status}>{search.trim() ? 'No advisor on this page matches that name or email.' : 'This tenant has no active advisors.'}</p>
          ) : null}
          {advisors.data && advisors.data.total > PAGE_SIZE ? (
            <nav className={styles.pagination}>
              <button type="button" className={styles.secondary} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page + 1} · {advisors.data.total} eligible advisors</span>
              <button type="button" className={styles.secondary} disabled={(page + 1) * PAGE_SIZE >= advisors.data.total} onClick={() => setPage(page + 1)}>Next</button>
            </nav>
          ) : null}
          <button className={styles.primary} disabled={assign.isPending || !Number(advisorUserId) || !intake.data}>
            {assign.isPending ? 'Assigning…' : 'Assign advisor'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default CounsellorAssignAdvisorPage;
