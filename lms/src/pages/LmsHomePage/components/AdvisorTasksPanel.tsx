import {useTranslation} from 'react-i18next';
import {ADVISING_ERROR_CODES} from '@/apis';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {APP_ROUTE_PATHS, STUDY_PLAN_QUERY_PARAMS} from '@/configs/routePaths';
import {advisingQueryKeys} from '@/pages/advising/queryKeys';
import {studyPlanRecordKey} from '@/pages/StudentAdvisingPage/studyPlanView';
import {formatPlanDate, taskStatusLabel} from '@/utils/studyPlan';
import {isMissingResource} from '@/utils/apiError';
import styles from './Dashboard.module.scss';

/** The work queue contains activity notifications. Advisor tasks belong to the study plan. */
export function AdvisorTasksPanel() {
  const {t: translate} = useTranslation();
  const query = useQuery({queryKey: advisingQueryKeys.studentStudyPlan, queryFn: async () => unwrapData(await advisorApiService.getOwnStudyPlan(), 'studentStudyPlan'), retry: false});
  const tasks = (query.data?.plan?.checkpoints ?? []).flatMap((checkpoint, index) => (checkpoint.tasks ?? []).map((task, taskIndex) => {
    const params = new URLSearchParams({[STUDY_PLAN_QUERY_PARAMS.checkpoint]: studyPlanRecordKey(checkpoint, index)});
    if (task.id != null) params.set(STUDY_PLAN_QUERY_PARAMS.task, String(task.id));
    return {task, key: `${studyPlanRecordKey(checkpoint, index)}-${task.id ?? taskIndex}`, to: `${APP_ROUTE_PATHS.myPlan}?${params}`};
  })).slice(0, 3);
  const error = query.isError && !isMissingResource(query.error, ADVISING_ERROR_CODES.studyPlanNotFound);
  return <section className={`${styles.panel} ${styles.advisorPanel}`} aria-labelledby="advisor-tasks-title">
    <header className={styles.panelHeader}><h2 id="advisor-tasks-title">{translate("dashboard:advisorTasks")}</h2><Link to={`${APP_ROUTE_PATHS.myPlan}?view=tasks`} className={styles.viewAll}>{translate("common:actions.viewAll")}{' '}</Link></header>
    {query.isPending ? <p className={styles.regionStatus} role="status">{translate("dashboard:loadingTasks")}</p> : error ? <div className={styles.regionStatus} role="alert">{translate("common:feedback.sectionFailed")}{' '}<button type="button" onClick={() => void query.refetch()}>{translate("common:actions.retry")}</button></div> : tasks.length === 0 ? <p className={styles.regionStatus}>{translate("dashboard:noTasks")}</p> : <div className={styles.taskList}>
      {tasks.map(({task, key, to}) => <Link to={to} className={styles.taskRow} key={key}>
        <span className={styles.taskCopy}><strong>{task.title || translate("dashboard:learningTask")}</strong><small>{taskStatusLabel(task.status)}</small></span>
        <span className={styles.taskProgress}>{formatPlanDate(task.dueDate)}</span><span className={styles.outlineButton}>{translate("common:actions.viewDetail")}</span>
      </Link>)}
    </div>}
  </section>;
}
