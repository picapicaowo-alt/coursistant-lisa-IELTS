import {formatNumber, formatDateTime, formatClockTime} from '@/i18n/formatting';
import {recordFieldLabel} from '@/components/RecordSummaryList/recordPresentation';
import {useTranslation} from 'react-i18next';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {addMonths, format, startOfMonth} from 'date-fns';
import {ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, FileText} from 'lucide-react';
import {unwrapData} from '@/apis';
import {courseOperationsApiService as api} from '@/apis/services/course-operations-api';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {LearningEmpty, LearningQueryState} from '@/components/LearningWorkspace';
import {TeachingPagination} from '@/components/TeachingWorkspace';
import {record, recordPage, optionalNumber, textValue} from '@/utils/operationRecords';
import {LEARNING_PAGE_SIZE, learningDate, scheduleOccurrence} from './learningData';
import {getApiErrorCode, isNotFound} from '@/utils/apiError';
import {ScheduleChangeForm} from './ScheduleChangeForm';
import s from './details.module.scss';
import common from './index.module.scss';

const REPORT_SECTIONS = ['overallSummary', 'skillEvaluation', 'strengths', 'weaknesses', 'improvementSuggestions'] as const;

export function CourseLearningDetails({courseId}: {courseId: number}) {
  const {t: translate} = useTranslation();
  const [tab, setTab] = useState<'reports' | 'schedule'>('reports');
  const [page, setPage] = useState(0);
  const [reportId, setReportId] = useState<number>();
  const hours = useQuery({queryKey: ['student-learning', courseId, 'hours'], queryFn: async () => record(unwrapData(await api.getMyCourseHours(courseId), 'course hours')), retry: false});
  const hoursNotConfigured = isNotFound(hours.error) && getApiErrorCode(hours.error) === 'COURSE_HOURS_NOT_FOUND';
  const reports = useQuery({queryKey: ['student-learning', courseId, 'reports', page], queryFn: async () => recordPage(unwrapData(await api.listMyPublishedCourseReports(courseId, page + 1, LEARNING_PAGE_SIZE), 'published reports')), enabled: tab === 'reports', retry: false});
  if (reportId != null) return <PublishedReportDetail courseId={courseId} reportId={reportId} onBack={() => setReportId(undefined)}/>;
  return <div className={s.details}>
    <WorkspaceSection title={translate("learning:hours.title")} appearance="record" className={s.hours}>
      {hoursNotConfigured ? <LearningEmpty title={translate("learning:hours.notConfigured")}/> : <LearningQueryState query={hours} errorMessage={translate("advising:support.hoursFailed")}/>}
      {hours.isSuccess ? <dl className={s.balances}>{[{key: 'purchasedMinutes', labelKey: 'learning:hours.purchased'}, {key: 'usedMinutes', labelKey: 'learning:hours.used'}, {key: 'remainingMinutes', labelKey: 'learning:hours.remaining'}].map(item => {const value = hours.data[item.key]; return <div key={item.key}><dt>{translate(item.labelKey)}</dt><dd>{typeof value === 'number' && Number.isFinite(value) ? formatNumber(value / 60, {maximumFractionDigits: 1}) : '—'}<span>{translate("learning:hours.unit")}</span></dd></div>;})}</dl> : null}
    </WorkspaceSection>
    <nav className={common.tabs} aria-label={translate("learning:schedule.details")}><button type="button" aria-pressed={tab === 'reports'} onClick={() => setTab('reports')}>{translate("learning:reports.title")}</button><button type="button" aria-pressed={tab === 'schedule'} onClick={() => setTab('schedule')}>{translate("learning:schedule.changes")}</button></nav>
    {tab === 'schedule' ? <CourseScheduleChanges courseId={courseId}/> : <WorkspaceSection title={translate("learning:reports.title")} summary={translate("learning:reports.description")} appearance="record">
      <LearningQueryState query={reports} errorMessage={translate("learning:reports.loadFailed")}/>
      {reports.isSuccess && !reports.data.items.length ? <LearningEmpty icon={FileText} title={translate("learning:reports.none")} description={translate("learning:reports.noneHelp")}/> : null}
      <div className={s.reports}>{reports.data?.items.map((item, index) => {const id = optionalNumber(item, 'id', 'reportId'); return <article key={id ?? index}><span className={s.icon}><FileText size={24}/></span><div><h3>{textValue(item, 'title') || (item.reportType === 'FINAL' ? translate("operations:finalReport") : translate("operations:midTermReport"))}</h3><p>{translate('common:records.publishedAt', {date: learningDate(textValue(item, 'publishedAt'))})}</p></div>{id ? <button type="button" className={common.textButton} onClick={() => setReportId(id)}>{translate('common:navigationControls.viewReport')} </button> : null}</article>;})}</div>
      <TeachingPagination label={translate("learning:reports.title")} page={page} size={LEARNING_PAGE_SIZE} total={reports.data?.total} count={reports.data?.items.length ?? 0} onChange={setPage} loading={reports.isFetching}/>
    </WorkspaceSection>}
  </div>;
}

function CourseScheduleChanges({courseId}: {courseId: number}) {
  const {t: translate} = useTranslation();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedId, setSelectedId] = useState<number>();
  const [submitted, setSubmitted] = useState(false);
  const from = format(month, 'yyyy-MM-dd');
  const to = format(addMonths(month, 1), 'yyyy-MM-dd');
  const query = useQuery({queryKey: ['student-learning', 'schedule', from, to], queryFn: async () => recordPage(unwrapData(await api.getMyCalendar({from, to, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone}), 'class calendar')).items, retry: false});
  const rows = (query.data ?? []).filter(item => optionalNumber(item, 'courseId') === courseId && optionalNumber(item, 'occurrenceId', 'sessionOccurrenceId')).map(scheduleOccurrence);
  const selected = rows.find(item => optionalNumber(item, 'occurrenceId', 'sessionOccurrenceId') === selectedId);
  return <div className={s.scheduleLayout}>
    <WorkspaceSection title={translate("learning:schedule.chooseClass")} appearance="record" summary={translate("learning:schedule.chooseClassHelp")}>
      <div className={s.monthNavigation}><button type="button" aria-label={translate('common:dateTime.previousMonth')} title={translate('common:dateTime.previousMonth')} onClick={() => {setSelectedId(undefined); setMonth(current => addMonths(current, -1));}}><ChevronLeft size={18} aria-hidden="true"/></button><strong>{formatDateTime(month, {month: 'long', year: 'numeric'})}</strong><button type="button" aria-label={translate('common:dateTime.nextMonth')} title={translate('common:dateTime.nextMonth')} onClick={() => {setSelectedId(undefined); setMonth(current => addMonths(current, 1));}}><ChevronRight size={18} aria-hidden="true"/></button></div>
      <LearningQueryState query={query} errorMessage={translate("learning:schedule.loadFailed")}/>
      {query.isSuccess && !rows.length ? <LearningEmpty icon={CalendarDays} title={translate("learning:schedule.noMonthClasses")} description={translate("learning:schedule.noMonthClassesHelp")}/> : null}
      <div className={s.classList}>{rows.map(item => {const id = optionalNumber(item, 'occurrenceId', 'sessionOccurrenceId')!; return <button type="button" className={s.classOption} aria-pressed={selectedId === id} key={id} onClick={() => {setSelectedId(id); setSubmitted(false);}}><CalendarDays size={22}/><span><strong>{textValue(item, 'title', 'courseTitle') || translate("learning:schedule.class")}</strong><small>{learningDate(textValue(item, 'occurrenceDate', 'date'))} · {formatClockTime(textValue(item, 'startTime') ?? '')}{textValue(item, 'endTime') ? `–${formatClockTime(textValue(item, 'endTime')!)}` : ''}</small>{textValue(item, 'timezone') ? <small>{textValue(item, 'timezone')}</small> : null}</span><ArrowRight size={17}/></button>;})}</div>
    </WorkspaceSection>
    <WorkspaceSection title={submitted ? translate("learning:schedule.submitted") : translate("learning:schedule.title")} appearance="record">
      {submitted ? <><p className={s.note} role="status">{translate("learning:schedule.submittedHelp")}</p><p className={s.note}>{translate("learning:schedule.checkStatus")}</p></> : selected && selectedId ? <ScheduleChangeForm key={selectedId} courseId={courseId} occurrenceId={selectedId} occurrence={selected} onSubmitted={() => {setSelectedId(undefined); setSubmitted(true);}}/> : <LearningEmpty icon={BookOpen} title={translate("learning:schedule.selectFirst")} description={translate("learning:schedule.selectFirstHelp")}/>}
    </WorkspaceSection>
  </div>;
}

export function PublishedReportDetail({courseId, reportId, onBack}: {courseId: number; reportId: number; onBack: () => void}) {
  const {t: translate} = useTranslation();
  const report = useQuery({queryKey: ['student-learning', courseId, 'report', reportId], queryFn: async () => record(unwrapData(await api.getMyPublishedCourseReport(courseId, reportId), 'published report')), retry: false});
  const snapshotValue = report.data?.performanceSnapshot;
  const snapshot = snapshotValue && typeof snapshotValue === 'object' && !Array.isArray(snapshotValue) ? record(snapshotValue) : undefined;
  return <WorkspaceSection title={textValue(report.data ?? {}, 'title') || translate("learning:reports.publishedReport")} summary={textValue(report.data ?? {}, 'publishedAt') ? translate('common:records.publishedAt', {date: learningDate(textValue(report.data!, 'publishedAt'))}) : undefined} appearance="record" meta={<button className={common.textButton} onClick={onBack} type="button">{translate('common:navigationControls.backToReports')}</button>}>
    <LearningQueryState query={report}/>
    {report.isSuccess ? <div className={s.report}>{REPORT_SECTIONS.map(section => textValue(report.data, section) ? <section key={section}><h3>{recordFieldLabel(section)}</h3><p>{textValue(report.data, section)}</p></section> : null)}{!REPORT_SECTIONS.some(section => textValue(report.data, section)) ? <LearningEmpty icon={FileText} title={translate("learning:reports.noEvaluation")}/> : null}</div> : null}
    {snapshot ? <section className={s.snapshot}><h3>{translate("learning:reports.performance")}</h3><dl>{['completedSessionCount', 'presentCount', 'absentCount', 'approvedAbsenceCount', 'unapprovedAbsenceCount', 'assignmentCount', 'submittedCount', 'releasedGradeCount', 'releasedScoreAverage'].map(key => typeof snapshot[key] === 'number' ? <div key={key}><dt>{recordFieldLabel(key)}</dt><dd>{formatNumber(snapshot[key])}</dd></div> : null)}</dl></section> : null}
  </WorkspaceSection>;
}
