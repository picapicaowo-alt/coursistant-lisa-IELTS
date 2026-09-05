import {useRef, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import {useActionTaskTransition} from './useActionTaskTransition';
import {AdvisingBadge} from '@/components/AdvisingBadge';
import {ACTION_CATEGORY_KEYS, ACTION_STATUS_KEYS, PRIORITY_KEYS} from '@/components/AdvisingBadge/labels';
import {useTranslation} from 'react-i18next';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';
import taskStyles from './AdvisorTasksPage.module.scss';
import {formatDateTime, formatNumber} from '@/i18n/formatting';
import {advisorApiService} from '@/apis/services/advisor-api';
import {ADVISOR_PAGE_SIZE, ACTION_TASK_TYPES} from '@/apis/types/advisorWorkspace';
import {actionTaskTargetPath} from './actionTaskTarget';
const formatTaskDateTime = (value?: string): string => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatDateTime(parsed, {dateStyle: 'medium', timeStyle: 'short'});
};

export default function AdvisorTasksPage() {
  const {t} = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = Number(searchParams.get('taskId')) || null;
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const setSelectedTaskId = (id: number | null) => setSearchParams(current => {
    const next = new URLSearchParams(current);
    if (id == null) next.delete('taskId');
    else next.set('taskId', String(id));
    return next;
  }, {replace: true});
  const closeDetail = () => {
    detailTrigger.current?.focus();
    setSelectedTaskId(null);
  };
  const [taskPage, setTaskPage] = useState(0);
  const [taskFilters, setTaskFilters] = useState({status: '', priority: '', type: '', studentType: ''});
  const tasks = useQuery({
    queryKey: ['advisor', 'action-tasks', taskPage, taskFilters],
    queryFn: async () =>
      unwrapData(
        await advisorApiService.listActionTasks({
          page: taskPage,
          size: ADVISOR_PAGE_SIZE,
          status: taskFilters.status || undefined,
          priority: taskFilters.priority || undefined,
          type: taskFilters.type || undefined,
          studentType: taskFilters.studentType || undefined,
        }),
        'advisorActionTasks'
      ),
    retry: false,
  });

  const taskDetail = useQuery({
    queryKey: ['advisor', 'action-task', selectedTaskId],
    queryFn: async () => unwrapData(await advisorApiService.getActionTask(selectedTaskId!), 'advisorActionTask'),
    enabled: selectedTaskId != null,
    retry: false,
  });

  const taskMutation = useActionTaskTransition();

  const tasksError = tasks.error || taskMutation.error;
  return <div className={styles.page}>
    <header className={styles.header}><div><h1>{t("navigation:actionTasks")}</h1><p className={styles.lede}>{t("advising:actionTasks.description")}</p></div><Link className={styles.secondaryLink} to={APP_ROUTE_PATHS.advisorOperations}>{t("course:detail.backToDashboard")}</Link></header>
        <WorkspaceSection
          title={t("navigation:actionTasks")}
          id="action-tasks"
          className={`${styles.disclosureLayout} ${taskStyles.taskSection}`}
          meta={<span className={styles.countBadge}>{formatNumber(tasks.data?.total ?? 0)}</span>}
        >
          <div className={`${styles.form} ${styles.formGrid} ${taskStyles.filters}`}>
            <label>
              {t("common:fields.status")}<select
                value={taskFilters.status}
                onChange={event => {
                  setTaskFilters(current => ({...current, status: event.target.value}));
                  setTaskPage(0);
                }}
              >
                <option value="">{t("advising:actionTasks.allStatuses")}</option>
                {Object.entries(ACTION_STATUS_KEYS).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
              </select>
            </label>
            <label>
              {t("advising:actionTasks.priority")}
              <select
                value={taskFilters.priority}
                onChange={event => {
                  setTaskFilters(current => ({...current, priority: event.target.value}));
                  setTaskPage(0);
                }}
              >
                <option value="">{t("advising:actionTasks.allPriorities")}</option>
                {Object.entries(PRIORITY_KEYS).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
              </select>
            </label>
            <label>
              {t("common:fields.type")}<select
                value={taskFilters.type}
                onChange={event => {
                  setTaskFilters(current => ({...current, type: event.target.value}));
                  setTaskPage(0);
                }}
              >
                <option value="">{t("advising:actionTasks.allTypes")}</option>
                {ACTION_TASK_TYPES.map(type => (
                  <option key={type} value={type}>{t(`advising:actionTasks.types.${type}`)}</option>
                ))}
              </select>
            </label>
            <label>
              {t("advising:actionTasks.studentType")}
              <select
                value={taskFilters.studentType}
                onChange={event => {
                  setTaskFilters(current => ({...current, studentType: event.target.value}));
                  setTaskPage(0);
                }}
              >
                <option value="">{t("advising:actionTasks.allStudents")}</option>
                <option value="ACTIVE">{t("common:status.ACTIVE")}</option>
                <option value="INTAKE">{t("advising:actionTasks.intake")}</option>
                <option value="TRANSITION">{t("advising:actionTasks.transition")}</option>
              </select>
            </label>
          </div>

          {tasksError ? (
            <p className={styles.error} role="alert">
              {advisingErrorMessage(tasksError, t("advising:actionTasks.loadFailed"))}
            </p>
          ) : null}
          {tasks.isPending ? <p className={styles.status} role="status">{t("advising:actionTasks.loading")}</p> : null}
          {!tasks.isPending && !tasks.isError && (tasks.data?.items.length ?? 0) === 0 ? (
            <div className={styles.emptyState}>
              <strong>{t("advising:actionTasks.empty")}</strong>
              <span>{t("advising:actionTasks.emptyHint")}</span>
            </div>
          ) : null}

          <div className={taskStyles.taskList}>
            {(tasks.data?.items.length ?? 0) > 0 ? <div className={taskStyles.columnHeadings} aria-hidden="true"><span>{t("advising:actionTasks.task")}</span><span>{t("common:fields.status")}</span><span>{t("advising:actionTasks.priority")}</span><span>{t("common:fields.actions")}</span></div> : null}
            {(tasks.data?.items ?? []).map(task => (
              <article className={taskStyles.taskRow} key={task.taskId}>
                  <div className={taskStyles.taskMain}>
                    <h3>{task.description || t("advising:actionTasks.fallbackTitle", {id: task.taskId})}</h3>
                    <p>
                      {task.category ? (ACTION_CATEGORY_KEYS[task.category] ? t(ACTION_CATEGORY_KEYS[task.category]) : task.category) : task.taskType && ACTION_TASK_TYPES.some(type => type === task.taskType) ? t(`advising:actionTasks.types.${task.taskType}`) : t('common:tasks.advisingTask')}
                      {task.createdAt ? ` · ${formatTaskDateTime(task.createdAt)}` : ''}
                    </p>
                  </div>
                  <AdvisingBadge value={task.status} kind="status"/>
                  <AdvisingBadge value={task.priority}/>
                  <div className={taskStyles.taskActions}>
                    {task.taskId != null ? (
                      <button
                        type="button"
                        className={`${styles.secondary} ${taskStyles.detailsAction}`}
                        ref={selectedTaskId === task.taskId ? detailTrigger : undefined}
                        aria-controls={selectedTaskId === task.taskId ? `task-detail-${task.taskId}` : undefined}
                        aria-expanded={selectedTaskId === task.taskId}
                        onClick={() => setSelectedTaskId(selectedTaskId === task.taskId ? null : task.taskId!)}
                      >
                        {t("common:fields.details")}</button>
                    ) : null}
                    {actionTaskTargetPath(task.target) ? (
                      <Link className={`${styles.secondaryLink} ${taskStyles.recordAction}`} to={actionTaskTargetPath(task.target)!}>
                        {t("advising:actionTasks.openRecord")}
                      </Link>
                    ) : null}
                    {task.status === 'PENDING' && task.taskId != null ? (
                      <button
                        type="button"
                        className={`${styles.secondary} ${taskStyles.transitionAction}`}
                        disabled={taskMutation.isPending || task.version == null}
                        onClick={() =>
                          taskMutation.mutate({action: 'start', taskId: task.taskId!, version: task.version})
                        }
                      >
                        {t("course:scheduleModal.startLabel")}</button>
                    ) : null}
                    {task.status === 'IN_PROGRESS' && task.taskId != null ? (
                      <button
                        type="button"
                        className={`${styles.primary} ${taskStyles.transitionAction}`}
                        disabled={taskMutation.isPending || task.version == null}
                        onClick={() =>
                          taskMutation.mutate({action: 'resolve', taskId: task.taskId!, version: task.version})
                        }
                      >
                        {t("advising:actionTasks.resolve")}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
          </div>

          {selectedTaskId != null ? (
            <section id={`task-detail-${selectedTaskId}`} className={`${styles.detailCard} ${taskStyles.detail}`} aria-label={t("advising:actionTasks.details")}>
              <div className={styles.detailHeader}>
                <h2>{t("advising:actionTasks.details")}</h2>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={closeDetail}
                >
                  {t("common:actions.close")}</button>
              </div>
              {taskDetail.isPending ? <p role="status">{t("advising:actionTasks.loadingDetail")}</p> : null}
              {taskDetail.isError ? (
                <p className={styles.error} role="alert">
                  {advisingErrorMessage(taskDetail.error, t("advising:actionTasks.unavailable"))}
                </p>
              ) : null}
              {taskDetail.data ? (
                <>
                  <h3>{taskDetail.data.description || t("navigation:actionTasks")}</h3>
                  <div className={taskStyles.taskBadges}>
                    <AdvisingBadge value={taskDetail.data.status} kind="status"/>
                    <AdvisingBadge value={taskDetail.data.priority}/>
                  </div>
                  <p>{taskDetail.data.createdAt ? t("advising:actionTasks.createdAt", {date: formatTaskDateTime(taskDetail.data.createdAt)}) : ''}</p>
                  {taskDetail.data.resolvedAt ? (
                    <p>{t('common:records.resolvedAt', {date: formatTaskDateTime(taskDetail.data.resolvedAt)})}</p>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : null}

          <AdvisingPagination
            label={t("advising:actionTasks.pages")}
            page={taskPage}
            total={tasks.data?.total ?? 0}
            onPage={setTaskPage}
          />
        </WorkspaceSection>

  </div>;
}
