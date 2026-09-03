import {useState} from 'react';
import {CalendarDays, Sparkles} from 'lucide-react';
import type {StudyPlanAggregate} from '@/apis';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {
  TASK_STATUS,
  formatPlanDate,
  taskStatusLabel,
  taskStatusTone,
} from '@/utils/studyPlan';
import {studyPlanRecordKey} from './studyPlanView';
import styles from './PlanOverview.module.scss';

export function AdvisorTasks({
  plan,
  onCheckpoint,
}: {
  plan?: StudyPlanAggregate;
  onCheckpoint: (key: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('');
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
    .sort((a, b) => a.task.dueDate!.localeCompare(b.task.dueDate!))
    .slice(0, 5);
  const feedback = allTasks.filter(({task}) => task.advisorFeedback);
  return (
    <div className={styles.tasksLayout}>
      <div className={styles.tasksMain}>
        <section
          className={styles.taskOverview}
          aria-labelledby="advisor-tasks-title"
        >
          <div>
            <h2 id="advisor-tasks-title">Advisor Tasks</h2>
            <p>
              Personalized tasks from your advisor to help you reach your
              learning goal.
            </p>
          </div>
          <img src="/icons/figma-study-plan/celebration.svg" alt="" />
          <nav className={styles.taskCounts} aria-label="Task status filters">
            {[
              {value: '', label: 'All tasks'},
              {value: TASK_STATUS.notStarted, label: 'Not started'},
              {value: TASK_STATUS.inProgress, label: 'In progress'},
              {value: TASK_STATUS.completed, label: 'Completed'},
            ].map((filter) => (
              <button
                type="button"
                key={filter.value}
                aria-pressed={filter.value === status}
                onClick={() => setStatus(filter.value)}
              >
                <span data-tone={taskStatusTone(filter.value)} />
                {filter.label}
                <strong>
                  {
                    allTasks.filter(
                      ({task}) => !filter.value || task.status === filter.value,
                    ).length
                  }
                </strong>
              </button>
            ))}
          </nav>
        </section>
        <section className={styles.taskBoard} aria-label="Tasks by checkpoint">
          <nav className={styles.steps} aria-label="Checkpoints">
            {checkpoints.map((record, index) => (
              <button
                type="button"
                key={studyPlanRecordKey(record, index)}
                aria-pressed={selectedIndex === index}
                title={record.description || record.goal}
                onClick={() => setStep(index)}
              >
                Step {index + 1}
              </button>
            ))}
          </nav>
          {checkpoint ? (
            <h3>
              {checkpoint.description ||
                checkpoint.goal ||
                `Checkpoint ${selectedIndex + 1}`}
            </h3>
          ) : null}
          {tasks.length ? (
            tasks.map((task, index) => (
              <article className={styles.taskRow} key={task.id ?? index}>
                <div>
                  <strong>{task.title || 'Advisor task'}</strong>
                  {task.description ? <p>{task.description}</p> : null}
                </div>
                <span className={styles.taskDate}>
                  <CalendarDays size={15} aria-hidden="true" />
                  {formatPlanDate(task.dueDate)}
                </span>
                <span
                  className={styles.taskStatus}
                  data-tone={taskStatusTone(task.status)}
                >
                  {taskStatusLabel(task.status)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onCheckpoint(studyPlanRecordKey(checkpoint!, selectedIndex))
                  }
                >
                  View task
                </button>
              </article>
            ))
          ) : (
            <p className={styles.taskEmpty}>
              {checkpoints.length
                ? 'No tasks match this status in this checkpoint.'
                : 'Your advisor has not added tasks yet.'}
            </p>
          )}
        </section>
      </div>
      <aside className={styles.tasksRail}>
        <WorkspaceSection
          title="Advisor Comments"
          meta={<Sparkles size={22} aria-hidden="true" />}
        >
          {feedback.length ? (
            feedback.slice(-3).map(({task}, index) => (
              <div key={task.id ?? index}>
                <strong>{task.title}</strong>
                <p>{task.advisorFeedback}</p>
              </div>
            ))
          ) : (
            <p>Your advisor’s task feedback will appear here.</p>
          )}
        </WorkspaceSection>
        <WorkspaceSection title="Upcoming deadlines">
          {reminders.length ? (
            reminders.map(({task, key}, index) => (
              <button
                type="button"
                key={task.id ?? index}
                className={styles.task}
                onClick={() => onCheckpoint(key)}
              >
                <strong>{task.title || 'Advisor task'}</strong>
                <small>{formatPlanDate(task.dueDate)}</small>
              </button>
            ))
          ) : (
            <p>No pending tasks with a deadline.</p>
          )}
        </WorkspaceSection>
      </aside>
    </div>
  );
}
