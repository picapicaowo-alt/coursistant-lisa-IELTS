import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {mockExamApiService} from '@/apis/services/mock-exam-api';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorCode, isHttpStatus} from '@/utils/apiError';
import {QueryFeedback} from '@/components/QueryFeedback';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from './staff.module.scss';

/** Mounted by grade ID so scores, feedback and retries never move to another script. */
export function WritingGradeReview({gradeId}: {gradeId: number}) {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [closed, setClosed] = useState(false);
  const detail = useQuery({
    queryKey: ['mock-exams', 'instructor', 'grade', gradeId],
    queryFn: async () => unwrapData(await mockExamApiService.getInstructorWritingGrade(gradeId), 'instructorWritingGrade'),
    retry: false,
  });
  const hasDetail = detail.isSuccess && Array.isArray(detail.data.tasks) && detail.data.tasks.length > 0;
  const canGrade = hasDetail && detail.data?.status === 'PENDING' && !closed;
  const validScore = score.trim() !== '' && Number.isFinite(Number(score)) && Number(score) >= 0 && Number(score) <= 9 && Number.isInteger(Number(score) * 2);
  const submit = useMutation({
    mutationFn: async () => {
      if (!canGrade || !validScore) throw new Error('Load a pending script and enter a score from 0 to 9 in steps of 0.5.');
      return idempotency.run('writing-grade', [gradeId, {score: Number(score), feedback: feedback.trim() || undefined}] satisfies Parameters<typeof mockExamApiService.gradeInstructorWriting>, (key, args) => mockExamApiService.gradeInstructorWriting(...args, key));
    },
    onError: async error => {
      if (getApiErrorCode(error) === 'MOCK_EXAM_WRITING_ALREADY_GRADED' || isHttpStatus(error, 403) || isHttpStatus(error, 404)) {
        setClosed(true);
        await queryClient.invalidateQueries({queryKey: ['mock-exams', 'instructor']});
      }
    },
    onSuccess: async () => {
      setClosed(true);
      setScore('');
      setFeedback('');
      await queryClient.invalidateQueries({queryKey: ['mock-exams', 'instructor']});
    },
  });
  return <>
    <QueryFeedback pending={detail.isPending} error={detail.error} onRetry={() => void detail.refetch()}/>
    {detail.isSuccess ? <div className={styles.script}><RecordSummaryList value={detail.data} emptyMessage="No writing script is available to grade."/></div> : null}
    {detail.isSuccess && detail.data.status !== 'PENDING' ? <p role="status">This submission is no longer available for grading.</p> : null}
    <form className={styles.compactForm} onSubmit={event => {event.preventDefault(); submit.mutate();}}>
      <label><span>Score</span><input required type="number" step="0.5" min="0" max="9" disabled={!canGrade || submit.isPending} value={score} onChange={event => setScore(event.target.value)}/></label>
      <label><span>Feedback</span><textarea rows={6} disabled={!canGrade || submit.isPending} value={feedback} onChange={event => setFeedback(event.target.value)}/></label>
      <button className={styles.primary} disabled={!canGrade || !validScore || submit.isPending}>{submit.isPending ? 'Submitting…' : 'Submit result'}</button>
    </form>
    {submit.isError ? <p role="alert" className={styles.error}>{advisingErrorMessage(submit.error, 'The writing result could not be submitted.')}</p> : submit.isSuccess ? <p role="status">Writing result submitted.</p> : null}
  </>;
}
