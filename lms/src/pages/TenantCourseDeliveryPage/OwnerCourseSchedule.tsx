import {CollapsibleSection} from '@/components/CollapsibleSection';
import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData, type CourseSessionPayload} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {EnglishDateInput, EnglishTimeInput} from '@/components/EnglishDateInput';
import {COURSE_SESSION_DAYS, COURSE_SESSION_TYPES} from '@/configs/courseSessions';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';

export function OwnerCourseSchedule({courseId}: {courseId: number}) {
  const client = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [draft, setDraft] = useState<CourseSessionPayload>({type: COURSE_SESSION_TYPES[0], dayOfWeek: COURSE_SESSION_DAYS[0].value, startTime: '', endTime: '', location: ''});
  const [range, setRange] = useState({from: '', to: ''});
  const sessions = useQuery({queryKey: ['advisor', 'owned-course-sessions', courseId], queryFn: async () => unwrapData(await courseApiService.getCourseSessions(courseId), 'courseSessions'), retry: false});
  const refresh = () => client.invalidateQueries({queryKey: ['advisor', 'course-delivery', courseId]});
  const save = useMutation({
    mutationFn: () => idempotency.run('owner-create-session', [courseId, draft], key => courseApiService.createCourseSession(courseId, draft, key)),
    onSuccess: async () => {await client.invalidateQueries({queryKey: ['advisor', 'owned-course-sessions', courseId]}); await refresh();},
  });
  const generate = useMutation({
    mutationFn: () => idempotency.run('owner-generate-occurrences', [courseId, range], key => courseOperationsApiService.generateSessionOccurrences(courseId, range, key)),
    onSuccess: refresh,
  });
  return <CollapsibleSection title="Course schedule" className={styles.disclosureLayout} summary="Times use the course timezone. Add recurring sessions, then generate dated occurrences before checking readiness.">


    {sessions.isPending ? <p role="status">Loading schedule…</p> : null}
    {sessions.data?.map(session => <p key={session.id}>{session.type} · {session.dayOfWeek} · {session.startTime}–{session.endTime} · {session.timezone}</p>)}
    <form className={styles.form} onSubmit={event => {event.preventDefault(); save.mutate();}}>
      <label>Session type<select value={draft.type} onChange={event => setDraft(current => ({...current, type: event.target.value as CourseSessionPayload['type']}))}>{COURSE_SESSION_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
      <label>Weekday<select value={draft.dayOfWeek} onChange={event => setDraft(current => ({...current, dayOfWeek: event.target.value as CourseSessionPayload['dayOfWeek']}))}>{COURSE_SESSION_DAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
      <label>Start time<EnglishTimeInput required value={draft.startTime} onChangeValue={startTime => setDraft(current => ({...current, startTime}))}/></label>
      <label>End time<EnglishTimeInput required value={draft.endTime} onChangeValue={endTime => setDraft(current => ({...current, endTime}))}/></label>
      <label>Location<input value={draft.location ?? ''} onChange={event => setDraft(current => ({...current, location: event.target.value}))}/></label>
      <button className={styles.primary} disabled={save.isPending || draft.endTime <= draft.startTime}>Add recurring session</button>
    </form>
    <form className={styles.form} onSubmit={event => {event.preventDefault(); generate.mutate();}}>
      <label>Generate from<EnglishDateInput required value={range.from} onChangeValue={from => setRange(current => ({...current, from}))}/></label>
      <label>Generate through<EnglishDateInput required value={range.to} onChangeValue={to => setRange(current => ({...current, to}))}/></label>
      <button className={styles.secondary} disabled={generate.isPending || range.to < range.from || !sessions.data?.length}>Generate occurrences</button>
    </form>
    {generate.isSuccess ? <p role="status">Occurrences generated. Validate course readiness before publishing.</p> : null}
    {sessions.error || save.error || generate.error ? <p role="alert">{advisingErrorMessage(sessions.error || save.error || generate.error, 'The schedule could not be updated.')}</p> : null}
  </CollapsibleSection>;
}
