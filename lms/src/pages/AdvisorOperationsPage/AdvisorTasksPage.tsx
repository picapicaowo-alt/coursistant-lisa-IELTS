import {useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import {useActionTaskTransition} from './useActionTaskTransition';
import {AdvisingBadge} from '@/components/AdvisingBadge';
import {ACTION_CATEGORY_LABELS} from '@/components/AdvisingBadge/labels';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';
import {advisorApiService} from '@/apis/services/advisor-api';
import {ADVISOR_PAGE_SIZE, ACTION_TASK_TYPES} from '@/apis/types/advisorWorkspace';
import {actionTaskTargetPath} from './actionTaskTarget';
const formatDateTime = (value?: string): string => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

export default function AdvisorTasksPage() {
  const [searchParams] = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(() => Number(searchParams.get('taskId')) || null);
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
    <header className={styles.header}><div><h1>Action tasks</h1><p className={styles.lede}>Review priorities, track progress, and open the student record.</p></div><Link className={styles.secondaryLink} to={APP_ROUTE_PATHS.advisorOperations}>Back to dashboard</Link></header>
        <WorkspaceSection
          title="Action tasks"
          id="action-tasks"
          className={styles.disclosureLayout}
          meta={<span className={styles.countBadge}>{tasks.data?.total ?? 0}</span>}
        >
          <div className={`${styles.form} ${styles.formGrid}`}>
            <label>
              Status
              <select
                value={taskFilters.status}
                onChange={event => {
                  setTaskFilters(current => ({...current, status: event.target.value}));
                  setTaskPage(0);
                }}
              >
                <option value="">All statuses</option>
                <option>PENDING</option>
                <option>IN_PROGRESS</option>
                <option>RESOLVED</option>
              </select>
            </label>
            <label>
              Priority
              <select
                value={taskFilters.priority}
                onChange={event => {
                  setTaskFilters(current => ({...current, priority: event.target.value}));
                  setTaskPage(0);
                }}
              >
                <option value="">All priorities</option>
                <option>HIGH</option>
                <option>MEDIUM</option>
                <option>LOW</option>
              </select>
            </label>
            <label>
              Type
              <select
                value={taskFilters.type}
                onChange={event => {
                  setTaskFilters(current => ({...current, type: event.target.value}));
                  setTaskPage(0);
                }}
              >
                <option value="">All types</option>
                {ACTION_TASK_TYPES.map(type => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Student type
              <select
                value={taskFilters.studentType}
                onChange={event => {
                  setTaskFilters(current => ({...current, studentType: event.target.value}));
                  setTaskPage(0);
                }}
              >
                <option value="">All students</option>
                <option value="ACTIVE">Active</option>
                <option value="INTAKE">Intake</option>
                <option value="TRANSITION">Transition</option>
              </select>
            </label>
          </div>

          {tasksError ? (
            <p className={styles.error} role="alert">
              {advisingErrorMessage(tasksError, 'Action tasks could not be loaded.')}
            </p>
          ) : null}
          {tasks.isPending ? <p className={styles.status}>Loading action tasks…</p> : null}
          {!tasks.isPending && !tasks.isError && (tasks.data?.items.length ?? 0) === 0 ? (
            <div className={styles.emptyState}>
              <strong>No open action tasks match your filter</strong>
              <span>New items appear when checkpoints near deadlines or support tickets escalate.</span>
            </div>
          ) : null}

          <div className={styles.inboxList}>
            {(tasks.data?.items ?? []).map(task => (
              <article className={styles.inboxRow} key={task.taskId}>
                  <div className={styles.inboxMain}>
                    <div className={styles.rowTitle}>
                      <strong>{task.description || `Task #${task.taskId}`}</strong>
                      <AdvisingBadge value={task.status} kind="status"/>
                      <AdvisingBadge value={task.priority}/>
                    </div>
                    <span>
                      {task.category ? ACTION_CATEGORY_LABELS[task.category] ?? task.category : task.taskType?.replace(/_/g, ' ').toLowerCase() || 'Advising task'}
                      {task.createdAt ? ` · ${formatDateTime(task.createdAt)}` : ''}
                    </span>
                  </div>
                  <div className={styles.actions}>
                    {task.taskId != null ? (
                      <button
                        type="button"
                        className={styles.secondary}
                        aria-expanded={selectedTaskId === task.taskId}
                        onClick={() => setSelectedTaskId(current => (current === task.taskId ? null : task.taskId!))}
                      >
                        Details
                      </button>
                    ) : null}
                    {actionTaskTargetPath(task.target) ? (
                      <Link className={styles.secondaryLink} to={actionTaskTargetPath(task.target)!}>
                        Open task record
                      </Link>
                    ) : null}
                    {task.status === 'PENDING' && task.taskId != null ? (
                      <button
                        type="button"
                        className={styles.secondary}
                        disabled={taskMutation.isPending || task.version == null}
                        onClick={() =>
                          taskMutation.mutate({action: 'start', taskId: task.taskId!, version: task.version})
                        }
                      >
                        Start
                      </button>
                    ) : null}
                    {task.status === 'IN_PROGRESS' && task.taskId != null ? (
                      <button
                        type="button"
                        className={styles.primary}
                        disabled={taskMutation.isPending || task.version == null}
                        onClick={() =>
                          taskMutation.mutate({action: 'resolve', taskId: task.taskId!, version: task.version})
                        }
                      >
                        Resolve
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
          </div>

          {selectedTaskId != null ? (
            <section className={styles.detailCard} aria-label="Task detail">
              <div className={styles.detailHeader}>
                <h2>Task details</h2>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setSelectedTaskId(null)}
                >
                  Close
                </button>
              </div>
              {taskDetail.isPending ? <p role="status">Loading task…</p> : null}
              {taskDetail.isError ? (
                <p className={styles.error} role="alert">
                  {advisingErrorMessage(taskDetail.error, 'This task is unavailable.')}
                </p>
              ) : null}
              {taskDetail.data ? (
                <>
                  <h3>{taskDetail.data.description || 'Action task'}</h3>
                  <p>
                    {taskDetail.data.status} · {taskDetail.data.priority}
                  </p>
                  <p>{taskDetail.data.createdAt ? `Created ${formatDateTime(taskDetail.data.createdAt)}` : ''}</p>
                  {taskDetail.data.resolvedAt ? (
                    <p>Resolved {formatDateTime(taskDetail.data.resolvedAt)}</p>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : null}

          <AdvisingPagination
            label="Action task pages"
            page={taskPage}
            total={tasks.data?.total ?? 0}
            onPage={setTaskPage}
          />
        </WorkspaceSection>

  </div>;
}
