import {Link} from 'react-router-dom';
import {ArrowUpRight, Info} from 'lucide-react';
import type {UseQueryResult} from '@tanstack/react-query';
import type {CounsellorDashboardResponse} from '@/apis';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {QueryError} from './WorkspaceFeedback';
import styles from './index.module.scss';

const METRICS = [
  {key: 'unassignedCount', label: 'Unassigned', hint: 'Open intakes you created that have not been handed to an Advisor.'},
  {key: 'assignedCount', label: 'Assigned', hint: 'Students you created who currently have an Advisor assignment. Intake access transfers to the Advisor at handover.'},
  {key: 'createdCount', label: 'Created', hint: 'All intakes you created, including cancelled records. This can differ from Assigned plus Unassigned.'},
] as const;

export function DashboardMetrics({query}: {query: UseQueryResult<CounsellorDashboardResponse, Error>}) {
  if (query.isError) return <QueryError error={query.error} fallback="Dashboard counts could not be loaded." onRetry={() => void query.refetch()}/>;
  return <section className={styles.metrics} aria-label="Intake counts" aria-busy={query.isPending}>
    {METRICS.map(metric => <div className={styles.metric} key={metric.key}>
      <div>
        <span className={styles.metricLabel}>{metric.label}</span>
        {metric.key === 'unassignedCount' && query.data ?
          <Link className={styles.metricValue} aria-label={`${query.data[metric.key]} Unassigned — open queue`} to={APP_ROUTE_PATHS.counsellorIntakes}>
            {query.data[metric.key]}<ArrowUpRight size={22} aria-hidden="true"/>
          </Link> : <strong className={styles.metricValue}>{query.data?.[metric.key] ?? '—'}</strong>}
      </div>
      <details className={styles.metricHelp} onKeyDown={event => {if (event.key === 'Escape') event.currentTarget.open = false;}}>
        <summary aria-label={`About ${metric.label.toLowerCase()} count`}><Info size={17} aria-hidden="true"/></summary>
        <p>{metric.hint}</p>
      </details>
    </div>)}
  </section>;
}
