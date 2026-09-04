import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {addMonths, format, startOfMonth} from 'date-fns';
import {ArrowLeft, ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, FileText} from 'lucide-react';
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

const REPORT_SECTIONS = [{key: 'overallSummary', label: 'Overall summary'}, {key: 'skillEvaluation', label: 'Skill evaluation'}, {key: 'strengths', label: 'Strengths'}, {key: 'weaknesses', label: 'Areas for improvement'}, {key: 'improvementSuggestions', label: 'Next steps'}] as const;

export function CourseLearningDetails({courseId}: {courseId: number}) {
  const [tab, setTab] = useState<'reports' | 'schedule'>('reports');
  const [page, setPage] = useState(0);
  const [reportId, setReportId] = useState<number>();
  const hours = useQuery({queryKey: ['student-learning', courseId, 'hours'], queryFn: async () => record(unwrapData(await api.getMyCourseHours(courseId), 'course hours')), retry: false});
  const hoursNotConfigured = isNotFound(hours.error) && getApiErrorCode(hours.error) === 'COURSE_HOURS_NOT_FOUND';
  const reports = useQuery({queryKey: ['student-learning', courseId, 'reports', page], queryFn: async () => recordPage(unwrapData(await api.listMyPublishedCourseReports(courseId, page + 1, LEARNING_PAGE_SIZE), 'published reports')), enabled: tab === 'reports', retry: false});
  const report = useQuery({queryKey: ['student-learning', courseId, 'report', reportId], queryFn: async () => record(unwrapData(await api.getMyPublishedCourseReport(courseId, reportId!), 'published report')), enabled: reportId != null, retry: false});
  const snapshotValue = report.data?.performanceSnapshot;
  const snapshot = snapshotValue && typeof snapshotValue === 'object' && !Array.isArray(snapshotValue) ? record(snapshotValue) : undefined;
  if (reportId != null) return <WorkspaceSection title={textValue(report.data ?? {}, 'title') || 'Published report'} summary={textValue(report.data ?? {}, 'publishedAt') ? `Published ${learningDate(textValue(report.data!, 'publishedAt'))}` : undefined} appearance="record" meta={<button className={common.textButton} onClick={() => setReportId(undefined)} type="button"><ArrowLeft size={16}/> Back to reports</button>}>
    <LearningQueryState query={report}/>
    {report.isSuccess ? <div className={s.report}>{REPORT_SECTIONS.map(section => textValue(report.data, section.key) ? <section key={section.key}><h3>{section.label}</h3><p>{textValue(report.data, section.key)}</p></section> : null)}{!REPORT_SECTIONS.some(section => textValue(report.data, section.key)) ? <LearningEmpty icon={FileText} title="No written evaluation is available."/> : null}</div> : null}
    {snapshot ? <section className={s.snapshot}><h3>Performance at publication</h3><dl>{[{key: 'completedSessionCount', label: 'Classes completed'}, {key: 'presentCount', label: 'Present'}, {key: 'absentCount', label: 'Absent'}, {key: 'approvedAbsenceCount', label: 'Approved absences'}, {key: 'unapprovedAbsenceCount', label: 'Unapproved absences'}, {key: 'assignmentCount', label: 'Assignments'}, {key: 'submittedCount', label: 'Submitted'}, {key: 'releasedGradeCount', label: 'Released grades'}, {key: 'releasedScoreAverage', label: 'Average released score'}].map(({key, label}) => typeof snapshot[key] === 'number' ? <div key={key}><dt>{label}</dt><dd>{snapshot[key]}</dd></div> : null)}</dl></section> : null}
  </WorkspaceSection>;
  return <div className={s.details}>
    <WorkspaceSection title="Course hours" appearance="record" className={s.hours}>
      {hoursNotConfigured ? <LearningEmpty title="No course hours have been added yet."/> : <LearningQueryState query={hours} errorMessage="Course hours could not be loaded."/>}
      {hours.isSuccess ? <dl className={s.balances}>{[{key: 'purchasedMinutes', label: 'Purchased'}, {key: 'usedMinutes', label: 'Used'}, {key: 'remainingMinutes', label: 'Remaining'}].map(item => {const value = hours.data[item.key]; return <div key={item.key}><dt>{item.label}</dt><dd>{typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US', {maximumFractionDigits: 1}).format(value / 60) : '—'}<span>hours</span></dd></div>;})}</dl> : null}
    </WorkspaceSection>
    <nav className={common.tabs} aria-label="Course learning details"><button type="button" aria-pressed={tab === 'reports'} onClick={() => setTab('reports')}>Published reports</button><button type="button" aria-pressed={tab === 'schedule'} onClick={() => setTab('schedule')}>Schedule changes</button></nav>
    {tab === 'schedule' ? <CourseScheduleChanges courseId={courseId}/> : <WorkspaceSection title="Published reports" summary="Your instructor’s feedback and recommended next steps." appearance="record">
      <LearningQueryState query={reports} errorMessage="Published reports could not be loaded."/>
      {reports.isSuccess && !reports.data.items.length ? <LearningEmpty icon={FileText} title="No published reports." description="Reports will appear after your instructor publishes them."/> : null}
      <div className={s.reports}>{reports.data?.items.map((item, index) => {const id = optionalNumber(item, 'id', 'reportId'); return <article key={id ?? index}><span className={s.icon}><FileText size={24}/></span><div><h3>{textValue(item, 'title') || (item.reportType === 'FINAL' ? 'Final report' : 'Mid-term report')}</h3><p>Published {learningDate(textValue(item, 'publishedAt'))}</p></div>{id ? <button type="button" className={common.textButton} onClick={() => setReportId(id)}>View report <ArrowRight size={16}/></button> : null}</article>;})}</div>
      <TeachingPagination label="Published reports" page={page} size={LEARNING_PAGE_SIZE} total={reports.data?.total} count={reports.data?.items.length ?? 0} onChange={setPage} loading={reports.isFetching}/>
    </WorkspaceSection>}
  </div>;
}

function CourseScheduleChanges({courseId}: {courseId: number}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedId, setSelectedId] = useState<number>();
  const [submitted, setSubmitted] = useState(false);
  const from = format(month, 'yyyy-MM-dd');
  const to = format(addMonths(month, 1), 'yyyy-MM-dd');
  const query = useQuery({queryKey: ['student-learning', 'schedule', from, to], queryFn: async () => recordPage(unwrapData(await api.getMyCalendar({from, to, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone}), 'class calendar')).items, retry: false});
  const rows = (query.data ?? []).filter(item => optionalNumber(item, 'courseId') === courseId && optionalNumber(item, 'occurrenceId', 'sessionOccurrenceId')).map(scheduleOccurrence);
  const selected = rows.find(item => optionalNumber(item, 'occurrenceId', 'sessionOccurrenceId') === selectedId);
  return <div className={s.scheduleLayout}>
    <WorkspaceSection title="Choose a class" appearance="record" summary="Request an absence or propose a different time for a dated class.">
      <div className={s.monthNavigation}><button type="button" aria-label="Previous schedule month" onClick={() => {setSelectedId(undefined); setMonth(current => addMonths(current, -1));}}><ChevronLeft size={18}/></button><strong>{format(month, 'MMMM yyyy')}</strong><button type="button" aria-label="Next schedule month" onClick={() => {setSelectedId(undefined); setMonth(current => addMonths(current, 1));}}><ChevronRight size={18}/></button></div>
      <LearningQueryState query={query} errorMessage="Calendar could not be loaded."/>
      {query.isSuccess && !rows.length ? <LearningEmpty icon={CalendarDays} title="No selectable classes this month." description="Try another month to find a published class."/> : null}
      <div className={s.classList}>{rows.map(item => {const id = optionalNumber(item, 'occurrenceId', 'sessionOccurrenceId')!; return <button type="button" className={s.classOption} aria-pressed={selectedId === id} key={id} onClick={() => {setSelectedId(id); setSubmitted(false);}}><CalendarDays size={22}/><span><strong>{textValue(item, 'title', 'courseTitle') || 'Scheduled class'}</strong><small>{learningDate(textValue(item, 'occurrenceDate', 'date'))} · {textValue(item, 'startTime')?.slice(0, 5)}{textValue(item, 'endTime') ? `–${textValue(item, 'endTime')!.slice(0, 5)}` : ''}</small>{textValue(item, 'timezone') ? <small>{textValue(item, 'timezone')}</small> : null}</span><ArrowRight size={17}/></button>;})}</div>
    </WorkspaceSection>
    <WorkspaceSection title={submitted ? 'Request submitted' : 'Request a schedule change'} appearance="record">
      {submitted ? <><p className={s.note} role="status">Your request has been submitted.</p><p className={s.note}>Check Schedule requests for the status of your request.</p></> : selected && selectedId ? <ScheduleChangeForm key={selectedId} courseId={courseId} occurrenceId={selectedId} occurrence={selected} onSubmitted={() => {setSelectedId(undefined); setSubmitted(true);}}/> : <LearningEmpty icon={BookOpen} title="Select a class to get started" description="Your request will be linked to the class you choose."/>}
    </WorkspaceSection>
  </div>;
}
