import {useTranslation} from 'react-i18next';
import {useRef, useEffect, useState} from 'react';
import {generatePath, Link} from 'react-router-dom';
import {ChevronRight, ChevronDown} from 'lucide-react';
import type {AdvisorActionTaskResponse, AdvisorStudentSummaryResponse} from '@/apis';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {AdvisingBadge} from '@/components/AdvisingBadge';
import {UserAvatar} from '@/components/UserAvatar';
import {formatPersonName} from '@/utils/personName';
import {formatUtcTimestamp} from '@/utils/datetime';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {useActionTaskTransition} from './useActionTaskTransition';
import {AdvisorLearningSchedule} from './AdvisorLearningSchedule';
import type {AdvisorDashboardView, AdvisorConversationSummaryView, AdvisorScheduleRequestView} from './advisorViewModels';
import styles from './AdvisorDashboardOverview.module.scss';

const PRIORITY_ORDER: Record<string, number> = {HIGH: 0, MEDIUM: 1, LOW: 2};
const readableReason = (reason: string) => /^[A-Z_]+$/.test(reason)
  ? reason.replace(/_/g, ' ').toLowerCase().replace(/^./, letter => letter.toUpperCase()) : reason;

function formatTaskTime(task: AdvisorActionTaskResponse): string {
  const raw = task.createdAt || task.startedAt;
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true}).toLowerCase();
}

function ViewAll({to}: {to: string}) {
  const {t: translate} = useTranslation();
  return <Link className={styles.viewAll} to={to}>{translate("common:actions.viewAll")}</Link>;
}

export function AdvisorDashboardOverview({name, dashboard, students, tasks, conversations, schedule, loading, error, onRetry}: {
  name: string; dashboard: AdvisorDashboardView; students: AdvisorStudentSummaryResponse[];
  tasks: AdvisorActionTaskResponse[]; conversations: AdvisorConversationSummaryView[];
  schedule: AdvisorScheduleRequestView[]; loading: boolean; error: boolean; onRetry: () => void;
}) {
  const transition = useActionTaskTransition();
  const [period, setPeriod] = useState<'week' | 'month' | 'caseload'>('week');
  const attention = students.filter(student => student.riskStatus === 'NEEDS_ATTENTION' || student.riskStatus === 'AT_RISK')
    .sort((a, b) => (PRIORITY_ORDER[a.highestPriority ?? ''] ?? 3) - (PRIORITY_ORDER[b.highestPriority ?? ''] ?? 3));
  const progress = dashboard.stats.filter(stat => ['onTrackCount', 'atRiskCount', 'needsAttentionCount'].includes(stat.key));
  const total = progress.reduce((sum, stat) => sum + stat.value, 0);
  return <>
    <header className={styles.welcome}>
      <div className={styles.greeting}><UserAvatar className={styles.welcomeAvatar}/><h1>Welcome back, {name}!</h1></div>
      <div className={styles.summary}>{dashboard.stats.slice(0, 4).map(stat => <span key={stat.key} data-stat={stat.key}>{stat.label} <strong>{loading || error ? '—' : stat.value}</strong></span>)}</div>
    </header>
    {error ? <p role="alert" className={styles.error}>Some dashboard information could not be loaded. <button type="button" onClick={onRetry}>Retry</button></p> : null}
    <div className={styles.grid}>
      <div className={styles.column}>
        <WorkspaceSection title="Need Attention" meta={<ViewAll to={APP_ROUTE_PATHS.advisorStudents}/>} bodyClassName={styles.attentionBody}>
          {attention.length === 0 ? <p className={styles.empty}>{loading ? 'Loading students…' : 'No students currently need attention.'}</p> : attention.slice(0, 5).map((student, index) => <div className={styles.attentionRow} key={student.studentUserId}>
            <div className={styles.person}><UserAvatar userId={student.studentUserId} className={styles.avatar}/><div><strong>{formatPersonName(student, `Student #${student.studentUserId}`)}</strong><small>{student.targetGoal || ''}</small></div></div>
            <AdvisingBadge value={student.highestPriority}/>
            <div className={styles.reason}><span>{student.riskReasons?.[0] ? readableReason(student.riskReasons[0]) : 'Review student progress'}</span>{student.riskReasons && student.riskReasons.length > 1 ? <small>{student.riskReasons.slice(1).map(readableReason).join(' · ')}</small> : null}</div>
            <Link className={styles.viewButton} data-primary={index === 0 || undefined} to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdStudyPlan, {studentUserId: String(student.studentUserId)})}>View</Link>
          </div>)}
        </WorkspaceSection>
        <WorkspaceSection title="Tasks Due Today" meta={<ViewAll to={APP_ROUTE_PATHS.advisorTasks}/>} bodyClassName={styles.taskBody}>
          {transition.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(transition.error, 'The task could not be updated. Review its current state and try again.')}</p> : null}
          {tasks.length === 0 ? <p className={styles.empty}>{loading ? 'Loading tasks…' : 'No action tasks to show.'}</p> : tasks.slice(0, 4).map(task => {
            const taskCategory = task.status === 'IN_PROGRESS'
              ? 'ONGOING'
              : task.category === 'FOLLOW_UP'
                ? 'PLANNING'
                : task.category || 'REVIEW';
            return <div className={styles.taskRow} key={task.taskId}>
              <TaskCheckbox task={task} pending={transition.isPending} onChange={() => {if (task.taskId != null) transition.mutate({action: task.status === 'PENDING' ? 'start' : 'resolve', taskId: task.taskId, version: task.version});}}/>
              <i className={styles.categoryDot} data-category={task.category} aria-hidden="true"/>
              <Link className={styles.taskTitle} to={task.taskId == null ? APP_ROUTE_PATHS.advisorTasks : `${APP_ROUTE_PATHS.advisorTasks}?taskId=${task.taskId}`}><strong>{task.description || 'Review action task'}</strong><small>{formatPersonName(students.find(student => student.studentUserId === task.studentUserId), task.studentUserId ? `Student #${task.studentUserId}` : 'Advising task')}</small></Link>
              <AdvisingBadge value={taskCategory} kind="category"/>
              <span className={styles.taskTime}>{formatTaskTime(task)}</span>
            </div>;
          })}
        </WorkspaceSection>
        <WorkspaceSection title="Progress Overview" meta={
          <div className={styles.periodSelectWrapper}>
            <select
              className={styles.periodSelect}
              value={period}
              onChange={event => setPeriod(event.target.value as 'week' | 'month' | 'caseload')}
              aria-label="Progress time period"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="caseload">Current caseload</option>
            </select>
            <ChevronDown size={14} className={styles.periodChevron} aria-hidden="true"/>
          </div>
        }>
          <div className={styles.progressBar} aria-label="Student risk distribution">{progress.map(stat => <span key={stat.key} data-stat={stat.key} style={{flexGrow: stat.value}} title={`${stat.label}: ${stat.value}`}/>)}{total === 0 ? <span/> : null}</div>
          <dl className={styles.stats}>{progress.map(stat => <div key={stat.key} data-stat={stat.key}><dt>{stat.label}</dt><dd>{loading || error ? '—' : stat.value}</dd></div>)}</dl>
        </WorkspaceSection>
      </div>
      <div className={styles.column}>
        <AdvisorLearningSchedule/>
        <WorkspaceSection title="Recent Messages" meta={<ViewAll to={APP_ROUTE_PATHS.advisorMessages}/>} bodyClassName={styles.messagesBody}>
          {conversations.length === 0 ? <p className={styles.empty}>{loading ? 'Loading messages…' : 'No recent conversations.'}</p> : conversations.slice(0, 5).map(conversation => <Link className={styles.messageRow} data-unread={conversation.unreadCount > 0 || undefined} to={`${APP_ROUTE_PATHS.advisorMessages}?studentUserId=${conversation.studentUserId}`} key={conversation.studentUserId}>
            <UserAvatar userId={conversation.studentUserId} className={styles.avatar}/><div><strong>{conversation.studentName}</strong><small>{conversation.latestPreview || 'Start a conversation'}</small></div>
            {conversation.unreadCount > 0 ? <span className={styles.unread} aria-label={`${conversation.unreadCount} unread messages`}>{conversation.unreadCount}</span> : conversation.latestAt ? <time dateTime={conversation.latestAt}>{formatUtcTimestamp(conversation.latestAt)}</time> : null}
          </Link>)}
        </WorkspaceSection>
        {schedule.length > 0 ? <Link className={styles.requestSummary} to={APP_ROUTE_PATHS.advisorSchedule}><span><strong>Schedule requests</strong><small>{schedule.filter(request => request.status === 'PENDING').length} awaiting review</small></span><ChevronRight size={18}/></Link> : null}
      </div>
    </div>
  </>;
}

function TaskCheckbox({task, pending, onChange}: {task: AdvisorActionTaskResponse; pending: boolean; onChange: () => void}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {if (input.current) input.current.indeterminate = task.status === 'IN_PROGRESS';}, [task.status]);
  const label = task.status === 'PENDING' ? 'Start' : task.status === 'IN_PROGRESS' ? 'Resolve' : 'Completed';
  return <label className={styles.taskCheck}><input ref={input} type="checkbox" checked={task.status === 'RESOLVED'} disabled={pending || task.version == null || task.taskId == null || !['PENDING', 'IN_PROGRESS'].includes(task.status ?? '')} aria-label={`${label}: ${task.description || 'action task'}`} onChange={onChange}/></label>;
}
