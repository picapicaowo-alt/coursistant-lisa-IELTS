import {useState} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import type {InstructorScheduleRequestItem} from '@/apis/types/studentInstructorReadModels';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {contractClock} from '@/utils/contractTime';
import {formatPersonName} from '@/utils/personName';
import {getApiErrorMessage, isConflict, isHttpStatus} from '@/utils/apiError';
import styles from './index.module.scss';

export function InstructorScheduleRequestRow({item}: {item: InstructorScheduleRequestItem}) {
  const cache = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [reason, setReason] = useState('');
  const [stale, setStale] = useState(false);
  const review = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT') => {
      if (item.id == null || item.courseId == null || item.version == null || stale) throw new Error('Reload this request before reviewing.');
      if (decision === 'REJECT' && !reason.trim()) throw new Error('Enter a reason for rejecting this request.');
      const payload = {expectedVersion: item.version, decision, rejectionReason: decision === 'REJECT' ? reason.trim() : undefined};
      return idempotency.run(`schedule-review-${item.id}`, payload, (key, request) => courseOperationsApiService.reviewCourseScheduleRequest(item.courseId!, item.id!, request, key));
    },
    onError: error => { if (isConflict(error) || isHttpStatus(error, 403) || isHttpStatus(error, 404)) setStale(true); },
    onSuccess: () => cache.invalidateQueries({queryKey: ['me', 'teaching-schedule-requests']}),
  });
  const name = formatPersonName({firstName: item.studentFirstName, middleName: item.studentMiddleName, lastName: item.studentLastName}, 'Student');
  const canReview = item.requestType === 'SCHEDULE_CHANGE' && item.status === 'PENDING_INSTRUCTOR' && item.id != null && item.courseId != null && item.version != null && !stale && !review.isSuccess;
  return <article className={styles.card}>
    <h3>{name} · {item.courseTitle || item.courseCode || 'Course'}</h3>
    <p>Current: {item.occurrenceDate} {contractClock(item.occurrenceStartTime)}–{contractClock(item.occurrenceEndTime)} {item.timezone}</p>
    <p>Requested: {item.proposedOccurrenceDate} {contractClock(item.proposedStartTime)}–{contractClock(item.proposedEndTime)} {item.timezone}</p>
    {item.reason ? <p>{item.reason}</p> : null}
    <label className={styles.queueField}>Rejection reason<textarea value={reason} onChange={event => setReason(event.target.value)} disabled={!canReview || review.isPending}/></label>
    <div className={styles.actions}>
      <button type="button" className={styles.primary} disabled={!canReview || review.isPending} onClick={() => review.mutate('APPROVE')}>Approve for advisor review</button>
      <button type="button" className={styles.secondary} disabled={!canReview || review.isPending || !reason.trim()} onClick={() => review.mutate('REJECT')}>Reject request</button>
    </div>
    {review.isError ? <p role="alert">{getApiErrorMessage(review.error, 'The review could not be saved.')}</p> : null}
    {stale && isConflict(review.error) ? <button type="button" onClick={() => void cache.invalidateQueries({queryKey: ['me', 'teaching-schedule-requests']})}>Reload requests</button> : null}
    {review.isSuccess ? <p role="status">Review saved.</p> : null}
  </article>;
}
