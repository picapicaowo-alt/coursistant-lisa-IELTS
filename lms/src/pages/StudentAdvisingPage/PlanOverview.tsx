import {formatNumber, formatNumericText} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import { useTranslation } from 'react-i18next';
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
  const { t: translate } = useTranslation();
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
            <section className={styles.goal} aria-label={translate("learning:plan.goalLabel")}>
              <h2>{translate("learning:plan.goal")}</h2>
              <p>
                {profile?.targetGoal ||
                  translate("learning:plan.noGoal")}
              </p>
              <div className={styles.goalValues}>
                <div>
                  <span>{translate("learning:plan.baseline")}</span>
                  <strong>
                    {profile?.baselineAssessment || translate("common:risk.notAssessed")}
                  </strong>
                </div>
                <div>
                  <span>{profile?.targetMetric || translate("learning:plan.target")}</span>
                  <strong>{formatNumericText(profile?.targetValue) || translate("assessment:submission.notSet")}</strong>
                </div>
              </div>
              <div className={styles.progress}><ProgressRing value={progress} label={translate("learning:plan.completion")} inverse/><small>{translate('learning:plan.completedTasks', {completed: formatNumber(completed), total: formatNumber(tasks.length)})}</small></div>
              <small>
                {translate('learning:plan.targetDate', {date: profile?.targetDate ? formatPlanDate(profile.targetDate) : translate('assessment:submission.notSet')})}
              </small>
            </section>
            <WorkspaceSection
              appearance="record"
              title={translate("learning:plan.skills")}
              summary={translate("learning:plan.skillsHelp")}
            >
              {(profile?.skills ?? []).length === 0 ? (
                <p>{translate("learning:plan.noSkills")}</p>
              ) : (
                profile?.skills?.map((skill, index) => {
                  const current = skill.currentValue?.trim()
                    ? Number(skill.currentValue)
                    : NaN;
                  const target = skill.targetValue?.trim()
                    ? Number(skill.targetValue)
                    : NaN;
                  const skillName = skill.displayName || statusLabel(skill.skillCode);
                  return (
                    <div
                      className={styles.skill}
                      key={skill.skillCode ?? index}
                    >
                      <strong>{skillName}</strong>
                      <div>
                        <span>
                          {translate("assessment:submission.current")}{' '}<b>{formatNumericText(skill.currentValue) || '—'}</b>
                        </span>
                        <span>
                          {translate("learning:plan.target")}{' '}<b>{formatNumericText(skill.targetValue) || '—'}</b>
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
                          aria-label={translate('learning:plan.skillProgress', {skill: skillName})}
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
              title={translate("learning:plan.journey")}
              summary={
                plan?.strategySummary ||
                translate("learning:plan.journeyHelp")
              }
            >
              {checkpoints.length === 0 ? (
                <p>{translate("learning:plan.noCheckpoints")}</p>
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
                        {formatNumber(index + 1)}
                      </span>
                      <span>
                        <strong>
                          {checkpoint.description ||
                            checkpoint.goal ||
                            translate('advising:studentTasks.checkpoint', {number: formatNumber(index + 1)})}
                        </strong>
                        <small>{checkpoint.goal}</small>
                      </span>
                      <span>
                        <small>{translate('learning:plan.taskCount', {count: checkpoint.tasks?.length ?? 0, number: formatNumber(checkpoint.tasks?.length ?? 0)})}</small>
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
              title={translate("dashboard:advisorTasks")}
              meta={
                <button type="button" onClick={() => setView('tasks')}>
                  {translate("common:actions.viewAll")}</button>
              }
            >
              {tasks.length === 0 ? (
                <p>{translate("learning:plan.noTasks")}</p>
              ) : (
                tasks.slice(0, 4).map(({task, checkpointKey}, index) => (
                  <button
                    type="button"
                    className={styles.task}
                    key={task.id ?? index}
                    onClick={() => onCheckpoint(checkpointKey, task.id)}
                  >
                    <strong>
                      {task.title || task.description || translate("advising:studentTasks.task")}
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
