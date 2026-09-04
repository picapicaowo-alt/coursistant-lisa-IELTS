import {useTranslation} from 'react-i18next';
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
import {Search, X} from 'lucide-react';
import {PersonSelectRow} from '@/components/PersonSelectRow';
import local from './index.module.scss';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {ADVISOR_LEVEL_LABELS, intakePath} from '../CounsellorDashboardPage/presentation';

const PAGE_SIZE = 100;

const CounsellorAssignAdvisorPage: React.FC = () => {
  const {t} = useTranslation('common');
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
        queryClient.invalidateQueries({queryKey: advisingQueryKeys.counsellorAll}),
        queryClient.invalidateQueries({queryKey: advisingQueryKeys.advisorStudentsAll}),
      ]);
      navigate(APP_ROUTE_PATHS.counsellorIntakes, {replace: true});
    },
  });

  const handover = (intake.isError && isNotFound(intake.error))
    || getApiErrorCode(assign.error) === ADVISING_ERROR_CODES.alreadyAssigned
    || getApiErrorCode(assign.error) === ADVISING_ERROR_CODES.intakeNotFound;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (assign.isPending || !intake.data || !advisorUserId) return;
    assign.mutate();
  };

  if (handover) {
    return (
      <div className={styles.page}>
        <p className={styles.success} role="status">This student has left the counsellor queue. First assignment is complete.</p>
        <Link className={styles.link} to={APP_ROUTE_PATHS.counsellorIntakes}>Back to unassigned queue</Link>
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
        <Link className={styles.link} to={intakePath(numericId)}>Back to intake</Link>
      </header>
      {assign.isError && !handover ? <p className={styles.error} role="alert">{advisingErrorMessage(assign.error, 'Assignment failed.')}</p> : null}
      {intake.isError && !handover ? <p className={styles.error} role="alert">{advisingErrorMessage(intake.error, 'Intake could not be loaded.')}</p> : null}
      <section className={styles.card}>
        <form className={local.form} onSubmit={onSubmit}>
          <div className={local.search}>
            <label htmlFor="advisor-search">{t('intake.searchAdvisors')}</label>
            <div><Search size={18} aria-hidden="true"/><input id="advisor-search" name="advisor-search" type="search" autoComplete="off" value={search} onChange={event => {setSearch(event.target.value); setAdvisorUserId('');}} placeholder={t('intake.nameOrEmail')}/>
              {search ? <button type="button" aria-label={t('intake.clearAdvisorSearch')} onClick={() => setSearch('')}><X size={18} aria-hidden="true"/></button> : null}
            </div>
            <small>{t('intake.pageSearchHelp')}</small>
          </div>
          {advisors.isPending ? <p className={styles.status} role="status">Loading eligible advisors…</p> : null}
          {advisors.isError ? <div className={styles.error} role="alert"><p>{advisingErrorMessage(advisors.error, 'Eligible advisors could not be loaded.')}</p><button type="button" className={styles.secondary} onClick={() => void advisors.refetch()}>Try again</button></div> : null}
          <fieldset className={local.list}>
            <legend>{t('intake.chooseAdvisor')}</legend>
            {visibleAdvisors.map(advisor => <PersonSelectRow key={advisor.advisorUserId}
              person={{...advisor, id: advisor.advisorUserId}} roleLabel={ADVISOR_LEVEL_LABELS[advisor.level]}
              name="advisor" value={String(advisor.advisorUserId)} selected={advisorUserId === String(advisor.advisorUserId)}
              disabled={assign.isPending} onSelect={() => setAdvisorUserId(String(advisor.advisorUserId))}/>
            )}
          </fieldset>
          {!advisors.isPending && !advisors.isError && visibleAdvisors.length === 0 ? (
            <p className={styles.status}>{search.trim() ? t('intake.noAdvisorMatches') : 'This tenant has no active advisors.'}</p>
          ) : null}
          {advisors.data && advisors.data.total > PAGE_SIZE ? (
            <nav className={styles.pagination} aria-label="Advisor pages">
              <button type="button" className={styles.secondary} disabled={page === 0} onClick={() => {setPage(page - 1); setAdvisorUserId('');}}>Previous</button>
              <span>Page {page + 1} · {advisors.data.total} eligible advisors</span>
              <button type="button" className={styles.secondary} disabled={(page + 1) * PAGE_SIZE >= advisors.data.total} onClick={() => {setPage(page + 1); setAdvisorUserId('');}}>Next</button>
            </nav>
          ) : null}
          <p className={styles.fieldHelp}>Assigning an Advisor completes the handover. This intake will leave your queue, and you will no longer be able to edit its record or parent links.</p>
          <div className={styles.formActions}><button className={styles.primary} disabled={assign.isPending || !Number(advisorUserId) || !intake.data || advisors.isError || !visibleAdvisors.some(advisor => String(advisor.advisorUserId) === advisorUserId)}>
            {assign.isPending ? 'Assigning…' : 'Assign advisor'}
          </button></div>
        </form>
      </section>
    </div>
  );
};

export default CounsellorAssignAdvisorPage;
