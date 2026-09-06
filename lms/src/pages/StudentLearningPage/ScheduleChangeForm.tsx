import {parseInputDate} from '@/i18n/dateInput';
import {timeDurationMinutes} from '@/utils/dateTimeRange';
import { useTranslation } from 'react-i18next';
import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {SCHEDULE_REQUEST_TYPES, unwrapData, type ScheduleRequestType} from '@/apis';
import {courseOperationsApiService as api} from '@/apis/services/course-operations-api';
import {EnglishDateInput, EnglishTimeInput} from '@/components/EnglishDateInput';
import {TeachingError} from '@/components/TeachingWorkspace';
import {LearningBadge, LearningQueryState} from '@/components/LearningWorkspace';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {record, textValue, type OperationRecord} from '@/utils/operationRecords';
import {learningDate} from './learningData';
import s from './details.module.scss';
import common from './index.module.scss';

export function ScheduleChangeForm({courseId, occurrenceId, occurrence, onSubmitted}: {courseId: number; occurrenceId: number; occurrence: OperationRecord; onSubmitted: () => void}) {
  const { t: translate } = useTranslation();
  const [requestType, setRequestType] = useState<ScheduleRequestType>('SCHEDULE_CHANGE');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [validation, setValidation] = useState('');
  const client = useQueryClient();
  const checkpoint = useIdempotencyCheckpoint();
  const attendance = useQuery({queryKey: ['student-learning', courseId, occurrenceId, 'attendance'], queryFn: async () => record(unwrapData(await api.getOwnOccurrenceAttendance(courseId, occurrenceId), 'class attendance')), retry: false});
  const mutation = useMutation({mutationFn: () => {
    const request = {requestType, reason: reason.trim() || undefined, ...(requestType === 'SCHEDULE_CHANGE' ? {proposedOccurrenceDate: date, proposedStartTime: `${start.slice(0, 5)}:00`, proposedEndTime: `${end.slice(0, 5)}:00`} : {})};
    return checkpoint.run(`student-schedule-${courseId}-${occurrenceId}`, request, async (key, payload) => unwrapData(await api.createCourseScheduleRequest(courseId, occurrenceId, payload, key), 'schedule request'));
  }, onSuccess: async () => {
    await Promise.all([client.invalidateQueries({queryKey: ['student-learning', 'requests']}), client.invalidateQueries({queryKey: ['me', 'schedule-requests']})]);
    onSubmitted();
  }});
  return <form className={s.form} noValidate onSubmit={event => {event.preventDefault(); if (requestType === 'SCHEDULE_CHANGE' && (!parseInputDate(date) || timeDurationMinutes(start, end) === null)) {setValidation("learning:schedule.invalidRange"); return;} setValidation(''); mutation.mutate();}}>
    <div className={s.selectedClass}><strong>{textValue(occurrence, 'title', 'courseTitle') || translate("learning:schedule.class")}</strong><span>{learningDate(textValue(occurrence, 'occurrenceDate', 'date'))} · {textValue(occurrence, 'timezone')}</span></div>
    <LearningQueryState query={attendance}/>
    {attendance.isSuccess && textValue(attendance.data, 'effectiveStatus', 'rawStatus', 'status') ? <LearningBadge value={textValue(attendance.data, 'effectiveStatus', 'rawStatus', 'status')}/> : null}
    <label>{translate("operations:requestType")}<select value={requestType} disabled={mutation.isPending} onChange={event => setRequestType(event.target.value as ScheduleRequestType)}>{SCHEDULE_REQUEST_TYPES.map(type => <option key={type} value={type}>{type === 'ABSENCE' ? translate("learning:schedule.absence") : translate("common:status.SCHEDULE_CHANGE")}</option>)}</select></label>
    {requestType === 'SCHEDULE_CHANGE' ? <><label>{translate("operations:proposedDate")}<EnglishDateInput aria-label={translate("operations:proposedDate")} disabled={mutation.isPending} required value={date} onChangeValue={setDate}/></label><div className={s.timeFields}><label>{translate("operations:proposedStart")}<EnglishTimeInput aria-label={translate("operations:proposedStart")} disabled={mutation.isPending} required value={start} onChangeValue={setStart}/></label><label>{translate("operations:proposedEnd")}<EnglishTimeInput aria-label={translate("operations:proposedEnd")} disabled={mutation.isPending} required value={end} onChangeValue={setEnd}/></label></div><p className={s.note}>{translate("learning:schedule.timezone", {timezone: textValue(occurrence, 'timezone') ? ` (${textValue(occurrence, 'timezone')})` : ''})}</p></> : null}
    <label>{translate("common:fields.reason")}<textarea rows={4} value={reason} disabled={mutation.isPending} onChange={event => setReason(event.target.value)} placeholder={translate("learning:schedule.reasonPlaceholder")}/></label>
    {validation ? <p className={s.error} role="alert">{translate(validation)}</p> : null}<TeachingError error={mutation.error}/>
    <button className={common.primary} disabled={mutation.isPending} type="submit">{mutation.isPending ? translate("common:actions.submitting") : translate("operations:submitRequest")}</button>
  </form>;
}
