import { useTranslation } from 'react-i18next';
import {FormEvent, useEffect, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, CalendarDays, Clock3, MapPin, Pencil, Plus, Trash2, X} from 'lucide-react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import type {CourseEvent, CourseEventPayload} from '@/apis';
import {unwrapData} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {DurationSelect} from '@/components/DurationSelect';
import {EnglishDateInput, EnglishTimeInput} from '@/components/EnglishDateInput';
import MarkdownMessage from '@/components/MarkdownMessage';
import {RichTextEditor} from '@/components/RichTextEditor';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorCode, isConflict} from '@/utils/apiError';
import {
  addMinutesToTimeValue,
  defaultTimeRange,
  DEFAULT_DURATION_MINUTES,
  presetDuration,
  SHORT_DURATION_OPTIONS,
  timeDurationMinutes,
} from '@/utils/dateTimeRange';
import {parseInputDate, parseInputTime} from '@/i18n/dateInput';
import {formatClockTime, formatDateTime, formatDateValue, formatNumber} from '@/i18n/formatting';
import styles from './index.module.scss';

const emptyEvent = (): CourseEventPayload => {
  const range = defaultTimeRange();
  return {
    name: '', date: range.date, startTime: range.start, endTime: range.end, location: '', description: '',
  };
};

const toDraft = (event: CourseEvent): CourseEventPayload => ({
  name: event.name,
  date: event.date,
  startTime: event.startTime?.slice(0, 5) ?? '',
  endTime: event.endTime?.slice(0, 5) ?? '',
  location: event.location ?? '',
  description: event.description ?? '',
});

const buildCourseEventRequest = (
  draft: CourseEventPayload,
  mode: 'create' | 'edit',
  expectedVersion?: number,
): CourseEventPayload => ({
  ...draft,
  name: draft.name.trim(),
  startTime: draft.startTime || null,
  endTime: draft.endTime || null,
  location: mode === 'edit' ? draft.location?.trim() ?? null : draft.location?.trim() || null,
  description: mode === 'edit' ? draft.description?.trim() ?? null : draft.description?.trim() || null,
  expectedVersion: mode === 'edit' ? expectedVersion : undefined,
});

interface SaveEventAttempt {
  request: CourseEventPayload;
  idempotencyKey: string;
  operation: string;
  mode: 'create' | 'edit';
}

interface DeleteEventAttempt {
  expectedVersion?: number;
  idempotencyKey: string;
  operation: string;
}

const CourseEventsPage = () => {
  const { t: translate } = useTranslation();
  const params = useParams();
  const courseId = Number(params.courseId);
  const eventId = params.eventId ? Number(params.eventId) : null;
  const validCourse = Number.isInteger(courseId) && courseId > 0;
  const validEvent = eventId === null || (Number.isInteger(eventId) && eventId > 0);
  const access = useCourseAccess(validCourse ? courseId : null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const idempotency = useIdempotencyCheckpoint();
  const [draft, setDraft] = useState<CourseEventPayload>(emptyEvent);
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<{key: string; tone: 'success' | 'error'} | null>(null);

  const eventsQuery = useQuery({
    queryKey: ['course-events', courseId],
    queryFn: async () => unwrapData(await courseApiService.listCourseEvents(courseId), 'listCourseEvents'),
    enabled: validCourse,
    retry: 1,
  });
  const selectedEventQuery = useQuery({
    queryKey: ['course-event', courseId, eventId],
    queryFn: async () => unwrapData(await courseApiService.getCourseEvent(courseId, eventId!), 'getCourseEvent'),
    enabled: validCourse && validEvent && eventId !== null,
    retry: 1,
  });
  const selectedEvent = selectedEventQuery.data;

  useEffect(() => {
    setEditorMode(null);
    setConfirmDelete(false);
    setMessage(null);
  }, [eventId]);

  const saveEvent = useMutation({
    mutationFn: ({request, idempotencyKey, mode}: SaveEventAttempt) =>
      mode === 'edit' && eventId !== null
        ? courseApiService.updateCourseEvent(courseId, eventId, request, idempotencyKey)
        : courseApiService.createCourseEvent(courseId, request, idempotencyKey),
    onSuccess: async (response, attempt) => {
      const saved = unwrapData(response, 'saveCourseEvent');
      idempotency.complete(attempt.operation, attempt.idempotencyKey);
      setEditorMode(null);
      setMessage({key: attempt.mode === 'edit' ? 'courseTools:events.updated' : 'courseTools:events.created', tone: 'success'});
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['course-events', courseId]}),
        queryClient.invalidateQueries({queryKey: ['course-event', courseId, saved.id]}),
      ]);
      if (attempt.mode === 'create') navigate(`/course/${courseId}/events/${saved.id}`);
    },
    onError: async error => {
      if (isConflict(error) || getApiErrorCode(error) === 'COURSE_EVENT_VERSION_CONFLICT') {
        if (eventId !== null) {
          await selectedEventQuery.refetch();
        }
        setMessage({key: 'courseTools:events.saveConflict', tone: 'error'});
      } else {
        setMessage({key: 'courseTools:events.saveFailed', tone: 'error'});
      }
    },
  });

  const deleteEvent = useMutation({
    mutationFn: ({expectedVersion, idempotencyKey}: DeleteEventAttempt) =>
      courseApiService.deleteCourseEvent(courseId, eventId!, expectedVersion, idempotencyKey),
    onSuccess: async (_, attempt) => {
      idempotency.complete(attempt.operation, attempt.idempotencyKey);
      await queryClient.invalidateQueries({queryKey: ['course-events', courseId]});
      navigate(`/course/${courseId}/events`, {replace: true});
    },
    onError: async error => {
      if (isConflict(error) || getApiErrorCode(error) === 'COURSE_EVENT_VERSION_CONFLICT') {
        await selectedEventQuery.refetch();
        setMessage({key: 'courseTools:events.deleteConflict', tone: 'error'});
      } else {
        setMessage({key: 'courseTools:events.deleteFailed', tone: 'error'});
      }
    },
  });

  const submit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    setMessage(null);
    if (!editorMode || saveEvent.isPending) return;
    if (!draft.name.trim() || !parseInputDate(draft.date)) {
      setMessage({key: 'courseTools:events.invalidDate', tone: 'error'});
      return;
    }
    // Optional times distinguish all-day events from invalid partially typed input.
    const fields = new FormData(submitEvent.currentTarget);
    if (['startTime', 'endTime'].some(name => {const raw = String(fields.get(name) ?? '').trim(); return raw !== '' && !parseInputTime(raw);})) {
      setMessage({key: 'courseTools:events.invalidClock', tone: 'error'});
      return;
    }
    if (invalidTime) {setMessage({key: 'operations:invalidTime', tone: 'error'}); return;}
    const request = buildCourseEventRequest(draft, editorMode, selectedEvent?.version);
    const operation = editorMode === 'edit' && eventId !== null
      ? `course-event-update-${courseId}-${eventId}`
      : `course-event-create-${courseId}`;
    saveEvent.mutate({
      request,
      operation,
      mode: editorMode,
      idempotencyKey: idempotency.keyFor(operation, idempotencyFingerprint(request)),
    });
  };
  const requestDelete = () => {
    if (eventId === null) return;
    const expectedVersion = selectedEvent?.version;
    const operation = `course-event-delete-${courseId}-${eventId}`;
    const fingerprint = idempotencyFingerprint({courseId, eventId, expectedVersion});
    deleteEvent.mutate({
      expectedVersion,
      operation,
      idempotencyKey: idempotency.keyFor(operation, fingerprint),
    });
  };
  const openCreate = () => { setDraft(emptyEvent()); setEditorMode('create'); setMessage(null); };
  const openEdit = () => { if (selectedEvent) { setDraft(toDraft(selectedEvent)); setEditorMode('edit'); setMessage(null); } };
  const rangeDuration = timeDurationMinutes(draft.startTime ?? '', draft.endTime ?? '');
  const selectedDuration = presetDuration(rangeDuration, SHORT_DURATION_OPTIONS);
  const changeStartTime = (value: string) => {
    const duration = rangeDuration ?? DEFAULT_DURATION_MINUTES;
    setDraft(current => ({
      ...current,
      startTime: value,
      endTime: value ? addMinutesToTimeValue(value, duration) || current.endTime : current.endTime,
    }));
  };
  const changeDuration = (minutes: number) => {
    setDraft(current => ({
      ...current,
      endTime: current.startTime ? addMinutesToTimeValue(current.startTime, minutes) || current.endTime : current.endTime,
    }));
  };
  const invalidTime = Boolean(draft.startTime && draft.endTime && draft.endTime <= draft.startTime);
  const sortedEvents = [...(eventsQuery.data ?? [])].sort((a, b) => `${a.date}${a.startTime ?? ''}`.localeCompare(`${b.date}${b.startTime ?? ''}`));
  const failed = !validCourse || !validEvent || eventsQuery.isError || selectedEventQuery.isError;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <Link to={eventId === null ? `/course/${courseId}` : `/course/${courseId}/events`} className={styles.backLink} aria-label={eventId === null ? translate("course:grades.back") : translate('common:navigationControls.backToEvents')} title={eventId === null ? translate("course:grades.back") : translate('common:navigationControls.backToEvents')}><ArrowLeft size={22} aria-hidden="true"/></Link>
        <div className={styles.headerText}><p className={styles.eyebrow}>{translate("operations:courseEvents")}</p><h1>{selectedEvent?.name || (eventId === null ? translate("courseTools:events.title") : translate("courseTools:events.loading"))}</h1></div>
        {access.canManageCourseEvents && editorMode === null ? <button type="button" className={styles.primaryButton} onClick={eventId === null ? openCreate : openEdit}>{eventId === null ? <><Plus size={17}/> {' '}{translate("courseTools:events.add")}</> : <><Pencil size={17}/> {' '}{translate("calendar:editEvent")}</>}</button> : null}
      </div>

      {message ? <p className={message.tone === 'error' ? styles.error : styles.success} role={message.tone === 'error' ? 'alert' : 'status'}>{translate(message.key)}</p> : null}
      {failed ? <section className={styles.card} role="alert"><h2>{translate("courseTools:events.loadFailed")}</h2><button type="button" className={styles.primaryButton} onClick={() => { void eventsQuery.refetch(); void selectedEventQuery.refetch(); }}>{translate("common:actions.tryAgain")}</button></section> : null}

      {editorMode ? (
        <form className={styles.card} noValidate onSubmit={submit}>
          <div className={styles.cardHeader}><div><h2>{editorMode === 'create' ? translate("calendar:editor.create") : translate("calendar:editEvent")}</h2><p>{translate("courseTools:events.timezoneHelp")}</p></div><button type="button" className={styles.iconButton} aria-label={translate("courseTools:events.close")} onClick={() => setEditorMode(null)}><X size={18}/></button></div>
          <div className={styles.formGrid}>
            <label className={styles.full}><span>{translate("common:fields.name")}</span><input required value={draft.name} onChange={e => setDraft(current => ({...current, name: e.target.value}))}/></label>
            <label><span>{translate("common:fields.date")}</span><EnglishDateInput required aria-label={translate("common:fields.date")} value={draft.date} onChangeValue={value => setDraft(current => ({...current, date: value}))}/></label>
            <span/>
            <label><span>{translate("calendar:editor.starts")}</span><EnglishTimeInput name="startTime" aria-label={translate("calendar:editor.starts")} value={draft.startTime ?? ''} onChangeValue={changeStartTime}/></label>
            <label><span>{translate("calendar:editor.ends")}</span><EnglishTimeInput name="endTime" aria-label={translate("calendar:editor.ends")} value={draft.endTime ?? ''} onChangeValue={value => setDraft(current => ({...current, endTime: value}))}/></label>
            <DurationSelect minutes={selectedDuration} options={SHORT_DURATION_OPTIONS} onChange={changeDuration}/>
            <span/>
            <label className={styles.full}><span>{translate("calendar:details.location")}</span><input value={draft.location ?? ''} onChange={e => setDraft(current => ({...current, location: e.target.value}))}/></label>
            <div className={`${styles.full} ${styles.markdownField}`}>
              <span>{translate("common:fields.description")}</span>
              <RichTextEditor
                content={draft.description ?? ''}
                onChange={description => setDraft(current => ({...current, description}))}
                placeholder={translate("courseTools:events.descriptionPlaceholder")}
                ariaLabel={translate("common:fields.description")}
              />
            </div>
          </div>
          {invalidTime ? <p className={styles.error} role="alert">{translate("operations:invalidTime")}</p> : null}
          <div className={styles.formFooter}><button type="submit" className={styles.primaryButton} disabled={saveEvent.isPending || !draft.name.trim() || !draft.date || invalidTime}>{saveEvent.isPending ? translate("common:actions.saving") : translate("courseTools:events.save")}</button></div>
        </form>
      ) : eventId !== null && selectedEvent ? (
        <section className={styles.card}>
          {selectedEvent.description ? <MarkdownMessage className={styles.description} content={selectedEvent.description}/> : null}
          <dl className={styles.metadata}>
            <div><dt><CalendarDays size={18}/><span className={styles.srOnly}>{translate("common:fields.date")}</span></dt><dd>{formatDateValue(selectedEvent.date)}</dd></div>
            {selectedEvent.startTime ? <div><dt><Clock3 size={18}/><span className={styles.srOnly}>{translate("common:dateTime.time")}</span></dt><dd>{formatClockTime(selectedEvent.startTime)}{selectedEvent.endTime ? ` – ${formatClockTime(selectedEvent.endTime)}` : ''} {selectedEvent.timezone}</dd></div> : null}
            {selectedEvent.location ? <div><dt><MapPin size={18}/><span className={styles.srOnly}>{translate("calendar:details.location")}</span></dt><dd>{selectedEvent.location}</dd></div> : null}
          </dl>
          {access.canManageCourseEvents ? <div className={styles.dangerZone}>{confirmDelete ? <><p>{translate("courseTools:events.deleteConfirm")}</p><button type="button" className={styles.dangerButton} onClick={requestDelete} disabled={deleteEvent.isPending}>{translate("assessment:quiz.confirmDelete")}</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmDelete(false)}>{translate("common:actions.cancel")}</button></> : <button type="button" className={styles.dangerButton} onClick={() => setConfirmDelete(true)}><Trash2 size={16}/> {' '}{translate("calendar:editor.delete")}</button>}</div> : null}
        </section>
      ) : eventId === null && !failed ? (
        <section className={styles.card}>
          <div className={styles.cardHeader}><div><h2>{translate("courseTools:events.all")}</h2><p>{translate("courseTools:events.scheduled", {count: sortedEvents.length, number: formatNumber(sortedEvents.length)})}</p></div></div>
          {eventsQuery.isPending ? <p className={styles.muted}>{translate("courseTools:events.loadingList")}</p> : sortedEvents.length === 0 ? <p className={styles.muted}>{translate("courseTools:events.none")}</p> : <ul className={styles.eventList}>{sortedEvents.map(item => <li key={item.id}><Link to={`/course/${courseId}/events/${item.id}`}><span className={styles.dateTile}><strong>{formatDateTime(new Date(`${item.date}T12:00:00Z`), {day: 'numeric', timeZone: 'UTC'})}</strong><small>{formatDateTime(new Date(`${item.date}T12:00:00Z`), {month: 'short', timeZone: 'UTC'})}</small></span><span className={styles.eventText}><strong>{item.name}</strong><small>{item.startTime ? formatClockTime(item.startTime) : translate("calendar:allDay")}{item.location ? ` · ${item.location}` : ''}</small></span><span aria-hidden="true">→</span></Link></li>)}</ul>}
        </section>
      ) : null}
    </main>
  );
};

export default CourseEventsPage;
