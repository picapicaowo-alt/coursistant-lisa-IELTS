import React, {useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData, SCHEDULE_DECISIONS} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {WorkspaceSection as CollapsibleSection} from '@/components/WorkspaceSection';
import {AdvisorDashboardOverview} from './AdvisorDashboardOverview';
import {AdvisorInstructorPicker} from '@/components/AdvisorInstructorPicker';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import {
  ADVISOR_PAGE_SIZE,
  ACTION_TASK_TYPES,
} from '@/apis/types/advisorWorkspace';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorCode} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {actionTaskTargetPath} from './actionTaskTarget';
import {OwnedCourses} from './OwnedCourses';
import {
  advisorConversationViews,
  advisorDashboardView,
  advisorScheduleRequestViews,
  type AdvisorScheduleRequestView,
} from './advisorViewModels';
import styles from '../advising/advising.module.scss';
import opStyles from './AdvisorOperationsPage.module.scss';

const formatDateTime = (value?: string): string => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const AdvisorOperationsPage: React.FC = () => {
  const {user} = useRequiredAuth();
  const userName = user.name || 'Advisor';
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
    queryFn: async () =>
      unwrapData(
        await advisorApiService.listActionTasks({
          page: taskPage,
          size: ADVISOR_PAGE_SIZE,
          status: taskFilters.status || undefined,
          priority: taskFilters.priority || undefined,
          type: taskFilters.type || undefined,
          studentType: taskFilters.studentType || undefined,
        }),
        'advisorActionTasks'
      ),
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
    queryFn: async () =>
      unwrapData(
        await advisorApiService.listConversations(conversationPage, ADVISOR_PAGE_SIZE, {
          q: conversationSearch || undefined,
          unreadOnly,
        }),
        'advisorConversations'
      ),
    retry: false,
  });

  const scheduleRequests = useQuery({
    queryKey: ['advisor', 'schedule-requests', schedulePage, requestType, studentFilter],
    queryFn: async () =>
      unwrapData(
        await courseOperationsApiService.listAdvisorScheduleRequests({
          page: schedulePage,
          size: ADVISOR_PAGE_SIZE,
          requestType: requestType || undefined,
          studentUserId: studentFilter,
        }),
        'advisorScheduleRequests'
      ),
    retry: false,
  });

  const availability = useQuery({
    queryKey: ['advisor', 'instructor-availability', availabilityInstructorId],
    queryFn: async () =>
      unwrapData(
        await courseOperationsApiService.getAdvisorInstructorAvailability(availabilityInstructorId!),
        'advisorInstructorAvailability'
      ),
    enabled: availabilityInstructorId != null,
    retry: false,
  });

  const students = useQuery({
    queryKey: ['advisor', 'students-highlight'],
    queryFn: async () => unwrapData(await advisorApiService.listStudents(0, 10, {}), 'listAdvisorStudents'),
    retry: false,
  });

  const taskMutation = useMutation({
    mutationFn: ({action, taskId, version}: {action: 'start' | 'resolve'; taskId: number; version?: number}) =>
      action === 'start'
        ? advisorApiService.startActionTask(
            taskId,
            {expectedVersion: version},
            idempotency.keyFor(`start-task-${taskId}`, String(version))
          )
        : advisorApiService.resolveActionTask(
            taskId,
            {expectedVersion: version},
            idempotency.keyFor(`resolve-task-${taskId}`, String(version))
          ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['advisor', 'action-tasks']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'action-task']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'dashboard']}),
      ]);
    },
    onError: async () => {
      await queryClient.invalidateQueries({queryKey: ['advisor', 'action-tasks']});
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: (request: AdvisorScheduleRequestView) =>
      courseOperationsApiService.decideAdvisorScheduleRequest(
        request.requestId,
        {
          decision: scheduleDecision,
          expectedVersion: request.expectedVersion,
          rejectionReason: scheduleDecision === 'REJECT' ? rejectionReason : undefined,
        },
        idempotency.keyFor(
          `schedule-decision-${request.requestId}`,
          idempotencyFingerprint({version: request.expectedVersion, scheduleDecision, rejectionReason})
        )
      ),
    onError: error => {
      if (getApiErrorCode(error)?.endsWith('VERSION_CONFLICT')) setScheduleConflict(true);
    },
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
  const studentItems = students.data?.items ?? [];
  const tasksError = tasks.error || taskMutation.error;
  const scheduleError = scheduleRequests.error || scheduleMutation.error;

  return (
    <div className={opStyles.page}>
      <AdvisorDashboardOverview name={userName} dashboard={dashboardView} students={studentItems}
        tasks={tasks.data?.items ?? []} conversations={conversationRows} schedule={scheduleRows}
        loading={dashboard.isPending} error={dashboard.isError || students.isError || tasks.isError || conversations.isError || scheduleRequests.isError}/>
      {/* Operational Sections Container */}
      <div className={opStyles.operations}>
        <OwnedCourses/>
        {/* Action Tasks Management Section */}
        <CollapsibleSection
          title="Action tasks"
          id="action-tasks"
          className={styles.disclosureLayout}
          meta={<span className={styles.countBadge}>{tasks.data?.total ?? 0}</span>}
        >
          <div className={styles.formGrid}>
            <label>
              Status
              <select
                value={taskFilters.status}
                onChange={event => {
                  setTaskFilters(current => ({...current, status: event.target.value}));
                  setTaskPage(0);
                }}
              >
                <option value="">All statuses</option>
                <option>PENDING</option>
                <option>IN_PROGRESS</option>
                <option>RESOLVED</option>
              </select>
            </label>
            <label>
              Priority
              <select
                value={taskFilters.priority}
                onChange={event => {
                  setTaskFilters(current => ({...current, priority: event.target.value}));
                  setTaskPage(0);
                }}
              >
                <option value="">All priorities</option>
                <option>HIGH</option>
                <option>MEDIUM</option>
                <option>LOW</option>
              </select>
            </label>
            <label>
              Type
              <select
                value={taskFilters.type}
                onChange={event => {
                  setTaskFilters(current => ({...current, type: event.target.value}));
                  setTaskPage(0);
                }}
              >
                <option value="">All types</option>
                {ACTION_TASK_TYPES.map(type => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Student type
              <select
                value={taskFilters.studentType}
                onChange={event => {
                  setTaskFilters(current => ({...current, studentType: event.target.value}));
                  setTaskPage(0);
                }}
              >
                <option value="">All students</option>
                <option value="ACTIVE">Active</option>
                <option value="INTAKE">Intake</option>
                <option value="TRANSITION">Transition</option>
              </select>
            </label>
          </div>

          {tasksError ? (
            <p className={styles.error} role="alert">
              {advisingErrorMessage(tasksError, 'Action tasks could not be loaded.')}
            </p>
          ) : null}
          {tasks.isPending ? <p className={styles.status}>Loading action tasks…</p> : null}
          {!tasks.isPending && !tasks.isError && (tasks.data?.items.length ?? 0) === 0 ? (
            <div className={styles.emptyState}>
              <strong>No open action tasks match your filter</strong>
              <span>New items appear when checkpoints near deadlines or support tickets escalate.</span>
            </div>
          ) : null}

          <div className={styles.inboxList}>
            {(tasks.data?.items ?? []).map(task => (
              <article className={styles.inboxRow} key={task.taskId}>
                  <div className={styles.inboxMain}>
                    <div className={styles.rowTitle}>
                      <strong>{task.description || `Task #${task.taskId}`}</strong>
                      <span className={styles.statusPill}>{task.status || 'PENDING'}</span>
                      <span className={styles.statusPill}>{task.priority || 'MEDIUM'}</span>
                    </div>
                    <span>
                      {task.category || task.taskType || 'Advising task'}
                      {task.createdAt ? ` · ${formatDateTime(task.createdAt)}` : ''}
                    </span>
                  </div>
                  <div className={styles.actions}>
                    {task.taskId != null ? (
                      <button
                        type="button"
                        className={styles.secondary}
                        aria-expanded={selectedTaskId === task.taskId}
                        onClick={() => setSelectedTaskId(current => (current === task.taskId ? null : task.taskId!))}
                      >
                        Details
                      </button>
                    ) : null}
                    {actionTaskTargetPath(task.target) ? (
                      <Link className={styles.secondaryLink} to={actionTaskTargetPath(task.target)!}>
                        Open task record
                      </Link>
                    ) : null}
                    {task.status === 'PENDING' && task.taskId != null ? (
                      <button
                        type="button"
                        className={styles.secondary}
                        disabled={taskMutation.isPending}
                        onClick={() =>
                          taskMutation.mutate({action: 'start', taskId: task.taskId!, version: task.version})
                        }
                      >
                        Start
                      </button>
                    ) : null}
                    {task.status === 'IN_PROGRESS' && task.taskId != null ? (
                      <button
                        type="button"
                        className={styles.primary}
                        disabled={taskMutation.isPending}
                        onClick={() =>
                          taskMutation.mutate({action: 'resolve', taskId: task.taskId!, version: task.version})
                        }
                      >
                        Resolve
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
          </div>

          {selectedTaskId != null ? (
            <section className={styles.detailCard} aria-label="Task detail">
              <div className={styles.detailHeader}>
                <h2>Task details</h2>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setSelectedTaskId(null)}
                >
                  Close
                </button>
              </div>
              {taskDetail.isPending ? <p role="status">Loading task…</p> : null}
              {taskDetail.isError ? (
                <p className={styles.error} role="alert">
                  {advisingErrorMessage(taskDetail.error, 'This task is unavailable.')}
                </p>
              ) : null}
              {taskDetail.data ? (
                <>
                  <h3>{taskDetail.data.description || 'Action task'}</h3>
                  <p>
                    {taskDetail.data.status} · {taskDetail.data.priority}
                  </p>
                  <p>{taskDetail.data.createdAt ? `Created ${formatDateTime(taskDetail.data.createdAt)}` : ''}</p>
                  {taskDetail.data.resolvedAt ? (
                    <p>Resolved {formatDateTime(taskDetail.data.resolvedAt)}</p>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : null}

          <AdvisingPagination
            label="Action task pages"
            page={taskPage}
            total={tasks.data?.total ?? 0}
            onPage={setTaskPage}
          />
        </CollapsibleSection>

        {/* Student Conversations Management Section */}
        <CollapsibleSection
          title="Student conversations"
          id="conversations"
          className={styles.disclosureLayout}
          meta={<span className={styles.countBadge}>{conversations.data?.total ?? 0}</span>}
        >
          <div className={styles.form}>
            <label>
              Search conversations
              <input
                type="search"
                maxLength={100}
                value={conversationSearch}
                onChange={event => {
                  setConversationSearch(event.target.value);
                  setConversationPage(0);
                }}
              />
            </label>
            <label className={styles.inlineCheckbox}>
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={event => {
                  setUnreadOnly(event.target.checked);
                  setConversationPage(0);
                }}
              />
              Unread only
            </label>
          </div>

          {conversations.isError ? (
            <p className={styles.error} role="alert">
              {advisingErrorMessage(conversations.error, 'Conversations could not be loaded.')}
            </p>
          ) : null}
          {conversations.isPending ? <p className={styles.status}>Loading conversations…</p> : null}
          {!conversations.isPending && !conversations.isError && conversationRows.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>No assigned student conversations</strong>
              <span>Open the student queue to review assignments.</span>
            </div>
          ) : null}

          <div className={styles.inboxList}>
            {conversationRows.map(conversation => (
              <article className={styles.inboxRow} key={conversation.studentUserId}>
                <div className={styles.studentMark} aria-hidden="true">
                  {conversation.studentName.charAt(0).toUpperCase()}
                </div>
                <div className={styles.inboxMain}>
                  <div className={styles.rowTitle}>
                    <strong>{conversation.studentName}</strong>
                    {conversation.unreadCount > 0 ? (
                      <span className={styles.unreadBadge}>{conversation.unreadCount} unread</span>
                    ) : null}
                  </div>
                  <span>
                    {conversation.latestPreview ||
                      'No messages yet — start the conversation from the student workspace.'}
                  </span>
                  {conversation.latestAt ? <small>{formatDateTime(conversation.latestAt)}</small> : null}
                </div>
                <Link
                  className={styles.primaryLink}
                  to={`/advisor/students/${conversation.studentUserId}/support#conversation`}
                >
                  {conversation.hasThread ? 'Open conversation' : 'Start conversation'}
                </Link>
              </article>
            ))}
          </div>
          <AdvisingPagination
            label="Conversation pages"
            page={conversationPage}
            total={conversations.data?.total ?? 0}
            onPage={setConversationPage}
          />
        </CollapsibleSection>

        {/* Schedule Requests Section */}
        <CollapsibleSection
          title="Schedule requests"
          id="schedule-requests"
          className={styles.disclosureLayout}
          meta={<span className={styles.countBadge}>{scheduleRequests.data?.total ?? 0}</span>}
        >
          <div className={styles.form}>
            <label>
              Request type
              <select
                value={requestType}
                onChange={event => {
                  setRequestType(event.target.value);
                  setSchedulePage(0);
                }}
              >
                <option value="">All requests</option>
                <option>ABSENCE</option>
                <option>SCHEDULE_CHANGE</option>
              </select>
            </label>
          </div>
          {studentFilter ? (
            <p>
              Requests for student #{studentFilter} ·{' '}
              <Link to="/advisor/operations#schedule-requests">Show all students</Link>
            </p>
          ) : null}
          {scheduleError ? (
            <p className={styles.error} role="alert">
              {advisingErrorMessage(scheduleError, 'Schedule requests could not be loaded.')}
            </p>
          ) : null}
          {scheduleRequests.isPending ? <p className={styles.status}>Loading schedule requests…</p> : null}
          {!scheduleRequests.isPending && !scheduleRequests.isError && scheduleRows.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>No schedule requests are waiting</strong>
              <span>
                Student and parent requests will appear here with the record version required for a safe decision.
              </span>
            </div>
          ) : null}

          <div className={styles.inboxList}>
            {scheduleRows.map(request => (
              <article className={styles.inboxRow} key={request.requestId}>
                <div className={styles.inboxMain}>
                  <div className={styles.rowTitle}>
                    <strong>{request.studentName}</strong>
                    <span className={styles.statusPill}>{request.status || request.requestType || 'Pending'}</span>
                  </div>
                  <span>
                    {request.courseLabel}
                    {request.requestedDate ? ` · ${request.requestedDate}` : ''}
                    {request.requestedTime ? ` · ${request.requestedTime}` : ''}
                  </span>
                  {request.reason ? <small>{request.reason}</small> : null}
                </div>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={request.expectedVersion == null}
                  onClick={() => {
                    setScheduleReview(request);
                    setScheduleConflict(false);
                  }}
                >
                  Review request
                </button>
              </article>
            ))}
          </div>

          <AdvisingPagination
            label="Schedule request pages"
            page={schedulePage}
            total={scheduleRequests.data?.total ?? 0}
            onPage={setSchedulePage}
          />

          {scheduleReview ? (
            <form
              className={styles.reviewPanel}
              onSubmit={event => {
                event.preventDefault();
                scheduleMutation.mutate(scheduleReview);
              }}
            >
              <div>
                <strong>Review request #{scheduleReview.requestId}</strong>
                <span>
                  {scheduleReview.studentName} · version {scheduleReview.expectedVersion}
                </span>
              </div>
              {scheduleConflict ? (
                <div role="alert">
                  <p>The request changed. Your decision and reason are preserved.</p>
                  <button
                    type="button"
                    onClick={() =>
                      void scheduleRequests.refetch().then(result => {
                        const latest = advisorScheduleRequestViews(result.data).find(
                          item => item.requestId === scheduleReview.requestId
                        );
                        if (latest) {
                          setScheduleReview(latest);
                          setScheduleConflict(false);
                        } else if (!result.isError) setScheduleReview(null);
                      })
                    }
                  >
                    Load latest request
                  </button>
                </div>
              ) : null}
              <label>
                Decision
                <select
                  value={scheduleDecision}
                  onChange={event => setScheduleDecision(event.target.value)}
                >
                  {SCHEDULE_DECISIONS.map(decision => (
                    <option key={decision}>{decision}</option>
                  ))}
                </select>
              </label>
              {scheduleDecision === 'REJECT' ? (
                <label>
                  Reason
                  <textarea
                    required
                    value={rejectionReason}
                    onChange={event => setRejectionReason(event.target.value)}
                  />
                </label>
              ) : null}
              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.primary}
                  disabled={
                    scheduleMutation.isPending ||
                    scheduleConflict ||
                    (scheduleDecision === 'REJECT' && !rejectionReason.trim())
                  }
                >
                  {scheduleMutation.isPending ? 'Saving…' : 'Save decision'}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setScheduleReview(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </CollapsibleSection>

        {/* Instructor Availability Section */}
        <CollapsibleSection title="Instructor availability" className={styles.disclosureLayout}>
          <form
            className={styles.inlineLookup}
            onSubmit={event => {
              event.preventDefault();
              setAvailabilityInstructorId(Number(instructorId));
            }}
          >
            <AdvisorInstructorPicker required value={instructorId} onChange={setInstructorId} />
            <button
              type="submit"
              className={styles.primary}
              disabled={!Number(instructorId) || availability.isFetching}
            >
              Check availability
            </button>
          </form>

          {availability.isError ? (
            <p className={styles.error} role="alert">
              {advisingErrorMessage(availability.error, 'Instructor availability could not be loaded.')}
            </p>
          ) : null}
          {availability.data !== undefined ? (
            <div className={styles.compactResult}>
              <RecordSummaryList
                value={availability.data}
                emptyMessage="No availability is recorded for this instructor."
              />
            </div>
          ) : null}
        </CollapsibleSection>
      </div>
    </div>
  );
};

export default AdvisorOperationsPage;
