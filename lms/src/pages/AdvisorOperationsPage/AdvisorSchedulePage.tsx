import {useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';
import layout from './OperationsWorkspace.module.scss';
import {SCHEDULE_DECISIONS} from '@/apis';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {ADVISOR_PAGE_SIZE} from '@/apis/types/advisorWorkspace';
import {idempotencyFingerprint} from '@/hooks/useIdempotencyCheckpoint';
import {isConflict} from '@/utils/apiError';
import {InstructorAvailabilityPanel} from './InstructorAvailabilityPanel';
import {advisorScheduleRequestViews, type AdvisorScheduleRequestView} from './advisorViewModels';

export default function AdvisorSchedulePage() {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [searchParams] = useSearchParams();
  const [schedulePage, setSchedulePage] = useState(0);
  const [requestType, setRequestType] = useState('');
  const studentFilter = Number(searchParams.get('studentUserId')) || undefined;

  const [scheduleReview, setScheduleReview] = useState<AdvisorScheduleRequestView | null>(null);
  const [scheduleConflict, setScheduleConflict] = useState(false);
  const [scheduleDecision, setScheduleDecision] = useState('APPROVE');
  const [rejectionReason, setRejectionReason] = useState('');

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
      if (isConflict(error)) setScheduleConflict(true);
    },
    onSuccess: async () => {
      setScheduleConflict(false);
      setScheduleReview(null);
      setRejectionReason('');
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['advisor', 'schedule-requests']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'student-schedule-requests']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'student-hub']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'dashboard']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'owned-course-schedule']}),
      ]);
    },
  });

  const scheduleRows = advisorScheduleRequestViews(scheduleRequests.data);
  const scheduleError = scheduleRequests.error || scheduleMutation.error;
  return <div className={styles.page}>
    <header className={styles.header}><div><h1>Scheduling</h1><p className={styles.lede}>Review schedule requests and check instructor availability.</p></div><Link className={styles.secondaryLink} to={APP_ROUTE_PATHS.advisorOperations}>Back to dashboard</Link></header>
        <div className={layout.grid}><WorkspaceSection
          title="Schedule requests"
          id="schedule-requests"
          className={layout.primary}
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
              <Link to={APP_ROUTE_PATHS.advisorSchedule}>Show all students</Link>
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
                Student and parent requests will appear here for your review.
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
                  disabled={request.expectedVersion == null || (Boolean(request.status) && request.status !== 'PENDING')}
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
                        if (result.isError) return;
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
                    scheduleReview.expectedVersion == null ||
                    (Boolean(scheduleReview.status) && scheduleReview.status !== 'PENDING') ||
                    (scheduleDecision === 'REJECT' && !rejectionReason.trim())
                  }
                >
                  {scheduleMutation.isPending ? 'Saving…' : 'Save decision'}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={scheduleMutation.isPending}
                  onClick={() => setScheduleReview(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </WorkspaceSection>

        <InstructorAvailabilityPanel/>
        </div>
  </div>;
}
