import {useTranslation} from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
import {roleLabel} from '@/i18n/presentation';
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
import {intakePath} from '../CounsellorDashboardPage/presentation';

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
        <p className={styles.success} role="status">{t("advising:counsellor.handoverComplete")}</p>
        <Link className={styles.link} to={APP_ROUTE_PATHS.counsellorIntakes}>{t("advising:counsellor.backToUnassigned")}</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>{t("advising:intake.assign")}</h1>
          <p className={styles.lede}>
            {intake.data ? t('advising:counsellor.versionedLabel', {label: formatPersonName(intake.data, t('common:roles.STUDENT')), number: formatNumber(intake.data.intakeVersion)}) : t("advising:counsellor.assignmentHelp")}
          </p>
        </div>
        <Link className={styles.link} to={intakePath(numericId)}>{t("advising:counsellor.backToIntake")}</Link>
      </header>
      {assign.isError && !handover ? <p className={styles.error} role="alert">{advisingErrorMessage(assign.error, t('advising:counsellor.assignmentFailed'))}</p> : null}
      {intake.isError && !handover ? <p className={styles.error} role="alert">{advisingErrorMessage(intake.error, t('advising:studentWorkspace.intakeFailed'))}</p> : null}
      <section className={styles.card}>
        <form className={local.form} onSubmit={onSubmit}>
          <div className={local.search}>
            <label htmlFor="advisor-search">{t('intake.searchAdvisors')}</label>
            <div><Search size={18} aria-hidden="true"/><input id="advisor-search" name="advisor-search" type="search" autoComplete="off" value={search} onChange={event => {setSearch(event.target.value); setAdvisorUserId('');}} placeholder={t('intake.nameOrEmail')}/>
              {search ? <button type="button" aria-label={t('intake.clearAdvisorSearch')} onClick={() => setSearch('')}><X size={18} aria-hidden="true"/></button> : null}
            </div>
            <small>{t('intake.pageSearchHelp')}</small>
          </div>
          {advisors.isPending ? <p className={styles.status} role="status">{t("advising:counsellor.loadingEligible")}</p> : null}
          {advisors.isError ? <div className={styles.error} role="alert"><p>{advisingErrorMessage(advisors.error, t('advising:counsellor.eligibleFailed'))}</p><button type="button" className={styles.secondary} onClick={() => void advisors.refetch()}>{t("common:actions.tryAgain")}</button></div> : null}
          <fieldset className={local.list}>
            <legend>{t('intake.chooseAdvisor')}</legend>
            {visibleAdvisors.map(advisor => <PersonSelectRow key={advisor.advisorUserId}
              person={{...advisor, id: advisor.advisorUserId}} roleLabel={roleLabel(advisor.level)}
              name="advisor" value={String(advisor.advisorUserId)} selected={advisorUserId === String(advisor.advisorUserId)}
              disabled={assign.isPending} onSelect={() => setAdvisorUserId(String(advisor.advisorUserId))}/>
            )}
          </fieldset>
          {!advisors.isPending && !advisors.isError && visibleAdvisors.length === 0 ? (
            <p className={styles.status}>{search.trim() ? t('intake.noAdvisorMatches') : t("advising:counsellor.noActive")}</p>
          ) : null}
          {advisors.data && advisors.data.total > PAGE_SIZE ? (
            <nav className={styles.pagination} aria-label={t("advising:counsellor.advisorPages")}>
              <button type="button" className={styles.secondary} disabled={page === 0} onClick={() => {setPage(page - 1); setAdvisorUserId('');}}>{t("common:actions.previous")}</button>
              <span>{t('advising:counsellor.eligiblePage', {page: formatNumber(page + 1), number: formatNumber(advisors.data.total)})}</span>
              <button type="button" className={styles.secondary} disabled={(page + 1) * PAGE_SIZE >= advisors.data.total} onClick={() => {setPage(page + 1); setAdvisorUserId('');}}>{t("common:actions.next")}</button>
            </nav>
          ) : null}
          <p className={styles.fieldHelp}>{t("advising:counsellor.handoverWarning")}</p>
          <div className={styles.formActions}><button className={styles.primary} disabled={assign.isPending || !Number(advisorUserId) || !intake.data || advisors.isError || !visibleAdvisors.some(advisor => String(advisor.advisorUserId) === advisorUserId)}>
            {assign.isPending ? t("exams:assignment.assigning") : t("advising:intake.assign")}
          </button></div>
        </form>
      </section>
    </div>
  );
};

export default CounsellorAssignAdvisorPage;
