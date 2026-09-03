import {COURSE_SESSION_DAYS as DAYS, COURSE_SESSION_TYPES as TYPES} from '@/configs/courseSessions';
import {FormEvent, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, Clock3, MapPin, Pencil, Plus, Trash2, X} from 'lucide-react';
import {Link, useParams} from 'react-router-dom';
import type {CourseSession, CourseSessionPayload, SessionDayOfWeek, SessionType} from '@/apis';
import {unwrapData} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {DurationSelect} from '@/components/DurationSelect';
import {EnglishTimeInput} from '@/components/EnglishDateInput';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {
  addMinutesToTimeValue,
  DEFAULT_DURATION_MINUTES,
  presetDuration,
  SHORT_DURATION_OPTIONS,
  timeDurationMinutes,
} from '@/utils/dateTimeRange';
import styles from '../CourseEventsPage/index.module.scss';

const dayLabel = (day: SessionDayOfWeek) => DAYS.find(item => item.value === day)?.label ?? day;
const emptyDraft = (): CourseSessionPayload => ({type: 'Lecture', dayOfWeek: 'MON', startTime: '09:00', endTime: '10:00', location: ''});
const toDraft = (session: CourseSession): CourseSessionPayload => ({type: session.type, dayOfWeek: session.dayOfWeek, startTime: session.startTime.slice(0, 5), endTime: session.endTime.slice(0, 5), location: session.location ?? ''});

const CourseSchedulePage = () => {
  const courseId = Number(useParams().courseId);
  const validCourse = Number.isInteger(courseId) && courseId > 0;
  const access = useCourseAccess(validCourse ? courseId : null);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CourseSessionPayload>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sessions = useQuery({queryKey: ['course-sessions', courseId], queryFn: async () => unwrapData(await courseApiService.getCourseSessions(courseId), 'List sessions'), enabled: validCourse});
  const save = useMutation({
    mutationFn: () => editingId === null ? courseApiService.createCourseSession(courseId, {...draft, location: draft.location?.trim() || null}) : courseApiService.updateCourseSession(courseId, editingId, {...draft, location: draft.location?.trim() || null}),
    onSuccess: async () => { await queryClient.invalidateQueries({queryKey: ['course-sessions', courseId]}); setEditorOpen(false); setEditingId(null); setMessage('Class time saved.'); },
    onError: () => setMessage('The class time could not be saved.'),
  });
  const remove = useMutation({
    mutationFn: (id: number) => courseApiService.deleteCourseSession(courseId, id),
    onSuccess: async () => { await queryClient.invalidateQueries({queryKey: ['course-sessions', courseId]}); setConfirmDeleteId(null); setMessage('Class time deleted.'); },
    onError: () => setMessage('The class time could not be deleted.'),
  });

  const invalidTime = draft.endTime <= draft.startTime;
  const rangeDuration = timeDurationMinutes(draft.startTime, draft.endTime);
  const selectedDuration = presetDuration(rangeDuration, SHORT_DURATION_OPTIONS);
  const changeStartTime = (value: string) => {
    const duration = rangeDuration ?? DEFAULT_DURATION_MINUTES;
    setDraft(current => ({
      ...current,
      startTime: value,
      endTime: addMinutesToTimeValue(value, duration) || current.endTime,
    }));
  };
  const changeDuration = (minutes: number) => {
    setDraft(current => ({
      ...current,
      endTime: addMinutesToTimeValue(current.startTime, minutes) || current.endTime,
    }));
  };
  const ordered = [...(sessions.data ?? [])].sort((a, b) => `${a.dayOfWeek}${a.startTime}`.localeCompare(`${b.dayOfWeek}${b.startTime}`));
  const submit = (event: FormEvent) => { event.preventDefault(); setMessage(null); save.mutate(); };

  return (
    <main className={styles.page}>
      <header className={styles.header}><Link to={`/course/${courseId}`} className={styles.backLink} aria-label="Back to course"><ArrowLeft size={22}/></Link><div className={styles.headerText}><p className={styles.eyebrow}>Recurring weekly schedule</p><h1>Course schedule</h1></div>{access.canManageCourseEvents && !editorOpen ? <button type="button" className={styles.primaryButton} onClick={() => { setDraft(emptyDraft()); setEditingId(null); setEditorOpen(true); }}><Plus size={17}/> Add class time</button> : null}</header>
      {message ? <p className={message.includes('could not') ? styles.error : styles.success} role="status">{message}</p> : null}

      {editorOpen ? <form className={styles.card} onSubmit={submit}>
        <div className={styles.cardHeader}><div><h2>{editingId === null ? 'Add class time' : 'Edit class time'}</h2><p>This repeats every week in the course timezone. New class times default to one hour.</p></div><button type="button" className={styles.iconButton} aria-label="Close editor" onClick={() => setEditorOpen(false)}><X size={18}/></button></div>
        <div className={styles.formGrid}>
          <label><span>Type</span><select value={draft.type} onChange={event => setDraft(current => ({...current, type: event.target.value as SessionType}))}>{TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
          <label><span>Day</span><select value={draft.dayOfWeek} onChange={event => setDraft(current => ({...current, dayOfWeek: event.target.value as SessionDayOfWeek}))}>{DAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
          <label><span>Starts</span><EnglishTimeInput required value={draft.startTime} onChangeValue={changeStartTime}/></label>
          <label><span>Ends</span><EnglishTimeInput required value={draft.endTime} onChangeValue={value => setDraft(current => ({...current, endTime: value}))}/></label>
          <DurationSelect minutes={selectedDuration} options={SHORT_DURATION_OPTIONS} onChange={changeDuration}/>
          <span/>
          <label className={styles.full}><span>Location</span><input value={draft.location ?? ''} onChange={event => setDraft(current => ({...current, location: event.target.value}))}/></label>
        </div>
        {invalidTime ? <p className={styles.error}>End time must be later than start time.</p> : null}
        <div className={styles.formFooter}><button type="submit" className={styles.primaryButton} disabled={save.isPending || invalidTime}>{save.isPending ? 'Saving…' : 'Save class time'}</button></div>
      </form> : <section className={styles.card}>
        <div className={styles.cardHeader}><div><h2>Weekly class times</h2><p>{ordered.length} recurring sessions</p></div></div>
        {sessions.isPending ? <p className={styles.muted}>Loading schedule…</p> : sessions.isError ? <p className={styles.error}>Could not load the schedule.</p> : ordered.length === 0 ? <p className={styles.muted}>No class times have been set.</p> : <ul className={styles.eventList}>{ordered.map(session => <li key={session.id}><div className={styles.announcementRow}><div className={styles.sessionSummary}><span className={styles.dateTile}><strong>{session.dayOfWeek}</strong></span><span className={styles.eventText}><strong>{session.type}</strong><small><Clock3 size={13}/> {session.startTime.slice(0, 5)} – {session.endTime.slice(0, 5)} · {dayLabel(session.dayOfWeek)}{session.location ? <> · <MapPin size={13}/> {session.location}</> : null}</small></span></div>{access.canManageCourseEvents ? <div className={styles.rowActions}><button type="button" className={styles.iconButton} aria-label={`Edit ${session.type} on ${dayLabel(session.dayOfWeek)}`} onClick={() => { setDraft(toDraft(session)); setEditingId(session.id); setEditorOpen(true); }}><Pencil size={16}/></button>{confirmDeleteId === session.id ? <><button type="button" className={styles.dangerButton} onClick={() => remove.mutate(session.id)}>Confirm</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmDeleteId(null)}>Cancel</button></> : <button type="button" className={styles.iconButton} aria-label={`Delete ${session.type} on ${dayLabel(session.dayOfWeek)}`} onClick={() => setConfirmDeleteId(session.id)}><Trash2 size={16}/></button>}</div> : null}</div></li>)}</ul>}
      </section>}
    </main>
  );
};

export default CourseSchedulePage;
