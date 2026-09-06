import {useTranslation} from 'react-i18next';
import {LocalizedError} from '@/i18n/errors';
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
  const {t: translate} = useTranslation();
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [invalid, setInvalid] = useState(false);
  const detail = useQuery({
    queryKey: ['mock-exams', 'instructor', 'grade', gradeId],
    queryFn: async () => unwrapData(await mockExamApiService.getInstructorWritingGrade(gradeId), 'instructorWritingGrade'),
    retry: false,
  });
  const hasDetail = detail.isSuccess && detail.data != null && typeof detail.data === 'object' && Object.keys(detail.data).length > 0;
  const pendingGrade = !(detail.data && typeof detail.data === 'object' && 'status' in detail.data) || detail.data.status === 'PENDING';
  const submit = useMutation({
    mutationFn: async () => {
      if (!hasDetail || !pendingGrade || !score.trim() || !feedback.trim() || !Number.isFinite(Number(score)) || Number(score) < 0 || Number(score) > 9 || !Number.isInteger(Number(score) * 2)) throw new LocalizedError("exams:staff.invalidGrade");
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
    {detail.isPending ? <p role="status" className={styles.status}>{translate("exams:staff.loadingScript")}</p> : detail.isError ? <div role="alert" className={styles.error}><p>{advisingErrorMessage(detail.error, translate('exams:staff.scriptFailed'))}</p><button type="button" className={styles.secondary} onClick={() => void detail.refetch()}>{translate("common:actions.retry")}</button></div> : <div className={styles.script}><RecordSummaryList value={detail.data} emptyMessage={translate("exams:staff.noScript")}/></div>}
    <form noValidate className={styles.compactForm} onSubmit={event => {
      event.preventDefault();
      if (!hasDetail || submit.isPending || alreadyGraded) return;
      const valid = score.trim() && feedback.trim() && Number.isFinite(Number(score)) && Number(score) >= 0 && Number(score) <= 9 && Number.isInteger(Number(score) * 2);
      setInvalid(!valid);
      if (valid) submit.mutate();
    }}>
      <h3>{translate("exams:staff.assessment")}</h3>
      <label><span>{translate("records:fields.score")}</span><input required type="number" step="0.5" min="0" max="9" disabled={!hasDetail || submit.isPending || alreadyGraded} value={score} onChange={event => setScore(event.target.value)}/></label>
      <label><span>{translate("course:assignmentSubmissionDetail.feedback")}</span><textarea required rows={6} disabled={!hasDetail || submit.isPending || alreadyGraded} value={feedback} onChange={event => setFeedback(event.target.value)}/></label>
      <button className={styles.primary} disabled={!hasDetail || submit.isPending || alreadyGraded}>{submit.isPending ? translate("common:actions.submitting") : translate("exams:staff.submitResult")}</button>
      {invalid ? <p role="alert" className={styles.error}>{translate('exams:staff.gradeValidation')}</p> : null}
    </form>
    {submit.isError ? <p role="alert" className={styles.error}>{advisingErrorMessage(submit.error, translate('exams:staff.resultFailed'))}</p> : submit.isSuccess ? <p role="status">{translate("exams:staff.resultSubmitted")}</p> : null}
  </>;
}
