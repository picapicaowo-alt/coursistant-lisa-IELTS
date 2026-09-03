import {unwrapPageData} from '@/apis';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {COURSE_REPORT_TYPES, OPERATION_QUEUE_PAGE_SIZE as size} from '@/apis/types/operationQueues';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {QueryFeedback} from '@/components/QueryFeedback';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {formatZonedTimestamp} from '@/utils/contractTime';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import styles from './index.module.scss';

export function StudentReports({courseId}: {courseId?: number}) {
  const [page, setPage] = useState(0);
  const [reportType, setReportType] = useState<'' | typeof COURSE_REPORT_TYPES[number]>('');
  const [selected, setSelected] = useState<{courseId: number; id: number}>();
  const reports = useQuery({queryKey: ['me', 'student-reports', courseId, reportType, page], queryFn: async () => unwrapPageData(await courseOperationsApiService.listMyPublishedReports({page, size, courseId, reportType: reportType || undefined}), 'myPublishedReports'), retry: false});
  const detail = useQuery({queryKey: ['me', 'course-report', selected?.courseId, selected?.id], queryFn: async () => unwrapData(await courseOperationsApiService.getMyPublishedCourseReport(selected!.courseId, selected!.id), 'myPublishedReport'), enabled: selected != null, retry: false});
  return <WorkspaceSection title="Published reports">
    <label>Report type<select value={reportType} onChange={event => {const value = COURSE_REPORT_TYPES.find(type => type === event.target.value); setReportType(value ?? ''); setPage(0); setSelected(undefined);}}><option value="">All report types</option>{COURSE_REPORT_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
    <QueryFeedback pending={reports.isPending} error={reports.error} onRetry={() => void reports.refetch()}/>
    {reports.isSuccess ? <>
      {reports.data.items.length ? <div className={styles.list}>{reports.data.items.map(item => <article className={styles.row} key={`${item.courseId}-${item.id}`}><span><strong>{item.title || item.reportType?.replace(/_/g, ' ') || 'Course report'}</strong><small>{item.courseTitle || item.courseCode} · {formatZonedTimestamp(item.publishedAt)}</small></span>{item.id != null && item.courseId != null ? <button type="button" className={styles.secondary} onClick={() => setSelected({courseId: item.courseId!, id: item.id!})}>Open report</button> : null}</article>)}</div> : <p className={styles.empty}>No published reports match these filters.</p>}
      <AdvisingPagination label="Published report pages" page={page} size={size} total={reports.data.total} onPage={next => {setPage(next); setSelected(undefined);}}/>
    </> : null}
    {selected ? <section className={styles.detail} aria-label="Published report detail"><button type="button" onClick={() => setSelected(undefined)}>Close report</button><QueryFeedback pending={detail.isPending} error={detail.error} onRetry={() => void detail.refetch()}/>{detail.isSuccess ? <RecordSummaryList value={detail.data}/> : null}</section> : null}
  </WorkspaceSection>;
}
