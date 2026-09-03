import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import type {SessionOccurrenceResponse} from '@/apis/types/studentInstructorReadModels';
import {courseOperationsApiService as api} from '@/apis/services/course-operations-api';
import {EnglishDateInput, EnglishTimeInput} from '@/components/EnglishDateInput';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {QueryFeedback} from '@/components/QueryFeedback';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {contractClock} from '@/utils/contractTime';
import {getApiErrorMessage, isConflict, isHttpStatus} from '@/utils/apiError';
import styles from '../advising/advising.module.scss';

/** Mounted only after the owner-scoped delivery read succeeds. The API remains
 * authoritative for ownership, lifecycle, availability and version conflicts. */
export function OwnerDatedSchedule({courseId}: {courseId: number}) {
  const cache = useQueryClient();
  const checkpoint = useIdempotencyCheckpoint();
  const [history, setHistory] = useState(false);
  const [selected, setSelected] = useState<SessionOccurrenceResponse>();
  const [editing, setEditing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<number>();
  const [draft, setDraft] = useState({occurrenceDate: '', startTime: '', endTime: ''});
  const query = useQuery({queryKey: ['advisor', 'dated-schedule', courseId, history], queryFn: async () => unwrapData(await api.listSessionOccurrences(courseId, {includeHistory: history}), 'ownerOccurrences'), retry: false});
  const refresh = () => Promise.all([
    cache.invalidateQueries({queryKey: ['advisor', 'dated-schedule', courseId]}),
    cache.invalidateQueries({queryKey: ['advisor', 'course-delivery', courseId]}),
    cache.invalidateQueries({queryKey: ['advisor', 'owned-course-schedule']}),
  ]);
  const mutation = useMutation({
    mutationFn: async (cancel: SessionOccurrenceResponse | undefined) => {
      if (blocked) throw new Error('Reload the schedule before making another change.');
      if (cancel) {
        if (cancel.id == null || cancel.version == null) throw new Error('This occurrence has no editable version.');
        return api.cancelSessionOccurrence(courseId, cancel.id, cancel.version);
      }
      if (!draft.occurrenceDate || !draft.startTime || draft.endTime <= draft.startTime) throw new Error('Choose a date and a valid time range.');
      if (selected) {
        if (selected.id == null || selected.version == null) throw new Error('Reload this occurrence before rescheduling.');
        return checkpoint.run(`reschedule-${selected.id}`, {...draft, expectedVersion: selected.version}, (key, payload) => api.rescheduleSessionOccurrence(courseId, selected.id!, payload, key));
      }
      return checkpoint.run('create-occurrence', draft, (key, payload) => api.createSessionOccurrence(courseId, payload, key));
    },
    onError: error => { if (isConflict(error) || isHttpStatus(error, 403) || isHttpStatus(error, 404)) setBlocked(true); },
    onSuccess: async () => {setEditing(false); setSelected(undefined); setConfirmCancel(undefined); await refresh();},
  });
  const edit = (item?: SessionOccurrenceResponse) => {
    setSelected(item); setEditing(true); setConfirmCancel(undefined);
    setDraft({occurrenceDate: item?.occurrenceDate ?? '', startTime: contractClock(item?.startTime) ?? '', endTime: contractClock(item?.endTime) ?? ''});
  };
  return <WorkspaceSection title="Dated classes">
    <div className={styles.actions}><button type="button" className={styles.secondary} disabled={blocked || mutation.isPending || !query.isSuccess} onClick={() => edit()}>Add dated class</button><label><input type="checkbox" checked={history} onChange={event => setHistory(event.target.checked)}/> Include schedule history</label></div>
    <QueryFeedback pending={query.isPending} error={query.error} onRetry={() => void query.refetch()}/>
    {query.isSuccess && query.data.length === 0 ? <p>No dated classes in this schedule.</p> : null}
    {query.data?.map(item => <article key={item.id} className={styles.inboxRow}><span>{item.occurrenceDate} · {contractClock(item.startTime)}–{contractClock(item.endTime)} · {item.timezone} · {item.status}</span>{item.current !== false && item.id != null && item.version != null && item.status !== 'CANCELLED' && item.status !== 'RESCHEDULED' ? <div className={styles.actions}><button type="button" className={styles.secondary} disabled={blocked || mutation.isPending} onClick={() => edit(item)}>Reschedule</button>{confirmCancel === item.id ? <><button type="button" className={styles.danger} disabled={blocked || mutation.isPending} onClick={() => mutation.mutate(item)}>Confirm cancellation</button><button type="button" className={styles.secondary} onClick={() => setConfirmCancel(undefined)}>Keep class</button></> : <button type="button" className={styles.secondary} disabled={blocked || mutation.isPending} onClick={() => setConfirmCancel(item.id)}>Cancel class</button>}</div> : null}</article>)}
    {editing ? <form className={styles.form} onSubmit={event => {event.preventDefault(); mutation.mutate(undefined);}}><h3>{selected ? 'Reschedule class' : 'Add dated class'}</h3><label>Date<EnglishDateInput required value={draft.occurrenceDate} onChangeValue={occurrenceDate => setDraft(current => ({...current, occurrenceDate}))}/></label><label>Start<EnglishTimeInput required value={draft.startTime} onChangeValue={startTime => setDraft(current => ({...current, startTime}))}/></label><label>End<EnglishTimeInput required value={draft.endTime} onChangeValue={endTime => setDraft(current => ({...current, endTime}))}/></label><button className={styles.primary} disabled={blocked || mutation.isPending || !draft.occurrenceDate || !draft.startTime || draft.endTime <= draft.startTime}>Save class</button><button type="button" className={styles.secondary} onClick={() => setEditing(false)}>Close editor</button></form> : null}
    {mutation.isError ? <p role="alert">{getApiErrorMessage(mutation.error, 'The schedule could not be updated.')}</p> : null}
    {blocked && isConflict(mutation.error) ? <button type="button" className={styles.secondary} onClick={() => void query.refetch().then(result => {if (result.isSuccess) {setEditing(false); setSelected(undefined); setBlocked(false); mutation.reset();}})}>Discard draft and reload schedule</button> : null}
  </WorkspaceSection>;
}
