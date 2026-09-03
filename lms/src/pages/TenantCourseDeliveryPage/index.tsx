import {getApiErrorCode} from '@/utils/apiError';
import {OwnerCourseSchedule} from './OwnerCourseSchedule';
import {OwnerDatedSchedule} from './OwnerDatedSchedule';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import React, {useEffect, useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useParams} from 'react-router-dom';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';

const AdvisorCourseDeliveryPage: React.FC = () => {
  const {courseId} = useParams();
  const id = Number(courseId);
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const initialized = useRef(false);
  const [reviewedVersion, setReviewedVersion] = useState<number>();
  const [reloadRequired, setReloadRequired] = useState(false);
  const [draft, setDraft] = useState({catalogCode: '', capacity: ''});
  const config = useQuery({
    queryKey: ['advisor', 'course-delivery', id],
    queryFn: async () => unwrapData(await advisorApiService.getCourseDeliveryConfig(id), 'advisorCourseDelivery'),
    enabled: Number.isInteger(id),
    retry: false,
  });

  useEffect(() => {
    if (!config.data || initialized.current) return;
    // The draft keeps the version the user reviewed; background refetches must not advance its write token.
    initialized.current = true;
    setReviewedVersion(config.data.courseLaunchVersion);
    setDraft({catalogCode: config.data.catalogCode ?? '', capacity: config.data.capacity == null ? '' : String(config.data.capacity)});
  }, [config.data]);

  const refresh = () => queryClient.invalidateQueries({queryKey: ['advisor', 'course-delivery', id]});
  const save = useMutation({
    mutationFn: () => idempotency.run('putCourseDeliveryConfig', [id, {
      catalogCode: draft.catalogCode,
      capacity: Number(draft.capacity),
      expectedCourseLaunchVersion: reviewedVersion,
    }] satisfies Parameters<typeof advisorApiService.putCourseDeliveryConfig>, (key, args) => advisorApiService.putCourseDeliveryConfig(...args, key)),
    onError: error => {if (getApiErrorCode(error)?.endsWith('VERSION_CONFLICT')) setReloadRequired(true);},
    onSuccess: async () => {initialized.current = false; setReloadRequired(false); await refresh();},
  });
  const transition = useMutation({
    mutationFn: (action: 'ready' | 'publish') => action === 'ready'
      ? idempotency.run('readyCourseLaunch', [id, {expectedCourseLaunchVersion: reviewedVersion}] satisfies Parameters<typeof advisorApiService.readyCourseLaunch>, (key, args) => advisorApiService.readyCourseLaunch(...args, key))
      : idempotency.run('publishCourseLaunch', [id, {expectedCourseLaunchVersion: reviewedVersion}] satisfies Parameters<typeof advisorApiService.publishCourseLaunch>, (key, args) => advisorApiService.publishCourseLaunch(...args, key)),
    onError: error => {if (getApiErrorCode(error)?.endsWith('VERSION_CONFLICT')) setReloadRequired(true);},
    onSuccess: async () => {initialized.current = false; setReloadRequired(false); await refresh();},
  });

  const error = config.error || save.error || transition.error;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>

          <h1>Delivery configuration</h1>
          <p className={styles.lede}>Course #{id} · configure, validate readiness, then publish.</p>
        </div>
      </header>
      {error ? <p className={styles.error} role="alert">{advisingErrorMessage(error, 'Delivery configuration could not be updated.')}</p> : null}
      {reloadRequired ? <div className={styles.conflictNotice} role="alert"><p>Your input is preserved. Reload the latest delivery version before saving.</p><button type="button" className={styles.secondary} onClick={() => void config.refetch().then(result => {if (result.data && !result.isError) {setReviewedVersion(result.data.courseLaunchVersion); setReloadRequired(false);}})}>Load latest delivery</button></div> : null}
      <section className={styles.card}>
        {config.isPending ? <p className={styles.status}>Loading…</p> : null}
        {config.data ? (
          <>
            <p><span className={styles.badge}>{config.data.launchState || 'Draft'}</span> · version {config.data.courseLaunchVersion ?? '—'} · {config.data.deliveryMode || 'Course'}</p>
            <form className={styles.form} onSubmit={event => { event.preventDefault(); save.mutate(); }}>
              <label>Catalog code<input required value={draft.catalogCode} onChange={event => setDraft(current => ({...current, catalogCode: event.target.value}))}/></label>
              <label>Capacity<input required min="1" type="number" value={draft.capacity} onChange={event => setDraft(current => ({...current, capacity: event.target.value}))}/></label>
              <button className={styles.primary} disabled={reloadRequired || save.isPending}>Save configuration</button>
            </form>
            <h2>Readiness blockers</h2>
            {(config.data.blockers ?? []).length === 0 ? <p className={styles.status}>No blockers reported.</p> : null}
            {(config.data.blockers ?? []).map((blocker, index) => <p className={styles.warn} key={`${blocker.code}-${index}`}>{blocker.code}: {blocker.message}</p>)}
            <div className={styles.actions}>
              <button className={styles.secondary} onClick={() => transition.mutate('ready')} disabled={reloadRequired || transition.isPending}>Validate ready</button>
              <button className={styles.primary} onClick={() => transition.mutate('publish')} disabled={reloadRequired || transition.isPending || config.data.launchState !== 'READY' || config.data.courseLaunchVersion == null}>Publish course</button>
            </div>
          </>
        ) : null}
      </section>
      {config.data?.deliveryMode === 'GROUP' && config.data.launchState !== 'PUBLISHED' ? <OwnerCourseSchedule courseId={id}/> : null}
      {config.isSuccess ? <OwnerDatedSchedule key={id} courseId={id}/> : null}
    </div>
  );
};

export default AdvisorCourseDeliveryPage;
