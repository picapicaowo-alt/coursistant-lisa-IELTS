import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import {formatClockTime, formatDateValue, formatNumber, formatWeekday} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import {parseInputDate} from '@/i18n/dateInput';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {CollapsibleSection} from '@/components/CollapsibleSection';
import {dashboardApiService} from '@/apis/services/dashboard-api';
import {assignmentGradingPath} from '@/configs/coursePaths';
import {registeredDestination} from '@/utils/registeredDestination';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
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
  return registeredDestination(destination) ?? undefined;
};

// Known contract codes are localized; authored titles and names retain their spelling.
const humanize = (value?: string): string => value ? statusLabel(value) : '';

const formatName = (record: {
  studentFirstName?: string;
  studentMiddleName?: string;
  studentLastName?: string;
  studentUserId: number;
}): string => [record.studentFirstName, record.studentMiddleName, record.studentLastName]
  .filter(Boolean)
  .join(' ') || i18n.t('common:people.studentFallback', {id: formatNumber(record.studentUserId)});

const formatDate = (value?: string): string | undefined => {
  if (!value) return undefined;
  return formatDateValue(value, {month: 'short', day: 'numeric', year: 'numeric', hour: undefined, minute: undefined});
};

const formatTime = (value?: string): string | undefined => {
  return value ? formatClockTime(value) : undefined;
};

const QueryState: React.FC<{
  empty: string;
  error: boolean;
  loading: boolean;
  onRetry: () => void;
}> = ({empty, error, loading, onRetry}) => {
  const { t: translate } = useTranslation();
  if (loading) return <p className={styles.empty} role="status">{translate("common:feedback.loading")}</p>;
  if (error) return <div className={styles.inlineAlert} role="alert"><span>{translate("common:feedback.sectionFailed")}</span><button type="button" onClick={onRetry}>{translate("common:actions.retry")}</button></div>;
  return <p className={styles.empty}>{empty}</p>;
};

const RecordRows: React.FC<{
  empty: string;
  items: UnknownRecord[];
  kind: 'alert' | 'request';
}> = ({empty, items, kind}) => {
  const {t: translate} = useTranslation();
  if (items.length === 0) return <p className={styles.empty}>{empty}</p>;
  return <div className={styles.operationList}>{items.map((item, index) => {
    const destination = internalLinkFrom(item);
    const title = kind === 'alert'
      ? humanize(textFrom(item, 'alertType', 'type')) || translate("operations:teacher.alert")
      : textFrom(item, 'title', 'requestType', 'type') || translate("operations:teacher.request");
    const meta = [
      textFrom(item, 'courseCode', 'courseTitle'),
      humanize(textFrom(item, 'status', 'severity')),
      formatDate(textFrom(item, 'createdAt', 'requestedAt', 'occurrenceDate')),
    ].filter(Boolean).join(' · ');
    const content = <><span><strong>{humanize(title)}</strong><small>{meta || (kind === 'alert' ? translate("operations:teacher.alertReview") : translate("operations:teacher.requestReview"))}</small></span>{destination ? <ChevronRight size={18} aria-hidden="true"/> : null}</>;
    const key = idFrom(item, 'alertId', 'requestId', 'id') ?? `${kind}-${index}`;
    return destination
      ? <Link className={styles.operationRow} to={destination} key={key}>{content}</Link>
      : <article className={styles.operationRow} key={key}>{content}</article>;
  })}</div>;
};

const TeachingQueue: React.FC = () => {
  const { t: translate } = useTranslation();
  const courses = useQuery({queryKey: ['me', 'teaching-courses'], queryFn: async () => unwrapData(await dashboardApiService.getTeachingCourses(), 'teachingCourses'), retry: false});
  const alerts = useQuery({queryKey: ['me', 'teaching-alerts'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyTeachingAlerts(), 'myTeachingAlerts'), retry: false});
  const grading = useQuery({queryKey: ['me', 'teaching-grading-items'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyTeachingGradingItems(), 'myTeachingGradingItems'), retry: false});
  const requests = useQuery({queryKey: ['me', 'teaching-schedule-requests'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyTeachingScheduleRequests(), 'myTeachingScheduleRequests'), retry: false});
  const support = useQuery({queryKey: ['me', 'teaching-support'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyTeachingStudentsNeedingSupport(), 'myTeachingSupport'), retry: false});
  const today = useQuery({queryKey: ['me', 'teaching-today'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyTeachingTodayClasses(), 'myTeachingToday'), retry: false});
  const gradingItems = grading.data ?? [];
  const supportStudents = support.data ?? [];
  const todayClasses = today.data ?? [];

  return <div className={styles.grid}>
    <WorkspaceSection title={translate("operations:teacher.today")} headingId="today-classes-title" summary={translate("operations:teacher.todayHelp")} meta={<span className={styles.countBadge}>{today.isSuccess ? formatNumber(todayClasses.length) : '—'}</span>}>

      {today.isPending || today.isError ? <QueryState loading={today.isPending} error={today.isError} empty={translate("operations:teacher.noClassesShort")} onRetry={() => void today.refetch()}/> : todayClasses.length === 0 ? <p className={styles.empty}>{translate("operations:teacher.noClassesShort")}</p> : <div className={styles.operationList}>{todayClasses.map((item: TeachingTodayClassResponse) => <Link to={`/course/${item.courseId}`} className={styles.operationRow} key={item.occurrenceId ?? item.sessionId ?? `${item.courseId}-${item.startTime}`}><span><strong>{item.courseTitle || item.courseCode || translate('assistant:courseFallback', {id: formatNumber(item.courseId)})}</strong><small>{[item.lectureNumber ? translate('operations:teacher.lecture', {number: formatNumber(item.lectureNumber)}) : undefined, `${formatTime(item.startTime) ?? translate("operations:teacher.timePending")}${item.endTime ? `–${formatTime(item.endTime)}` : ''}`, item.location, typeof item.studentCount === 'number' ? translate('operations:teacher.studentsCount', {count: item.studentCount, number: formatNumber(item.studentCount)}) : undefined].filter(Boolean).join(' · ')}</small></span><ChevronRight size={18} aria-hidden="true"/></Link>)}</div>}
    </WorkspaceSection>

    <WorkspaceSection title={translate("dashboard:gradingQueue")} headingId="grading-title" summary={translate("operations:teacher.queueHelp")} meta={<span className={styles.countBadge}>{grading.isError ? translate("course:learning.dataUnavailable") : grading.isPending ? '…' : formatNumber(gradingItems.length)}</span>}>

      {grading.isPending || grading.isError ? <QueryState loading={grading.isPending} error={grading.isError} empty={translate("operations:teacher.noGrading")} onRetry={() => void grading.refetch()}/> : gradingItems.length === 0 ? <p className={styles.empty}>{translate("operations:teacher.noGrading")}</p> : <div className={styles.operationList}>{gradingItems.map((item: TeachingGradingItemResponse) => {
        const destination = registeredDestination(item.gradingDeepLink) ?? assignmentGradingPath(item.courseId, item.assignmentId);
        return <Link to={destination} className={styles.operationRow} key={`${item.assignmentId}-${item.groupId ?? item.studentUserId}`}><span><strong>{item.title}</strong><small>{[item.groupName || formatName(item), item.courseCode, humanize(item.status), item.dueAtUtc ? translate('operations:teacher.due', {date: formatDate(item.dueAtUtc)}) : undefined].filter(Boolean).join(' · ')}</small></span><ChevronRight size={18} aria-hidden="true"/></Link>;
      })}</div>}
    </WorkspaceSection>

    <WorkspaceSection title={translate("operations:teacher.support")} headingId="support-title" summary={translate("operations:teacher.supportHelp")} meta={<span className={styles.countBadge}>{support.isSuccess ? formatNumber(supportStudents.length) : '—'}</span>}>

      {support.isPending || support.isError ? <QueryState loading={support.isPending} error={support.isError} empty={translate("advising:overview.noAttention")} onRetry={() => void support.refetch()}/> : supportStudents.length === 0 ? <p className={styles.empty}>{translate("advising:overview.noAttention")}</p> : <div className={styles.operationList}>{supportStudents.map((item: TeachingStudentSupportResponse) => {
        const destination = registeredDestination(item.deepLink) ?? `/course/${item.courseId}`;
        return <Link to={destination} className={styles.operationRow} key={`${item.courseId}-${item.studentUserId}`}><span><strong>{formatName(item)}</strong><small>{[item.courseTitle, ...(item.reasons ?? []).map(humanize)].filter(Boolean).join(' · ')}</small></span><ChevronRight size={18} aria-hidden="true"/></Link>;
      })}</div>}
    </WorkspaceSection>

    <WorkspaceSection title={translate("operations:teacher.alerts")} headingId="alerts-title" summary={translate("operations:teacher.alertsHelp")}>

      {alerts.isPending || alerts.isError ? <QueryState loading={alerts.isPending} error={alerts.isError} empty={translate("operations:teacher.noAlertsShort")} onRetry={() => void alerts.refetch()}/> : <RecordRows items={recordsFrom(alerts.data)} kind="alert" empty={translate("operations:teacher.noAlertsShort")}/>}
    </WorkspaceSection>

    <WorkspaceSection title={translate("operations:teacher.courses")} className={styles.fullWidthCard}>

      {courses.isPending || courses.isError ? <QueryState loading={courses.isPending} error={courses.isError} empty={translate("operations:teacher.noCoursesShort")} onRetry={() => void courses.refetch()}/> : !courses.data?.length ? <p className={styles.empty}>{translate("operations:teacher.noCoursesShort")}</p> : <div className={styles.operationList}>{courses.data.map(course => <Link className={styles.operationRow} to={`/course/${course.id}`} key={course.id}><span><strong>{course.title}</strong><small>{course.courseCode}</small></span><ChevronRight size={18} aria-hidden="true"/></Link>)}</div>}
    </WorkspaceSection>

    <WorkspaceSection title={translate("operations:scheduleRequests")} headingId="requests-title" className={styles.fullWidthCard} summary={translate("operations:teacher.requestsHelp")}>

      {requests.isPending || requests.isError ? <QueryState loading={requests.isPending} error={requests.isError} empty={translate("learning:overview.noRequests")} onRetry={() => void requests.refetch()}/> : <RecordRows items={recordsFrom(requests.data)} kind="request" empty={translate("learning:overview.noRequests")}/>}
    </WorkspaceSection>
  </div>;
};

const emptyWindow = (timezone: string): AvailabilityWindowRequest => ({
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime: '17:00',
  timezone,
});

const AvailabilityEditor: React.FC<{timezone: string}> = ({timezone}) => {
  const { t: translate } = useTranslation();
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const initialized = useRef(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const availability = useQuery({queryKey: ['me', 'teaching-availability'], queryFn: async () => unwrapData(await courseOperationsApiService.getMyTeachingAvailability(), 'myTeachingAvailability'), retry: false});
  const [version, setVersion] = useState<number | null>(null);
  const [windows, setWindows] = useState<AvailabilityWindowRequest[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityExceptionRequest[]>([]);
  const [editorReveal, setEditorReveal] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<AvailabilityWindowRequest>(() => emptyWindow(timezone));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!availability.data || initialized.current) return;
    initialized.current = true;
    setVersion(availability.data.version ?? availability.data.availabilityVersion ?? null);
    setWindows(availability.data.windows ?? []);
    setExceptions(availability.data.exceptions ?? []);
    setSelectedIndex(null);
    setDraft(emptyWindow(timezone));
  }, [availability.data, timezone]);

  const [dateInputError, setDateInputError] = useState(false);
  const validationKey = useMemo(() => {
    if (!draft.dayOfWeek || !draft.startTime || !draft.endTime) return 'operations:availability.required';
    if (draft.endTime <= draft.startTime) return 'operations:invalidTime';
    if (draft.effectiveFrom && draft.effectiveTo && draft.effectiveTo < draft.effectiveFrom) return 'operations:availability.invalidRange';
    return null;
  }, [draft]);

  const commitDraft = (form: HTMLFormElement) => {
    // An incomplete optional date is not an instruction to clear the effective boundary.
    const values = new FormData(form);
    const invalidDate = ['effectiveFrom', 'effectiveTo'].some(name => {
      const raw = String(values.get(name) ?? '').trim();
      return raw !== '' && !parseInputDate(raw);
    });
    setDateInputError(invalidDate);
    if (validationKey || invalidDate) return;
    const normalized = {...draft, timezone: draft.timezone || timezone};
    setWindows(current => selectedIndex == null
      ? [...current, normalized]
      : current.map((item, index) => index === selectedIndex ? normalized : item));
    setSelectedIndex(null);
    setDraft(emptyWindow(timezone));
    setSaved(false);
  };

  const mutation = useMutation({
    mutationFn: () => idempotency.run('instructor-availability', {
      expectedVersion: version ?? undefined,
      windows,
      exceptions,
    }, (key, payload) => courseOperationsApiService.replaceMyTeachingAvailability(payload, key)),
    onError: error => {if (getApiErrorCode(error)?.includes('VERSION_CONFLICT')) setReloadRequired(true);},
    onSuccess: async () => {
      initialized.current = false;
      setReloadRequired(false);
      setSaved(true);
      await queryClient.invalidateQueries({queryKey: ['me', 'teaching-availability']});
    },
  });

  if (availability.isPending) return <section className={styles.card}><p className={styles.empty} role="status">{translate("operations:availability.loading")}</p></section>;
  if (availability.isError) return <section className={styles.card}><div className={styles.inlineAlert} role="alert"><span>{translate("operations:availability.loadFailed")}</span><button type="button" onClick={() => void availability.refetch()}>{translate("common:actions.retry")}</button></div></section>;

  const errorMessage = mutation.isError
    ? getApiErrorCode(mutation.error)?.includes('VERSION_CONFLICT')
      ? translate('operations:availability.conflict')
      : getApiErrorMessage(mutation.error, translate('operations:availability.saveFailed'))
    : '';

  return <div className={styles.workspace}>
    <WorkspaceSection title={translate("operations:availability.title")} headingId="availability-title" summary={translate("operations:availability.help")} meta={<span className={styles.versionBadge}>{translate('operations:availability.version', {number: version == null ? '—' : formatNumber(version)})}</span>}>

      {windows.length === 0 ? <div className={styles.emptyPanel}><strong>{translate("operations:availability.empty")}</strong><span>{translate("operations:availability.emptyHelp")}</span></div> : <div className={styles.availabilityList}>{windows.map((item, index) => <article className={styles.availabilityRow} key={`${item.dayOfWeek}-${item.startTime}-${item.effectiveFrom ?? 'ongoing'}-${index}`}>
        <span className={styles.availabilityIcon}><CalendarClock size={19} aria-hidden="true"/></span>
        <span><strong>{formatWeekday(item.dayOfWeek ?? '', 'long')}</strong><small>{formatTime(item.startTime)}–{formatTime(item.endTime)}</small><small>{item.effectiveFrom || item.effectiveTo ? `${formatDate(item.effectiveFrom) ?? translate("operations:availability.now")}–${formatDate(item.effectiveTo) ?? translate("operations:availability.ongoing")}` : translate("operations:availability.ongoing")} · {item.timezone || timezone}</small></span>
        <span className={styles.rowActions}><button type="button" onClick={() => { setEditorReveal(current => current + 1); setDateInputError(false); setSelectedIndex(index); setDraft({...item}); setSaved(false); }}><Pencil size={16} aria-hidden="true"/> {translate("common:actions.edit")}</button><button type="button" className={styles.textDanger} onClick={() => { setWindows(current => current.filter((_, itemIndex) => itemIndex !== index)); if (selectedIndex === index) { setSelectedIndex(null); setDraft(emptyWindow(timezone)); setDateInputError(false); } else if (selectedIndex != null && selectedIndex > index) { setSelectedIndex(selectedIndex - 1); } setSaved(false); }}><Trash2 size={16} aria-hidden="true"/> {translate("common:actions.remove")}</button></span>
      </article>)}</div>}
      {exceptions.length > 0 ? <div className={styles.exceptionNotice}><strong>{translate('operations:availability.exceptions', {count: exceptions.length, number: formatNumber(exceptions.length)})}</strong><span>{translate("operations:availability.exceptionsHelp")}</span></div> : null}
    </WorkspaceSection>

    <CollapsibleSection title={selectedIndex == null ? translate("operations:availability.addTitle") : translate("operations:availability.editTitle")} headingId="availability-editor-title" revealKey={editorReveal} summary={translate("operations:availability.editorHelp")}>

      <form noValidate className={styles.form} onSubmit={event => { event.preventDefault(); commitDraft(event.currentTarget); }}>
        <label>{translate("course:scheduleModal.dayLabel")}<select value={draft.dayOfWeek} onChange={event => setDraft(current => ({...current, dayOfWeek: event.target.value}))}>{WEEKDAYS.map(day => <option key={day} value={day}>{formatWeekday(day, 'long')}</option>)}</select></label>
        <label>{translate("auth:preview.startTime")}<EnglishTimeInput name="startTime" aria-label={translate("auth:preview.startTime")} required value={draft.startTime ?? ''} onChangeValue={startTime => setDraft(current => ({...current, startTime}))}/></label>
        <label>{translate("operations:endTime")}<EnglishTimeInput name="endTime" aria-label={translate("operations:endTime")} required value={draft.endTime ?? ''} onChangeValue={endTime => setDraft(current => ({...current, endTime}))}/></label>
        <label>{translate("operations:availability.effectiveFrom")}<EnglishDateInput name="effectiveFrom" aria-label={translate("operations:availability.effectiveFrom")} value={draft.effectiveFrom ?? ''} onChangeValue={effectiveFrom => setDraft(current => ({...current, effectiveFrom: effectiveFrom || undefined}))}/></label>
        <label>{translate("operations:availability.effectiveTo")}<EnglishDateInput name="effectiveTo" aria-label={translate("operations:availability.effectiveTo")} value={draft.effectiveTo ?? ''} onChangeValue={effectiveTo => setDraft(current => ({...current, effectiveTo: effectiveTo || undefined}))}/></label>
        {validationKey || dateInputError ? <p className={styles.formMessage} role="alert">{translate(validationKey ?? "operations:availability.invalidDate")}</p> : null}
        <div className={styles.actions}><button className={styles.secondary} disabled={Boolean(validationKey)}>{selectedIndex == null ? <><Plus size={17} aria-hidden="true"/> {' '}{translate("operations:availability.add")}</> : translate("operations:availability.apply")}</button>{selectedIndex != null ? <button type="button" className={styles.secondary} onClick={() => { setSelectedIndex(null); setDraft(emptyWindow(timezone)); setDateInputError(false); }}>{translate("operations:availability.cancel")}</button> : null}</div>
      </form>
    </CollapsibleSection>
      <div className={styles.saveBar}>
        <span>{translate('operations:availability.ready', {count: windows.length, number: formatNumber(windows.length)})}</span>
        <button type="button" className={styles.primary} disabled={reloadRequired || mutation.isPending || version == null} onClick={() => mutation.mutate()}>{mutation.isPending ? translate("common:actions.saving") : translate("operations:availability.save")}</button>
      </div>
      {version == null ? <p className={styles.formMessage} role="alert">{translate("operations:availability.reloadRequired")}</p> : null}
      {saved ? <p className={styles.successMessage} role="status">{translate("operations:availability.saved")}</p> : null}
      {errorMessage ? <div className={styles.inlineAlert} role="alert"><span>{errorMessage}</span>{reloadRequired ? <button type="button" onClick={() => void availability.refetch().then(result => {if (result.data && !result.isError) {setVersion(result.data.version ?? result.data.availabilityVersion ?? null); setReloadRequired(false); mutation.reset();}})}>{translate("operations:availability.reload")}</button> : null}</div> : null}
  </div>;
};

export const TeacherOperationsSections: React.FC<{section: TeacherSection; timezone: string}> = ({section, timezone}) =>
  section === 'teaching' ? <TeachingQueue/> : <AvailabilityEditor timezone={timezone}/>;
