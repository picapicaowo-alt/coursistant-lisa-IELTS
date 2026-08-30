import React, {useEffect, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useParams} from 'react-router-dom';
import {unwrapData} from '@/apis';
import {tenantAdvisingApiService} from '@/apis/services/tenant-advising-api';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';

const TenantCourseDeliveryPage: React.FC = () => {
  const {courseId} = useParams();
  const id = Number(courseId);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({catalogCode: '', capacity: ''});
  const config = useQuery({
    queryKey: ['tenant', 'course-delivery', id],
    queryFn: async () => unwrapData(await tenantAdvisingApiService.getCourseDeliveryConfig(id), 'tenantCourseDelivery'),
    enabled: Number.isInteger(id),
    retry: false,
  });

  useEffect(() => {
    if (!config.data) return;
    setDraft({catalogCode: config.data.catalogCode ?? '', capacity: config.data.capacity == null ? '' : String(config.data.capacity)});
  }, [config.data]);

  const refresh = () => queryClient.invalidateQueries({queryKey: ['tenant', 'course-delivery', id]});
  const save = useMutation({
    mutationFn: () => tenantAdvisingApiService.putCourseDeliveryConfig(id, {
      catalogCode: draft.catalogCode,
      capacity: Number(draft.capacity),
      expectedCourseLaunchVersion: config.data?.courseLaunchVersion,
    }),
    onSuccess: refresh,
  });
  const transition = useMutation({
    mutationFn: (action: 'ready' | 'publish') => action === 'ready'
      ? tenantAdvisingApiService.readyCourseLaunch(id, {expectedCourseLaunchVersion: config.data?.courseLaunchVersion})
      : tenantAdvisingApiService.publishCourseLaunch(id, {expectedCourseLaunchVersion: config.data?.courseLaunchVersion}),
    onSuccess: refresh,
  });

  const error = config.error || save.error || transition.error;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Tenant course operations</p>
          <h1>Delivery configuration</h1>
          <p className={styles.lede}>Course #{id} · configure, validate readiness, then publish.</p>
        </div>
      </header>
      {error ? <p className={styles.error} role="alert">{advisingErrorMessage(error, 'Delivery configuration could not be updated.')}</p> : null}
      <section className={styles.card}>
        {config.isPending ? <p className={styles.status}>Loading…</p> : null}
        {config.data ? (
          <>
            <p><span className={styles.badge}>{config.data.launchState || 'Draft'}</span> · version {config.data.courseLaunchVersion ?? '—'} · {config.data.deliveryMode || 'Course'}</p>
            <form className={styles.form} onSubmit={event => { event.preventDefault(); save.mutate(); }}>
              <label>Catalog code<input required value={draft.catalogCode} onChange={event => setDraft(current => ({...current, catalogCode: event.target.value}))}/></label>
              <label>Capacity<input required min="1" type="number" value={draft.capacity} onChange={event => setDraft(current => ({...current, capacity: event.target.value}))}/></label>
              <button className={styles.primary} disabled={save.isPending}>Save configuration</button>
            </form>
            <h2>Readiness blockers</h2>
            {(config.data.blockers ?? []).length === 0 ? <p className={styles.status}>No blockers reported.</p> : null}
            {(config.data.blockers ?? []).map((blocker, index) => <p className={styles.warn} key={`${blocker.code}-${index}`}>{blocker.code}: {blocker.message}</p>)}
            <div className={styles.actions}>
              <button className={styles.secondary} onClick={() => transition.mutate('ready')} disabled={transition.isPending}>Validate ready</button>
              <button className={styles.primary} onClick={() => transition.mutate('publish')} disabled={transition.isPending}>Publish course</button>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
};

export default TenantCourseDeliveryPage;
