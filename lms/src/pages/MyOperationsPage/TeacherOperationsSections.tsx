import React, {useEffect, useMemo, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {CalendarClock, ChevronRight, Pencil, Plus, Trash2} from 'lucide-react';
import type {
  AvailabilityExceptionRequest,
  AvailabilityWindowRequest,
  TeachingGradingItemResponse,
  TeachingStudentSupportResponse,
  TeachingTodayClassResponse,
} from '@/apis';
import {WEEKDAYS, unwrapData} from '@/apis';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {EnglishDateInput, EnglishTimeInput} from '@/components/EnglishDateInput';
import {getApiErrorCode, getApiErrorMessage} from '@/utils/apiError';
import styles from './index.module.scss';

type TeacherSection = 'teaching' | 'availability';
type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const recordsFrom = (value: unknown): UnknownRecord[] => {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of ['items', 'content', 'alerts', 'requests', 'results']) {
    if (Array.isArray(value[key])) return value[key].filter(isRecord);
  }
  return [];
};

const textFrom = (record: UnknownRecord, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const idFrom = (record: UnknownRecord, ...keys: string[]): string | number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' || (typeof value === 'string' && value.trim())) return value;
  }
  return undefined;
};

const internalLinkFrom = (record: UnknownRecord): string | undefined => {
  const destination = textFrom(record, 'deepLink', 'gradingDeepLink', 'destination');
  return destination?.startsWith('/') && !destination.startsWith('//') ? destination : undefined;
};

const humanize = (value?: string): string => value
  ? value.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, letter => letter.toUpperCase())
  : '';

const formatName = (record: {
  studentFirstName?: string;
  studentMiddleName?: string;
  studentLastName?: string;
  studentUserId: number;
}): string => [record.studentFirstName, record.studentMiddleName, record.studentLastName]
  .filter(Boolean)
  .join(' ') || `Student #${record.studentUserId}`;

const formatDate = (value?: string): string | undefined => {
  if (!value) return undefined;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric'}).format(parsed);
};

const formatTime = (value?: string): string | undefined => {
  const match = value?.match(/^(\d{2}):(\d{2})/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = match[2];
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const QueryState: React.FC<{
  empty: string;
  error: boolean;
  loading: boolean;
  onRetry: () => void;
}> = ({empty, error, loading, onRetry}) => {
  if (loading) return <p className={styles.empty} role="status">Loading…</p>;
  if (error) return <div className={styles.inlineAlert} role="alert"><span>This section could not be loaded.</span><button type="button" onClick={onRetry}>Retry</button></div>;
  return <p className={styles.empty}>{empty}</p>;
};

const RecordRows: React.FC<{
  empty: string;
  items: UnknownRecord[];
  kind: 'alert' | 'request';
}> = ({empty, items, kind}) => {
  if (items.length === 0) return <p className={styles.empty}>{empty}</p>;
  return <div className={styles.operationList}>{items.map((item, index) => {
    const destination = internalLinkFrom(item);
    const title = kind === 'alert'
      ? textFrom(item, 'title', 'message', 'alertType', 'type') || 'Teaching alert'
      : textFrom(item, 'title', 'requestType', 'type') || 'Schedule request';
    const meta = [
      textFrom(item, 'courseCode', 'courseTitle'),
      humanize(textFrom(item, 'status', 'severity')),
      formatDate(textFrom(item, 'createdAt', 'requestedAt', 'occurrenceDate')),
    ].filter(Boolean).join(' · ');
    const content = <><span><strong>{humanize(title)}</strong><small>{meta || (kind === 'alert' ? 'Review this teaching update' : 'Review request details')}</small></span>{destination ? <ChevronRight size={18} aria-hidden="true"/> : null}</>;
    const key = idFrom(item, 'alertId', 'requestId', 'id') ?? `${kind}-${title}-${index}`;
    return destination
      ? <Link className={styles.operationRow} to={destination} key={key}>{content}</Link>
      : <article className={styles.operationRow} key={key}>{content}</article>;
  })}</div>;
};

const TeachingQueue: React.FC = () => {
  const alerts = useQuery({queryKey: ['me', 'teaching-alerts'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyTeachingAlerts(), 'myTeachingAlerts'), retry: false});
  const grading = useQuery({queryKey: ['me', 'teaching-grading-items'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyTeachingGradingItems(), 'myTeachingGradingItems'), retry: false});
  const requests = useQuery({queryKey: ['me', 'teaching-schedule-requests'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyTeachingScheduleRequests(), 'myTeachingScheduleRequests'), retry: false});
  const support = useQuery({queryKey: ['me', 'teaching-support'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyTeachingStudentsNeedingSupport(), 'myTeachingSupport'), retry: false});
  const today = useQuery({queryKey: ['me', 'teaching-today'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyTeachingTodayClasses(), 'myTeachingToday'), retry: false});
  const gradingItems = grading.data ?? [];
  const supportStudents = support.data ?? [];
  const todayClasses = today.data ?? [];

  return <div className={styles.grid}>
    <section className={styles.card} aria-labelledby="today-classes-title">
      <div className={styles.cardHeading}><div><h2 id="today-classes-title">Today’s classes</h2><p>Your live teaching schedule and class context.</p></div><span className={styles.countBadge}>{todayClasses.length}</span></div>
      {today.isPending || today.isError ? <QueryState loading={today.isPending} error={today.isError} empty="No classes today." onRetry={() => void today.refetch()}/> : todayClasses.length === 0 ? <p className={styles.empty}>No classes today.</p> : <div className={styles.operationList}>{todayClasses.map((item: TeachingTodayClassResponse) => <Link to={`/course/${item.courseId}`} className={styles.operationRow} key={item.occurrenceId ?? item.sessionId ?? `${item.courseId}-${item.startTime}`}><span><strong>{item.courseTitle || item.courseCode || `Course #${item.courseId}`}</strong><small>{[item.lectureNumber ? `Lecture ${item.lectureNumber}` : undefined, `${formatTime(item.startTime) ?? 'Time pending'}${item.endTime ? `–${formatTime(item.endTime)}` : ''}`, item.location, typeof item.studentCount === 'number' ? `${item.studentCount} students` : undefined].filter(Boolean).join(' · ')}</small></span><ChevronRight size={18} aria-hidden="true"/></Link>)}</div>}
    </section>

    <section className={styles.card} aria-labelledby="grading-title">
      <div className={styles.cardHeading}><div><h2 id="grading-title">Grading queue</h2><p>Submissions currently waiting for your review.</p></div><span className={styles.countBadge}>{gradingItems.length}</span></div>
      {grading.isPending || grading.isError ? <QueryState loading={grading.isPending} error={grading.isError} empty="Nothing is waiting for grading." onRetry={() => void grading.refetch()}/> : gradingItems.length === 0 ? <p className={styles.empty}>Nothing is waiting for grading.</p> : <div className={styles.operationList}>{gradingItems.map((item: TeachingGradingItemResponse) => {
        const destination = item.gradingDeepLink?.startsWith('/') ? item.gradingDeepLink : `/course/${item.courseId}/assignments/${item.assignmentId}/grading`;
        return <Link to={destination} className={styles.operationRow} key={`${item.assignmentId}-${item.studentUserId}`}><span><strong>{item.title}</strong><small>{[formatName(item), item.courseCode, humanize(item.status), item.dueAt ? `Due ${formatDate(item.dueAt)}` : undefined].filter(Boolean).join(' · ')}</small></span><ChevronRight size={18} aria-hidden="true"/></Link>;
      })}</div>}
    </section>

    <section className={styles.card} aria-labelledby="support-title">
      <div className={styles.cardHeading}><div><h2 id="support-title">Students needing support</h2><p>Signals that may need a timely teaching response.</p></div><span className={styles.countBadge}>{supportStudents.length}</span></div>
      {support.isPending || support.isError ? <QueryState loading={support.isPending} error={support.isError} empty="No students currently need attention." onRetry={() => void support.refetch()}/> : supportStudents.length === 0 ? <p className={styles.empty}>No students currently need attention.</p> : <div className={styles.operationList}>{supportStudents.map((item: TeachingStudentSupportResponse) => {
        const destination = item.deepLink?.startsWith('/') ? item.deepLink : `/course/${item.courseId}`;
        return <Link to={destination} className={styles.operationRow} key={`${item.courseId}-${item.studentUserId}`}><span><strong>{formatName(item)}</strong><small>{[item.courseTitle, ...(item.reasons ?? []).map(humanize)].filter(Boolean).join(' · ')}</small></span><ChevronRight size={18} aria-hidden="true"/></Link>;
      })}</div>}
    </section>

    <section className={styles.card} aria-labelledby="alerts-title">
      <div className={styles.cardHeading}><div><h2 id="alerts-title">Teaching alerts</h2><p>Course and learner signals that require attention.</p></div></div>
      {alerts.isPending || alerts.isError ? <QueryState loading={alerts.isPending} error={alerts.isError} empty="No teaching alerts." onRetry={() => void alerts.refetch()}/> : <RecordRows items={recordsFrom(alerts.data)} kind="alert" empty="No teaching alerts."/>}
    </section>

    <section className={`${styles.card} ${styles.fullWidthCard}`} aria-labelledby="requests-title">
      <div className={styles.cardHeading}><div><h2 id="requests-title">Schedule requests</h2><p>Student schedule changes that need your review or awareness.</p></div></div>
      {requests.isPending || requests.isError ? <QueryState loading={requests.isPending} error={requests.isError} empty="No schedule requests." onRetry={() => void requests.refetch()}/> : <RecordRows items={recordsFrom(requests.data)} kind="request" empty="No schedule requests."/>}
    </section>
  </div>;
};

const emptyWindow = (timezone: string): AvailabilityWindowRequest => ({
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime: '17:00',
  timezone,
});

const AvailabilityEditor: React.FC<{timezone: string}> = ({timezone}) => {
  const queryClient = useQueryClient();
  const availability = useQuery({queryKey: ['me', 'teaching-availability'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyTeachingAvailability(), 'myTeachingAvailability'), retry: false});
  const [version, setVersion] = useState<number | null>(null);
  const [windows, setWindows] = useState<AvailabilityWindowRequest[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityExceptionRequest[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<AvailabilityWindowRequest>(() => emptyWindow(timezone));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!availability.data) return;
    setVersion(availability.data.version ?? availability.data.availabilityVersion ?? null);
    setWindows(availability.data.windows ?? []);
    setExceptions(availability.data.exceptions ?? []);
    setSelectedIndex(null);
    setDraft(emptyWindow(timezone));
  }, [availability.data, timezone]);

  const validationMessage = useMemo(() => {
    if (!draft.dayOfWeek || !draft.startTime || !draft.endTime) return 'Choose a day, start time, and end time.';
    if (draft.endTime <= draft.startTime) return 'End time must be later than start time.';
    if (draft.effectiveFrom && draft.effectiveTo && draft.effectiveTo < draft.effectiveFrom) return 'Effective end date must be on or after the start date.';
    return '';
  }, [draft]);

  const commitDraft = () => {
    if (validationMessage) return;
    const normalized = {...draft, timezone: draft.timezone || timezone};
    setWindows(current => selectedIndex == null
      ? [...current, normalized]
      : current.map((item, index) => index === selectedIndex ? normalized : item));
    setSelectedIndex(null);
    setDraft(emptyWindow(timezone));
    setSaved(false);
  };

  const mutation = useMutation({
    mutationFn: () => courseOperationsApiService.replaceMyTeachingAvailability({
      expectedVersion: version ?? undefined,
      windows,
      exceptions,
    }),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({queryKey: ['me', 'teaching-availability']});
    },
  });

  if (availability.isPending) return <section className={styles.card}><p className={styles.empty} role="status">Loading availability…</p></section>;
  if (availability.isError) return <section className={styles.card}><div className={styles.inlineAlert} role="alert"><span>Availability could not be loaded.</span><button type="button" onClick={() => void availability.refetch()}>Retry</button></div></section>;

  const errorMessage = mutation.isError
    ? getApiErrorCode(mutation.error)?.includes('VERSION_CONFLICT')
      ? 'Availability changed in another session. Reload the latest schedule before saving again.'
      : getApiErrorMessage(mutation.error, 'Availability could not be saved. Your changes remain on this page.')
    : '';

  return <div className={styles.workspace}>
    <section className={styles.card} aria-labelledby="availability-title">
      <div className={styles.cardHeading}><div><h2 id="availability-title">Weekly availability</h2><p>These windows tell advisors when you can teach. They do not create classes automatically.</p></div><span className={styles.versionBadge}>Version {version ?? '—'}</span></div>
      {windows.length === 0 ? <div className={styles.emptyPanel}><strong>No weekly availability yet</strong><span>Add your first teaching window below.</span></div> : <div className={styles.availabilityList}>{windows.map((item, index) => <article className={styles.availabilityRow} key={`${item.dayOfWeek}-${item.startTime}-${item.effectiveFrom ?? 'ongoing'}-${index}`}>
        <span className={styles.availabilityIcon}><CalendarClock size={19} aria-hidden="true"/></span>
        <span><strong>{humanize(item.dayOfWeek)}</strong><small>{formatTime(item.startTime)}–{formatTime(item.endTime)}</small><small>{item.effectiveFrom || item.effectiveTo ? `${formatDate(item.effectiveFrom) ?? 'Now'}–${formatDate(item.effectiveTo) ?? 'Ongoing'}` : 'Ongoing'} · {item.timezone || timezone}</small></span>
        <span className={styles.rowActions}><button type="button" onClick={() => { setSelectedIndex(index); setDraft({...item}); setSaved(false); }}><Pencil size={16} aria-hidden="true"/> Edit</button><button type="button" className={styles.textDanger} onClick={() => { setWindows(current => current.filter((_, itemIndex) => itemIndex !== index)); if (selectedIndex === index) { setSelectedIndex(null); setDraft(emptyWindow(timezone)); } setSaved(false); }}><Trash2 size={16} aria-hidden="true"/> Remove</button></span>
      </article>)}</div>}
      {exceptions.length > 0 ? <div className={styles.exceptionNotice}><strong>{exceptions.length} date exception{exceptions.length === 1 ? '' : 's'} will be preserved</strong><span>This contract supports saving existing exceptions, but does not yet identify their business labels. No exception is deleted when weekly hours are changed.</span></div> : null}
    </section>

    <section className={styles.card} aria-labelledby="availability-editor-title">
      <div className={styles.cardHeading}><div><h2 id="availability-editor-title">{selectedIndex == null ? 'Add teaching window' : 'Edit teaching window'}</h2><p>Set a recurring day and the dates when this window applies.</p></div></div>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); commitDraft(); }}>
        <label>Day<select value={draft.dayOfWeek} onChange={event => setDraft(current => ({...current, dayOfWeek: event.target.value}))}>{WEEKDAYS.map(day => <option key={day}>{day}</option>)}</select></label>
        <label>Start time<EnglishTimeInput required value={draft.startTime ?? ''} onChangeValue={startTime => setDraft(current => ({...current, startTime}))}/></label>
        <label>End time<EnglishTimeInput required value={draft.endTime ?? ''} onChangeValue={endTime => setDraft(current => ({...current, endTime}))}/></label>
        <label>Effective from<EnglishDateInput value={draft.effectiveFrom ?? ''} onChangeValue={effectiveFrom => setDraft(current => ({...current, effectiveFrom: effectiveFrom || undefined}))}/></label>
        <label>Effective to<EnglishDateInput value={draft.effectiveTo ?? ''} onChangeValue={effectiveTo => setDraft(current => ({...current, effectiveTo: effectiveTo || undefined}))}/></label>
        {validationMessage ? <p className={styles.formMessage} role="alert">{validationMessage}</p> : null}
        <div className={styles.actions}><button className={styles.secondary} disabled={Boolean(validationMessage)}>{selectedIndex == null ? <><Plus size={17} aria-hidden="true"/> Add window</> : 'Apply changes'}</button>{selectedIndex != null ? <button type="button" className={styles.secondary} onClick={() => { setSelectedIndex(null); setDraft(emptyWindow(timezone)); }}>Cancel edit</button> : null}</div>
      </form>
      <div className={styles.saveBar}>
        <span>{windows.length} window{windows.length === 1 ? '' : 's'} ready to save</span>
        <button type="button" className={styles.primary} disabled={mutation.isPending || version == null} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : 'Save all availability'}</button>
      </div>
      {version == null ? <p className={styles.formMessage} role="alert">The backend response did not provide the version required for a safe update.</p> : null}
      {saved ? <p className={styles.successMessage} role="status">Availability saved.</p> : null}
      {errorMessage ? <div className={styles.inlineAlert} role="alert"><span>{errorMessage}</span>{getApiErrorCode(mutation.error)?.includes('VERSION_CONFLICT') ? <button type="button" onClick={() => void availability.refetch()}>Reload latest</button> : null}</div> : null}
    </section>
  </div>;
};

export const TeacherOperationsSections: React.FC<{section: TeacherSection; timezone: string}> = ({section, timezone}) =>
  section === 'teaching' ? <TeachingQueue/> : <AvailabilityEditor timezone={timezone}/>;
