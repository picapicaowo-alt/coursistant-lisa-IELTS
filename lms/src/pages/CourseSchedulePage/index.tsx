import { useTranslation } from 'react-i18next';
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
import {formatWeekday, formatClockTime, formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import styles from '../CourseEventsPage/index.module.scss';

const emptyDraft = (): CourseSessionPayload => ({type: 'Lecture', dayOfWeek: 'MON', startTime: '09:00', endTime: '10:00', location: ''});
const toDraft = (session: CourseSession): CourseSessionPayload => ({type: session.type, dayOfWeek: session.dayOfWeek, startTime: session.startTime.slice(0, 5), endTime: session.endTime.slice(0, 5), location: session.location ?? ''});

const CourseSchedulePage = () => {
  const { t: translate } = useTranslation();
  const courseId = Number(useParams().courseId);
  const validCourse = Number.isInteger(courseId) && courseId > 0;
  const access = useCourseAccess(validCourse ? courseId : null);
  const queryClient = useQueryClient();
  const canEditSchedule = access.canManageCourseEvents && !access.membership?.launchState;
  const [draft, setDraft] = useState<CourseSessionPayload>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState<{key: string; tone: 'success' | 'error'} | null>(null);

  const sessions = useQuery({queryKey: ['course-sessions', courseId], queryFn: async () => unwrapData(await courseApiService.getCourseSessions(courseId), 'List sessions'), enabled: validCourse});
  const save = useMutation({
    mutationFn: () => editingId === null ? courseApiService.createCourseSession(courseId, {...draft, location: draft.location?.trim() || null}) : courseApiService.updateCourseSession(courseId, editingId, {...draft, location: draft.location?.trim() || null}),
    onSuccess: async () => { await queryClient.invalidateQueries({queryKey: ['course-sessions', courseId]}); setEditorOpen(false); setEditingId(null); setMessage({key: 'courseTools:schedule.saved', tone: 'success'}); },
    onError: () => setMessage({key: 'courseTools:schedule.saveFailed', tone: 'error'}),
  });
  const remove = useMutation({
    mutationFn: (id: number) => courseApiService.deleteCourseSession(courseId, id),
    onSuccess: async () => { await queryClient.invalidateQueries({queryKey: ['course-sessions', courseId]}); setConfirmDeleteId(null); setMessage({key: 'courseTools:schedule.deleted', tone: 'success'}); },
    onError: () => setMessage({key: 'courseTools:schedule.deleteFailed', tone: 'error'}),
  });

  const invalidTime = timeDurationMinutes(draft.startTime, draft.endTime) === null;
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
  const submit = (event: FormEvent) => { event.preventDefault(); setMessage(null); if (!canEditSchedule || save.isPending) return; if (invalidTime) {setMessage({key: 'operations:invalidTime', tone: 'error'}); return;} save.mutate(); };

  return (
    <main className={styles.page}>
      <header className={styles.header}><Link to={`/course/${courseId}`} className={styles.backLink} aria-label={translate("course:grades.back")} title={translate("course:grades.back")}><ArrowLeft size={22} aria-hidden="true"/></Link><div className={styles.headerText}><p className={styles.eyebrow}>{translate("courseTools:schedule.eyebrow")}</p><h1>{translate("courseTools:schedule.title")}</h1></div>{canEditSchedule && !editorOpen ? <button type="button" className={styles.primaryButton} onClick={() => { setDraft(emptyDraft()); setEditingId(null); setEditorOpen(true); }}><Plus size={17}/> {' '}{translate("courseTools:schedule.add")}</button> : null}</header>
      {message ? <p className={message.tone === 'error' ? styles.error : styles.success} role={message.tone === 'error' ? 'alert' : 'status'}>{translate(message.key)}</p> : null}

      {editorOpen ? <form className={styles.card} noValidate onSubmit={submit}>
        <div className={styles.cardHeader}><div><h2>{editingId === null ? translate("courseTools:schedule.add") : translate("courseTools:schedule.edit")}</h2><p>{translate("courseTools:schedule.timezoneHelp")}</p></div><button type="button" className={styles.iconButton} aria-label={translate("courseTools:announcements.close")} onClick={() => setEditorOpen(false)}><X size={18}/></button></div>
        <div className={styles.formGrid}>
          <label><span>{translate("common:fields.type")}</span><select value={draft.type} onChange={event => setDraft(current => ({...current, type: event.target.value as SessionType}))}>{TYPES.map(type => <option key={type} value={type}>{statusLabel(type)}</option>)}</select></label>
          <label><span>{translate("course:scheduleModal.dayLabel")}</span><select value={draft.dayOfWeek} onChange={event => setDraft(current => ({...current, dayOfWeek: event.target.value as SessionDayOfWeek}))}>{DAYS.map(day => <option key={day.value} value={day.value}>{formatWeekday(day.value, 'long')}</option>)}</select></label>
          <label><span>{translate("calendar:editor.starts")}</span><EnglishTimeInput required aria-label={translate("calendar:editor.starts")} value={draft.startTime} onChangeValue={changeStartTime}/></label>
          <label><span>{translate("calendar:editor.ends")}</span><EnglishTimeInput required aria-label={translate("calendar:editor.ends")} value={draft.endTime} onChangeValue={value => setDraft(current => ({...current, endTime: value}))}/></label>
          <DurationSelect minutes={selectedDuration} options={SHORT_DURATION_OPTIONS} onChange={changeDuration}/>
          <span/>
          <label className={styles.full}><span>{translate("calendar:details.location")}</span><input value={draft.location ?? ''} onChange={event => setDraft(current => ({...current, location: event.target.value}))}/></label>
        </div>
        {invalidTime ? <p className={styles.error}>{translate("operations:invalidTime")}</p> : null}
        <div className={styles.formFooter}><button type="submit" className={styles.primaryButton} disabled={save.isPending || invalidTime}>{save.isPending ? translate("common:actions.saving") : translate("courseTools:schedule.save")}</button></div>
      </form> : <section className={styles.card}>
        <div className={styles.cardHeader}><div><h2>{translate("courseTools:schedule.weekly")}</h2><p>{translate("courseTools:schedule.count", {count: ordered.length, number: formatNumber(ordered.length)})}</p></div></div>
        {sessions.isPending ? <p className={styles.muted}>{translate("dashboard:loadingSchedule")}</p> : sessions.isError ? <p className={styles.error}>{translate("courseTools:schedule.loadFailed")}</p> : ordered.length === 0 ? <p className={styles.muted}>{translate("courseTools:schedule.none")}</p> : <ul className={styles.eventList}>{ordered.map(session => <li key={session.id}><div className={styles.announcementRow}><div className={styles.sessionSummary}><span className={styles.dateTile}><strong>{formatWeekday(session.dayOfWeek)}</strong></span><span className={styles.eventText}><strong>{statusLabel(session.type)}</strong><small><Clock3 size={13}/> {formatClockTime(session.startTime)} – {formatClockTime(session.endTime)} · {formatWeekday(session.dayOfWeek, 'long')}{session.location ? <> · <MapPin size={13}/> {session.location}</> : null}</small></span></div>{canEditSchedule ? <div className={styles.rowActions}><button type="button" className={styles.iconButton} aria-label={translate('courseTools:schedule.editSession', {type: statusLabel(session.type), day: formatWeekday(session.dayOfWeek, 'long')})} onClick={() => { setDraft(toDraft(session)); setEditingId(session.id); setEditorOpen(true); }}><Pencil size={16}/></button>{confirmDeleteId === session.id ? <><button type="button" className={styles.dangerButton} onClick={() => remove.mutate(session.id)}>{translate("common:actions.confirm")}</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmDeleteId(null)}>{translate("common:actions.cancel")}</button></> : <button type="button" className={styles.iconButton} aria-label={translate('courseTools:schedule.deleteSession', {type: statusLabel(session.type), day: formatWeekday(session.dayOfWeek, 'long')})} onClick={() => setConfirmDeleteId(session.id)}><Trash2 size={16}/></button>}</div> : null}</div></li>)}</ul>}
      </section>}
    </main>
  );
};

export default CourseSchedulePage;
