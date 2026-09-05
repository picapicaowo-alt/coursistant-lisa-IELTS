import {LocalizedError} from '@/i18n/errors';
import { useTranslation } from 'react-i18next';
import {useState} from 'react';
import {CalendarDays, Globe2, MapPin, Plus} from 'lucide-react';
import {useIsMutating, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData, type CourseResponse, type CourseSession, type CourseSessionPayload} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {EnglishDateInput, EnglishTimeInput} from '@/components/EnglishDateInput';
import {formatDateValue, formatWeekday} from '@/i18n/formatting';
import {parseInputDate} from '@/i18n/dateInput';
import {timeDurationMinutes} from '@/utils/dateTimeRange';
import {statusLabel} from '@/i18n/presentation';
import {COURSE_SESSION_DAYS, COURSE_SESSION_TYPES} from '@/configs/courseSessions';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {isHttpStatus} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {courseManagementKeys as keys, formatCourseDate, formatCourseTime, parseAdvisorCourseOccurrences} from '../advising/courseManagement';
import styles from '../advising/CourseManagement.module.scss';

const emptySession = (): CourseSessionPayload => ({type: COURSE_SESSION_TYPES[0], dayOfWeek: COURSE_SESSION_DAYS[0].value, startTime: '', endTime: '', location: ''});
const sessionDraft = (session: CourseSession): CourseSessionPayload => ({type: session.type, dayOfWeek: session.dayOfWeek, startTime: session.startTime.slice(0, 5), endTime: session.endTime.slice(0, 5), location: session.location ?? ''});
const shortDate = (value: string): string => formatDateValue(value, {weekday: 'short', month: 'short', day: 'numeric', year: undefined});

function SessionFields({draft, onChange}: {draft: CourseSessionPayload; onChange: (draft: CourseSessionPayload) => void}) {
  const {t: translate} = useTranslation();
  return <>
    <label className={styles.field}>{translate("courseTools:owner.sessionType")}<select value={draft.type} onChange={event => onChange({...draft, type: event.target.value as CourseSessionPayload['type']})}>{COURSE_SESSION_TYPES.map(type => <option key={type} value={type}>{statusLabel(type)}</option>)}</select></label>
    <label className={styles.field}>{translate("courseTools:owner.weekday")}<select value={draft.dayOfWeek} onChange={event => onChange({...draft, dayOfWeek: event.target.value as CourseSessionPayload['dayOfWeek']})}>{COURSE_SESSION_DAYS.map(day => <option key={day.value} value={day.value}>{formatWeekday(day.value, 'long')}</option>)}</select></label>
    <label className={styles.field}>{translate("auth:preview.startTime")}<EnglishTimeInput required aria-label={translate('auth:preview.startTime')} value={draft.startTime} onChangeValue={startTime => onChange({...draft, startTime})} /></label>
    <label className={styles.field}>{translate("operations:endTime")}<EnglishTimeInput required aria-label={translate('operations:endTime')} value={draft.endTime} onChangeValue={endTime => onChange({...draft, endTime})} /></label>
    <label className={`${styles.field} ${styles.fieldWide}`}>{translate("courseTools:owner.locationOptional")}<input value={draft.location ?? ''} onChange={event => onChange({...draft, location: event.target.value})} /></label>
  </>;
}

export function OwnerCourseSchedule({courseId, course, readOnly, canGenerateDates}: {courseId: number; course: CourseResponse; readOnly: boolean; canGenerateDates: boolean}) {
  const { t: translate } = useTranslation();
  const client = useQueryClient();
  // Schedule writes must remain locked after a tab remount.
  const schedulePending = useIsMutating({mutationKey: keys.scheduleWrites(courseId)}) > 0;
  const idempotency = useIdempotencyCheckpoint();
  const [draft, setDraft] = useState<CourseSessionPayload>(emptySession);
  const [editing, setEditing] = useState<{id: number; draft: CourseSessionPayload} | null>(null);
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [generationOpen, setGenerationOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [showAllOccurrences, setShowAllOccurrences] = useState(false);
  const [validationKey, setValidationKey] = useState('');
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
      if (!canWrite) throw new LocalizedError("courseTools:owner.loadEditable");
      if (timeDurationMinutes(draft.startTime, draft.endTime) === null) throw new LocalizedError('operations:invalidTime');
      return idempotency.run('owner-create-session', [courseId, draft] as const, async (key, args) => unwrapData(await courseApiService.createCourseSession(...args, key), 'createCourseSession'));
    },
    onSuccess: async () => {setDraft(emptySession()); setSessionFormOpen(false); await refreshSchedule();},
  });
  const update = useMutation({
    mutationKey: keys.scheduleWrites(courseId),
    mutationFn: async () => {
      if (!canWrite || !editing) throw new LocalizedError("courseTools:owner.selectEditable");
      if (timeDurationMinutes(editing.draft.startTime, editing.draft.endTime) === null) throw new LocalizedError('operations:invalidTime');
      return idempotency.run('owner-update-session', [courseId, editing.id, editing.draft] as const, async (key, args) => unwrapData(await courseApiService.updateCourseSession(...args, key), 'updateCourseSession'));
    },
    onSuccess: async () => {setEditing(null); setSessionFormOpen(false); await refreshSchedule();},
  });
  const generate = useMutation({
    mutationKey: keys.scheduleWrites(courseId),
    mutationFn: async () => {
      if (!canGenerateDates || !sessions.isSuccess || !occurrences.isSuccess || !parseInputDate(range.from) || !parseInputDate(range.to) || range.to < range.from) throw new LocalizedError("courseTools:owner.validRange");
      return idempotency.run('owner-generate-occurrences', [courseId, range] as const, async (key, args) => unwrapData(await courseOperationsApiService.generateSessionOccurrences(...args, key), 'generateSessionOccurrences'));
    },
    onSuccess: async () => {setGenerationOpen(false); await refreshSchedule();},
  });
  const busy = schedulePending || create.isPending || update.isPending || generate.isPending;
  // Occurrence reads can fail independently of a successfully loaded course and weekly schedule.
  const error = sessions.error || create.error || update.error || generate.error;
  const visibleOccurrences = showAllOccurrences ? occurrences.data : occurrences.data?.slice(0, 8);
  const datesError = isHttpStatus(occurrences.error, 404) ? translate('courseTools:owner.courseUnavailable') : isHttpStatus(occurrences.error, 401) || isHttpStatus(occurrences.error, 403)
    ? advisingErrorMessage(occurrences.error, translate('courseTools:owner.deniedDates'))
    : translate('courseTools:owner.datesFailed');
  const activeDraft = editing?.draft ?? draft;
  const invalidSession = timeDurationMinutes(activeDraft.startTime, activeDraft.endTime) === null;
  const invalidRange = !parseInputDate(range.from) || !parseInputDate(range.to) || range.to < range.from;

  return <div className={styles.scheduleWorkspace}>
    <section className={styles.scheduleSection} aria-labelledby="recurring-sessions-title">
      <header className={styles.scheduleSectionHeader}>
        <div><h2 id="recurring-sessions-title">{translate("courseTools:delivery.recurring")}</h2><p>{translate("courseTools:owner.manageHelp")}</p></div>
        {canWrite ? <button type="button" className={styles.outlinePrimaryButton} disabled={busy} onClick={() => {setEditing(null); setDraft(emptySession()); setSessionFormOpen(true);}}><Plus size={16} aria-hidden="true" />{translate("courseTools:owner.add")}</button> : <span className={styles.statusBadge}>{translate("courseTools:owner.readOnly")}</span>}
      </header>
      {sessions.isPending ? <p role="status" className={styles.helper}>{translate("courseTools:owner.loading")}</p> : null}
      {sessions.data?.length ? <div className={styles.sessionGrid}>{sessions.data.map(session => {
        const weekday = formatWeekday(session.dayOfWeek, 'long');
        return <article key={session.id} className={styles.sessionCard}>
          <header className={styles.sessionCardHeader}><span className={styles.sessionType} data-type={session.type}>{statusLabel(session.type)}</span></header>
          <div className={styles.sessionTime}><h3>{formatCourseTime(session.startTime)} — {formatCourseTime(session.endTime)}</h3><strong>{translate("courseTools:schedule.everyWeekday", {day: weekday})}</strong></div>
          <ul className={styles.sessionMeta}>
            <li><MapPin size={15} aria-hidden="true" />{session.location || translate("course:catalogue.noLocation")}</li>
            <li><Globe2 size={15} aria-hidden="true" />{session.timezone || translate("courseTools:delivery.timezoneMissing")}</li>
            <li><CalendarDays size={15} aria-hidden="true" />{translate('courseTools:owner.weeklyTerm', {start: formatCourseDate(course.termStartDate), end: formatCourseDate(course.termEndDate)})}</li>
          </ul>
          {canWrite ? <footer className={styles.sessionActions}><span><button type="button" className={styles.textAction} disabled={busy} onClick={() => {setEditing({id: session.id, draft: sessionDraft(session)}); setSessionFormOpen(true);}}>{translate("common:actions.edit")}</button><button type="button" className={styles.plainAction} disabled={busy} onClick={() => {setDraft(sessionDraft(session)); setEditing(null); setSessionFormOpen(true);}}>{translate("courseTools:owner.duplicate")}</button></span></footer> : null}
        </article>;
      })}</div> : !sessions.isPending && !sessions.isError ? <p className={styles.helper}>{translate("courseTools:delivery.noSessions")}</p> : null}
    </section>

    {!readOnly && sessionFormOpen ? <section className={styles.editorPanel} aria-labelledby="session-form-title">
      <header className={styles.panelHeader}><div><h2 id="session-form-title">{editing ? translate("courseTools:owner.edit") : translate("courseTools:owner.addRecurring")}</h2><p>{editing ? translate("courseTools:owner.updateHelp") : translate("courseTools:owner.createHelp")}</p></div></header>
      <form className={styles.formGrid} noValidate onSubmit={event => {event.preventDefault(); if (!canWrite || busy) return; if (invalidSession) {setValidationKey('operations:invalidTime'); return;} setValidationKey(''); if (editing) update.mutate(); else create.mutate();}}>
        <SessionFields draft={editing?.draft ?? draft} onChange={next => editing ? setEditing({...editing, draft: next}) : setDraft(next)} />
        <div className={styles.formActions}><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => {setEditing(null); setSessionFormOpen(false); setValidationKey('');}}>{translate("common:actions.cancel")}</button><button type="submit" className={styles.primaryButton} disabled={!canWrite || busy || invalidSession}>{editing ? translate("courseTools:owner.save") : translate("courseTools:owner.add")}</button></div>
      </form>
    </section> : null}

    {datesOpen && canGenerateDates && !occurrences.isError && generationOpen ? <section className={styles.editorPanel} aria-labelledby="generate-occurrences-title">
      <header className={styles.panelHeader}><div><h2 id="generate-occurrences-title">{translate("courseTools:owner.generateTitle")}</h2><p>{translate("courseTools:owner.generateHelp")}</p></div></header>
      <form className={styles.formGrid} noValidate onSubmit={event => {event.preventDefault(); if (!canGenerateDates || busy) return; if (invalidRange) {setValidationKey('courseTools:owner.validRange'); return;} setValidationKey(''); generate.mutate();}}><label className={styles.field}>{translate("courseTools:owner.generateFrom")}<EnglishDateInput required aria-label={translate('courseTools:owner.generateFrom')} value={range.from} onChangeValue={from => setRange(current => ({...current, from}))} /></label><label className={styles.field}>{translate("courseTools:owner.generateThrough")}<EnglishDateInput required aria-label={translate('courseTools:owner.generateThrough')} value={range.to} onChangeValue={to => setRange(current => ({...current, to}))} /></label><div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => {setGenerationOpen(false); setValidationKey('');}}>{translate("common:actions.cancel")}</button><button type="submit" className={styles.primaryButton} disabled={!canGenerateDates || busy || invalidRange || !sessions.data?.length}>{generate.isPending ? translate("courseTools:owner.generating") : translate("operations:generateOccurrences")}</button></div></form>
    </section> : null}

    <button type="button" className={styles.textAction} aria-expanded={datesOpen} aria-controls="course-class-dates" onClick={() => setDatesOpen(current => !current)}>{datesOpen ? translate("courseTools:owner.hideDates") : translate("courseTools:owner.viewDates")}<CalendarDays size={16} aria-hidden="true" /></button>
    {datesOpen ? <section id="course-class-dates" className={styles.occurrenceTableWrap} aria-labelledby="upcoming-occurrences-title">
      <header className={styles.panelHeader}><div><h2 id="upcoming-occurrences-title">{translate("courseTools:owner.occurrences")}</h2></div>{canGenerateDates && occurrences.isSuccess ? <button type="button" className={styles.secondaryButton} disabled={busy || !sessions.data?.length} onClick={() => {setRange(termRange); setGenerationOpen(true);}}>{translate("courseTools:owner.generateDates")}</button> : null}</header>
      {occurrences.isPending ? <p role="status" className={styles.helper}>{translate("courseTools:owner.loadingOccurrences")}</p> : null}
      {occurrences.isError ? <p className={styles.helper} role="alert">{datesError} <button type="button" className={styles.textAction} disabled={occurrences.isFetching} onClick={() => void occurrences.refetch()}>{occurrences.isFetching ? translate("common:feedback.loading") : translate("common:actions.tryAgain")}</button></p> : null}
      {visibleOccurrences?.length ? <table className={styles.occurrenceTable}><thead><tr><th>{translate("common:fields.date")}</th><th>{translate("common:dateTime.time")}</th><th>{translate("calendar:details.location")}</th><th>{translate("common:fields.status")}</th></tr></thead><tbody>{visibleOccurrences.map(item => {
        return <tr key={item.id}><td data-label={translate("common:fields.date")}>{shortDate(item.date)}</td><td data-label={translate("common:dateTime.time")}>{formatCourseTime(item.startTime)}{item.endTime ? `–${formatCourseTime(item.endTime)}` : ''}</td><td data-label={translate("calendar:details.location")}>{item.location || translate("common:feedback.notProvided")}</td><td data-label={translate("common:fields.status")}><span className={styles.statusPill} data-state={item.status}>{statusLabel(item.status)}</span></td></tr>;
      })}</tbody></table> : !occurrences.isPending && !occurrences.isError ? <p className={styles.helper}>{translate("courseTools:owner.noOccurrences")}</p> : null}
      {occurrences.data && occurrences.data.length > 8 ? <button type="button" className={styles.textAction} onClick={() => setShowAllOccurrences(current => !current)}>{showAllOccurrences ? translate('common:navigationControls.fewerOccurrences') : translate('common:navigationControls.allOccurrences', {count: occurrences.data.length})}</button> : null}
    </section> : null}
    {validationKey ? <p role="alert" className={styles.error}>{translate(validationKey)}</p> : null}
    {error ? <p role="alert" className={styles.error}>{advisingErrorMessage(error, translate('courseTools:owner.scheduleError'))} {sessions.isError ? <button type="button" className={styles.ghostButton} onClick={() => void sessions.refetch()}>{translate("common:actions.retry")}</button> : translate("courseTools:owner.retryHelp")}</p> : null}
  </div>;
}
