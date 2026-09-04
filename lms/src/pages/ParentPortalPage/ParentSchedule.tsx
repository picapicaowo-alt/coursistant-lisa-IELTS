import {formatPersonName} from '@/utils/personName';
import {calendarLocalFields} from '@/utils/datetime';
import {useEffect, useRef, type Dispatch, type SetStateAction} from 'react';
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
  return from != null && to != null && to > from ? `${to - from} minutes` : undefined;
};

export function ParentSchedule({value, history, loading, loadError, draft, setDraft, pending, error, success, onSubmit}: {
  value: unknown; history: boolean; loading: boolean; loadError: boolean;
  draft: ParentScheduleDraft; setDraft: Dispatch<SetStateAction<ParentScheduleDraft>>;
  pending: boolean; error: unknown; success: boolean; onSubmit: () => void;
}) {
  const data = asRecord(value);
  const classes = parentRecords(data?.calendar).filter(row => !row.eventType || row.eventType === 'SESSION');
  const editor = useRef<HTMLHeadingElement>(null);
  const selected = classes.find(row => String(parentNumber(row, 'courseId')) === draft.courseId && String(parentNumber(row, 'occurrenceId') ?? parentNumber(row, 'sessionOccurrenceId')) === draft.occurrenceId);
  useEffect(() => {if (draft.occurrenceId && !history) editor.current?.focus({preventScroll: false});}, [draft.occurrenceId, history]);
  if (history) return <WorkspaceSection title="Request history" summary="Submitted requests and their current status." className={styles.scheduleHistory}>
    {loading ? <p role="status">Loading schedule requests…</p> : loadError ? null : <RecordSummaryList value={data?.requests} emptyMessage="No schedule requests yet. Choose a class in Scheduled classes to submit a request."/>}
  </WorkspaceSection>;
  return <div className={styles.scheduleGrid}>
    <WorkspaceSection title="Upcoming scheduled classes" summary="Review your child’s upcoming classes." className={styles.scheduleList}>
      {loading ? <p role="status">Loading scheduled classes…</p> : loadError ? null : classes.length ? classes.map((row, index) => {
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
            <div><strong>{parentText(row, 'courseTitle') || parentText(row, 'courseCode') || parentText(row, 'title') || 'Scheduled class'}</strong>{instructor ? <span>Instructor: {instructor}</span> : null}</div>
          </header>
          <dl className={styles.classFacts}>
            <div><CalendarDays size={19} aria-hidden="true"/><span><dt>Date</dt><dd>{date ? parentDate(date) : 'Not provided'}</dd></span></div>
            <div><Clock3 size={19} aria-hidden="true"/><span><dt>Time</dt><dd>{[parentTime(start), parentTime(end)].filter(Boolean).join(' – ') || 'Not provided'}</dd>{classDuration(start, end) ? <small>{classDuration(start, end)}</small> : null}<small>{timezone}</small></span></div>
            {location ? <div><MapPin size={19} aria-hidden="true"/><span><dt>Location</dt><dd>{location}</dd></span></div> : null}
          </dl>
          {courseId != null && occurrenceId != null ? <button type="button" className={active ? shared.primary : shared.secondary} aria-pressed={active} disabled={pending} onClick={() => setDraft(current => ({...current, courseId: String(courseId), occurrenceId: String(occurrenceId)}))}>{active ? 'Selected class' : 'Request change'}</button> : <p className={styles.meta}>Schedule changes are not available for this class.</p>}
        </article>;
      }) : <div className={shared.emptyState}><CalendarClock size={42} aria-hidden="true"/><strong>No scheduled classes available</strong><span>Classes will appear here when the schedule is shared.</span></div>}
      {!loading && classes.length ? <p className={styles.resultCount}>{classes.length} upcoming {classes.length === 1 ? 'class' : 'classes'}</p> : null}
    </WorkspaceSection>
    <WorkspaceSection title="Request a schedule change" summary="Select a scheduled class and then propose a new time or request leave." className={styles.scheduleEditor}>
      {success && !draft.occurrenceId ? <p role="status" className={styles.success}>Request submitted. You can follow its status in Request history.</p> : null}
      {selected && !loadError ? <form className={styles.scheduleForm} onSubmit={event => {event.preventDefault(); onSubmit();}}>
        <h3 ref={editor} tabIndex={-1}>{parentText(selected, 'courseTitle') || parentText(selected, 'courseCode') || parentText(selected, 'title') || 'Selected scheduled class'}</h3>
        <label>Request type<select name="requestType" autoComplete="off" value={draft.requestType} disabled={pending} onChange={event => setDraft(current => ({...current, requestType: event.target.value as ScheduleRequestType}))}>{SCHEDULE_REQUEST_TYPES.map(type => <option key={type} value={type}>{parentLabel(type)}</option>)}</select></label>
        {draft.requestType === SCHEDULE_REQUEST_TYPES[1] ? <>
          <label>Proposed date<EnglishDateInput name="proposedOccurrenceDate" required value={draft.date} disabled={pending} onChangeValue={date => setDraft(current => ({...current, date}))}/></label>
          <div className={styles.timeFields}>
            <label>Starts<EnglishTimeInput name="proposedStartTime" required value={draft.start} disabled={pending} onChangeValue={start => setDraft(current => ({...current, start}))}/></label>
            <label>Ends<EnglishTimeInput name="proposedEndTime" required value={draft.end} disabled={pending} onChangeValue={end => setDraft(current => ({...current, end}))}/></label>
          </div>
        </> : null}
        <label>Reason<textarea name="reason" autoComplete="off" value={draft.reason} disabled={pending} onChange={event => setDraft(current => ({...current, reason: event.target.value}))}/></label>
        <div className={styles.formActions}><button type="button" className={shared.secondary} disabled={pending} onClick={() => setDraft(current => ({...current, courseId: '', occurrenceId: ''}))}>Cancel</button><button type="submit" className={shared.primary} disabled={pending}>{pending ? 'Submitting…' : 'Submit request'}</button></div>
        {error ? <p className={shared.error} role="alert">{advisingErrorMessage(error, 'Schedule request could not be submitted.')}</p> : null}
      </form> : <div className={`${shared.emptyState} ${styles.scheduleEmpty}`}><CalendarClock size={54} aria-hidden="true"/><strong>No class selected</strong><span>Choose a scheduled class from the list to propose a new time or request leave.</span></div>}
    </WorkspaceSection>
  </div>;
}
