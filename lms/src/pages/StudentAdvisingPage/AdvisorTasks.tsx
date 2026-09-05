import { useTranslation } from 'react-i18next';
import {useState} from 'react';
import {CalendarDays, ChevronRight, Sparkle} from 'lucide-react';
import {differenceInCalendarDays, parseISO} from 'date-fns';
import type {StudyPlanAggregate} from '@/apis';
import {formatNumber} from '@/i18n/formatting';
import {
  TASK_STATUS,
  formatPlanDate,
  taskStatusLabel,
  taskStatusTone,
} from '@/utils/studyPlan';
import {studyPlanRecordKey} from './studyPlanView';
import styles from './AdvisorTasks.module.scss';

export function AdvisorTasks({
  plan,
  onCheckpoint,
}: {
  plan?: StudyPlanAggregate;
  onCheckpoint: (key: string, taskId?: number) => void;
}) {
  const { t: translate } = useTranslation();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('');
  const [showAllReminders, setShowAllReminders] = useState(false);
  const checkpoints = plan?.checkpoints ?? [];
  const selectedIndex = Math.min(step, Math.max(0, checkpoints.length - 1));
  const checkpoint = checkpoints[selectedIndex];
  const allTasks = checkpoints.flatMap((record, index) =>
    (record.tasks ?? []).map((task) => ({
      task,
      key: studyPlanRecordKey(record, index),
    })),
  );
  const tasks = (checkpoint?.tasks ?? []).filter(
    (task) => !status || task.status === status,
  );
  const reminders = allTasks
    .filter(({task}) => task.dueDate && task.status !== TASK_STATUS.completed)
    .sort((a, b) => a.task.dueDate!.localeCompare(b.task.dueDate!));
  const visibleReminders = showAllReminders ? reminders : reminders.slice(0, 3);
  const feedback = allTasks.filter(({task}) => task.advisorFeedback);
  const deadline = (dueDate?: string, taskStatus?: string) => {
    if (!dueDate || taskStatus === TASK_STATUS.completed) return undefined;
    // Contract deadlines are calendar dates in the viewer's locale, not UTC instants.
    const days = differenceInCalendarDays(parseISO(dueDate.slice(0, 10)), new Date());
    if (!Number.isFinite(days)) return undefined;
    if (days < 0) return {tone: 'urgent', label: translate('common:status.OVERDUE')};
    if (days === 0) return {tone: 'urgent', label: translate('advising:studentTasks.dueToday')};
    if (days === 1) return {tone: 'soon', label: translate('advising:studentTasks.dueTomorrow')};
    return {tone: 'later', label: translate('advising:studentTasks.inDays', {count: days})};
  };
  return (
    <div className={styles.tasksLayout}>
      <div className={styles.tasksMain}>
        <section
          className={styles.taskOverview}
          aria-labelledby="advisor-tasks-title"
        >
          <div>
            <h2 id="advisor-tasks-title">{translate("dashboard:advisorTasks")}</h2>
            <p>
              {translate('advising:studentTasks.description')}
            </p>
          <nav className={styles.taskCounts} aria-label={translate('advising:studentTasks.statusFilters')}>
            {[
              {value: '', label: translate('advising:studentTasks.allTasks')},
              {value: TASK_STATUS.notStarted, label: taskStatusLabel(TASK_STATUS.notStarted)},
              {value: TASK_STATUS.inProgress, label: taskStatusLabel(TASK_STATUS.inProgress)},
              {value: TASK_STATUS.completed, label: taskStatusLabel(TASK_STATUS.completed)},
            ].map((filter) => (
              <button
                type="button"
                key={filter.value}
                aria-pressed={filter.value === status}
                onClick={() => setStatus(filter.value)}
              >
                {filter.value ? <span data-tone={taskStatusTone(filter.value)} /> : null}
                {filter.label}
                <strong>
                  {
                    formatNumber(allTasks.filter(
                      ({task}) => !filter.value || task.status === filter.value,
                    ).length)
                  }
                </strong>
              </button>
            ))}
          </nav>
          </div>
          <img src="/icons/figma-study-plan/celebration.svg" alt="" />
        </section>
        <section className={styles.taskBoard} aria-label={translate('advising:studentTasks.board')}>
          {checkpoint ? (
            <h3>
              {checkpoint.description ||
                checkpoint.goal ||
                translate('advising:studentTasks.checkpoint', {number: formatNumber(selectedIndex + 1)})}
            </h3>
          ) : null}
          <nav className={styles.steps} aria-label={translate('advising:studentTasks.checkpoints')}>
            {checkpoints.map((record, index) => (
              <button
                type="button"
                key={studyPlanRecordKey(record, index)}
                aria-pressed={selectedIndex === index}
                title={record.description || record.goal}
                onClick={() => setStep(index)}
              >
                {translate('advising:studentTasks.step', {number: formatNumber(index + 1)})}
                {selectedIndex === index ? <span>{translate('advising:studentTasks.activeStep')}</span> : null}
              </button>
            ))}
          </nav>
          {tasks.length ? (
            tasks.map((task, index) => {
              const due = deadline(task.dueDate, task.status);
              const canAct = task.id != null && task.version != null;
              return <article className={styles.taskRow} key={task.id ?? index}>
                <div>
                  <strong>{task.title || translate('advising:studentTasks.task')}</strong>
                  {task.description ? <p>{task.description}</p> : null}
                </div>
                <span className={styles.taskDate} data-tone={due?.tone}>
                  <CalendarDays size={18} strokeWidth={1.5} aria-hidden="true" />
                  {task.dueDate ? <time dateTime={task.dueDate.slice(0, 10)} title={formatPlanDate(task.dueDate)} aria-label={formatPlanDate(task.dueDate)}>
                    {due && due.tone !== 'later' ? due.label : formatPlanDate(task.dueDate, {compact: true})}
                  </time> : <span>{formatPlanDate()}</span>}
                </span>
                <span
                  className={styles.taskStatus}
                  data-tone={taskStatusTone(task.status)}
                >
                  {taskStatusLabel(task.status)}
                </span>
                <button
                  type="button"
                  className={styles.taskAction}
                  data-primary={(canAct && task.status === TASK_STATUS.notStarted) || undefined}
                  onClick={() =>
                    onCheckpoint(studyPlanRecordKey(checkpoint!, selectedIndex), task.id)
                  }
                >
                  {canAct && task.status === TASK_STATUS.notStarted
                    ? translate('advising:studentTasks.start')
                    : canAct && task.status === TASK_STATUS.inProgress
                      ? translate('advising:studentTasks.continue')
                      : translate('advising:studentTasks.viewTask')}
                </button>
              </article>;
            })
          ) : (
            <p className={styles.taskEmpty}>
              {checkpoints.length
                ? translate('advising:studentTasks.noMatches')
                : translate('advising:studentTasks.empty')}
            </p>
          )}
        </section>
      </div>
      <aside className={styles.tasksRail}>
        <section className={styles.railCard} aria-labelledby="advisor-comments-title">
          <h2 id="advisor-comments-title"><Sparkle size={36} fill="currentColor" strokeWidth={1} aria-hidden="true" />{translate('advising:studentTasks.comments')}</h2>
          {feedback.length ? (
            feedback.slice(-3).map(({task}, index) => (
              <div key={task.id ?? index}>
                <p>{task.advisorFeedback}</p>
              </div>
            ))
          ) : (
            <p>{translate('advising:studentTasks.noFeedback')}</p>
          )}
        </section>
        <section className={styles.railCard} aria-labelledby="advisor-deadlines-title">
          <header className={styles.railHeading}>
            <h2 id="advisor-deadlines-title">{translate('dashboard:alerts')}</h2>
            {reminders.length > 3 ? <button type="button" aria-expanded={showAllReminders} aria-controls="advisor-deadlines" onClick={() => setShowAllReminders(current => !current)}>
              {showAllReminders ? translate('advising:studentTasks.showLess') : translate('common:actions.viewAll')}<ChevronRight size={20} aria-hidden="true" />
            </button> : null}
          </header>
          <div id="advisor-deadlines" className={styles.reminders}>
          {reminders.length ? (
            visibleReminders.map(({task, key}, index) => {
              const due = deadline(task.dueDate, task.status);
              return <button
                type="button"
                key={task.id ?? index}
                className={styles.task}
                onClick={() => onCheckpoint(key, task.id)}
              >
                <span className={styles.reminderDot} data-tone={taskStatusTone(task.status)} aria-hidden="true" />
                <strong>{task.title || translate('advising:studentTasks.task')}</strong>
                <small data-tone={due?.tone}>{due && due.tone !== 'later' ? due.label : formatPlanDate(task.dueDate)}</small>
              </button>;
            })
          ) : (
            <p>{translate('advising:studentTasks.noDeadlines')}</p>
          )}
          </div>
        </section>
      </aside>
    </div>
  );
}
