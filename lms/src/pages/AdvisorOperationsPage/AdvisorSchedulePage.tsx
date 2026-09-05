import {isAdvisorSchedulePending} from '../advising/scheduleRequests';
import {InstructorAvailabilityPanel} from './InstructorAvailabilityPanel';
import {formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import { useTranslation } from 'react-i18next';
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
import {advisorScheduleRequestViews, type AdvisorScheduleRequestView} from './advisorViewModels';

export default function AdvisorSchedulePage() {
  const { t: translate } = useTranslation();
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
  const [invalidDecision, setInvalidDecision] = useState(false);

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
  return <div className={styles.page}>
    <header className={styles.header}><div><h1>{translate("navigation:scheduling")}</h1><p className={styles.lede}>{translate("advising:scheduling.description")}</p></div><Link className={styles.secondaryLink} to={APP_ROUTE_PATHS.advisorOperations}>{translate("course:detail.backToDashboard")}</Link></header>
        <div className={layout.grid}><WorkspaceSection
          title={translate("operations:scheduleRequests")}
          id="schedule-requests"
          className={layout.primary}
          meta={<span className={styles.countBadge}>{scheduleRequests.isError || scheduleRequests.isPending ? '—' : formatNumber(scheduleRequests.data?.total ?? 0)}</span>}
        >
          <div className={styles.form}>
            <label>
              {translate("operations:requestType")}<select
                value={requestType}
                onChange={event => {
                  setRequestType(event.target.value);
                  setSchedulePage(0);
                }}
              >
                <option value="">{translate("advising:scheduling.allRequests")}</option>
                <option value="ABSENCE">{statusLabel('ABSENCE')}</option>
                <option value="SCHEDULE_CHANGE">{statusLabel('SCHEDULE_CHANGE')}</option>
              </select>
            </label>
          </div>
          {studentFilter ? (
            <p>
              {translate("advising:scheduling.studentFilter", {id: formatNumber(studentFilter)})} ·{' '}
              <Link to={APP_ROUTE_PATHS.advisorSchedule}>{translate("advising:scheduling.allStudents")}</Link>
            </p>
          ) : null}
          {scheduleRequests.isError ? (
            <p className={styles.error} role="alert">
              {advisingErrorMessage(scheduleRequests.error, translate("advising:scheduling.failed"))}
            </p>
          ) : null}
          {scheduleRequests.isPending ? <p className={styles.status}>{translate("learning:schedule.loadingRequests")}</p> : null}
          {!scheduleRequests.isPending && !scheduleRequests.isError && scheduleRows.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>{translate("advising:scheduling.empty")}</strong>
              <span>
                {translate("advising:scheduling.emptyHelp")}</span>
            </div>
          ) : null}

          <div className={styles.inboxList}>
            {scheduleRows.map(request => (
              <article className={styles.inboxRow} key={request.requestId}>
                <div className={styles.inboxMain}>
                  <div className={styles.rowTitle}>
                    <strong>{request.studentName}</strong>
                    <span className={styles.statusPill}>{statusLabel(request.status || request.requestType || 'PENDING')}</span>
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
                  disabled={request.expectedVersion == null || !isAdvisorSchedulePending(request.status)}
                  onClick={() => {
                    setScheduleReview(request);
                    setScheduleConflict(false);
                  }}
                >
                  {translate("operations:reviewRequest")}</button>
              </article>
            ))}
          </div>

          <AdvisingPagination
            label={translate("advising:scheduling.pages")}
            page={schedulePage}
            total={scheduleRequests.data?.total ?? 0}
            onPage={setSchedulePage}
          />

          {scheduleReview ? (
            <form
              className={styles.reviewPanel}
              noValidate
              onSubmit={event => {
                event.preventDefault();
                setInvalidDecision(false);
                if (scheduleMutation.isPending || scheduleConflict || scheduleReview.expectedVersion == null || !isAdvisorSchedulePending(scheduleReview.status)) return;
                if (scheduleDecision === 'REJECT' && !rejectionReason.trim()) {setInvalidDecision(true); return;}
                scheduleMutation.mutate(scheduleReview);
              }}
            >
              <div>
                <strong>{translate("advising:scheduling.reviewNumber", {id: formatNumber(scheduleReview.requestId)})}</strong>
                <span>
                  {translate("advising:scheduling.studentVersion", {name: scheduleReview.studentName, version: scheduleReview.expectedVersion == null ? '—' : formatNumber(scheduleReview.expectedVersion)})}
                </span>
              </div>
              {invalidDecision ? <p className={styles.error} role="alert">{translate("advising:scheduling.requiredReason")}</p> : null}
              {scheduleMutation.isError && !scheduleConflict ? <p className={styles.error} role="alert">{advisingErrorMessage(scheduleMutation.error, translate("advising:scheduling.decisionFailed"))}</p> : null}
              {scheduleConflict ? (
                <div role="alert">
                  <p>{translate("advising:scheduling.conflict")}</p>
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
                    {translate("advising:scheduling.loadLatest")}</button>
                </div>
              ) : null}
              <label>
                {translate("operations:decision")}<select
                  value={scheduleDecision}
                  onChange={event => setScheduleDecision(event.target.value)}
                >
                  {SCHEDULE_DECISIONS.map(decision => (
                    <option key={decision} value={decision}>{statusLabel(decision)}</option>
                  ))}
                </select>
              </label>
              {scheduleDecision === 'REJECT' ? (
                <label>
                  {translate("common:fields.reason")}<textarea
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
                    !isAdvisorSchedulePending(scheduleReview.status) ||
                    (scheduleDecision === 'REJECT' && !rejectionReason.trim())
                  }
                >
                  {scheduleMutation.isPending ? translate("common:actions.saving") : translate("advising:scheduling.saveDecision")}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={scheduleMutation.isPending}
                  onClick={() => setScheduleReview(null)}
                >
                  {translate("common:actions.cancel")}</button>
              </div>
            </form>
          ) : null}
        </WorkspaceSection>

        <InstructorAvailabilityPanel />
        </div>
  </div>;
}
