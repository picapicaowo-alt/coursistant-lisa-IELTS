import {formatNumber} from '@/i18n/formatting';
import {useTranslation} from 'react-i18next';
import {AdvisingBadge} from '@/components/AdvisingBadge';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {CalendarDays, Check, Circle} from 'lucide-react';
import {asRecord, parentDate, parentLabel, parentRecords, parentText, withoutFields} from './parentPresentation';
import styles from './index.module.scss';

export function ParentStudyPlan({value}: {value: unknown}) {
  const {t: translate} = useTranslation();
  const root = asRecord(value);
  const plan = asRecord(root?.plan) ?? root;
  if (!plan) return <RecordSummaryList value={value} emptyMessage={translate("learning:parent.noPlan")}/>;
  const checkpoints = parentRecords(plan.checkpoints);
  const summary = parentText(plan, 'strategySummary');
  const start = parentText(plan, 'startDate');
  const end = parentText(plan, 'planEndDate');
  const other = withoutFields(plan, ['strategySummary', 'startDate', 'planEndDate', 'checkpoints']);
  return <>
    {summary ? <p className={styles.planSummary}>{summary}</p> : null}
    {start || end ? <p className={styles.planPeriod}><CalendarDays size={18} aria-hidden="true"/><span>{translate("learning:parent.activePeriod")}</span><strong>{start ? parentDate(start) : translate("learning:parent.noStart")} — {end ? parentDate(end) : translate("learning:parent.noEnd")}</strong></p> : null}
    {checkpoints.length ? <h3 className={styles.milestoneHeading}>{translate("learning:parent.milestones")}</h3> : null}
    {checkpoints.length ? <ol className={styles.checkpoints}>{checkpoints.map((checkpoint, index) => {
      const tasks = parentRecords(checkpoint.tasks);
      const due = parentText(checkpoint, 'dueDate');
      const status = parentText(checkpoint, 'derivedStatus');
      const complete = status === 'REACHED_COMPLETED';
      const details = withoutFields(checkpoint, ['description', 'title', 'goal', 'dueDate', 'derivedStatus', 'tasks', 'position']);
      return <li key={index} data-status={status}>
        <span className={styles.timelineMarker}>{complete ? <Check size={15} aria-hidden="true"/> : <Circle size={13} aria-hidden="true"/>}</span>
        <div className={styles.rowHeading}><h3>{formatNumber(index + 1)}. {parentText(checkpoint, 'description') || parentText(checkpoint, 'title') || translate('learning:parent.checkpoint', {number: formatNumber(index + 1)})}</h3>{status ? <AdvisingBadge kind="status" value={status} label={parentLabel(status)}/> : null}</div>
        {tasks.length ? <ul className={styles.planTasks}>{tasks.map((task, taskIndex) => <li key={taskIndex}>
          <div className={styles.taskHeading}><div><strong>{parentText(checkpoint, 'goal') || translate('learning:parent.task', {number: formatNumber(taskIndex + 1)})}</strong><span>{parentText(task, 'title') || parentText(task, 'description') || translate('learning:parent.task', {number: formatNumber(taskIndex + 1)})}</span></div>{due ? <span>{translate('assessment:attempt.deadline', {date: parentDate(due)})}</span> : null}</div>
          {parentText(task, 'status') ? <div className={styles.taskStatus}><AdvisingBadge kind="status" value={parentText(task, 'status')} label={parentLabel(parentText(task, 'status')!)}/></div> : null}
          <details className={styles.details}><summary>{translate("advising:actionTasks.details")}</summary><RecordSummaryList value={withoutFields(task, ['title', 'status'])}/></details>
        </li>)}</ul> : <p className={styles.meta}>{translate("learning:parent.noTasks")}</p>}
        {Object.keys(details).length ? <details className={styles.details}><summary>{translate("learning:parent.checkpointDetails")}</summary><RecordSummaryList value={details}/></details> : null}
      </li>;
    })}</ol> : <p className={styles.meta}>{translate("learning:parent.noCheckpoints")}</p>}
    {Object.keys(other).length ? <details className={styles.details}><summary>{translate("learning:parent.planDetails")}</summary><RecordSummaryList value={other}/></details> : null}
  </>;
}
