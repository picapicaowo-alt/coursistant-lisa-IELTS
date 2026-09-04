import {useSearchParams} from 'react-router-dom';
import {ProgressRing} from '@/components/ProgressRing';
import {AdvisorTasks} from './AdvisorTasks';
import type {StudentFacingProfileResponse, StudyPlanAggregate} from '@/apis';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {TASK_STATUS, formatPlanDate, taskStatusLabel} from '@/utils/studyPlan';
import {studyPlanRecordKey} from './studyPlanView';
import styles from './PlanOverview.module.scss';

export function PlanOverview({
  profile,
  plan,
  onCheckpoint,
}: {
  profile?: StudentFacingProfileResponse;
  plan?: StudyPlanAggregate;
  onCheckpoint: (key: string, taskId?: number) => void;
}) {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'tasks' ? 'tasks' : 'overview';
  const setView = (next: 'overview' | 'tasks') =>
    setParams((current) => {
      const updated = new URLSearchParams(current);
      if (next === 'tasks') updated.set('view', next);
      else updated.delete('view');
      return updated;
    });
  const checkpoints = plan?.checkpoints ?? [];
  const tasks = checkpoints.flatMap((checkpoint, index) =>
    (checkpoint.tasks ?? []).map((task) => ({
      task,
      checkpointKey: studyPlanRecordKey(checkpoint, index),
    })),
  );
  const completed = tasks.filter(
    ({task}) => task.status === TASK_STATUS.completed,
  ).length;
  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : null;
  return (
    <div className={styles.overview}>

      {view === 'overview' ? (
        <>
          <div className={styles.summary}>
            <section className={styles.goal} aria-label="Learning goal">
              <h2>My Learning Goal</h2>
              <p>
                {profile?.targetGoal ||
                  'Your advisor will help you set a learning goal.'}
              </p>
              <div className={styles.goalValues}>
                <div>
                  <span>Baseline assessment</span>
                  <strong>
                    {profile?.baselineAssessment || 'Not assessed'}
                  </strong>
                </div>
                <div>
                  <span>{profile?.targetMetric || 'Target'}</span>
                  <strong>{profile?.targetValue || 'Not set'}</strong>
                </div>
              </div>
              <div className={styles.progress}><ProgressRing value={progress} label="Advisor task completion" inverse/><small>{completed} of {tasks.length} tasks completed</small></div>
              <small>
                Target date ·{' '}
                {profile?.targetDate
                  ? formatPlanDate(profile.targetDate)
                  : 'Not set'}
              </small>
            </section>
            <WorkspaceSection
              appearance="record"
              title="Current Skills"
              summary="Current assessments and targets from your learning profile."
            >
              {(profile?.skills ?? []).length === 0 ? (
                <p>No skill assessments yet.</p>
              ) : (
                profile?.skills?.map((skill, index) => {
                  const current = skill.currentValue?.trim()
                    ? Number(skill.currentValue)
                    : NaN;
                  const target = skill.targetValue?.trim()
                    ? Number(skill.targetValue)
                    : NaN;
                  return (
                    <div
                      className={styles.skill}
                      key={skill.skillCode ?? index}
                    >
                      <strong>{skill.displayName || skill.skillCode}</strong>
                      <div>
                        <span>
                          Current <b>{skill.currentValue || '—'}</b>
                        </span>
                        <span>
                          Target <b>{skill.targetValue || '—'}</b>
                        </span>
                      </div>
                      {Number.isFinite(current) &&
                      Number.isFinite(target) &&
                      current >= 0 &&
                      target > 0 ? (
                        <meter
                          min={0}
                          max={target}
                          value={Math.min(current, target)}
                          aria-label={`${skill.displayName || skill.skillCode}: current value relative to target`}
                        />
                      ) : null}
                      <small>{skill.scale}</small>
                    </div>
                  );
                })
              )}
            </WorkspaceSection>
          </div>
          <div className={styles.journey}>
            <WorkspaceSection
              appearance="record"
              title="Learning Journey"
              summary={
                plan?.strategySummary ||
                'Your personalized roadmap and next checkpoints.'
              }
            >
              {checkpoints.length === 0 ? (
                <p>Your advisor has not added checkpoints yet.</p>
              ) : (
                checkpoints.map((checkpoint, index) => {
                  const done =
                    (checkpoint.tasks?.length ?? 0) > 0 &&
                    checkpoint.tasks?.every(
                      (task) => task.status === TASK_STATUS.completed,
                    );
                  return (
                    <button
                      type="button"
                      className={styles.checkpoint}
                      key={studyPlanRecordKey(checkpoint, index)}
                      onClick={() =>
                        onCheckpoint(studyPlanRecordKey(checkpoint, index))
                      }
                    >
                      <span
                        className={styles.step}
                        data-complete={done || undefined}
                      >
                        {index + 1}
                      </span>
                      <span>
                        <strong>
                          {checkpoint.description ||
                            checkpoint.goal ||
                            `Checkpoint ${index + 1}`}
                        </strong>
                        <small>{checkpoint.goal}</small>
                      </span>
                      <span>
                        <small>{checkpoint.tasks?.length ?? 0} tasks</small>
                        <small>{formatPlanDate(checkpoint.dueDate)}</small>
                      </span>
                      <img
                        src="/icons/figma-dashboard/arrow-right.svg"
                        alt=""
                      />
                    </button>
                  );
                })
              )}
            </WorkspaceSection>
            <WorkspaceSection
              appearance="record"
              title="Advisor Tasks"
              meta={
                <button type="button" onClick={() => setView('tasks')}>
                  View all
                </button>
              }
            >
              {tasks.length === 0 ? (
                <p>No advisor tasks yet.</p>
              ) : (
                tasks.slice(0, 4).map(({task, checkpointKey}, index) => (
                  <button
                    type="button"
                    className={styles.task}
                    key={task.id ?? index}
                    onClick={() => onCheckpoint(checkpointKey, task.id)}
                  >
                    <strong>
                      {task.title || task.description || 'Advisor task'}
                    </strong>
                    <small>{taskStatusLabel(task.status)}</small>
                    <small>{formatPlanDate(task.dueDate)}</small>
                  </button>
                ))
              )}
            </WorkspaceSection>
          </div>
        </>
      ) : (
        <AdvisorTasks plan={plan} onCheckpoint={onCheckpoint} />
      )}
    </div>
  );
}
