import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {ArrowUpRight, Info} from 'lucide-react';
import type {UseQueryResult} from '@tanstack/react-query';
import type {CounsellorDashboardResponse} from '@/apis';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {formatNumber} from '@/i18n/formatting';
import {QueryError} from './WorkspaceFeedback';
import styles from './index.module.scss';

const METRICS = [
  {key: 'unassignedCount', label: 'advising:studentIntake.unassigned', hint: 'advising:counsellor.metrics.unassignedHelp'},
  {key: 'assignedCount', label: 'common:status.ASSIGNED', hint: 'advising:counsellor.metrics.assignedHelp'},
  {key: 'createdCount', label: 'advising:counsellor.metrics.created', hint: 'advising:counsellor.metrics.createdHelp'},
] as const;

export function DashboardMetrics({query}: {query: UseQueryResult<CounsellorDashboardResponse, Error>}) {
  const {t: translate} = useTranslation();
  if (query.isError) return <QueryError error={query.error} fallback={translate('advising:counsellor.metrics.loadFailed')} onRetry={() => void query.refetch()}/>;
  return <section className={styles.metrics} aria-label={translate("advising:counsellor.metrics.label")} aria-busy={query.isPending}>
    {METRICS.map(metric => <div className={styles.metric} key={metric.key}>
      <div>
        <span className={styles.metricLabel}>{translate(metric.label)}</span>
        {metric.key === 'unassignedCount' && query.data ?
          <Link className={styles.metricValue} aria-label={translate('advising:counsellor.metrics.openQueue', {number: formatNumber(query.data[metric.key])})} to={APP_ROUTE_PATHS.counsellorIntakes}>
            {formatNumber(query.data[metric.key])}<ArrowUpRight size={22} aria-hidden="true"/>
          </Link> : <strong className={styles.metricValue}>{query.data ? formatNumber(query.data[metric.key]) : '—'}</strong>}
      </div>
      <details className={styles.metricHelp} onKeyDown={event => {if (event.key === 'Escape') event.currentTarget.open = false;}}>
        <summary aria-label={translate('advising:counsellor.metrics.about', {label: translate(metric.label)})}><Info size={17} aria-hidden="true"/></summary>
        <p>{translate(metric.hint)}</p>
      </details>
    </div>)}
  </section>;
}
