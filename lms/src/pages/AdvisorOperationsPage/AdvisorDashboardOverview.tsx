import {generatePath, Link} from 'react-router-dom';
import type {
  AdvisorActionTaskResponse,
  AdvisorStudentSummaryResponse,
} from '@/apis';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {formatPersonName} from '@/utils/personName';
import type {
  AdvisorDashboardView,
  AdvisorConversationSummaryView,
  AdvisorScheduleRequestView,
} from './advisorViewModels';
import styles from './AdvisorDashboardOverview.module.scss';

export function AdvisorDashboardOverview({
  name,
  dashboard,
  students,
  tasks,
  conversations,
  schedule,
  loading,
  error,
}: {
  name: string;
  dashboard: AdvisorDashboardView;
  students: AdvisorStudentSummaryResponse[];
  tasks: AdvisorActionTaskResponse[];
  conversations: AdvisorConversationSummaryView[];
  schedule: AdvisorScheduleRequestView[];
  loading: boolean;
  error: boolean;
}) {
  const attention = students.filter(
    (student) =>
      student.riskStatus === 'NEEDS_ATTENTION' ||
      student.riskStatus === 'AT_RISK',
  );
  return (
    <>
      <header className={styles.welcome}>
        <h1>Welcome back, {name}!</h1>
        <div>
          {dashboard.stats.slice(0, 4).map((stat) => (
            <span key={stat.key}>
              {stat.label}{' '}
              <strong>{loading || error ? '—' : stat.value}</strong>
            </span>
          ))}
        </div>
      </header>
      {error ? (
        <p role="alert" className={styles.error}>
          Some dashboard information could not be loaded. Check the affected
          sections below.
        </p>
      ) : null}
      <div className={styles.grid}>
        <aside className={styles.assistant}>
          <h2>Your advising workspace</h2>
          <p>Review student progress and keep the next step clear.</p>
          <Link to={APP_ROUTE_PATHS.advisorStudents}>Review students</Link>
          <a href="#action-tasks">Review action tasks</a>
          <a href="#schedule-requests">Review schedule requests</a>
          <Link to={APP_ROUTE_PATHS.advisorMessages}>Open messages</Link>
          <small>
            AI advising assistance is not available for this workspace yet.
          </small>
        </aside>
        <div className={styles.column}>
          <WorkspaceSection
            title="Need Attention"
            meta={<Link to={APP_ROUTE_PATHS.advisorStudents}>View all</Link>}
          >
            {attention.length === 0 ? (
              <p>
                {loading
                  ? 'Loading students…'
                  : 'No flagged students in the current selection.'}
              </p>
            ) : (
              attention.slice(0, 5).map((student) => (
                <div className={styles.row} key={student.studentUserId}>
                  <div>
                    <strong>
                      {formatPersonName(
                        student,
                        `Student #${student.studentUserId}`,
                      )}
                    </strong>
                    <small>{student.targetGoal || 'Goal not set'}</small>
                    <small>
                      {student.riskReasons?.join(' · ') ||
                        student.riskStatus?.replace(/_/g, ' ')}
                    </small>
                  </div>
                  <Link
                    to={generatePath(
                      APP_ROUTE_PATHS.advisorStudentsStudentUserIdStudyPlan,
                      {studentUserId: String(student.studentUserId)},
                    )}
                  >
                    View
                  </Link>
                </div>
              ))
            )}
          </WorkspaceSection>
          <WorkspaceSection
            title="Action Tasks"
            meta={<a href="#action-tasks">View all</a>}
          >
            {tasks.length === 0 ? (
              <p>{loading ? 'Loading tasks…' : 'No action tasks to show.'}</p>
            ) : (
              tasks.slice(0, 4).map((task, index) => (
                <a
                  className={styles.row}
                  href="#action-tasks"
                  key={task.taskId ?? index}
                >
                  <div>
                    <strong>{task.description || 'Review action task'}</strong>
                    <small>{task.category || task.taskType}</small>
                  </div>
                  <span>{task.status?.replace(/_/g, ' ')}</span>
                </a>
              ))
            )}
          </WorkspaceSection>
          <WorkspaceSection title="Progress Overview">
            <dl className={styles.stats}>
              {dashboard.stats.slice(1).map((stat) => (
                <div key={stat.key}>
                  <dt>{stat.label}</dt>
                  <dd>{loading || error ? '—' : stat.value}</dd>
                </div>
              ))}
            </dl>
          </WorkspaceSection>
        </div>
        <div className={styles.column}>
          <WorkspaceSection
            title="Schedule Requests"
            meta={<a href="#schedule-requests">View all</a>}
          >
            {schedule.length === 0 ? (
              <p>
                {loading
                  ? 'Loading requests…'
                  : 'No schedule requests to show.'}
              </p>
            ) : (
              schedule.slice(0, 4).map((request) => (
                <a
                  className={styles.row}
                  href="#schedule-requests"
                  key={request.requestId}
                >
                  <div>
                    <strong>{request.studentName}</strong>
                    <small>{request.courseLabel}</small>
                    <small>
                      {[request.requestedDate, request.requestedTime]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </div>
                </a>
              ))
            )}
          </WorkspaceSection>
          <WorkspaceSection
            title="Recent Messages"
            meta={<Link to={APP_ROUTE_PATHS.advisorMessages}>View all</Link>}
          >
            {conversations.length === 0 ? (
              <p>
                {loading ? 'Loading messages…' : 'No recent conversations.'}
              </p>
            ) : (
              conversations.slice(0, 5).map((conversation) => (
                <Link
                  className={styles.row}
                  to={`${APP_ROUTE_PATHS.advisorMessages}?studentUserId=${conversation.studentUserId}`}
                  key={conversation.studentUserId}
                >
                  <div>
                    <strong>{conversation.studentName}</strong>
                    <small>
                      {conversation.latestPreview || 'Start a conversation'}
                    </small>
                  </div>
                  {conversation.unreadCount > 0 ? (
                    <span>{conversation.unreadCount} unread</span>
                  ) : null}
                </Link>
              ))
            )}
          </WorkspaceSection>
        </div>
      </div>
    </>
  );
}
