import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {SCHEDULE_DECISIONS} from '@/apis';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {
  advisorConversationViews,
  advisorDashboardView,
  advisorScheduleRequestViews,
  type AdvisorScheduleRequestView,
} from './advisorViewModels';
import styles from '../advising/advising.module.scss';

const formatDateTime = (value?: string): string => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const AdvisorOperationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [scheduleReview, setScheduleReview] = useState<AdvisorScheduleRequestView | null>(null);
  const [scheduleDecision, setScheduleDecision] = useState('APPROVE');
  const [rejectionReason, setRejectionReason] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [availabilityInstructorId, setAvailabilityInstructorId] = useState<number | null>(null);

  const dashboard = useQuery({
    queryKey: ['advisor', 'dashboard'],
    queryFn: async () => unwrapData(await advisorApiService.getDashboard(), 'advisorDashboard'),
    retry: false,
  });
  const tasks = useQuery({
    queryKey: ['advisor', 'action-tasks'],
    queryFn: async () => unwrapData(await advisorApiService.listActionTasks({page: 0, size: 50}), 'advisorActionTasks'),
    retry: false,
  });
  const conversations = useQuery({
    queryKey: ['advisor', 'conversations'],
    queryFn: async () => unwrapData(await advisorApiService.listConversations(), 'advisorConversations'),
    retry: false,
  });
  const scheduleRequests = useQuery({
    queryKey: ['advisor', 'schedule-requests'],
    queryFn: async () => unwrapData(await courseOperationsApiService.listAdvisorScheduleRequests(), 'advisorScheduleRequests'),
    retry: false,
  });
  const availability = useQuery({
    queryKey: ['advisor', 'instructor-availability', availabilityInstructorId],
    queryFn: async () => unwrapData(
      await courseOperationsApiService.getAdvisorInstructorAvailability(availabilityInstructorId!),
      'advisorInstructorAvailability',
    ),
    enabled: availabilityInstructorId != null,
    retry: false,
  });

  const taskMutation = useMutation({
    mutationFn: ({action, taskId, version}: {action: 'start' | 'resolve'; taskId: number; version?: number}) =>
      action === 'start'
        ? advisorApiService.startActionTask(taskId, {expectedVersion: version})
        : advisorApiService.resolveActionTask(taskId, {expectedVersion: version}),
    onSuccess: async () => queryClient.invalidateQueries({queryKey: ['advisor', 'action-tasks']}),
  });
  const scheduleMutation = useMutation({
    mutationFn: (request: AdvisorScheduleRequestView) => courseOperationsApiService.decideAdvisorScheduleRequest(
      request.requestId,
      {
        decision: scheduleDecision,
        expectedVersion: request.expectedVersion,
        rejectionReason: scheduleDecision === 'REJECT' ? rejectionReason : undefined,
      },
    ),
    onSuccess: async () => {
      setScheduleReview(null);
      setRejectionReason('');
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['advisor', 'schedule-requests']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'dashboard']}),
      ]);
    },
  });

  const dashboardView = advisorDashboardView(dashboard.data);
  const conversationRows = advisorConversationViews(conversations.data);
  const scheduleRows = advisorScheduleRequestViews(scheduleRequests.data);
  const tasksError = tasks.error || taskMutation.error;
  const scheduleError = scheduleRequests.error || scheduleMutation.error;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Advisor work desk</p>
          <h1>Today’s student work</h1>
          <p className={styles.lede}>Open a student to manage courses, support, reports, hours, and conversation history.</p>
        </div>
        <Link className={styles.primaryLink} to="/advisor/students">Open student queue</Link>
      </header>

      {dashboard.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(dashboard.error, 'Dashboard could not be loaded.')}</p> : null}
      <section className={styles.advisorStats} aria-label="Advisor workload summary">
        {dashboard.isPending ? <p className={styles.status}>Loading workload…</p> : dashboardView.stats.map(stat => (
          <article className={styles.advisorStat} key={stat.key}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </section>

      <div className={styles.advisorColumns}>
        <section className={styles.card}>
          <div className={styles.sectionHeading}>
            <div><p className={styles.sectionKicker}>Work queue</p><h2>Action tasks</h2></div>
            <span className={styles.countBadge}>{tasks.data?.total ?? 0}</span>
          </div>
          {tasksError ? <p className={styles.error} role="alert">{advisingErrorMessage(tasksError, 'Action tasks could not be loaded.')}</p> : null}
          {tasks.isPending ? <p className={styles.status}>Loading tasks…</p> : null}
          {!tasks.isPending && (tasks.data?.items.length ?? 0) === 0 ? <div className={styles.emptyState}><strong>No action tasks need attention</strong><span>New support and follow-up tasks will appear here.</span></div> : null}
          <div className={styles.inboxList}>
            {(tasks.data?.items ?? []).map((task, index) => (
              <article className={styles.inboxRow} key={task.taskId ?? index}>
                <div className={styles.inboxMain}>
                  <span className={styles.statusPill}>{task.priority || 'Normal'}</span>
                  <strong>{task.description || task.taskType || `Task #${task.taskId}`}</strong>
                  <small>{task.category || 'Student support'} · {task.status || 'Open'} · Student #{task.studentUserId ?? '—'}</small>
                </div>
                {task.taskId != null ? <div className={styles.actions}>
                  {task.studentUserId != null ? <Link className={styles.secondaryLink} to={`/advisor/students/${task.studentUserId}/support`}>Open student</Link> : null}
                  <button className={styles.secondary} disabled={taskMutation.isPending || task.status === 'IN_PROGRESS'} onClick={() => taskMutation.mutate({action: 'start', taskId: task.taskId!, version: task.version})}>Start</button>
                  <button className={styles.primary} disabled={taskMutation.isPending || task.status === 'RESOLVED'} onClick={() => taskMutation.mutate({action: 'resolve', taskId: task.taskId!, version: task.version})}>Resolve</button>
                </div> : null}
              </article>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeading}>
            <div><p className={styles.sectionKicker}>Inbox</p><h2>Student conversations</h2></div>
            <span className={styles.countBadge}>{conversationRows.length}</span>
          </div>
          {conversations.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(conversations.error, 'Conversations could not be loaded.')}</p> : null}
          {conversations.isPending ? <p className={styles.status}>Loading conversations…</p> : null}
          {!conversations.isPending && conversationRows.length === 0 ? <div className={styles.emptyState}><strong>No assigned student conversations</strong><span>Open the student queue to review assignments.</span></div> : null}
          <div className={styles.inboxList}>
            {conversationRows.map(conversation => (
              <article className={styles.inboxRow} key={conversation.studentUserId}>
                <div className={styles.studentMark} aria-hidden="true">{conversation.studentName.charAt(0).toUpperCase()}</div>
                <div className={styles.inboxMain}>
                  <div className={styles.rowTitle}><strong>{conversation.studentName}</strong>{conversation.unreadCount > 0 ? <span className={styles.unreadBadge}>{conversation.unreadCount} unread</span> : null}</div>
                  <span>{conversation.latestPreview || 'No messages yet — start the conversation from the student workspace.'}</span>
                  {conversation.latestAt ? <small>{formatDateTime(conversation.latestAt)}</small> : null}
                </div>
                <Link className={styles.primaryLink} to={`/advisor/students/${conversation.studentUserId}/support#conversation`}>{conversation.hasThread ? 'Open conversation' : 'Start conversation'}</Link>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className={`${styles.card} ${styles.wideCard}`}>
        <div className={styles.sectionHeading}>
          <div><p className={styles.sectionKicker}>Approvals</p><h2>Schedule requests</h2></div>
          <span className={styles.countBadge}>{scheduleRows.length}</span>
        </div>
        {scheduleError ? <p className={styles.error} role="alert">{advisingErrorMessage(scheduleError, 'Schedule requests could not be loaded.')}</p> : null}
        {scheduleRequests.isPending ? <p className={styles.status}>Loading schedule requests…</p> : null}
        {!scheduleRequests.isPending && scheduleRows.length === 0 ? <div className={styles.emptyState}><strong>No schedule requests are waiting</strong><span>Student and parent requests will appear here with the record version required for a safe decision.</span></div> : null}
        <div className={styles.inboxList}>
          {scheduleRows.map(request => (
            <article className={styles.inboxRow} key={request.requestId}>
              <div className={styles.inboxMain}>
                <div className={styles.rowTitle}><strong>{request.studentName}</strong><span className={styles.statusPill}>{request.status || request.requestType || 'Pending'}</span></div>
                <span>{request.courseLabel}{request.requestedDate ? ` · ${request.requestedDate}` : ''}{request.requestedTime ? ` · ${request.requestedTime}` : ''}</span>
                {request.reason ? <small>{request.reason}</small> : null}
              </div>
              <button className={styles.primary} disabled={request.expectedVersion == null} onClick={() => setScheduleReview(request)}>Review request</button>
            </article>
          ))}
        </div>
        {scheduleReview ? (
          <form className={styles.reviewPanel} onSubmit={event => { event.preventDefault(); scheduleMutation.mutate(scheduleReview); }}>
            <div><strong>Review request #{scheduleReview.requestId}</strong><span>{scheduleReview.studentName} · version {scheduleReview.expectedVersion}</span></div>
            <label>Decision<select value={scheduleDecision} onChange={event => setScheduleDecision(event.target.value)}>{SCHEDULE_DECISIONS.map(decision => <option key={decision}>{decision}</option>)}</select></label>
            {scheduleDecision === 'REJECT' ? <label>Reason<textarea required value={rejectionReason} onChange={event => setRejectionReason(event.target.value)}/></label> : null}
            <div className={styles.actions}>
              <button className={styles.primary} disabled={scheduleMutation.isPending || (scheduleDecision === 'REJECT' && !rejectionReason.trim())}>{scheduleMutation.isPending ? 'Saving…' : 'Save decision'}</button>
              <button type="button" className={styles.secondary} onClick={() => setScheduleReview(null)}>Cancel</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className={`${styles.card} ${styles.wideCard}`}>
        <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Planning reference</p><h2>Instructor availability</h2></div></div>
        <form className={styles.inlineLookup} onSubmit={event => { event.preventDefault(); setAvailabilityInstructorId(Number(instructorId)); }}>
          <label>Instructor user ID<input required inputMode="numeric" value={instructorId} onChange={event => setInstructorId(event.target.value)}/></label>
          <button className={styles.primary} disabled={!Number(instructorId) || availability.isFetching}>Check availability</button>
        </form>
        <p className={styles.muted}>Use the instructor assigned to a one-to-one course. Instructor directory search is not available for Advisor accounts yet.</p>
        {availability.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(availability.error, 'Instructor availability could not be loaded.')}</p> : null}
        {availability.data !== undefined ? <div className={styles.compactResult}><RecordSummaryList value={availability.data} emptyMessage="No availability is recorded for this instructor."/></div> : null}
      </section>
    </main>
  );
};

export default AdvisorOperationsPage;
