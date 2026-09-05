import {useTranslation} from 'react-i18next';
import i18n from '@/i18n';
import {formatNumber} from '@/i18n/formatting';
import {parseInputDate} from '@/i18n/dateInput';
import {timeDurationMinutes} from '@/utils/dateTimeRange';
import {formatPersonName} from '@/utils/personName';
import {calendarLocalFields} from '@/utils/datetime';
import {useEffect, useRef, useState, type Dispatch, type SetStateAction} from 'react';
import {CalendarClock, CalendarDays, Clock3, FilePenLine, MapPin} from 'lucide-react';
import {SCHEDULE_REQUEST_TYPES, type ScheduleRequestType} from '@/apis';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {EnglishDateInput, EnglishTimeInput} from '@/components/EnglishDateInput';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {asRecord, parentDate, parentLabel, parentNumber, parentRecords, parentText, parentTime} from './parentPresentation';
import styles from './index.module.scss';
import shared from '../advising/advising.module.scss';

export interface ParentScheduleDraft {
  courseId: string; occurrenceId: string; requestType: ScheduleRequestType; reason: string; date: string; start: string; end: string;
}

const classDuration = (start?: string, end?: string): string | undefined => {
  const parse = (value?: string) => {
    const match = value?.match(/^(\d{2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
  };
  const from = parse(start);
  const to = parse(end);
  return from != null && to != null && to > from ? i18n.t('assessment:attempt.duration', {count: to - from, number: formatNumber(to - from)}) : undefined;
};

export function ParentSchedule({value, history, loading, loadError, draft, setDraft, pending, error, success, onSubmit}: {
  value: unknown; history: boolean; loading: boolean; loadError: boolean;
  draft: ParentScheduleDraft; setDraft: Dispatch<SetStateAction<ParentScheduleDraft>>;
  pending: boolean; error: unknown; success: boolean; onSubmit: () => void;
}) {
  const {t: translate} = useTranslation();
  const [invalidOccurrence, setInvalidOccurrence] = useState<string>();
  const data = asRecord(value);
  const classes = parentRecords(data?.calendar).filter(row => !row.eventType || row.eventType === 'SESSION');
  const editor = useRef<HTMLHeadingElement>(null);
  const selected = classes.find(row => String(parentNumber(row, 'courseId')) === draft.courseId && String(parentNumber(row, 'occurrenceId') ?? parentNumber(row, 'sessionOccurrenceId')) === draft.occurrenceId);
  useEffect(() => {if (draft.occurrenceId && !history) editor.current?.focus({preventScroll: false});}, [draft.occurrenceId, history]);
  if (history) return <WorkspaceSection title={translate("navigation:parent.requestHistory")} summary={translate("learning:schedule.historyHelp")} className={styles.scheduleHistory}>
    {loading ? <p role="status">{translate("learning:schedule.loadingRequests")}</p> : loadError ? null : <RecordSummaryList value={data?.requests} emptyMessage={translate("learning:schedule.noHistory")}/>}
  </WorkspaceSection>;
  return <div className={styles.scheduleGrid}>
    <WorkspaceSection title={translate("learning:schedule.upcoming")} summary={translate("learning:schedule.parentHelp")} className={styles.scheduleList}>
      {loading ? <p role="status">{translate("learning:schedule.loadingClasses")}</p> : loadError ? null : classes.length ? classes.map((row, index) => {
        const courseId = parentNumber(row, 'courseId');
        const occurrenceId = parentNumber(row, 'occurrenceId') ?? parentNumber(row, 'sessionOccurrenceId');
        const active = selected === row;
        const timezone = parentText(row, 'timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const startUtc = parentText(row, 'startsAtUtc');
        const endUtc = parentText(row, 'endsAtUtc');
        const local = startUtc ? calendarLocalFields(startUtc, endUtc, timezone) : undefined;
        const date = local?.date || parentText(row, 'occurrenceDate') || parentText(row, 'date');
        const start = local?.startTime || parentText(row, 'startTime');
        const end = local?.endTime || parentText(row, 'endTime');
        const instructor = formatPersonName({firstName: parentText(row, 'instructorFirstName'), middleName: parentText(row, 'instructorMiddleName'), lastName: parentText(row, 'instructorLastName')}, parentText(row, 'instructorName') || '');
        const location = parentText(row, 'location');
        return <article className={styles.classRow} data-selected={active || undefined} key={occurrenceId ?? index}>
          <header className={styles.classHeader}>
            <span className={styles.classIcon}><FilePenLine size={28} aria-hidden="true"/></span>
            <div><strong>{parentText(row, 'courseTitle') || parentText(row, 'courseCode') || parentText(row, 'title') || translate("learning:schedule.class")}</strong>{instructor ? <span>{translate('learning:schedule.instructorName', {name: instructor})}</span> : null}</div>
          </header>
          <dl className={styles.classFacts}>
            <div><CalendarDays size={19} aria-hidden="true"/><span><dt>{translate("common:fields.date")}</dt><dd>{date ? parentDate(date) : translate("common:feedback.notProvided")}</dd></span></div>
            <div><Clock3 size={19} aria-hidden="true"/><span><dt>{translate("common:dateTime.time")}</dt><dd>{[parentTime(start), parentTime(end)].filter(Boolean).join(' – ') || translate("common:feedback.notProvided")}</dd>{classDuration(start, end) ? <small>{classDuration(start, end)}</small> : null}<small>{timezone}</small></span></div>
            {location ? <div><MapPin size={19} aria-hidden="true"/><span><dt>{translate("calendar:details.location")}</dt><dd>{location}</dd></span></div> : null}
          </dl>
          {courseId != null && occurrenceId != null ? <button type="button" className={active ? shared.primary : shared.secondary} aria-pressed={active} disabled={pending} onClick={() => setDraft(current => ({...current, courseId: String(courseId), occurrenceId: String(occurrenceId)}))}>{active ? translate("learning:schedule.selected") : translate("learning:schedule.requestChange")}</button> : <p className={styles.meta}>{translate("learning:schedule.unavailable")}</p>}
        </article>;
      }) : <div className={shared.emptyState}><CalendarClock size={42} aria-hidden="true"/><strong>{translate("learning:schedule.noClasses")}</strong><span>{translate("learning:schedule.noClassesHelp")}</span></div>}
      {!loading && classes.length ? <p className={styles.resultCount}>{translate('learning:schedule.upcomingCount', {count: classes.length, number: formatNumber(classes.length)})}</p> : null}
    </WorkspaceSection>
    <WorkspaceSection title={translate("learning:schedule.title")} summary={translate("learning:schedule.editorHelp")} className={styles.scheduleEditor}>
      {success && !draft.occurrenceId ? <p role="status" className={styles.success}>{translate("learning:schedule.parentSubmitted")}</p> : null}
      {selected && !loadError ? <form noValidate className={styles.scheduleForm} onSubmit={event => {event.preventDefault(); if (pending) return; if (draft.requestType === SCHEDULE_REQUEST_TYPES[1] && (!parseInputDate(draft.date) || timeDurationMinutes(draft.start, draft.end) === null)) {setInvalidOccurrence(draft.occurrenceId); return;} setInvalidOccurrence(undefined); onSubmit();}}>
        <h3 ref={editor} tabIndex={-1}>{parentText(selected, 'courseTitle') || parentText(selected, 'courseCode') || parentText(selected, 'title') || translate("learning:schedule.selectedClass")}</h3>
        <label>{translate("operations:requestType")}<select name="requestType" autoComplete="off" value={draft.requestType} disabled={pending} onChange={event => setDraft(current => ({...current, requestType: event.target.value as ScheduleRequestType}))}>{SCHEDULE_REQUEST_TYPES.map(type => <option key={type} value={type}>{parentLabel(type)}</option>)}</select></label>
        {draft.requestType === SCHEDULE_REQUEST_TYPES[1] ? <>
          <label>{translate("operations:proposedDate")}<EnglishDateInput aria-label={translate("operations:proposedDate")} name="proposedOccurrenceDate" required value={draft.date} disabled={pending} onChangeValue={date => setDraft(current => ({...current, date}))}/></label>
          <div className={styles.timeFields}>
            <label>{translate("calendar:editor.starts")}<EnglishTimeInput aria-label={translate("calendar:editor.starts")} name="proposedStartTime" required value={draft.start} disabled={pending} onChangeValue={start => setDraft(current => ({...current, start}))}/></label>
            <label>{translate("calendar:editor.ends")}<EnglishTimeInput aria-label={translate("calendar:editor.ends")} name="proposedEndTime" required value={draft.end} disabled={pending} onChangeValue={end => setDraft(current => ({...current, end}))}/></label>
          </div>
        </> : null}
        <label>{translate("common:fields.reason")}<textarea name="reason" autoComplete="off" value={draft.reason} disabled={pending} onChange={event => setDraft(current => ({...current, reason: event.target.value}))}/></label>
        <div className={styles.formActions}><button type="button" className={shared.secondary} disabled={pending} onClick={() => setDraft(current => ({...current, courseId: '', occurrenceId: ''}))}>{translate("common:actions.cancel")}</button><button type="submit" className={shared.primary} disabled={pending}>{pending ? translate("common:actions.submitting") : translate("operations:submitRequest")}</button></div>
        {invalidOccurrence === draft.occurrenceId && draft.requestType === SCHEDULE_REQUEST_TYPES[1] ? <p className={shared.error} role="alert">{translate('learning:schedule.invalidRange')}</p> : null}
        {error ? <p className={shared.error} role="alert">{advisingErrorMessage(error, translate('learning:schedule.failed'))}</p> : null}
      </form> : <div className={`${shared.emptyState} ${styles.scheduleEmpty}`}><CalendarClock size={54} aria-hidden="true"/><strong>{translate("learning:schedule.noSelection")}</strong><span>{translate("learning:schedule.noSelectionHelp")}</span></div>}
    </WorkspaceSection>
  </div>;
}
