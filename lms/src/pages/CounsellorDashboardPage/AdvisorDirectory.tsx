import {formatNumber} from '@/i18n/formatting';
import {roleLabel} from '@/i18n/presentation';
import {useTranslation} from 'react-i18next';
import {PersonCell} from '@/components/PersonCell';
import type {UseQueryResult} from '@tanstack/react-query';
import type {AdvisingPage, AdvisorCandidateResponse} from '@/apis';
import {QueryError, WorkspacePagination} from './WorkspaceFeedback';
import styles from './index.module.scss';

export function AdvisorDirectory({query, onPageChange}: {
  query: UseQueryResult<AdvisingPage<AdvisorCandidateResponse>, Error>;
  onPageChange: (page: number) => void;
}) {
  const {t: translate} = useTranslation();
  const items = query.data?.items ?? [];
  return <section className={`${styles.panel} ${styles.advisorsPanel}`} aria-labelledby="available-advisors-title">
    <header className={styles.panelHeader}>
      <h2 id="available-advisors-title">{translate("advising:counsellor.availableAdvisors")}{query.data && !query.isError ? <span className={styles.count}>{formatNumber(query.data.total)}</span> : null}</h2>
      {query.data && !query.isError ? <WorkspacePagination {...query.data} label={translate('advising:counsellor.advisorPages')} onChange={onPageChange}/> : null}
    </header>
    {query.isPending ? <p className={styles.feedback} role="status">{translate("advising:counsellor.loadingAdvisors")}</p> : query.isError ?
      <QueryError error={query.error} fallback={translate('advising:counsellor.advisorsFailed')} onRetry={() => void query.refetch()}/> : items.length === 0 ?
        <div className={styles.feedback}><p>{translate("advising:counsellor.emptyAdvisors")}</p></div> : <>
          <ul className={styles.advisorList}>{items.map(advisor => <li key={advisor.advisorUserId}>
            <PersonCell compact person={{...advisor, id: advisor.advisorUserId}} roleLabel={roleLabel(advisor.level)}/>
          </li>)}</ul>
        </>}
  </section>;
}
