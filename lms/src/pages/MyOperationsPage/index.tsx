import React, {useMemo, useState} from 'react';
import {Navigate} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {EnglishDateInput, EnglishDateTimeInput, EnglishTimeInput} from '@/components/EnglishDateInput';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {useMyCourses} from '@/hooks/useCourseAccess';
import {SCHEDULE_REQUEST_TYPES, unwrapData, type PersonalEventRequest} from '@/apis';
import {canUseStudentLearningOperations, canUseTeachingOperations} from '@/utils/roleCapabilities';
import {getSignedInHomePath} from '@/utils/signedInHomePath';
import {TeacherOperationsSections} from './TeacherOperationsSections';
import styles from './index.module.scss';

type Section = 'overview' | 'calendar' | 'teaching' | 'availability';
type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as UnknownRecord : null;
const records = (value: unknown): UnknownRecord[] => {
  const record = asRecord(value);
  const source = Array.isArray(value) ? value : record && Array.isArray(record.items) ? record.items : record && Array.isArray(record.content) ? record.content : [];
  return source.filter(item => asRecord(item) !== null) as UnknownRecord[];
};
const numeric = (record: UnknownRecord, ...keys: string[]): number | undefined => { for (const key of keys) if (typeof record[key] === 'number') return record[key] as number; return undefined; };
const textual = (record: UnknownRecord, ...keys: string[]): string | undefined => { for (const key of keys) if (typeof record[key] === 'string' && String(record[key]).trim()) return record[key] as string; return undefined; };

const MyOperationsPage: React.FC = () => {
  const {user} = useRequiredAuth();
  const student = canUseStudentLearningOperations(user);
  const instructor = canUseTeachingOperations(user);
  const courses = useMyCourses();
  const queryClient = useQueryClient();
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [section, setSection] = useState<Section>(student ? 'overview' : 'teaching');
  const [courseId, setCourseId] = useState('');
  const [selectedOccurrence, setSelectedOccurrence] = useState<UnknownRecord | null>(null);
  const [schedule, setSchedule] = useState({requestType: 'RESCHEDULE', date: '', start: '', end: '', reason: ''});
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<UnknownRecord | null>(null);
  const [event, setEvent] = useState<PersonalEventRequest>({title: '', startsAtLocal: '', endsAtLocal: '', timezone});
  const selectedCourseId = Number(courseId);
  const validCourse = Number.isInteger(selectedCourseId) && selectedCourseId > 0;

  const alerts = useQuery({queryKey: ['me', 'alerts'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyAlerts(), 'myAlerts'), enabled: student && section === 'overview', retry: false});
  const attendance = useQuery({queryKey: ['me', 'attendance'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyAttendance(), 'myAttendance'), enabled: student && section === 'overview', retry: false});
  const progress = useQuery({queryKey: ['me', 'progress'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyProgress(), 'myProgress'), enabled: student && section === 'overview', retry: false});
  const workQueue = useQuery({queryKey: ['me', 'work-queue'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyWorkQueue(), 'myWorkQueue'), enabled: student && section === 'overview', retry: false});
  const scheduleRequests = useQuery({queryKey: ['me', 'schedule-requests'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyScheduleRequests(), 'myScheduleRequests'), enabled: student && section === 'overview', retry: false});
  const calendar = useQuery({queryKey: ['me', 'calendar'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyCalendar(), 'myCalendar'), enabled: section === 'calendar' || (student && section === 'overview'), retry: false});
  const hours = useQuery({queryKey: ['me', 'course-hours', selectedCourseId], queryFn: async () => unwrapData(await courseOperationsApiService.getMyCourseHours(selectedCourseId), 'myCourseHours'), enabled: student && section === 'overview' && validCourse, retry: false});
  const reports = useQuery({queryKey: ['me', 'course-reports', selectedCourseId], queryFn: async () => unwrapData(await courseOperationsApiService.listMyPublishedCourseReports(selectedCourseId), 'myCourseReports'), enabled: student && section === 'overview' && validCourse, retry: false});
  const reportDetail = useQuery({queryKey: ['me', 'course-report', selectedCourseId, selectedReportId], queryFn: async () => unwrapData(await courseOperationsApiService.getMyPublishedCourseReport(selectedCourseId, selectedReportId!), 'myCourseReport'), enabled: validCourse && selectedReportId != null, retry: false});
  const personalEvents = useQuery({queryKey: ['me', 'personal-events'], queryFn: async () => unwrapData(await courseOperationsApiService.listMyPersonalEvents(), 'myPersonalEvents'), enabled: section === 'calendar', retry: false});

  const scheduleMutation = useMutation({
    mutationFn: () => courseOperationsApiService.createCourseScheduleRequest(selectedCourseId, numeric(selectedOccurrence!, 'occurrenceId', 'sessionOccurrenceId')!, {requestType: schedule.requestType, proposedOccurrenceDate: schedule.date || undefined, proposedStartTime: schedule.start || undefined, proposedEndTime: schedule.end || undefined, reason: schedule.reason || undefined}),
    onSuccess: async () => { setSelectedOccurrence(null); setSchedule({requestType: 'RESCHEDULE', date: '', start: '', end: '', reason: ''}); await queryClient.invalidateQueries({queryKey: ['me', 'schedule-requests']}); },
  });
  const eventMutation = useMutation({
    mutationFn: (action: 'create' | 'update' | 'delete') => {
      if (action === 'create') return courseOperationsApiService.createMyPersonalEvent(event);
      const eventId = numeric(selectedEvent!, 'eventId', 'id')!;
      if (action === 'delete') return courseOperationsApiService.deleteMyPersonalEvent(eventId);
      return courseOperationsApiService.patchMyPersonalEvent(eventId, {...event, expectedVersion: numeric(selectedEvent!, 'version', 'eventVersion')});
    },
    onSuccess: async () => { setSelectedEvent(null); setEvent({title: '', startsAtLocal: '', endsAtLocal: '', timezone}); await Promise.all([queryClient.invalidateQueries({queryKey: ['me', 'personal-events']}), queryClient.invalidateQueries({queryKey: ['me', 'calendar']})]); },
  });

  const chooseEvent = (record: UnknownRecord) => {
    setSelectedEvent(record);
    setEvent({title: textual(record, 'title') ?? '', startsAtLocal: textual(record, 'startsAtLocal', 'startsAt') ?? '', endsAtLocal: textual(record, 'endsAtLocal', 'endsAt') ?? '', timezone: textual(record, 'timezone') ?? timezone, reminderMinutesBefore: numeric(record, 'reminderMinutesBefore')});
  };

  if (!student && !instructor) return <Navigate to={getSignedInHomePath(user)} replace/>;
  const calendarRows = records(calendar.data).filter(row => !validCourse || numeric(row, 'courseId') === selectedCourseId);
  const reportRows = records(reports.data);
  const eventRows = records(personalEvents.data);

  return (
    <main className={styles.page}>
      <header className={styles.header}><div><h1>{student ? 'Learning overview' : 'Teaching operations'}</h1><p>{student ? 'Your live alerts, progress, attendance, schedule, and reports.' : 'Your live teaching queue, classes, personal calendar, and availability.'}</p></div>{student ? <label className={styles.coursePicker}>Course<select value={courseId} onChange={change => { setCourseId(change.target.value); setSelectedOccurrence(null); setSelectedReportId(null); }}><option value="">All courses</option>{(courses.data ?? []).map(course => { const id = course.id ?? course.courseId; return <option key={id} value={id}>{course.title || course.courseCode || `Course #${id}`}</option>; })}</select></label> : null}</header>
      <nav className={styles.tabs} aria-label="Operations sections">{([...(student ? ['overview'] : []), ...(instructor ? ['teaching', 'availability'] : []), 'calendar'] as Section[]).map(item => <button type="button" key={item} className={section === item ? styles.active : ''} onClick={() => setSection(item)}>{item}</button>)}</nav>

      {section === 'overview' && student ? <div className={styles.workspace}>
        <div className={styles.grid}>{[
          ['Alerts', alerts.data, 'No active alerts.'], ['Attendance', attendance.data, 'No attendance has been recorded.'], ['Learning progress', progress.data, 'No progress records are available.'], ['Work queue', workQueue.data, 'Nothing needs attention.'], ['Schedule requests', scheduleRequests.data, 'No schedule requests have been submitted.'],
        ].map(([title, value, empty]) => <section className={styles.card} key={String(title)}><h2>{String(title)}</h2><RecordSummaryList value={value} emptyMessage={String(empty)}/></section>)}</div>
        {validCourse ? <div className={styles.grid}><section className={styles.card}><h2>Purchased course hours</h2><RecordSummaryList value={hours.data} emptyMessage="No purchased-hours record is available."/></section><section className={styles.card}><h2>Published reports</h2>{reportRows.length === 0 ? <p className={styles.empty}>No published reports.</p> : <div className={styles.list}>{reportRows.map((row, index) => { const id = numeric(row, 'reportId'); return <article className={styles.row} key={id ?? index}><div><strong>{textual(row, 'reportType', 'title') || 'Course report'}</strong><small>{textual(row, 'publishedAt', 'status') || 'Published'}</small></div>{id != null ? <button type="button" className={styles.secondary} onClick={() => setSelectedReportId(id)}>Open</button> : null}</article>; })}</div>}{reportDetail.data !== undefined ? <div className={styles.detail}><RecordSummaryList value={reportDetail.data}/></div> : null}</section></div> : <section className={styles.emptyPanel}><strong>Select a course for course hours, reports, and schedule changes</strong><span>The course selector is populated from your live enrolments.</span></section>}
        {validCourse ? <section className={styles.card}><h2>Request a schedule change</h2>{calendarRows.length === 0 ? <p className={styles.empty}>No selectable class occurrence is available for this course.</p> : <div className={styles.list}>{calendarRows.map((row, index) => { const occurrenceId = numeric(row, 'occurrenceId', 'sessionOccurrenceId'); const selected = occurrenceId != null && occurrenceId === numeric(selectedOccurrence ?? {}, 'occurrenceId', 'sessionOccurrenceId'); return <article className={styles.row} key={occurrenceId ?? index}><div><strong>{textual(row, 'title', 'courseTitle', 'courseCode') || 'Scheduled class'}</strong><small>{[textual(row, 'occurrenceDate', 'date'), textual(row, 'startTime'), textual(row, 'location')].filter(Boolean).join(' · ')}</small></div>{occurrenceId != null ? <button type="button" className={selected ? styles.primary : styles.secondary} onClick={() => setSelectedOccurrence(row)}>{selected ? 'Selected' : 'Request change'}</button> : null}</article>; })}</div>}{selectedOccurrence ? <form className={styles.form} onSubmit={eventSubmit => { eventSubmit.preventDefault(); scheduleMutation.mutate(); }}><label>Request type<select value={schedule.requestType} onChange={change => setSchedule(current => ({...current, requestType: change.target.value}))}>{SCHEDULE_REQUEST_TYPES.map(type => <option key={type}>{type}</option>)}</select></label><label>Proposed date<EnglishDateInput value={schedule.date} onChangeValue={date => setSchedule(current => ({...current, date}))}/></label><label>Proposed start<EnglishTimeInput value={schedule.start} onChangeValue={start => setSchedule(current => ({...current, start}))}/></label><label>Proposed end<EnglishTimeInput value={schedule.end} onChangeValue={end => setSchedule(current => ({...current, end}))}/></label><label>Reason<textarea value={schedule.reason} onChange={change => setSchedule(current => ({...current, reason: change.target.value}))}/></label><button className={styles.primary} disabled={scheduleMutation.isPending}>Submit request</button></form> : null}</section> : null}
      </div> : null}

      {section === 'calendar' ? <div className={styles.workspace}><div className={styles.grid}><section className={styles.card}><h2>Academic calendar</h2><RecordSummaryList value={calendar.data} emptyMessage="No calendar items are available."/></section><section className={styles.card}><h2>Personal events</h2>{eventRows.length === 0 ? <p className={styles.empty}>No personal events.</p> : <div className={styles.list}>{eventRows.map((row, index) => <article className={styles.row} key={numeric(row, 'eventId', 'id') ?? index}><div><strong>{textual(row, 'title') || 'Personal event'}</strong><small>{[textual(row, 'startsAtLocal', 'startsAt'), textual(row, 'timezone')].filter(Boolean).join(' · ')}</small></div><button type="button" className={styles.secondary} onClick={() => chooseEvent(row)}>Edit</button></article>)}</div>}</section></div><section className={styles.card}><h2>{selectedEvent ? 'Edit personal event' : 'Create personal event'}</h2><form className={styles.form} onSubmit={submit => { submit.preventDefault(); eventMutation.mutate(selectedEvent ? 'update' : 'create'); }}><label>Title<input required value={event.title ?? ''} onChange={change => setEvent(current => ({...current, title: change.target.value}))}/></label><label>Starts<EnglishDateTimeInput required value={event.startsAtLocal ?? ''} onChangeValue={startsAtLocal => setEvent(current => ({...current, startsAtLocal}))}/></label><label>Ends<EnglishDateTimeInput required value={event.endsAtLocal ?? ''} onChangeValue={endsAtLocal => setEvent(current => ({...current, endsAtLocal}))}/></label><label>Timezone<input value={event.timezone ?? ''} onChange={change => setEvent(current => ({...current, timezone: change.target.value}))}/></label><label>Reminder minutes<input type="number" min="0" value={event.reminderMinutesBefore ?? ''} onChange={change => setEvent(current => ({...current, reminderMinutesBefore: change.target.value ? Number(change.target.value) : undefined}))}/></label><div className={styles.actions}><button className={styles.primary} disabled={eventMutation.isPending}>{selectedEvent ? 'Save changes' : 'Create event'}</button>{selectedEvent ? <><button type="button" className={styles.secondary} onClick={() => { setSelectedEvent(null); setEvent({title: '', startsAtLocal: '', endsAtLocal: '', timezone}); }}>Cancel</button><button type="button" className={styles.danger} onClick={() => eventMutation.mutate('delete')}>Delete event</button></> : null}</div></form></section></div> : null}

      {instructor && (section === 'teaching' || section === 'availability') ? <TeacherOperationsSections section={section} timezone={timezone}/> : null}
    </main>
  );
};

export default MyOperationsPage;
