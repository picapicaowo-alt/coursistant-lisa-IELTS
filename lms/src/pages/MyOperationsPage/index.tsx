import {calendarLocalFields} from '@/utils/datetime';
import {LocalizedError} from '@/i18n/errors';
import {isPersonalEventVersionConflict, personalEventErrorKey} from '@/utils/personalEventError';
import { useTranslation } from 'react-i18next';
import {formatClockTime, formatDateValue, formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import {MY_OPERATIONS_SECTION_KEYS} from './sections';
import {parseInputDate, parseInputTime} from '@/i18n/dateInput';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {CollapsibleSection} from '@/components/CollapsibleSection';
import {getApiErrorCode, getApiErrorMessage, isNotFound} from '@/utils/apiError';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import React, {useMemo, useState} from 'react';
import {Navigate} from 'react-router-dom';
import {STUDENT_LEARNING_PATH} from '@/configs/routePaths';
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
import {InstructorOperationsPage} from './InstructorOperationsPage';
import StudentLearningPage from '@/pages/StudentLearningPage';

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

const LegacyMyOperationsPage: React.FC<{embedded?: boolean}> = ({embedded = false}) => {
  const { t: translate } = useTranslation();
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
  const [eventReadError, setEventReadError] = useState<unknown>();
  const [eventValidationKey, setEventValidationKey] = useState<string>();
  const [scheduleInvalid, setScheduleInvalid] = useState(false);
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
  // A documented missing balance is unconfigured, not a failed or zero balance.
  const hoursNotConfigured = isNotFound(hours.error) && getApiErrorCode(hours.error) === 'COURSE_HOURS_NOT_FOUND';
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
      if (action === 'delete') return idempotency.run(`delete-event-${eventId}`, {eventId, expectedVersion: numeric(selectedEvent!, 'version')}, (key, request) => courseOperationsApiService.deleteMyPersonalEvent(request.eventId, key, request.expectedVersion));
      return idempotency.run(`update-event-${eventId}`, {...event, expectedVersion: numeric(selectedEvent!, 'version')}, (key, payload) => courseOperationsApiService.patchMyPersonalEvent(eventId, payload, key));
    },
    onError: async (error) => {
      if (isPersonalEventVersionConflict(error) && selectedEvent) {
        await openEvent(selectedEvent);
        await queryClient.invalidateQueries({queryKey: ['me', 'personal-events']});
      }
    },
    onSuccess: async () => { setSelectedEvent(null); setEventValidationKey(undefined); setEvent({title: '', startsAtLocal: '', endsAtLocal: '', timezone}); await Promise.all([queryClient.invalidateQueries({queryKey: ['me', 'personal-events']}), queryClient.invalidateQueries({queryKey: ['me', 'calendar']})]); },
  });

  const chooseEvent = (record: UnknownRecord) => {
    setEditorReveal(current => current + 1);
    setSelectedEvent(record); setEventValidationKey(undefined);
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
      if (!latest) throw new LocalizedError("operations:legacy.eventUnavailable");
      chooseEvent(latest);
    } catch (error) { setEventReadError(error); }
    finally { setLoadingEventId(undefined); }
  };

  const submitEvent = (form: HTMLFormElement) => {
    const values = new FormData(form);
    const reminder = form.elements.namedItem('reminderMinutesBefore');
    const invalidReminder = reminder instanceof HTMLInputElement && reminder.validity.badInput;
    const rawReminder = String(values.get('reminderMinutesBefore') ?? '').trim();
    const key = !event.title?.trim() ? 'calendar:editor.requiredTitle'
      : !event.startsAtLocal || !event.endsAtLocal ? 'calendar:editor.validDates'
      : event.endsAtLocal <= event.startsAtLocal ? 'calendar:editor.invalidTime'
      : !event.timezone?.trim() ? 'calendar:editor.requiredTimezone'
      : invalidReminder || rawReminder !== '' && (!Number.isSafeInteger(Number(rawReminder)) || Number(rawReminder) < 0) ? 'calendar:editor.invalidReminder'
      : selectedEvent && numeric(selectedEvent, 'version') == null ? 'calendar:editor.missingVersion'
      : undefined;
    setEventValidationKey(key);
    if (!key && !eventMutation.isPending && loadingEventId == null && !eventReadError) eventMutation.mutate(selectedEvent ? 'update' : 'create');
  };

  const submitSchedule = (form: HTMLFormElement) => {
    const values = new FormData(form);
    const invalid = schedule.requestType === SCHEDULE_REQUEST_TYPES[1] && (
      ([['date', parseInputDate], ['start', parseInputTime], ['end', parseInputTime]] as const).some(([name, parse]) => {
        const raw = String(values.get(name) ?? '').trim();
        return raw !== '' && !parse(raw);
      }) || Boolean(schedule.start && schedule.end && schedule.end <= schedule.start)
    );
    setScheduleInvalid(invalid);
    if (!invalid && !scheduleMutation.isPending) scheduleMutation.mutate();
  };

  if (student && !embedded) return <Navigate to={STUDENT_LEARNING_PATH} replace/>;
  if (!student && !instructor) return <Navigate to={getSignedInHomePath(user)} replace/>;
  const calendarRows = records(calendar.data).filter(row => (!row.eventType || row.eventType === 'SESSION') && (!validCourse || numeric(row, 'courseId') === selectedCourseId)).map(row => {
    const start = textual(row, 'startsAtUtc');
    const local = start ? calendarLocalFields(start, textual(row, 'endsAtUtc'), textual(row, 'timezone') || timezone) : undefined;
    return local ? {...row, occurrenceDate: local.date, startTime: local.startTime, endTime: local.endTime} : row;
  });
  const reportRows = records(reports.data);
  const eventRows = records(personalEvents.data);

  return (
    <div className={embedded ? styles.embedded : styles.page}>
      <header className={styles.header}><div><h1>{student ? translate("advising:studentPlan.learning") : translate("navigation:teachingOperations")}</h1><p>{student ? translate("operations:legacy.learningHelp") : translate("operations:teacher.description")}</p></div>{student ? <label className={styles.coursePicker}>{translate("common:fields.course")}<select value={courseId} onChange={change => { setCourseId(change.target.value); setSelectedOccurrence(null); setSelectedReportId(null); }}><option value="">{translate("dashboard:allCourses")}</option>{(courses.data ?? []).map(course => { const id = course.id ?? course.courseId; return <option key={id} value={id}>{course.title || course.courseCode || translate('assistant:courseFallback', {id: formatNumber(id ?? 0)})}</option>; })}</select></label> : null}</header>
      <nav className={styles.tabs} aria-label={translate("operations:teacher.sections")}>{([...(student ? ['overview'] : []), ...(instructor ? ['teaching', 'availability'] : []), 'calendar'] as Section[]).map(item => <button type="button" key={item} className={section === item ? styles.active : ''} onClick={() => setSection(item)}>{translate(MY_OPERATIONS_SECTION_KEYS[item])}</button>)}</nav>

      {section === 'overview' && student ? <div className={styles.workspace}>
        <div className={styles.grid}>{[
          {titleKey: "learning:overview.progress", query: progress, emptyKey: "operations:legacy.noProgress", region: styles.primaryRegion},
          {titleKey: "dashboard:alerts", query: alerts, emptyKey: "dashboard:noAlerts", region: styles.supportRegion},
          {titleKey: "operations:tabs.attendance", query: attendance, emptyKey: "operations:legacy.noAttendance", region: styles.supportRegion},
          {titleKey: "learning:overview.work", query: workQueue, emptyKey: "learning:overview.noWork", region: styles.supportRegion},
          {titleKey: "operations:scheduleRequests", query: scheduleRequests, emptyKey: "operations:legacy.noRequests", region: styles.supportRegion},
        ].map(({titleKey, query, emptyKey, region}) => <WorkspaceSection key={titleKey} title={translate(titleKey)} className={region}>{query.isPending ? <p role="status">{translate("common:feedback.loading")}</p> : query.isError ? <div className={styles.inlineAlert} role="alert"><p>{getApiErrorMessage(query.error, translate('operations:legacy.loadFailedNamed', {section: translate(titleKey)}))}</p><button type="button" onClick={() => void query.refetch()}>{translate("common:actions.retry")}</button></div> : <RecordSummaryList value={query.data} emptyMessage={translate(emptyKey)}/>}</WorkspaceSection>)}</div>
        {validCourse ? <div className={styles.grid}><WorkspaceSection title={translate("operations:legacy.purchasedHours")}>{hoursNotConfigured ? <p className={styles.empty}>{translate("learning:hours.notConfigured")}</p> : hours.isPending ? <p role="status">{translate("common:feedback.loading")}</p> : hours.isSuccess ? <RecordSummaryList value={hours.data} emptyMessage={translate("operations:legacy.noHours")}/> : null}</WorkspaceSection><WorkspaceSection title={translate("learning:reports.title")}>{reports.isPending ? <p role="status">{translate("learning:reports.loadingList")}</p> : reports.isError ? null : reportRows.length === 0 ? <p className={styles.empty}>{translate("learning:reports.none")}</p> : <div className={styles.list}>{reportRows.map((row, index) => { const id = numeric(row, 'reportId'); return <article className={styles.row} key={id ?? index}><div><strong>{textual(row, 'title') || statusLabel(textual(row, 'reportType')) || translate("operations:legacy.courseReport")}</strong><small>{(textual(row, 'publishedAt') ? formatDateValue(textual(row, 'publishedAt')!) : statusLabel(textual(row, 'status'))) || translate("common:status.PUBLISHED")}</small></div>{id != null ? <button type="button" className={styles.secondary} onClick={() => setSelectedReportId(id)}>{translate("common:status.OPEN")}</button> : null}</article>; })}</div>}{reportDetail.data !== undefined ? <div className={styles.detail}><RecordSummaryList value={reportDetail.data}/></div> : null}</WorkspaceSection></div> : <section className={styles.emptyPanel}><strong>{translate("operations:legacy.chooseCourse")}</strong><span>{translate("operations:legacy.chooseCourseHelp")}</span></section>}
        {validCourse ? <WorkspaceSection title={translate("learning:schedule.title")}>{calendar.isPending ? <p role="status">{translate("common:feedback.loading")}</p> : calendar.isError ? null : calendarRows.length === 0 ? <p className={styles.empty}>{translate("operations:legacy.noOccurrence")}</p> : <div className={styles.list}>{calendarRows.map((row, index) => { const occurrenceId = numeric(row, 'occurrenceId', 'sessionOccurrenceId'); const selected = occurrenceId != null && occurrenceId === numeric(selectedOccurrence ?? {}, 'occurrenceId', 'sessionOccurrenceId'); return <article className={styles.row} key={occurrenceId ?? index}><div><strong>{textual(row, 'title', 'courseTitle', 'courseCode') || translate("learning:schedule.class")}</strong><small>{[formatDateValue(textual(row, 'occurrenceDate', 'date') ?? ''), formatClockTime(textual(row, 'startTime') ?? ''), textual(row, 'location')].filter(Boolean).join(' · ')}</small></div>{occurrenceId != null ? <button type="button" className={selected ? styles.primary : styles.secondary} onClick={() => setSelectedOccurrence(row)}>{selected ? translate("operations:legacy.selected") : translate("learning:schedule.requestChange")}</button> : null}</article>; })}</div>}{selectedOccurrence ? <form noValidate className={styles.form} onSubmit={eventSubmit => { eventSubmit.preventDefault(); submitSchedule(eventSubmit.currentTarget); }}><label>{translate("operations:requestType")}<select value={schedule.requestType} onChange={change => setSchedule(current => ({...current, requestType: change.target.value}))}>{SCHEDULE_REQUEST_TYPES.map(type => <option key={type} value={type}>{statusLabel(type)}</option>)}</select></label>{schedule.requestType === SCHEDULE_REQUEST_TYPES[1] ? <><label>{translate("operations:proposedDate")}<EnglishDateInput name="date" aria-label={translate("operations:proposedDate")} value={schedule.date} onChangeValue={date => setSchedule(current => ({...current, date}))}/></label><label>{translate("operations:proposedStart")}<EnglishTimeInput name="start" aria-label={translate("operations:proposedStart")} value={schedule.start} onChangeValue={start => setSchedule(current => ({...current, start}))}/></label><label>{translate("operations:proposedEnd")}<EnglishTimeInput name="end" aria-label={translate("operations:proposedEnd")} value={schedule.end} onChangeValue={end => setSchedule(current => ({...current, end}))}/></label></> : null}<label>{translate("common:fields.reason")}<textarea value={schedule.reason} onChange={change => setSchedule(current => ({...current, reason: change.target.value}))}/></label><button className={styles.primary} disabled={scheduleMutation.isPending}>{translate("operations:submitRequest")}</button></form> : null}</WorkspaceSection> : null}
      </div> : null}

      {scheduleInvalid ? <p className={styles.formMessage} role="alert">{translate("learning:schedule.invalidRange")}</p> : null}
      {scheduleMutation.isError ? <p className={styles.formMessage} role="alert">{getApiErrorMessage(scheduleMutation.error, translate("operations:legacy.requestFailed"))}</p> : null}
      {eventValidationKey ? <p className={styles.formMessage} role="alert">{translate(eventValidationKey)}</p> : null}
      {eventMutation.isError ? <p className={styles.formMessage} role="alert">{getApiErrorMessage(eventMutation.error, translate(personalEventErrorKey(eventMutation.error, eventMutation.variables === 'delete')))}</p> : null}
      {[{labelKey: "operations:legacy.courseSelection", query: courses, visible: true}, {labelKey: "learning:hours.title", query: hours, visible: validCourse && section === 'overview' && !hoursNotConfigured}, {labelKey: "navigation:parent.reports", query: reports, visible: validCourse && section === 'overview'}, {labelKey: "operations:reportDetail", query: reportDetail, visible: validCourse && selectedReportId != null && section === 'overview'}, {labelKey: "common:sidebar.calendar", query: calendar, visible: student || section === 'calendar'}, {labelKey: "operations:legacy.personalEvents", query: personalEvents, visible: section === 'calendar'}].filter(({query, visible}) => visible && query.isError).map(({labelKey, query}) => <div className={styles.inlineAlert} key={labelKey} role="alert"><p>{getApiErrorMessage(query.error, translate('operations:legacy.loadFailedNamed', {section: translate(labelKey)}))}</p><button type="button" onClick={() => void query.refetch()}>{translate('common:actions.retryTarget', {target: translate(labelKey)})}</button></div>)}
      {eventReadError != null ? <p className={styles.formMessage} role="alert">{getApiErrorMessage(eventReadError, translate("calendar:editor.loadFailed"))}</p> : null}
      {selectedOccurrence && section === 'overview' ? <CollapsibleSection title={translate("operations:legacy.selectedAttendance")} revealKey={selectedOccurrence ? String(selectedOccurrence.occurrenceId ?? selectedOccurrence.sessionOccurrenceId) : undefined}>{ownOccurrenceAttendance.isPending ? <p role="status">{translate("operations:legacy.loadingAttendance")}</p> : ownOccurrenceAttendance.isError ? <p role="alert">{getApiErrorMessage(ownOccurrenceAttendance.error, translate("operations:legacy.attendanceFailed"))}</p> : <RecordSummaryList value={ownOccurrenceAttendance.data}/>}</CollapsibleSection> : null}
      {section === 'calendar' ? <div className={styles.workspace}><div className={styles.grid}><WorkspaceSection title={translate("operations:legacy.academicCalendar")}>{calendar.isPending ? <p role="status">{translate("calendar:loading")}</p> : calendar.isSuccess ? <RecordSummaryList value={calendar.data} emptyMessage={translate("operations:legacy.noCalendar")}/> : null}</WorkspaceSection><CollapsibleSection title={translate("operations:legacy.personalEvents")}>{personalEvents.isPending ? <p role="status">{translate("common:feedback.loading")}</p> : personalEvents.isError ? <p>{translate("calendar:errors.personal")}</p> : eventRows.length === 0 ? <p className={styles.empty}>{translate("operations:legacy.noEvents")}</p> : <div className={styles.list}>{eventRows.map((row, index) => <article className={styles.row} key={numeric(row, 'eventId', 'id') ?? index}><div><strong>{textual(row, 'title') || translate("calendar:kinds.Personal")}</strong><small>{[formatDateValue(textual(row, 'startsAtLocal', 'startsAt') ?? '', {hour: 'numeric', minute: '2-digit'}), textual(row, 'timezone')].filter(Boolean).join(' · ')}</small></div><button type="button" className={styles.secondary} disabled={loadingEventId != null} onClick={() => void openEvent(row)}>{loadingEventId === numeric(row, 'eventId', 'id') ? translate("common:feedback.loading") : translate("common:actions.edit")}</button></article>)}</div>}</CollapsibleSection></div><CollapsibleSection title={selectedEvent ? translate("calendar:editor.editTitle") : translate("operations:legacy.createEventTitle")} revealKey={editorReveal}><form noValidate className={styles.form} onSubmit={submit => { submit.preventDefault(); submitEvent(submit.currentTarget); }}><label>{translate("common:fields.title")}<input required value={event.title ?? ''} onChange={change => setEvent(current => ({...current, title: change.target.value}))}/></label><label>{translate("calendar:editor.starts")}<EnglishDateTimeInput name="startsAtLocal" aria-label={translate("calendar:editor.starts")} required value={event.startsAtLocal ?? ''} onChangeValue={startsAtLocal => setEvent(current => ({...current, startsAtLocal}))}/></label><label>{translate("calendar:editor.ends")}<EnglishDateTimeInput name="endsAtLocal" aria-label={translate("calendar:editor.ends")} required value={event.endsAtLocal ?? ''} onChangeValue={endsAtLocal => setEvent(current => ({...current, endsAtLocal}))}/></label><label>{translate("calendar:editor.timezone")}<input value={event.timezone ?? ''} onChange={change => setEvent(current => ({...current, timezone: change.target.value}))}/></label><label>{translate("operations:legacy.reminder")}<input name="reminderMinutesBefore" type="number" min="0" step="1" value={event.reminderMinutesBefore ?? ''} onChange={change => setEvent(current => ({...current, reminderMinutesBefore: change.target.value ? Number(change.target.value) : undefined}))}/></label><div className={styles.actions}><button className={styles.primary} disabled={eventMutation.isPending || loadingEventId != null || Boolean(eventReadError)}>{selectedEvent ? translate("common:actions.saveChanges") : translate("calendar:editor.create")}</button>{selectedEvent ? <><button type="button" className={styles.secondary} onClick={() => { setSelectedEvent(null); setEventValidationKey(undefined); setEvent({title: '', startsAtLocal: '', endsAtLocal: '', timezone}); }}>{translate("common:actions.cancel")}</button><button type="button" className={styles.danger} disabled={eventMutation.isPending || loadingEventId != null || Boolean(eventReadError)} onClick={() => eventMutation.mutate('delete')}>{translate("calendar:editor.delete")}</button></> : null}</div></form></CollapsibleSection></div> : null}

      {instructor && (section === 'teaching' || section === 'availability') ? <TeacherOperationsSections section={section} timezone={timezone}/> : null}
    </div>
  );
};

const MyOperationsPage: React.FC<{embedded?: boolean}> = ({embedded = false}) => {
  const {user} = useRequiredAuth();
  if (canUseStudentLearningOperations(user)) return embedded ? <StudentLearningPage/> : <Navigate to={STUDENT_LEARNING_PATH} replace/>;
  return !embedded && user.role === 'USER' && user.level === 'INSTRUCTOR' ? <InstructorOperationsPage/> : <LegacyMyOperationsPage embedded={embedded}/>;
};
export default MyOperationsPage;
