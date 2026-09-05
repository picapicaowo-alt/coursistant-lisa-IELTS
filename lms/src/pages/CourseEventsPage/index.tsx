import {useTranslation} from 'react-i18next';
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
  const {t: translate} = useTranslation();
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
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage(attempt.mode === 'edit' ? 'Event updated.' : 'Event created.');
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
        setMessage('This event was modified by another user. The latest version has been loaded. Please review your changes and try saving again.');
      } else {
        setMessage('The event could not be saved.');
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
        setMessage('This event was modified by another user. Please review the updated event before deleting.');
      } else {
        setMessage('The event could not be deleted.');
      }
    },
  });

  const submit = (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setMessage(null);
    if (!editorMode) return;
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
        <div className={styles.headerText}><p className={styles.eyebrow}>Course events</p><h1>{selectedEvent?.name || (eventId === null ? 'Events' : 'Loading event…')}</h1></div>
        {access.canManageCourseEvents && editorMode === null ? <button type="button" className={styles.primaryButton} onClick={eventId === null ? openCreate : openEdit}>{eventId === null ? <><Plus size={17}/> Add event</> : <><Pencil size={17}/> Edit event</>}</button> : null}
      </div>

      {message ? <p className={message.includes('could not') ? styles.error : styles.success} role="status">{message}</p> : null}
      {failed ? <section className={styles.card} role="alert"><h2>This event view could not be loaded</h2><button type="button" className={styles.primaryButton} onClick={() => { void eventsQuery.refetch(); void selectedEventQuery.refetch(); }}>Try again</button></section> : null}

      {editorMode ? (
        <form className={styles.card} onSubmit={submit}>
          <div className={styles.cardHeader}><div><h2>{editorMode === 'create' ? 'Create event' : 'Edit event'}</h2><p>Times use the course timezone. New events default to one hour.</p></div><button type="button" className={styles.iconButton} aria-label="Close event editor" onClick={() => setEditorMode(null)}><X size={18}/></button></div>
          <div className={styles.formGrid}>
            <label className={styles.full}><span>Name</span><input required value={draft.name} onChange={e => setDraft(current => ({...current, name: e.target.value}))}/></label>
            <label><span>Date</span><EnglishDateInput required value={draft.date} onChangeValue={value => setDraft(current => ({...current, date: value}))}/></label>
            <span/>
            <label><span>Starts</span><EnglishTimeInput value={draft.startTime ?? ''} onChangeValue={changeStartTime}/></label>
            <label><span>Ends</span><EnglishTimeInput value={draft.endTime ?? ''} onChangeValue={value => setDraft(current => ({...current, endTime: value}))}/></label>
            <DurationSelect minutes={selectedDuration} options={SHORT_DURATION_OPTIONS} onChange={changeDuration}/>
            <span/>
            <label className={styles.full}><span>Location</span><input value={draft.location ?? ''} onChange={e => setDraft(current => ({...current, location: e.target.value}))}/></label>
            <div className={`${styles.full} ${styles.markdownField}`}>
              <span>Description</span>
              <RichTextEditor
                content={draft.description ?? ''}
                onChange={description => setDraft(current => ({...current, description}))}
                placeholder="Add an event description…"
                ariaLabel="Description"
              />
            </div>
          </div>
          {invalidTime ? <p className={styles.error} role="alert">End time must be later than start time.</p> : null}
          <div className={styles.formFooter}><button type="submit" className={styles.primaryButton} disabled={saveEvent.isPending || !draft.name.trim() || !draft.date || invalidTime}>{saveEvent.isPending ? 'Saving…' : 'Save event'}</button></div>
        </form>
      ) : eventId !== null && selectedEvent ? (
        <section className={styles.card}>
          {selectedEvent.description ? <MarkdownMessage className={styles.description} content={selectedEvent.description}/> : null}
          <dl className={styles.metadata}>
            <div><dt><CalendarDays size={18}/><span className={styles.srOnly}>Date</span></dt><dd>{selectedEvent.date}</dd></div>
            {selectedEvent.startTime ? <div><dt><Clock3 size={18}/><span className={styles.srOnly}>Time</span></dt><dd>{selectedEvent.startTime.slice(0, 5)}{selectedEvent.endTime ? ` – ${selectedEvent.endTime.slice(0, 5)}` : ''} {selectedEvent.timezone}</dd></div> : null}
            {selectedEvent.location ? <div><dt><MapPin size={18}/><span className={styles.srOnly}>Location</span></dt><dd>{selectedEvent.location}</dd></div> : null}
          </dl>
          {access.canManageCourseEvents ? <div className={styles.dangerZone}>{confirmDelete ? <><p>Delete this event for everyone in the course?</p><button type="button" className={styles.dangerButton} onClick={requestDelete} disabled={deleteEvent.isPending}>Confirm delete</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmDelete(false)}>Cancel</button></> : <button type="button" className={styles.dangerButton} onClick={() => setConfirmDelete(true)}><Trash2 size={16}/> Delete event</button>}</div> : null}
        </section>
      ) : eventId === null && !failed ? (
        <section className={styles.card}>
          <div className={styles.cardHeader}><div><h2>All events</h2><p>{sortedEvents.length} scheduled</p></div></div>
          {eventsQuery.isPending ? <p className={styles.muted}>Loading events…</p> : sortedEvents.length === 0 ? <p className={styles.muted}>No course events have been scheduled.</p> : <ul className={styles.eventList}>{sortedEvents.map(item => <li key={item.id}><Link to={`/course/${courseId}/events/${item.id}`}><span className={styles.dateTile}><strong>{new Date(`${item.date}T12:00:00`).toLocaleDateString('en-US', {day: 'numeric'})}</strong><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString('en-US', {month: 'short'})}</small></span><span className={styles.eventText}><strong>{item.name}</strong><small>{item.startTime ? item.startTime.slice(0, 5) : 'All day'}{item.location ? ` · ${item.location}` : ''}</small></span><span aria-hidden="true">→</span></Link></li>)}</ul>}
        </section>
      ) : null}
    </main>
  );
};

export default CourseEventsPage;
