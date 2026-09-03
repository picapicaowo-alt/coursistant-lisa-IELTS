import {useEffect, useId, useMemo, useRef, useState} from 'react';
import {CalendarDays, X} from 'lucide-react';
import type {StudyPlanAggregate} from '@/apis';
import {TASK_STATUS, taskStatusLabel, formatPlanDate} from '@/utils/studyPlan';
import styles from './LearningJourney.module.scss';

/** Read the published aggregate; edits stay in the version-protected plan editor. */
export function LearningJourney({plan, onEdit, checkpointTarget, taskTarget}: {plan: StudyPlanAggregate; onEdit: () => void; checkpointTarget: number; taskTarget: number}) {
  const checkpoints = useMemo(() => plan.checkpoints ?? [], [plan.checkpoints]);
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const checkpoint = selected == null ? undefined : checkpoints[selected];
  useEffect(() => {
    const index = checkpoints.findIndex(item => (checkpointTarget > 0 && item.id === checkpointTarget) || (taskTarget > 0 && item.tasks?.some(task => task.id === taskTarget)));
    if (index >= 0) setSelected(index);
  }, [checkpointTarget, taskTarget, checkpoints]);
  useEffect(() => {
    if (checkpoint && !dialog.current?.open) dialog.current?.showModal();
    else if (!checkpoint) dialog.current?.close();
  }, [checkpoint]);

  return <section className={styles.journey} aria-labelledby="learning-journey-title">
    <header className={styles.header}><div><h2 id="learning-journey-title">Learning journey</h2><p>{plan.strategySummary}</p></div><button type="button" onClick={onEdit}>Edit study plan</button></header>
    <div className={styles.phases}>
      {checkpoints.map((item, index) => {
        const tasks = item.tasks ?? [];
        const completed = tasks.filter(task => task.status === TASK_STATUS.completed).length;
        const hasKnownStatus = tasks.length > 0 && tasks.every(task => task.status != null);
        return <article key={item.id ?? index} className={styles.phase}>
          <div className={styles.phaseLabel}><span>Phase {String(index + 1).padStart(2, '0')}</span>{hasKnownStatus ? <span>{completed === tasks.length ? 'Completed' : tasks.some(task => task.status === TASK_STATUS.inProgress) ? 'In progress' : 'Not started'}</span> : null}</div>
          <h3>{item.goal || item.description || `Checkpoint ${index + 1}`}</h3>
          {item.goal && item.description ? <p>{item.description}</p> : null}
          {item.dueDate ? <p className={styles.date}><CalendarDays size={16} aria-hidden="true"/>{formatPlanDate(item.dueDate)}</p> : null}
          <div className={styles.progress}>{hasKnownStatus ? <><span>{completed} of {tasks.length} tasks completed</span><progress value={completed} max={tasks.length} aria-label={`Phase ${index + 1} progress`}/></> : <span>{tasks.length} tasks</span>}</div>
          <button type="button" onClick={() => setSelected(index)} aria-label={`View phase ${index + 1}`}>View detail</button>
        </article>;
      })}
      {!checkpoints.length ? <p>No checkpoints have been added yet.</p> : null}
    </div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onClose={() => setSelected(null)}>
      <div className={styles.dialogHeader}><h2 id={titleId}>{checkpoint?.goal || checkpoint?.description || 'Checkpoint tasks'}</h2><button type="button" aria-label="Close checkpoint" onClick={() => dialog.current?.close()}><X size={20}/></button></div>
      <div className={styles.taskList}>
        <div className={styles.tableHeading}><span>Task name</span><span>Deadline</span><span>Status</span></div>
        {(checkpoint?.tasks ?? []).map((task, index) => <article key={task.id ?? index} className={styles.task}>
          <div><h3>{task.title || `Task ${index + 1}`}</h3>{task.description ? <p>{task.description}</p> : null}{task.submissionRequirement ? <p>Submission: {task.submissionRequirement}</p> : null}{task.submissionText ? <p>Student submission: {task.submissionText}</p> : null}{task.advisorFeedback ? <p>Feedback: {task.advisorFeedback}</p> : null}</div>
          <span>{task.dueDate ? formatPlanDate(task.dueDate) : 'No deadline'}</span><span>{taskStatusLabel(task.status)}</span>
        </article>)}
        {!checkpoint?.tasks?.length ? <p>No tasks in this checkpoint.</p> : null}
      </div>
      <footer className={styles.dialogFooter}><button type="button" onClick={() => {dialog.current?.close(); onEdit();}}>Edit checkpoint &amp; tasks</button></footer>
    </dialog>
  </section>;
}
