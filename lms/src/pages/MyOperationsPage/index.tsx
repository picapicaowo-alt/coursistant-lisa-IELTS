import {WorkspaceSection} from '@/components/WorkspaceSection';
import {CollapsibleSection} from '@/components/CollapsibleSection';
import {getApiErrorMessage} from '@/utils/apiError';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
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
  const idempotency = useIdempotencyCheckpoint();
  const eventWindow = useMemo(() => {const now = new Date(); return {fromUtc: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), toUtc: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()};}, []);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [section, setSection] = useState<Section>(student ? 'overview' : 'teaching');
  const [courseId, setCourseId] = useState('');
  const [selectedOccurrence, setSelectedOccurrence] = useState<UnknownRecord | null>(null);
  const [schedule, setSchedule] = useState({requestType: String(SCHEDULE_REQUEST_TYPES[1]), date: '', start: '', end: '', reason: ''});
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [eventReadError, setEventReadError] = useState<string>();
  const [loadingEventId, setLoadingEventId] = useState<number>();
  const [editorReveal, setEditorReveal] = useState(0);
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
  const personalEvents = useQuery({queryKey: ['me', 'personal-events', eventWindow], queryFn: async () => unwrapData(await courseOperationsApiService.listMyPersonalEvents(eventWindow), 'myPersonalEvents'), enabled: section === 'calendar', retry: false});

  const ownOccurrenceAttendance = useQuery({
    queryKey: ['me', 'occurrence-attendance', selectedCourseId, selectedOccurrence],
    queryFn: async () => unwrapData(await courseOperationsApiService.getOwnOccurrenceAttendance(selectedCourseId, numeric(selectedOccurrence!, 'occurrenceId', 'sessionOccurrenceId')!), 'ownOccurrenceAttendance'),
    enabled: student && validCourse && selectedOccurrence != null,
    retry: false,
  });
  const scheduleMutation = useMutation({
    mutationFn: () => {
      const occurrenceId = numeric(selectedOccurrence!, 'occurrenceId', 'sessionOccurrenceId')!;
      const changingSchedule = schedule.requestType === SCHEDULE_REQUEST_TYPES[1];
      const request = {requestType: schedule.requestType, proposedOccurrenceDate: changingSchedule ? schedule.date || undefined : undefined, proposedStartTime: changingSchedule ? schedule.start || undefined : undefined, proposedEndTime: changingSchedule ? schedule.end || undefined : undefined, reason: schedule.reason || undefined};
      return idempotency.run(`schedule-${selectedCourseId}-${occurrenceId}`, request, (key, payload) => courseOperationsApiService.createCourseScheduleRequest(selectedCourseId, occurrenceId, payload, key));
    },
    onSuccess: async () => { setSelectedOccurrence(null); setSchedule({requestType: String(SCHEDULE_REQUEST_TYPES[1]), date: '', start: '', end: '', reason: ''}); await queryClient.invalidateQueries({queryKey: ['me', 'schedule-requests']}); },
  });
  const eventMutation = useMutation({
    mutationFn: (action: 'create' | 'update' | 'delete') => {
      if (action === 'create') return idempotency.run('create-personal-event', event, (key, payload) => courseOperationsApiService.createMyPersonalEvent(payload, key));
      const eventId = numeric(selectedEvent!, 'eventId', 'id')!;
      if (action === 'delete') return idempotency.run(`delete-event-${eventId}`, eventId, key => courseOperationsApiService.deleteMyPersonalEvent(eventId, key));
      return idempotency.run(`update-event-${eventId}`, {...event, expectedVersion: numeric(selectedEvent!, 'version', 'eventVersion')}, (key, payload) => courseOperationsApiService.patchMyPersonalEvent(eventId, payload, key));
    },
    onSuccess: async () => { setSelectedEvent(null); setEvent({title: '', startsAtLocal: '', endsAtLocal: '', timezone}); await Promise.all([queryClient.invalidateQueries({queryKey: ['me', 'personal-events']}), queryClient.invalidateQueries({queryKey: ['me', 'calendar']})]); },
  });

  const chooseEvent = (record: UnknownRecord) => {
    setEditorReveal(current => current + 1);
    setSelectedEvent(record);
    setEvent({title: textual(record, 'title') ?? '', startsAtLocal: textual(record, 'startsAtLocal', 'startsAt') ?? '', endsAtLocal: textual(record, 'endsAtLocal', 'endsAt') ?? '', timezone: textual(record, 'timezone') ?? timezone, reminderMinutesBefore: numeric(record, 'reminderMinutesBefore')});
  };

  const openEvent = async (record: UnknownRecord) => {
    const eventId = numeric(record, 'eventId', 'id');
    if (eventId == null) return;
    setLoadingEventId(eventId);
    setEventReadError(undefined);
    try {
      const value = await queryClient.fetchQuery({queryKey: ['me', 'personal-event', eventId], queryFn: async () => unwrapData(await courseOperationsApiService.getMyPersonalEvent(eventId), 'personalEvent'), staleTime: 0});
      const latest = asRecord(value);
      if (!latest) throw new Error('The event is no longer available.');
      chooseEvent(latest);
    } catch (error) { setEventReadError(getApiErrorMessage(error, 'The event could not be loaded.')); }
    finally { setLoadingEventId(undefined); }
  };

  if (!student && !instructor) return <Navigate to={getSignedInHomePath(user)} replace/>;
  const calendarRows = records(calendar.data).filter(row => !validCourse || numeric(row, 'courseId') === selectedCourseId);
  const reportRows = records(reports.data);
  const eventRows = records(personalEvents.data);

  return (
    <div className={styles.page}>
      <header className={styles.header}><div><h1>{student ? 'Learning overview' : 'Teaching operations'}</h1><p>{student ? 'Your live alerts, progress, attendance, schedule, and reports.' : 'Your live teaching queue, classes, personal calendar, and availability.'}</p></div>{student ? <label className={styles.coursePicker}>Course<select value={courseId} onChange={change => { setCourseId(change.target.value); setSelectedOccurrence(null); setSelectedReportId(null); }}><option value="">All courses</option>{(courses.data ?? []).map(course => { const id = course.id ?? course.courseId; return <option key={id} value={id}>{course.title || course.courseCode || `Course #${id}`}</option>; })}</select></label> : null}</header>
      <nav className={styles.tabs} aria-label="Operations sections">{([...(student ? ['overview'] : []), ...(instructor ? ['teaching', 'availability'] : []), 'calendar'] as Section[]).map(item => <button type="button" key={item} className={section === item ? styles.active : ''} onClick={() => setSection(item)}>{item}</button>)}</nav>

      {section === 'overview' && student ? <div className={styles.workspace}>
        <div className={styles.grid}>{[
          {title: 'Alerts', query: alerts, empty: 'No active alerts.'}, {title: 'Attendance', query: attendance, empty: 'No attendance has been recorded.'}, {title: 'Learning progress', query: progress, empty: 'No progress records are available.'}, {title: 'Work queue', query: workQueue, empty: 'Nothing needs attention.'}, {title: 'Schedule requests', query: scheduleRequests, empty: 'No schedule requests have been submitted.'},
        ].map(({title, query, empty}) => <WorkspaceSection key={title} title={title}>{query.isPending ? <p role="status">Loading…</p> : query.isError ? <div className={styles.inlineAlert} role="alert"><p>{getApiErrorMessage(query.error, `${title} could not be loaded.`)}</p><button type="button" onClick={() => void query.refetch()}>Retry</button></div> : <RecordSummaryList value={query.data} emptyMessage={empty}/>}</WorkspaceSection>)}</div>
        {validCourse ? <div className={styles.grid}><WorkspaceSection title="Purchased course hours"><RecordSummaryList value={hours.data} emptyMessage="No purchased-hours record is available."/></WorkspaceSection><WorkspaceSection title="Published reports">{reportRows.length === 0 ? <p className={styles.empty}>No published reports.</p> : <div className={styles.list}>{reportRows.map((row, index) => { const id = numeric(row, 'reportId'); return <article className={styles.row} key={id ?? index}><div><strong>{textual(row, 'reportType', 'title') || 'Course report'}</strong><small>{textual(row, 'publishedAt', 'status') || 'Published'}</small></div>{id != null ? <button type="button" className={styles.secondary} onClick={() => setSelectedReportId(id)}>Open</button> : null}</article>; })}</div>}{reportDetail.data !== undefined ? <div className={styles.detail}><RecordSummaryList value={reportDetail.data}/></div> : null}</WorkspaceSection></div> : <section className={styles.emptyPanel}><strong>Select a course for course hours, reports, and schedule changes</strong><span>The course selector is populated from your live enrolments.</span></section>}
        {validCourse ? <WorkspaceSection title="Request a schedule change">{calendarRows.length === 0 ? <p className={styles.empty}>No selectable class occurrence is available for this course.</p> : <div className={styles.list}>{calendarRows.map((row, index) => { const occurrenceId = numeric(row, 'occurrenceId', 'sessionOccurrenceId'); const selected = occurrenceId != null && occurrenceId === numeric(selectedOccurrence ?? {}, 'occurrenceId', 'sessionOccurrenceId'); return <article className={styles.row} key={occurrenceId ?? index}><div><strong>{textual(row, 'title', 'courseTitle', 'courseCode') || 'Scheduled class'}</strong><small>{[textual(row, 'occurrenceDate', 'date'), textual(row, 'startTime'), textual(row, 'location')].filter(Boolean).join(' · ')}</small></div>{occurrenceId != null ? <button type="button" className={selected ? styles.primary : styles.secondary} onClick={() => setSelectedOccurrence(row)}>{selected ? 'Selected' : 'Request change'}</button> : null}</article>; })}</div>}{selectedOccurrence ? <form className={styles.form} onSubmit={eventSubmit => { eventSubmit.preventDefault(); scheduleMutation.mutate(); }}><label>Request type<select value={schedule.requestType} onChange={change => setSchedule(current => ({...current, requestType: change.target.value}))}>{SCHEDULE_REQUEST_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>{schedule.requestType === SCHEDULE_REQUEST_TYPES[1] ? <><label>Proposed date<EnglishDateInput value={schedule.date} onChangeValue={date => setSchedule(current => ({...current, date}))}/></label><label>Proposed start<EnglishTimeInput value={schedule.start} onChangeValue={start => setSchedule(current => ({...current, start}))}/></label><label>Proposed end<EnglishTimeInput value={schedule.end} onChangeValue={end => setSchedule(current => ({...current, end}))}/></label></> : null}<label>Reason<textarea value={schedule.reason} onChange={change => setSchedule(current => ({...current, reason: change.target.value}))}/></label><button className={styles.primary} disabled={scheduleMutation.isPending}>Submit request</button></form> : null}</WorkspaceSection> : null}
      </div> : null}

      {scheduleMutation.isError ? <p className={styles.formMessage} role="alert">{getApiErrorMessage(scheduleMutation.error, 'The request could not be submitted. Your entries are preserved.')}</p> : null}
      {eventMutation.isError ? <p className={styles.formMessage} role="alert">{getApiErrorMessage(eventMutation.error, 'The event could not be saved. Your entries are preserved.')}</p> : null}
      {[{label: 'Course selection', query: courses}, {label: 'Course hours', query: hours}, {label: 'Reports', query: reports}, {label: 'Report detail', query: reportDetail}, {label: 'Calendar', query: calendar}, {label: 'Personal events', query: personalEvents}].filter(({query}) => query.isError).map(({label, query}) => <div className={styles.inlineAlert} key={label} role="alert"><p>{getApiErrorMessage(query.error, `${label} could not be loaded.`)}</p><button type="button" onClick={() => void query.refetch()}>Retry {label.toLowerCase()}</button></div>)}
      {eventReadError ? <p className={styles.formMessage} role="alert">{eventReadError}</p> : null}
      {selectedOccurrence && section === 'overview' ? <CollapsibleSection title="Selected class attendance" revealKey={selectedOccurrence ? String(selectedOccurrence.occurrenceId ?? selectedOccurrence.sessionOccurrenceId) : undefined}>{ownOccurrenceAttendance.isPending ? <p role="status">Loading attendance…</p> : ownOccurrenceAttendance.isError ? <p role="alert">{getApiErrorMessage(ownOccurrenceAttendance.error, 'Attendance could not be loaded.')}</p> : <RecordSummaryList value={ownOccurrenceAttendance.data}/>}</CollapsibleSection> : null}
      {section === 'calendar' ? <div className={styles.workspace}><div className={styles.grid}><WorkspaceSection title="Academic calendar"><RecordSummaryList value={calendar.data} emptyMessage="No calendar items are available."/></WorkspaceSection><CollapsibleSection title="Personal events">{eventRows.length === 0 ? <p className={styles.empty}>No personal events.</p> : <div className={styles.list}>{eventRows.map((row, index) => <article className={styles.row} key={numeric(row, 'eventId', 'id') ?? index}><div><strong>{textual(row, 'title') || 'Personal event'}</strong><small>{[textual(row, 'startsAtLocal', 'startsAt'), textual(row, 'timezone')].filter(Boolean).join(' · ')}</small></div><button type="button" className={styles.secondary} disabled={loadingEventId != null} onClick={() => void openEvent(row)}>{loadingEventId === numeric(row, 'eventId', 'id') ? 'Loading…' : 'Edit'}</button></article>)}</div>}</CollapsibleSection></div><CollapsibleSection title={selectedEvent ? 'Edit personal event' : 'Create personal event'} revealKey={editorReveal}><form className={styles.form} onSubmit={submit => { submit.preventDefault(); eventMutation.mutate(selectedEvent ? 'update' : 'create'); }}><label>Title<input required value={event.title ?? ''} onChange={change => setEvent(current => ({...current, title: change.target.value}))}/></label><label>Starts<EnglishDateTimeInput required value={event.startsAtLocal ?? ''} onChangeValue={startsAtLocal => setEvent(current => ({...current, startsAtLocal}))}/></label><label>Ends<EnglishDateTimeInput required value={event.endsAtLocal ?? ''} onChangeValue={endsAtLocal => setEvent(current => ({...current, endsAtLocal}))}/></label><label>Timezone<input value={event.timezone ?? ''} onChange={change => setEvent(current => ({...current, timezone: change.target.value}))}/></label><label>Reminder minutes<input type="number" min="0" value={event.reminderMinutesBefore ?? ''} onChange={change => setEvent(current => ({...current, reminderMinutesBefore: change.target.value ? Number(change.target.value) : undefined}))}/></label><div className={styles.actions}><button className={styles.primary} disabled={eventMutation.isPending}>{selectedEvent ? 'Save changes' : 'Create event'}</button>{selectedEvent ? <><button type="button" className={styles.secondary} onClick={() => { setSelectedEvent(null); setEvent({title: '', startsAtLocal: '', endsAtLocal: '', timezone}); }}>Cancel</button><button type="button" className={styles.danger} disabled={eventMutation.isPending} onClick={() => eventMutation.mutate('delete')}>Delete event</button></> : null}</div></form></CollapsibleSection></div> : null}

      {instructor && (section === 'teaching' || section === 'availability') ? <TeacherOperationsSections section={section} timezone={timezone}/> : null}
    </div>
  );
};

export default MyOperationsPage;
