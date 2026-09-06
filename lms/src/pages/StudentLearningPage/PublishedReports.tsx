import {useTranslation} from 'react-i18next';
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
  const {t: translate} = useTranslation();
  const [page, setPage] = useState(0);
  const [reportType, setReportType] = useState<MyPublishedReportParams['reportType']>();
  const [selected, setSelected] = useState<{courseId: number; reportId: number}>();
  const reports = useQuery({
    queryKey: ['student-learning', 'published-reports', courseId, reportType, page],
    queryFn: async () => recordPage(unwrapData(await api.listMyPublishedReports({courseId, reportType, page, size: LEARNING_PAGE_SIZE}), 'published reports')),
    retry: false,
  });
  if (selected) return <PublishedReportDetail key={`${selected.courseId}-${selected.reportId}`} {...selected} onBack={() => setSelected(undefined)}/>;
  return <WorkspaceSection title={translate("learning:reports.title")} appearance="record" summary={translate('learning:reports.feedSummary')}>
    <label className={common.coursePicker}>
      <span>{translate("operations:reportType")}</span>
      <select value={reportType ?? ''} onChange={event => {
        const value = event.target.value;
        setReportType(value === 'MID_TERM' || value === 'FINAL' ? value : undefined);
        setPage(0);
      }}>
        <option value="">{translate('learning:reports.allTypes')}</option>
        <option value="MID_TERM">{translate('operations:midTermReport')}</option>
        <option value="FINAL">{translate('operations:finalReport')}</option>
      </select>
    </label>
    <LearningQueryState query={reports} errorMessage={translate('learning:reports.loadFailed')}/>
    {reports.isSuccess && !reports.data.items.length ? <LearningEmpty icon={FileText} title={translate("learning:reports.none")} description={translate('learning:reports.feedEmptyHelp')}/> : null}
    <div className={s.reports}>{reports.data?.items.map((item, index) => {
      const reportId = optionalNumber(item, 'id');
      const reportCourseId = optionalNumber(item, 'courseId');
      return <article key={reportId ?? index}>
        <span className={s.icon}><FileText size={24} aria-hidden="true"/></span>
        <div>
          <h3>{textValue(item, 'title') || (item.reportType === 'FINAL' ? translate("operations:finalReport") : translate("operations:midTermReport"))}</h3>
          <p>{textValue(item, 'courseTitle', 'courseCode') || translate("operations:legacy.courseReport")}</p>
          <p>{translate('common:records.publishedAt', {date: learningDate(textValue(item, 'publishedAt'))})}</p>
        </div>
        {reportId != null && reportCourseId != null ? <button className={common.textButton} type="button" onClick={() => setSelected({courseId: reportCourseId, reportId})}>{translate("common:navigationControls.viewReport")}{' '}<ArrowRight size={16} aria-hidden="true"/></button> : null}
      </article>;
    })}</div>
    <TeachingPagination label={translate("learning:reports.title")} page={page} size={LEARNING_PAGE_SIZE} total={reports.data?.total} count={reports.data?.items.length ?? 0} onChange={setPage} loading={reports.isFetching}/>
  </WorkspaceSection>;
}
