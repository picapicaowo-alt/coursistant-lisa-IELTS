import {useState} from 'react';
import {ArrowRight, CalendarDays, Globe2, MapPin, Plus} from 'lucide-react';
import {useIsMutating, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData, type CourseResponse, type CourseSession, type CourseSessionPayload} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {EnglishDateInput, EnglishTimeInput} from '@/components/EnglishDateInput';
import {COURSE_SESSION_DAYS, COURSE_SESSION_TYPES} from '@/configs/courseSessions';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {isHttpStatus} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {courseManagementKeys as keys, formatCourseDate, formatCourseTime, parseAdvisorCourseOccurrences} from '../advising/courseManagement';
import styles from '../advising/CourseManagement.module.scss';

const emptySession = (): CourseSessionPayload => ({type: COURSE_SESSION_TYPES[0], dayOfWeek: COURSE_SESSION_DAYS[0].value, startTime: '', endTime: '', location: ''});
const sessionDraft = (session: CourseSession): CourseSessionPayload => ({type: session.type, dayOfWeek: session.dayOfWeek, startTime: session.startTime.slice(0, 5), endTime: session.endTime.slice(0, 5), location: session.location ?? ''});
const shortDate = (value: string): string => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('en-US', {weekday: 'short', month: 'short', day: 'numeric'}).format(new Date(year, month - 1, day));
};

function SessionFields({draft, onChange}: {draft: CourseSessionPayload; onChange: (draft: CourseSessionPayload) => void}) {
  return <>
    <label className={styles.field}>Session type<select value={draft.type} onChange={event => onChange({...draft, type: event.target.value as CourseSessionPayload['type']})}>{COURSE_SESSION_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
    <label className={styles.field}>Weekday<select value={draft.dayOfWeek} onChange={event => onChange({...draft, dayOfWeek: event.target.value as CourseSessionPayload['dayOfWeek']})}>{COURSE_SESSION_DAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
    <label className={styles.field}>Start time<EnglishTimeInput required value={draft.startTime} onChangeValue={startTime => onChange({...draft, startTime})} /></label>
    <label className={styles.field}>End time<EnglishTimeInput required value={draft.endTime} onChangeValue={endTime => onChange({...draft, endTime})} /></label>
    <label className={`${styles.field} ${styles.fieldWide}`}>Location (optional)<input value={draft.location ?? ''} onChange={event => onChange({...draft, location: event.target.value})} /></label>
  </>;
}

export function OwnerCourseSchedule({courseId, course, readOnly, canGenerateDates}: {courseId: number; course: CourseResponse; readOnly: boolean; canGenerateDates: boolean}) {
  const client = useQueryClient();
  // Schedule writes survive tab changes; block new actions after this view remounts.
  const schedulePending = useIsMutating({mutationKey: keys.scheduleWrites(courseId)}) > 0;
  const idempotency = useIdempotencyCheckpoint();
  const [draft, setDraft] = useState<CourseSessionPayload>(emptySession);
  const [editing, setEditing] = useState<{id: number; draft: CourseSessionPayload} | null>(null);
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [generationOpen, setGenerationOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [showAllOccurrences, setShowAllOccurrences] = useState(false);
  // Preserve course-local dates; never seed a write from today's UTC date or an invented term.
  const termRange = {from: course.termStartDate || '', to: course.termEndDate || ''};
  const [range, setRange] = useState(termRange);
  const sessionsKey = keys.sessions(courseId);
  const occurrencesKey = [...keys.occurrences(courseId), termRange] as const;
  const sessions = useQuery({queryKey: sessionsKey, queryFn: async () => unwrapData(await courseApiService.getCourseSessions(courseId), 'courseSessions'), retry: false});
  // The weekly template is usable independently. Read dated classes only when requested;
  // never synthesize them from recurrence rules, which cannot represent cancellations.
  const occurrences = useQuery({queryKey: occurrencesKey, queryFn: async () => parseAdvisorCourseOccurrences(unwrapData(await courseOperationsApiService.listSessionOccurrences(courseId, {from: termRange.from || undefined, to: termRange.to || undefined, includeHistory: false}), 'listSessionOccurrences')), enabled: datesOpen, retry: false});
  const canWrite = !readOnly && sessions.isSuccess && !sessions.isFetching;
  const refreshSchedule = async () => {
    await Promise.all([sessionsKey, keys.occurrences(courseId), keys.delivery(courseId), keys.owned].map(queryKey => client.invalidateQueries({queryKey})));
  };
  const create = useMutation({
    mutationKey: keys.scheduleWrites(courseId),
    mutationFn: async () => {
      if (!canWrite) throw new Error('Load the editable group-course schedule before making changes.');
      return idempotency.run('owner-create-session', [courseId, draft] as const, async (key, args) => unwrapData(await courseApiService.createCourseSession(...args, key), 'createCourseSession'));
    },
    onSuccess: async () => {setDraft(emptySession()); setSessionFormOpen(false); await refreshSchedule();},
  });
  const update = useMutation({
    mutationKey: keys.scheduleWrites(courseId),
    mutationFn: async () => {
      if (!canWrite || !editing) throw new Error('Load and select an editable recurring session first.');
      return idempotency.run('owner-update-session', [courseId, editing.id, editing.draft] as const, async (key, args) => unwrapData(await courseApiService.updateCourseSession(...args, key), 'updateCourseSession'));
    },
    onSuccess: async () => {setEditing(null); setSessionFormOpen(false); await refreshSchedule();},
  });
  const generate = useMutation({
    mutationKey: keys.scheduleWrites(courseId),
    mutationFn: async () => {
      if (!canGenerateDates || !sessions.isSuccess || !occurrences.isSuccess || !range.from || !range.to || range.to < range.from) throw new Error('Load the schedule and select a valid date range first.');
      return idempotency.run('owner-generate-occurrences', [courseId, range] as const, async (key, args) => unwrapData(await courseOperationsApiService.generateSessionOccurrences(...args, key), 'generateSessionOccurrences'));
    },
    onSuccess: async () => {setGenerationOpen(false); await refreshSchedule();},
  });
  const busy = schedulePending || create.isPending || update.isPending || generate.isPending;
  // Occurrence reads can fail independently of a successfully loaded course and weekly schedule.
  const error = sessions.error || create.error || update.error || generate.error;
  const visibleOccurrences = showAllOccurrences ? occurrences.data : occurrences.data?.slice(0, 8);
  const datesError = isHttpStatus(occurrences.error, 401) || isHttpStatus(occurrences.error, 403)
    ? advisingErrorMessage(occurrences.error, 'You do not have access to these class dates.')
    : 'Class dates could not be loaded.';

  return <div className={styles.scheduleWorkspace}>
    <section className={styles.scheduleSection} aria-labelledby="recurring-sessions-title">
      <header className={styles.scheduleSectionHeader}>
        <div><h2 id="recurring-sessions-title">Recurring sessions</h2><p>Manage active class structures and recurrence rules.</p></div>
        {canWrite ? <button type="button" className={styles.outlinePrimaryButton} disabled={busy} onClick={() => {setEditing(null); setDraft(emptySession()); setSessionFormOpen(true);}}><Plus size={16} aria-hidden="true" />Add session</button> : <span className={styles.statusBadge}>Read only</span>}
      </header>
      {sessions.isPending ? <p role="status" className={styles.helper}>Loading recurring sessions…</p> : null}
      {sessions.data?.length ? <div className={styles.sessionGrid}>{sessions.data.map(session => {
        const weekday = COURSE_SESSION_DAYS.find(day => day.value === session.dayOfWeek)?.label ?? session.dayOfWeek;
        return <article key={session.id} className={styles.sessionCard}>
          <header className={styles.sessionCardHeader}><span className={styles.sessionType} data-type={session.type}>{session.type}</span></header>
          <div className={styles.sessionTime}><h3>{formatCourseTime(session.startTime)} — {formatCourseTime(session.endTime)}</h3><strong>Every {weekday}</strong></div>
          <ul className={styles.sessionMeta}>
            <li><MapPin size={15} aria-hidden="true" />{session.location || 'Location not provided'}</li>
            <li><Globe2 size={15} aria-hidden="true" />{session.timezone || 'Timezone not provided'}</li>
            <li><CalendarDays size={15} aria-hidden="true" />Weekly · {course ? formatCourseDate(course.termStartDate) : 'Term start'} – {course ? formatCourseDate(course.termEndDate) : 'Term end'}</li>
          </ul>
          {canWrite ? <footer className={styles.sessionActions}><span><button type="button" className={styles.textAction} disabled={busy} onClick={() => {setEditing({id: session.id, draft: sessionDraft(session)}); setSessionFormOpen(true);}}>Edit</button><button type="button" className={styles.plainAction} disabled={busy} onClick={() => {setDraft(sessionDraft(session)); setEditing(null); setSessionFormOpen(true);}}>Duplicate</button></span></footer> : null}
        </article>;
      })}</div> : !sessions.isPending && !sessions.isError ? <p className={styles.helper}>No recurring sessions have been added.</p> : null}
    </section>

    {!readOnly && sessionFormOpen ? <section className={styles.editorPanel} aria-labelledby="session-form-title">
      <header className={styles.panelHeader}><div><h2 id="session-form-title">{editing ? 'Edit recurring session' : 'Add recurring session'}</h2><p>{editing ? 'Update the complete weekly template.' : 'Create another weekly teaching slot.'}</p></div></header>
      <form className={styles.formGrid} onSubmit={event => {event.preventDefault(); if (!canWrite || busy) return; if (editing) update.mutate(); else create.mutate();}}>
        <SessionFields draft={editing?.draft ?? draft} onChange={next => editing ? setEditing({...editing, draft: next}) : setDraft(next)} />
        <div className={styles.formActions}><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => {setEditing(null); setSessionFormOpen(false);}}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={!canWrite || busy || !(editing?.draft ?? draft).startTime || !(editing?.draft ?? draft).endTime || (editing?.draft ?? draft).endTime <= (editing?.draft ?? draft).startTime}>{editing ? 'Save session' : 'Add session'}</button></div>
      </form>
    </section> : null}

    {datesOpen && canGenerateDates && !occurrences.isError && generationOpen ? <section className={styles.editorPanel} aria-labelledby="generate-occurrences-title">
      <header className={styles.panelHeader}><div><h2 id="generate-occurrences-title">Generate dated occurrences</h2><p>Create calendar dates after the recurring pattern is complete.</p></div></header>
      <form className={styles.formGrid} onSubmit={event => {event.preventDefault(); if (canGenerateDates && !busy) generate.mutate();}}><label className={styles.field}>Generate from<EnglishDateInput required value={range.from} onChangeValue={from => setRange(current => ({...current, from}))} /></label><label className={styles.field}>Generate through<EnglishDateInput required value={range.to} onChangeValue={to => setRange(current => ({...current, to}))} /></label><div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => setGenerationOpen(false)}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={!canGenerateDates || busy || !range.from || !range.to || range.to < range.from || !sessions.data?.length}>{generate.isPending ? 'Generating…' : 'Generate occurrences'}</button></div></form>
    </section> : null}

    <button type="button" className={styles.textAction} aria-expanded={datesOpen} aria-controls="course-class-dates" onClick={() => setDatesOpen(current => !current)}>{datesOpen ? 'Hide class dates' : 'View class dates'}<CalendarDays size={16} aria-hidden="true" /></button>
    {datesOpen ? <section id="course-class-dates" className={styles.occurrenceTableWrap} aria-labelledby="upcoming-occurrences-title">
      <header className={styles.panelHeader}><div><h2 id="upcoming-occurrences-title">Course occurrences</h2></div>{canGenerateDates && occurrences.isSuccess ? <button type="button" className={styles.secondaryButton} disabled={busy || !sessions.data?.length} onClick={() => {setRange(termRange); setGenerationOpen(true);}}>Generate dates</button> : null}</header>
      {occurrences.isPending ? <p role="status" className={styles.helper}>Loading course occurrences…</p> : null}
      {occurrences.isError ? <p className={styles.helper} role="alert">{datesError} <button type="button" className={styles.textAction} disabled={occurrences.isFetching} onClick={() => void occurrences.refetch()}>{occurrences.isFetching ? 'Loading…' : 'Try again'}</button></p> : null}
      {visibleOccurrences?.length ? <table className={styles.occurrenceTable}><thead><tr><th>Date</th><th>Time</th><th>Location</th><th>Status</th></tr></thead><tbody>{visibleOccurrences.map(item => {
        return <tr key={item.id}><td data-label="Date">{shortDate(item.date)}</td><td data-label="Time">{formatCourseTime(item.startTime)}{item.endTime ? `–${formatCourseTime(item.endTime)}` : ''}</td><td data-label="Location">{item.location || 'Not provided'}</td><td data-label="Status"><span className={styles.statusPill} data-state={item.status}>{item.status?.replace(/_/g, ' ') || 'Not provided'}</span></td></tr>;
      })}</tbody></table> : !occurrences.isPending && !occurrences.isError ? <p className={styles.helper}>No occurrences were returned for this period.</p> : null}
      {occurrences.data && occurrences.data.length > 8 ? <button type="button" className={styles.textAction} onClick={() => setShowAllOccurrences(current => !current)}>{showAllOccurrences ? 'Show fewer occurrences' : `View all ${occurrences.data.length} occurrences`}<ArrowRight size={15} aria-hidden="true" /></button> : null}
    </section> : null}
    {error ? <p role="alert" className={styles.error}>{advisingErrorMessage(error, 'The course schedule could not be loaded or updated.')} {sessions.isError ? <button type="button" className={styles.ghostButton} onClick={() => void sessions.refetch()}>Retry</button> : 'Your input is preserved. Review the form and submit again to retry.'}</p> : null}
  </div>;
}
