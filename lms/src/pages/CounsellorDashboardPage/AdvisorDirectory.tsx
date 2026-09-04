import {PersonCell} from '@/components/PersonCell';
import type {UseQueryResult} from '@tanstack/react-query';
import type {AdvisingPage, AdvisorCandidateResponse} from '@/apis';
import {ADVISOR_LEVEL_LABELS} from './presentation';
import {QueryError, WorkspacePagination} from './WorkspaceFeedback';
import styles from './index.module.scss';

export function AdvisorDirectory({query, onPageChange}: {
  query: UseQueryResult<AdvisingPage<AdvisorCandidateResponse>, Error>;
  onPageChange: (page: number) => void;
}) {
  const items = query.data?.items ?? [];
  return <section className={`${styles.panel} ${styles.advisorsPanel}`} aria-labelledby="available-advisors-title">
    <header className={styles.panelHeader}>
      <h2 id="available-advisors-title">Available advisors{query.data && !query.isError ? <span className={styles.count}>{query.data.total}</span> : null}</h2>
      {query.data && !query.isError ? <WorkspacePagination {...query.data} label="advisor pages" onChange={onPageChange}/> : null}
    </header>
    {query.isPending ? <p className={styles.feedback} role="status">Loading advisors…</p> : query.isError ?
      <QueryError error={query.error} fallback="Advisors could not be loaded." onRetry={() => void query.refetch()}/> : items.length === 0 ?
        <div className={styles.feedback}><p>No active advisors are available in this tenant.</p></div> : <>
          <ul className={styles.advisorList}>{items.map(advisor => <li key={advisor.advisorUserId}>
            <PersonCell compact person={{...advisor, id: advisor.advisorUserId}} roleLabel={ADVISOR_LEVEL_LABELS[advisor.level]}/>
          </li>)}</ul>
        </>}
  </section>;
}
