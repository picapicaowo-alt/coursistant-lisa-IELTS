import { useTranslation } from 'react-i18next';
import {useState} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {isConflict} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from './LearningJourney.module.scss';

export function ScheduleRequestActions({requestId, version, onReload}: {requestId: number; version?: number; onReload: () => Promise<boolean>}) {
  const { t: translate } = useTranslation();
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);
  const decision = useMutation({
    mutationFn: (action: 'APPROVE' | 'REJECT') => {
      const payload = {decision: action, expectedVersion: version, rejectionReason: action === 'REJECT' ? reason.trim() : undefined};
      return courseOperationsApiService.decideAdvisorScheduleRequest(requestId, payload, idempotency.keyFor(`schedule-decision-${requestId}`, idempotencyFingerprint(payload)));
    },
    onError: error => setConflict(isConflict(error)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['advisor', 'student-schedule-requests']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'schedule-requests']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'student-hub']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'dashboard']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'owned-course-schedule']}),
      ]);
    },
  });
  const reload = async () => {
    setReloading(true);
    setReloadFailed(false);
    try {
      // Query refetch resolves even on HTTP errors; only fresh data releases the guard.
      if (await onReload()) {
        setConflict(false);
        decision.reset();
      } else setReloadFailed(true);
    } catch {
      setReloadFailed(true);
    } finally {
      setReloading(false);
    }
  };
  return <form noValidate className={styles.decisionForm} onSubmit={event => {event.preventDefault(); if (rejecting && reason.trim() && !decision.isPending && !conflict && version != null) decision.mutate('REJECT');}}>
    {decision.isError ? <p role="alert">{advisingErrorMessage(decision.error, translate('advising:requestActions.failed'))}</p> : null}
    {conflict || version == null ? <button type="button" disabled={reloading} onClick={() => void reload()}>{reloading ? translate("advising:requestActions.reloading") : translate("advising:requestActions.reload")}</button> : null}
    {reloadFailed ? <p role="alert">{translate("advising:requestActions.reloadFailed")}</p> : null}
    {rejecting ? <label>{translate("operations:rejectionReason")}<textarea required value={reason} onChange={event => setReason(event.target.value)} disabled={decision.isPending}/></label> : null}
    <div className={styles.reqActions}>
      {rejecting ? <><button className={styles.rejectBtn} disabled={!reason.trim() || decision.isPending || conflict || version == null}>{translate("advising:requestActions.confirmReject")}</button><button type="button" disabled={decision.isPending} onClick={() => setRejecting(false)}>{translate("common:actions.cancel")}</button></> : <><button type="button" className={styles.rejectBtn} disabled={decision.isPending || conflict || version == null} onClick={() => setRejecting(true)}>{translate("common:status.REJECT")}</button><button type="button" className={styles.approveBtn} disabled={decision.isPending || conflict || version == null} onClick={() => decision.mutate('APPROVE')}>{decision.isPending ? translate("common:actions.saving") : translate("common:status.APPROVE")}</button></>}
    </div>
    {version == null ? <small>{translate("advising:requestActions.reloadHelp")}</small> : null}
  </form>;
}
