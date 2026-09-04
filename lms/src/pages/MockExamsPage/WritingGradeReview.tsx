import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {getApiErrorCode} from '@/utils/apiError';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from './staff.module.scss';

/** Mounted by grade ID so scores, feedback and retries never move to another script. */
export function WritingGradeReview({gradeId, onBusy}: {gradeId: number; onBusy?: (busy: boolean) => void}) {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const detail = useQuery({
    queryKey: ['mock-exams', 'instructor', 'grade', gradeId],
    queryFn: async () => unwrapData(await mockExamApiService.getInstructorWritingGrade(gradeId), 'instructorWritingGrade'),
    retry: false,
  });
  const hasDetail = detail.isSuccess && detail.data != null && typeof detail.data === 'object' && Object.keys(detail.data).length > 0;
  const pendingGrade = !(detail.data && typeof detail.data === 'object' && 'status' in detail.data) || detail.data.status === 'PENDING';
  const submit = useMutation({
    mutationFn: async () => {
      if (!hasDetail || !pendingGrade || !score.trim() || !Number.isFinite(Number(score)) || Number(score) < 0 || Number(score) > 9 || !Number.isInteger(Number(score) * 2)) throw new Error('Load the script and enter a valid score before submitting.');
      return idempotency.run('writing-grade', [gradeId, {score: Number(score), feedback: feedback.trim() || undefined}] satisfies Parameters<typeof mockExamApiService.gradeInstructorWriting>, (key, args) => mockExamApiService.gradeInstructorWriting(...args, key));
    },
    onMutate: () => onBusy?.(true),
    onSettled: () => onBusy?.(false),
    onSuccess: async () => {
      setScore('');
      setFeedback('');
      await queryClient.invalidateQueries({queryKey: ['mock-exams', 'instructor']});
    },
  });
  const alreadyGraded = !pendingGrade || submit.isSuccess || getApiErrorCode(submit.error) === 'MOCK_EXAM_WRITING_ALREADY_GRADED';
  return <>
    {detail.isPending ? <p role="status" className={styles.status}>Loading script…</p> : detail.isError ? <div role="alert" className={styles.error}><p>{advisingErrorMessage(detail.error, 'The writing script could not be loaded.')}</p><button type="button" className={styles.secondary} onClick={() => void detail.refetch()}>Retry</button></div> : <div className={styles.script}><RecordSummaryList value={detail.data} emptyMessage="No writing script is available to grade."/></div>}
    <form className={styles.compactForm} onSubmit={event => {event.preventDefault(); submit.mutate();}}>
      <h3>Assessment</h3>
      <label><span>Score</span><input required type="number" step="0.5" min="0" max="9" disabled={!hasDetail || submit.isPending || alreadyGraded} value={score} onChange={event => setScore(event.target.value)}/></label>
      <label><span>Feedback</span><textarea required rows={6} disabled={!hasDetail || submit.isPending || alreadyGraded} value={feedback} onChange={event => setFeedback(event.target.value)}/></label>
      <button className={styles.primary} disabled={!hasDetail || submit.isPending || alreadyGraded}>{submit.isPending ? 'Submitting…' : 'Submit result'}</button>
    </form>
    {submit.isError ? <p role="alert" className={styles.error}>{advisingErrorMessage(submit.error, 'The writing result could not be submitted.')}</p> : submit.isSuccess ? <p role="status">Writing result submitted.</p> : null}
  </>;
}
