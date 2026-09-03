import {CollapsibleSection} from '@/components/CollapsibleSection';
import {getApiErrorCode} from '@/utils/apiError';
import {AdvisorInstructorPicker} from '@/components/AdvisorInstructorPicker';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import {ADVISOR_PAGE_SIZE, ACTION_TASK_TYPES} from '@/apis/types/advisorWorkspace';
import {OwnedCourses} from './OwnedCourses';
import {actionTaskTargetPath} from './actionTaskTarget';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import React, {useState} from 'react';
import {CalendarClock, ClipboardList, MessagesSquare, UserRoundCheck} from 'lucide-react';
import {Link, useSearchParams} from 'react-router-dom';
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

/** Dot colour per workload stat; keys follow the dashboard contract fields. */
const STAT_TONES: Record<string, 'brand' | 'ok' | 'risk' | 'attention'> = {
  assignedStudentCount: 'brand',
  onTrackCount: 'ok',
  atRiskCount: 'risk',
  needsAttentionCount: 'attention',
  pendingApprovalCount: 'risk',
  overdueFollowUpCount: 'attention',
};

const AdvisorOperationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [searchParams] = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskPage, setTaskPage] = useState(0);
  const [taskFilters, setTaskFilters] = useState({status: '', priority: '', type: '', studentType: ''});
  const [conversationPage, setConversationPage] = useState(0);
  const [conversationSearch, setConversationSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [schedulePage, setSchedulePage] = useState(0);
  const [requestType, setRequestType] = useState('');
  const studentFilter = Number(searchParams.get('studentUserId')) || undefined;

  const [scheduleReview, setScheduleReview] = useState<AdvisorScheduleRequestView | null>(null);
  const [scheduleConflict, setScheduleConflict] = useState(false);
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
    queryKey: ['advisor', 'action-tasks', taskPage, taskFilters],
    queryFn: async () => unwrapData(await advisorApiService.listActionTasks({page: taskPage, size: ADVISOR_PAGE_SIZE, status: taskFilters.status || undefined, priority: taskFilters.priority || undefined, type: taskFilters.type || undefined, studentType: taskFilters.studentType || undefined}), 'advisorActionTasks'),
    retry: false,
  });
  const taskDetail = useQuery({
    queryKey: ['advisor', 'action-task', selectedTaskId],
    queryFn: async () => unwrapData(await advisorApiService.getActionTask(selectedTaskId!), 'advisorActionTask'),
    enabled: selectedTaskId != null,
    retry: false,
  });
  const conversations = useQuery({
    queryKey: ['advisor', 'conversations', conversationPage, conversationSearch, unreadOnly],
    queryFn: async () => unwrapData(await advisorApiService.listConversations(conversationPage, ADVISOR_PAGE_SIZE, {q: conversationSearch || undefined, unreadOnly}), 'advisorConversations'),
    retry: false,
  });
  const scheduleRequests = useQuery({
    queryKey: ['advisor', 'schedule-requests', schedulePage, requestType, studentFilter],
    queryFn: async () => unwrapData(await courseOperationsApiService.listAdvisorScheduleRequests({page: schedulePage, size: ADVISOR_PAGE_SIZE, requestType: requestType || undefined, studentUserId: studentFilter}), 'advisorScheduleRequests'),
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
        ? advisorApiService.startActionTask(taskId, {expectedVersion: version}, idempotency.keyFor(`start-task-${taskId}`, String(version)))
        : advisorApiService.resolveActionTask(taskId, {expectedVersion: version}, idempotency.keyFor(`resolve-task-${taskId}`, String(version))),
    onSuccess: async () => {await Promise.all([
      queryClient.invalidateQueries({queryKey: ['advisor', 'action-tasks']}),
      queryClient.invalidateQueries({queryKey: ['advisor', 'action-task']}),
      queryClient.invalidateQueries({queryKey: ['advisor', 'dashboard']}),
    ]);},
    onError: async () => {await queryClient.invalidateQueries({queryKey: ['advisor', 'action-tasks']});},
  });
  const scheduleMutation = useMutation({
    mutationFn: (request: AdvisorScheduleRequestView) => courseOperationsApiService.decideAdvisorScheduleRequest(
      request.requestId,
      {
        decision: scheduleDecision,
        expectedVersion: request.expectedVersion,
        rejectionReason: scheduleDecision === 'REJECT' ? rejectionReason : undefined,
      },
      idempotency.keyFor(`schedule-decision-${request.requestId}`, idempotencyFingerprint({version: request.expectedVersion, scheduleDecision, rejectionReason})),
    ),
    onError: error => {if (getApiErrorCode(error)?.endsWith('VERSION_CONFLICT')) setScheduleConflict(true);},
    onSuccess: async () => {
      setScheduleConflict(false);
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
    <div className={styles.page}>
      <header className={styles.header}>
        <div>

          <h1>Today’s student work</h1>
          <p className={styles.lede}>Open a student to manage courses, support, reports, hours, and conversation history.</p>
        </div>
        <Link className={styles.primaryLink} to="/advisor/students">Open student queue</Link>
      </header>

      {dashboard.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(dashboard.error, 'Dashboard could not be loaded.')}</p> : null}
      <section className={styles.advisorStats} aria-label="Advisor workload summary">
        {dashboard.isPending ? <p className={styles.status}>Loading workload…</p> : dashboardView.stats.map(stat => (
          <article className={styles.advisorStat} data-tone={STAT_TONES[stat.key]} key={stat.key}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </section>

      <div className={styles.advisorColumns}>
        <CollapsibleSection title="Action tasks" icon={<ClipboardList/>} summary="Follow-ups and support tasks waiting on you." className={styles.disclosureLayout} count={tasks.data?.total ?? 0}>

          <div className={`${styles.form} ${styles.formGrid}`}>{(['status', 'priority', 'type', 'studentType'] as const).map(field => <label key={field}>{{status: 'Status', priority: 'Priority', type: 'Task type', studentType: 'Student type'}[field]}<select value={taskFilters[field]} onChange={event => {setTaskFilters(current => ({...current, [field]: event.target.value})); setTaskPage(0);}}><option value="">All</option>{(field === 'status' ? ['PENDING', 'IN_PROGRESS', 'RESOLVED'] : field === 'priority' ? ['HIGH', 'MEDIUM', 'LOW'] : field === 'studentType' ? ['VIP', 'STANDARD'] : ACTION_TASK_TYPES).map(value => <option key={value}>{value}</option>)}</select></label>)}</div>
          {tasksError ? <p className={styles.error} role="alert">{advisingErrorMessage(tasksError, 'Action tasks could not be loaded.')}</p> : null}
          {tasks.isPending ? <p className={styles.status}>Loading tasks…</p> : null}
          {!tasks.isPending && !tasks.isError && (tasks.data?.items.length ?? 0) === 0 ? <div className={styles.emptyState}><strong>No action tasks need attention</strong><span>New support and follow-up tasks will appear here.</span></div> : null}
          <div className={styles.inboxList}>
            {(tasks.data?.items ?? []).map((task, index) => (
              <article className={styles.inboxRow} key={task.taskId ?? index}>
                <div className={styles.inboxMain}>
                  <span className={styles.statusPill}>{task.priority || 'Normal'}</span>
                  <strong>{task.description || task.taskType || `Task #${task.taskId}`}</strong>
                  <small>{task.category || 'Student support'} · {task.status || 'Open'} · Student #{task.studentUserId ?? '—'}</small>
                </div>
                {task.taskId != null ? <div className={styles.actions}><button type="button" className={styles.secondary} aria-expanded={selectedTaskId === task.taskId} onClick={() => setSelectedTaskId(current => current === task.taskId ? null : task.taskId!)}>Details</button>
                  {actionTaskTargetPath(task.target) ? <Link className={styles.secondaryLink} to={actionTaskTargetPath(task.target)!}>Open task record</Link> : null}
                  <button className={styles.secondary} disabled={taskMutation.isPending || task.version == null || task.status !== 'PENDING'} onClick={() => taskMutation.mutate({action: 'start', taskId: task.taskId!, version: task.version})}>Start</button>
                  <button className={styles.primary} disabled={taskMutation.isPending || task.version == null || task.status === 'RESOLVED'} onClick={() => taskMutation.mutate({action: 'resolve', taskId: task.taskId!, version: task.version})}>Resolve</button>
                </div> : null}
              </article>
            ))}
          </div>
          {selectedTaskId != null ? <section className={styles.reviewPanel} aria-label="Action task details">
            {taskDetail.isPending ? <p role="status">Loading task…</p> : null}
            {taskDetail.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(taskDetail.error, 'This task is unavailable.')}</p> : null}
            {taskDetail.data ? <><h3>{taskDetail.data.description || 'Action task'}</h3><p>{taskDetail.data.status} · {taskDetail.data.priority}</p><p>{taskDetail.data.createdAt ? `Created ${formatDateTime(taskDetail.data.createdAt)}` : ''}</p>{taskDetail.data.resolvedAt ? <p>Resolved {formatDateTime(taskDetail.data.resolvedAt)}</p> : null}</> : null}
          </section> : null}
          <AdvisingPagination label="Action task pages" page={taskPage} total={tasks.data?.total ?? 0} onPage={setTaskPage}/>
        </CollapsibleSection>

        <CollapsibleSection title="Student conversations" id="conversations" icon={<MessagesSquare/>} summary="Threads with your assigned students; unread first." className={styles.disclosureLayout} count={conversations.data?.total ?? 0}>

          <div className={styles.form}><label>Search conversations<input type="search" maxLength={100} value={conversationSearch} onChange={event => {setConversationSearch(event.target.value); setConversationPage(0);}}/></label>
          <label className={styles.inlineCheckbox}><input type="checkbox" checked={unreadOnly} onChange={event => {setUnreadOnly(event.target.checked); setConversationPage(0);}}/>Unread only</label></div>
          {conversations.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(conversations.error, 'Conversations could not be loaded.')}</p> : null}
          {conversations.isPending ? <p className={styles.status}>Loading conversations…</p> : null}
          {!conversations.isPending && !conversations.isError && conversationRows.length === 0 ? <div className={styles.emptyState}><strong>No assigned student conversations</strong><span>Open the student queue to review assignments.</span></div> : null}
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
          <AdvisingPagination label="Conversation pages" page={conversationPage} total={conversations.data?.total ?? 0} onPage={setConversationPage}/>
        </CollapsibleSection>
      </div>

      <div className={styles.advisorColumns}>
      <CollapsibleSection title="Schedule requests" id="schedule-requests" icon={<CalendarClock/>} summary="Absence and reschedule requests awaiting a decision." className={styles.disclosureLayout} count={scheduleRequests.data?.total ?? 0}>

        <div className={styles.form}><label>Request type<select value={requestType} onChange={event => {setRequestType(event.target.value); setSchedulePage(0);}}><option value="">All requests</option><option>ABSENCE</option><option>SCHEDULE_CHANGE</option></select></label></div>
        {studentFilter ? <p>Requests for student #{studentFilter} · <Link to="/advisor/operations#schedule-requests">Show all students</Link></p> : null}
        {scheduleError ? <p className={styles.error} role="alert">{advisingErrorMessage(scheduleError, 'Schedule requests could not be loaded.')}</p> : null}
        {scheduleRequests.isPending ? <p className={styles.status}>Loading schedule requests…</p> : null}
        {!scheduleRequests.isPending && !scheduleRequests.isError && scheduleRows.length === 0 ? <div className={styles.emptyState}><strong>No schedule requests are waiting</strong><span>Student and parent requests will appear here with the record version required for a safe decision.</span></div> : null}
        <div className={styles.inboxList}>
          {scheduleRows.map(request => (
            <article className={styles.inboxRow} key={request.requestId}>
              <div className={styles.inboxMain}>
                <div className={styles.rowTitle}><strong>{request.studentName}</strong><span className={styles.statusPill}>{request.status || request.requestType || 'Pending'}</span></div>
                <span>{request.courseLabel}{request.requestedDate ? ` · ${request.requestedDate}` : ''}{request.requestedTime ? ` · ${request.requestedTime}` : ''}</span>
                {request.reason ? <small>{request.reason}</small> : null}
              </div>
              <button className={styles.primary} disabled={request.expectedVersion == null} onClick={() => {setScheduleReview(request); setScheduleConflict(false);}}>Review request</button>
            </article>
          ))}
        </div>
        <AdvisingPagination label="Schedule request pages" page={schedulePage} total={scheduleRequests.data?.total ?? 0} onPage={setSchedulePage}/>
        {scheduleReview ? (
          <form className={styles.reviewPanel} onSubmit={event => { event.preventDefault(); scheduleMutation.mutate(scheduleReview); }}>
            <div><strong>Review request #{scheduleReview.requestId}</strong><span>{scheduleReview.studentName} · version {scheduleReview.expectedVersion}</span></div>
            {scheduleConflict ? <div role="alert"><p>The request changed. Your decision and reason are preserved.</p><button type="button" onClick={() => void scheduleRequests.refetch().then(result => {const latest = advisorScheduleRequestViews(result.data).find(item => item.requestId === scheduleReview.requestId); if (latest) {setScheduleReview(latest); setScheduleConflict(false);} else if (!result.isError) setScheduleReview(null);})}>Load latest request</button></div> : null}
            <label>Decision<select value={scheduleDecision} onChange={event => setScheduleDecision(event.target.value)}>{SCHEDULE_DECISIONS.map(decision => <option key={decision}>{decision}</option>)}</select></label>
            {scheduleDecision === 'REJECT' ? <label>Reason<textarea required value={rejectionReason} onChange={event => setRejectionReason(event.target.value)}/></label> : null}
            <div className={styles.actions}>
              <button className={styles.primary} disabled={scheduleMutation.isPending || scheduleConflict || (scheduleDecision === 'REJECT' && !rejectionReason.trim())}>{scheduleMutation.isPending ? 'Saving…' : 'Save decision'}</button>
              <button type="button" className={styles.secondary} onClick={() => setScheduleReview(null)}>Cancel</button>
            </div>
          </form>
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection title="Instructor availability" icon={<UserRoundCheck/>} summary="Look up an instructor's recorded teaching slots." className={styles.disclosureLayout}>
        <form className={styles.inlineLookup} onSubmit={event => { event.preventDefault(); setAvailabilityInstructorId(Number(instructorId)); }}>
          <AdvisorInstructorPicker required value={instructorId} onChange={setInstructorId}/>
          <button className={styles.primary} disabled={!Number(instructorId) || availability.isFetching}>Check availability</button>
        </form>

        {availability.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(availability.error, 'Instructor availability could not be loaded.')}</p> : null}
        {availability.data !== undefined ? <div className={styles.compactResult}><RecordSummaryList value={availability.data} emptyMessage="No availability is recorded for this instructor."/></div> : null}
      </CollapsibleSection>
      </div>
      <OwnedCourses/>
    </div>
  );
};

export default AdvisorOperationsPage;
