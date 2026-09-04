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
  return <form className={s.form} onSubmit={event => {event.preventDefault(); if (requestType === 'SCHEDULE_CHANGE' && (!date || !start || !end || end <= start)) {setValidation('Choose a date and an end time after the start time.'); return;} setValidation(''); mutation.mutate();}}>
    <div className={s.selectedClass}><strong>{textValue(occurrence, 'title', 'courseTitle') || 'Scheduled class'}</strong><span>{learningDate(textValue(occurrence, 'occurrenceDate', 'date'))} · {textValue(occurrence, 'timezone')}</span></div>
    <LearningQueryState query={attendance}/>
    {attendance.isSuccess && textValue(attendance.data, 'effectiveStatus', 'rawStatus', 'status') ? <LearningBadge value={textValue(attendance.data, 'effectiveStatus', 'rawStatus', 'status')}/> : null}
    <label>Request type<select value={requestType} disabled={mutation.isPending} onChange={event => setRequestType(event.target.value as ScheduleRequestType)}>{SCHEDULE_REQUEST_TYPES.map(type => <option key={type} value={type}>{type === 'ABSENCE' ? 'Absence request' : 'Schedule change'}</option>)}</select></label>
    {requestType === 'SCHEDULE_CHANGE' ? <><label>Proposed date<EnglishDateInput disabled={mutation.isPending} required value={date} onChangeValue={setDate}/></label><div className={s.timeFields}><label>Proposed start<EnglishTimeInput disabled={mutation.isPending} required value={start} onChangeValue={setStart}/></label><label>Proposed end<EnglishTimeInput disabled={mutation.isPending} required value={end} onChangeValue={setEnd}/></label></div><p className={s.note}>Times use the class timezone{textValue(occurrence, 'timezone') ? `: ${textValue(occurrence, 'timezone')}` : ''}.</p></> : null}
    <label>Reason<textarea rows={4} value={reason} disabled={mutation.isPending} onChange={event => setReason(event.target.value)} placeholder="Share the reason for your request…"/></label>
    {validation ? <p className={s.error} role="alert">{validation}</p> : null}<TeachingError error={mutation.error}/>
    <button className={common.primary} disabled={mutation.isPending} type="submit">{mutation.isPending ? 'Submitting…' : 'Submit request'}</button>
  </form>;
}
