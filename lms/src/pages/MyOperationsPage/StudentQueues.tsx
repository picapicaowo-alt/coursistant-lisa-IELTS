import {unwrapPageData} from '@/apis';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {SCHEDULE_REQUEST_TYPES} from '@/apis';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {OPERATION_QUEUE_PAGE_SIZE as size, SCHEDULE_REQUEST_STATUSES, WORK_QUEUE_MAX_OFFSET} from '@/apis/types/operationQueues';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {QueryFeedback} from '@/components/QueryFeedback';
import {registeredDestination} from '@/utils/registeredDestination';
import {contractClock, formatZonedTimestamp} from '@/utils/contractTime';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import styles from './index.module.scss';

export function StudentWorkQueue() {
  const [page, setPage] = useState(0);
  const query = useQuery({queryKey: ['me', 'work-queue', page], queryFn: async () => unwrapPageData(await courseOperationsApiService.getMyWorkQueue({page, size}), 'myWorkQueue'), retry: false});
  return <WorkspaceSection title="Work queue" className={styles.supportRegion}>
    <QueryFeedback pending={query.isPending} error={query.error} onRetry={() => void query.refetch()}/>
    {query.isSuccess ? <>
      {/* Preserve the server's urgency/time ordering across page boundaries. */}
      {query.data.items.length ? <div className={styles.operationList}>{query.data.items.map((item, index) => {
        const destination = registeredDestination(item.deepLink);
        const content = <span><strong>{item.title || item.sourceType?.replace(/_/g, ' ') || 'Learning update'}</strong><small>{[item.courseTitle, item.urgency, item.actionAtUtc ? formatZonedTimestamp(item.actionAtUtc, item.timezone) : undefined].filter(Boolean).join(' · ')}</small>{item.description ? <small>{item.description}</small> : null}</span>;
        const key = `${item.sourceType}-${item.assignmentId ?? item.taskId ?? item.notificationId ?? item.occurrenceId ?? index}`;
        return destination ? <Link className={styles.operationRow} key={key} to={destination}>{content}</Link> : <article className={styles.operationRow} key={key}>{content}</article>;
      })}</div> : <p className={styles.empty}>Nothing needs attention.</p>}
      <AdvisingPagination label="Work queue pages" page={page} size={size} total={query.data.total} onPage={setPage} maxOffset={WORK_QUEUE_MAX_OFFSET}/>
    </> : null}
  </WorkspaceSection>;
}

export function StudentScheduleRequests({courseId}: {courseId?: number}) {
  const [page, setPage] = useState(0);
  const [requestType, setRequestType] = useState('');
  const [status, setStatus] = useState('');
  const query = useQuery({queryKey: ['me', 'schedule-requests', courseId, page, requestType, status], queryFn: async () => unwrapPageData(await courseOperationsApiService.getMyScheduleRequests({page, size, courseId, requestType: requestType || undefined, status: status || undefined}), 'myScheduleRequests'), retry: false});
  return <WorkspaceSection title="Schedule requests" className={styles.supportRegion}>
    <div className={styles.actions}>
      <label>Request type<select value={requestType} onChange={event => {setRequestType(event.target.value); setPage(0);}}><option value="">All types</option>{SCHEDULE_REQUEST_TYPES.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Request status<select value={status} onChange={event => {setStatus(event.target.value); setPage(0);}}><option value="">All statuses</option>{SCHEDULE_REQUEST_STATUSES.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <QueryFeedback pending={query.isPending} error={query.error} onRetry={() => void query.refetch()}/>
    {query.isSuccess ? <>
      {query.data.items.length ? <div className={styles.operationList}>{query.data.items.map(item => <article className={styles.operationRow} key={item.id}><span><strong>{item.courseTitle || item.courseCode || 'Course'}</strong><small>{[item.requestType?.replace(/_/g, ' '), item.status?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}</small><small>{item.occurrenceDate} {contractClock(item.startTime)}–{contractClock(item.endTime)} {item.timezone}</small></span></article>)}</div> : <p className={styles.empty}>No schedule requests match these filters.</p>}
      <AdvisingPagination label="Student schedule request pages" page={page} size={size} total={query.data.total} onPage={setPage}/>
    </> : null}
  </WorkspaceSection>;
}
