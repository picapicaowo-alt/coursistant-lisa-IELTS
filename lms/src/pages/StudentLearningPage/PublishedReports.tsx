import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ArrowRight, FileText} from 'lucide-react';
import {unwrapData, type MyPublishedReportParams} from '@/apis';
import {courseOperationsApiService as api} from '@/apis/services/course-operations-api';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {LearningEmpty, LearningQueryState} from '@/components/LearningWorkspace';
import {TeachingPagination} from '@/components/TeachingWorkspace';
import {optionalNumber, recordPage, textValue} from '@/utils/operationRecords';
import {PublishedReportDetail} from './CourseLearningDetails';
import {LEARNING_PAGE_SIZE, learningDate} from './learningData';
import s from './details.module.scss';
import common from './index.module.scss';

/** This feed includes reports independently of the current enrollment picker. */
export function PublishedReports({courseId}: {courseId?: number}) {
  const [page, setPage] = useState(0);
  const [reportType, setReportType] = useState<MyPublishedReportParams['reportType']>();
  const [selected, setSelected] = useState<{courseId: number; reportId: number}>();
  const reports = useQuery({
    queryKey: ['student-learning', 'published-reports', courseId, reportType, page],
    queryFn: async () => recordPage(unwrapData(await api.listMyPublishedReports({courseId, reportType, page, size: LEARNING_PAGE_SIZE}), 'published reports')),
    retry: false,
  });
  if (selected) return <PublishedReportDetail key={`${selected.courseId}-${selected.reportId}`} {...selected} onBack={() => setSelected(undefined)}/>;
  return <WorkspaceSection title="Published reports" appearance="record" summary="Your instructor’s feedback and next steps across your courses.">
    <label className={common.coursePicker}>
      <span>Report type</span>
      <select value={reportType ?? ''} onChange={event => {
        const value = event.target.value;
        setReportType(value === 'MID_TERM' || value === 'FINAL' ? value : undefined);
        setPage(0);
      }}>
        <option value="">All report types</option>
        <option value="MID_TERM">Mid-term</option>
        <option value="FINAL">Final</option>
      </select>
    </label>
    <LearningQueryState query={reports} errorMessage="Published reports could not be loaded."/>
    {reports.isSuccess && !reports.data.items.length ? <LearningEmpty icon={FileText} title="No published reports." description="Reports appear here after your instructor publishes them."/> : null}
    <div className={s.reports}>{reports.data?.items.map((item, index) => {
      const reportId = optionalNumber(item, 'id');
      const reportCourseId = optionalNumber(item, 'courseId');
      return <article key={reportId ?? index}>
        <span className={s.icon}><FileText size={24} aria-hidden="true"/></span>
        <div>
          <h3>{textValue(item, 'title') || (item.reportType === 'FINAL' ? 'Final report' : 'Mid-term report')}</h3>
          <p>{textValue(item, 'courseTitle', 'courseCode') || 'Course report'}</p>
          <p>Published {learningDate(textValue(item, 'publishedAt'))}</p>
        </div>
        {reportId != null && reportCourseId != null ? <button className={common.textButton} type="button" onClick={() => setSelected({courseId: reportCourseId, reportId})}>View report <ArrowRight size={16} aria-hidden="true"/></button> : null}
      </article>;
    })}</div>
    <TeachingPagination label="Published reports" page={page} size={LEARNING_PAGE_SIZE} total={reports.data?.total} count={reports.data?.items.length ?? 0} onChange={setPage} loading={reports.isFetching}/>
  </WorkspaceSection>;
}
