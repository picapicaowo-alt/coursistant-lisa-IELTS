import {useTranslation} from 'react-i18next';
import React, {useEffect, useId, useMemo, useRef, useState} from 'react';
import {X, Plus, Calendar, Check} from 'lucide-react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {ScheduleRequestActions} from './ScheduleRequestActions';
import {unwrapData} from '@/apis';
import type {StudyPlanAggregate, AdvisorTaskResponse} from '@/apis';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {TASK_STATUS, formatPlanDate} from '@/utils/studyPlan';
import styles from './LearningJourney.module.scss';

export function LearningJourney({
  plan,
  studentUserId,
  onEdit,
  checkpointTarget,
  taskTarget,
}: {
  plan: StudyPlanAggregate;
  studentUserId?: number;
  onEdit: (checkpointId?: number, taskId?: number) => void;
  checkpointTarget: number;
  taskTarget: number;
}) {
  const {t: translate} = useTranslation();
  const checkpoints = useMemo(() => plan.checkpoints ?? [], [plan.checkpoints]);
  const [selected, setSelected] = useState<number | null>(null);
  const [taskFilter, setTaskFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_STARTED'>('ALL');
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [selectedTask, setSelectedTask] = useState<AdvisorTaskResponse | null>(null);
  const checkpoint = selected == null ? undefined : checkpoints[selected];

  const scheduleRequests = useQuery({
    queryKey: ['advisor', 'student-schedule-requests', studentUserId],
    queryFn: async () =>
      unwrapData(
        await courseOperationsApiService.listAdvisorScheduleRequests({
          page: 0,
          size: 10,
          studentUserId,
        }),
        'advisorScheduleRequests'
      ),
    enabled: Boolean(studentUserId),
    retry: false,
  });


  useEffect(() => {
    const index = checkpoints.findIndex(
      item =>
        (checkpointTarget > 0 && item.id === checkpointTarget) ||
        (taskTarget > 0 && item.tasks?.some(task => task.id === taskTarget))
    );
    if (index >= 0) setSelected(index);
  }, [checkpointTarget, taskTarget, checkpoints]);

  useEffect(() => {
    if (checkpoint && !dialog.current?.open) dialog.current?.showModal();
    else if (!checkpoint) dialog.current?.close();
  }, [checkpoint]);

  // Tasks in dialog
  const allTasks = checkpoint?.tasks ?? [];
  const completedCount = allTasks.filter(t => t.status === TASK_STATUS.completed).length;
  const inProgressCount = allTasks.filter(t => t.status === TASK_STATUS.inProgress).length;
  const notStartedCount = allTasks.length - completedCount - inProgressCount;

  const filteredTasks = allTasks.filter(t => {
    if (taskFilter === 'COMPLETED') return t.status === TASK_STATUS.completed;
    if (taskFilter === 'IN_PROGRESS') return t.status === TASK_STATUS.inProgress;
    if (taskFilter === 'NOT_STARTED') return t.status !== TASK_STATUS.completed && t.status !== TASK_STATUS.inProgress;
    return true;
  });

interface PendingRequestItem {
  id: number;
  courseTitle: string;
  requestedDate: string;
  requestedTime: string;
  reason: string;
  version?: number;
}

  // Unknown states must not expose approval actions.
  const rawPendingRequests = (scheduleRequests.data?.items ?? []).filter(r => r.status === 'PENDING');
  const pendingRequests: PendingRequestItem[] = rawPendingRequests.filter(r => r.id != null).map(r => ({
    id: r.id!, courseTitle: r.courseId ? `Course #${r.courseId}` : 'Schedule request',
    requestedDate: r.proposedOccurrenceDate || 'Not supplied',
    requestedTime: [r.proposedStartTime, r.proposedEndTime].filter(Boolean).join(' – '),
    reason: r.reason || 'No reason supplied', version: r.version,
  }));

  return (
    <div className={styles.journeyLayout}>
      {/* Main Column: Learning Journey */}
      <section className={styles.journey} aria-labelledby="learning-journey-title">
        <header className={styles.header}>
          <div>
            <h2 id="learning-journey-title">Learning Journey</h2>
            <p>{plan.strategySummary || 'Target-driven milestone progression'}</p>
          </div>
          <button type="button" className={styles.editBtn} onClick={() => onEdit()}>
            Edit study plan
          </button>
        </header>

        <div className={styles.phases}>
          {checkpoints.map((item, index) => {
            const tasks = item.tasks ?? [];
            const completed = tasks.filter(task => task.status === TASK_STATUS.completed).length;
            const isCompleted = tasks.length > 0 && completed === tasks.length;
            const isCurrent = !isCompleted && index === checkpoints.findIndex(checkpoint => !(checkpoint.tasks?.length && checkpoint.tasks.every(task => task.status === TASK_STATUS.completed)));
            const progressPercent = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

            return (
              <article
                key={item.id ?? index}
                className={styles.phaseCard}
                data-current={isCurrent ? 'true' : undefined}
                data-state={isCompleted ? 'completed' : isCurrent ? 'current' : 'planned'}
              >
                <span className={styles.phaseMarker} data-state={isCompleted ? 'completed' : isCurrent ? 'current' : 'planned'} aria-hidden="true">{isCompleted ? <Check size={18}/> : null}</span>
                <div className={styles.phaseBadgeRow}>
                  <span className={styles.phaseNumber}>Phase {String(index + 1).padStart(2, '0')}</span>
                  <span
                    className={styles.statusPill}
                    data-status={isCompleted ? 'completed' : isCurrent ? 'current' : 'locked'}
                  >
                    {isCompleted ? 'Completed' : isCurrent ? 'Current Phase' : 'Planned'}
                  </span>
                </div>

                <h3>{item.goal || item.description || `Checkpoint ${index + 1}`}</h3>
                <p className={styles.phaseDesc}>
                  {item.description || 'No description provided.'}
                </p>

                <div className={styles.phaseMetrics}>
                  <div className={styles.metricLine}>
                    <span>Advisor Tasks</span>
                    <strong>{completed}/{tasks.length}</strong>
                  </div>
                  <div className={styles.metricLine}>
                    <span>Progress</span>
                    <strong>{progressPercent}%</strong>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      data-completed={isCompleted ? 'true' : undefined}
                      style={{width: `${progressPercent}%`}}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.phaseActionBtn}
                  data-variant={isCurrent ? 'primary' : isCompleted ? 'secondary' : 'outline'}
                  onClick={() => {setSelectedTask(null); setTaskFilter('ALL'); setSelected(index);}}
                  aria-label={translate("common:navigationControls.viewPhase", {number: index + 1})}
                >
                  {translate("common:actions.viewDetails")}
                </button>
              </article>
            );
          })}

          {!checkpoints.length ? (
            <article className={styles.phaseCard}>
              <div className={styles.phaseBadgeRow}>
                <span className={styles.phaseNumber}>Phase 01</span>
                <span className={styles.statusPill} data-status="current">Setup</span>
              </div>
              <h3>No checkpoints yet</h3>
              <p className={styles.phaseDesc}>Add a checkpoint to begin this student’s learning journey.</p>
              <button
                type="button"
                className={styles.phaseActionBtn}
                data-variant="primary"
                onClick={() => onEdit()}
              >
                + Create Checkpoint
              </button>
            </article>
          ) : null}
        </div>
      </section>

      {/* Right Column: Pending Requests */}
      <section className={styles.requestsCard} aria-label="Student pending requests">
        <header className={styles.requestsHeader}>
          <div className={styles.headerGroup}>
            <h3>Requests</h3>
            <span className={styles.pendingBadge}>{pendingRequests.length} Pending{(scheduleRequests.data?.total ?? 0) > (scheduleRequests.data?.items?.length ?? 0) ? ' on this page' : ''}</span>
          </div>
        </header>

        <div className={styles.requestsList}>
          {scheduleRequests.isPending ? <p>Loading requests…</p> : scheduleRequests.isError ? <p role="alert">Schedule requests could not be loaded.</p> : pendingRequests.length === 0 ? <p>No pending requests.</p> : null}
          {pendingRequests.map(req => (
            <div className={styles.requestItem} key={req.id}>
              <div className={styles.reqTopLine}>
                <strong>{req.courseTitle}</strong>
                <span className={styles.reqTag}>Schedule change</span>
              </div>

              <div className={styles.reqDetails}>
                <div>
                  Requested: <strong>{req.requestedDate} · {req.requestedTime}</strong>
                </div>
                <div>
                  Reason: <span>{req.reason}</span>
                </div>
              </div>

              <ScheduleRequestActions requestId={req.id} version={req.version} onReload={async () => {const result = await scheduleRequests.refetch(); return !result.isError && Boolean(result.data?.items?.some(item => item.id === req.id && item.version != null));}}/>
            </div>
          ))}
        </div>
        <Link to={`${APP_ROUTE_PATHS.advisorSchedule}?studentUserId=${studentUserId}`}>View all schedule requests</Link>
      </section>

      {/* Checkpoint Tasks Modal Dialog (Figma Top-Right Frame) */}
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        onClose={() => setSelected(null)}
      >
        <div className={styles.dialogHeader}>
          <h2 id={titleId}>{checkpoint?.goal || checkpoint?.description || 'Checkpoint tasks'}</h2>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Close dialog"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.dialogToolbar}>
          <div className={styles.filterTabs}>
            <button
              type="button"
              data-active={taskFilter === 'ALL' ? 'true' : undefined}
              onClick={() => setTaskFilter('ALL')}
            >
              All Tasks: {allTasks.length}
            </button>
            <button
              type="button"
              data-active={taskFilter === 'IN_PROGRESS' ? 'true' : undefined}
              onClick={() => setTaskFilter('IN_PROGRESS')}
            >
              In Progress: {inProgressCount}
            </button>
            <button
              type="button"
              data-active={taskFilter === 'COMPLETED' ? 'true' : undefined}
              onClick={() => setTaskFilter('COMPLETED')}
            >
              Completed: {completedCount}
            </button>
            <button
              type="button"
              data-active={taskFilter === 'NOT_STARTED' ? 'true' : undefined}
              onClick={() => setTaskFilter('NOT_STARTED')}
            >
              Not Started: {notStartedCount}
            </button>
          </div>

          <button
            type="button"
            className={styles.addTaskBtn}
            onClick={() => {
              dialog.current?.close();
              onEdit();
            }}
          >
            <Plus size={14} />
            <span>Edit checkpoint &amp; tasks</span>
          </button>
        </div>

        {selectedTask != null ? <section className={styles.taskDetail} aria-label="Task details">
          <button type="button" onClick={() => setSelectedTask(null)}>Back to all tasks</button>
          <h3>{selectedTask.title || 'Advisor task'}</h3>
          <p>{selectedTask.description || 'No description supplied.'}</p>
          <dl><dt>Deadline</dt><dd>{formatPlanDate(selectedTask.dueDate)}</dd><dt>Submission requirement</dt><dd>{selectedTask.submissionRequirement || 'No additional requirement.'}</dd></dl>
          <button type="button" onClick={() => {dialog.current?.close(); onEdit(checkpoint?.id, selectedTask.id);}}>Edit task</button>
        </section> :
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col">Task Name</th>
                <th scope="col">Deadline</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task, index) => {
                const isDone = task.status === TASK_STATUS.completed;
                const isInProg = task.status === TASK_STATUS.inProgress;
                const statusKey = isDone ? 'COMPLETED' : isInProg ? 'IN_PROGRESS' : 'NOT_STARTED';
                const statusText = isDone ? 'Completed' : isInProg ? 'In Progress' : 'Not Started';

                return (
                  <tr key={task.id ?? index}>
                    <td>
                      <strong className={styles.taskTitle}>
                        {task.title || `Task ${index + 1}`}
                      </strong>
                      <small className={styles.taskDescription}>
                        {task.description || ''}
                      </small>
                    </td>
                    <td>
                      <span className={styles.deadlineCell}>
                        <Calendar size={13} />
                        {task.dueDate ? formatPlanDate(task.dueDate) : 'No deadline'}
                      </span>
                    </td>
                    <td>
                      <span className={styles.taskStatusBadge} data-status={statusKey}>
                        {statusText}
                      </span>
                    </td>
                    <td>
                      <div className={styles.dialogActions}>
                        <button
                          type="button"
                          onClick={() => setSelectedTask(task)}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filteredTasks.length ? (
                <tr>
                  <td colSpan={4} className={styles.tableEmpty}>
                    No tasks match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        }
      </dialog>
    </div>
  );
}
