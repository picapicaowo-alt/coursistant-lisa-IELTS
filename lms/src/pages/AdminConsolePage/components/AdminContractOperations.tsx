import React, {useEffect, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData, type ManagedUser} from '@/apis';
import {RecordSummaryList} from '@/components/RecordSummaryList';
import {adminApiService} from '@/apis/services/admin-api';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {notificationApiService} from '@/apis/services/notification-api';
import styles from '../index.module.scss';

const asRecord = (value: unknown): Record<string, unknown> | null => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const numberValue = (record: Record<string, unknown> | null, ...keys: string[]): number | undefined => { for (const key of keys) if (record && typeof record[key] === 'number') return record[key] as number; return undefined; };

export const AdminContractOperations: React.FC<{isSystemAdmin: boolean; users: ManagedUser[]}> = ({isSystemAdmin, users}) => {
  const queryClient = useQueryClient();
  const [adminSearch, setAdminSearch] = useState('');
  const [submittedAdminSearch, setSubmittedAdminSearch] = useState('');
  const [digest, setDigest] = useState({date: '', tenantId: ''});
  const [alerts, setAlerts] = useState({version: '', inactivityDays: '', gradingDelayDays: '', absenceCount: '', absenceWindowDays: ''});

  const directory = useQuery({
    queryKey: ['admin', 'directory', submittedAdminSearch],
    queryFn: async () => unwrapData(await adminApiService.listAdmins({email: submittedAdminSearch || undefined, name: submittedAdminSearch || undefined, username: submittedAdminSearch || undefined}), 'adminDirectory'),
    enabled: isSystemAdmin,
    retry: false,
  });
  const alertRules = useQuery({queryKey: ['tenant', 'alert-rules'], queryFn: async () => unwrapData(await courseOperationsApiService.getTenantAlertRules(), 'tenantAlertRules'), retry: false});

  useEffect(() => {
    const record = asRecord(alertRules.data);
    if (!record) return;
    const field = (key: string) => typeof record[key] === 'number' ? String(record[key]) : '';
    setAlerts({version: String(numberValue(record, 'version', 'alertRulesVersion') ?? ''), inactivityDays: field('inactivityDays'), gradingDelayDays: field('gradingDelayDays'), absenceCount: field('absenceCount'), absenceWindowDays: field('absenceWindowDays')});
  }, [alertRules.data]);

  const digestMutation = useMutation({mutationFn: () => notificationApiService.runAdminDigest({digestDate: digest.date, tenantId: digest.tenantId ? Number(digest.tenantId) : undefined})});
  const alertMutation = useMutation({
    mutationFn: () => courseOperationsApiService.putTenantAlertRules({expectedVersion: Number(alerts.version), inactivityDays: alerts.inactivityDays ? Number(alerts.inactivityDays) : undefined, gradingDelayDays: alerts.gradingDelayDays ? Number(alerts.gradingDelayDays) : undefined, absenceCount: alerts.absenceCount ? Number(alerts.absenceCount) : undefined, absenceWindowDays: alerts.absenceWindowDays ? Number(alerts.absenceWindowDays) : undefined}),
    onSuccess: async () => queryClient.invalidateQueries({queryKey: ['tenant', 'alert-rules']}),
  });

  return (
    <>
      {isSystemAdmin ? <section className={styles.card}>
        <h2>Administrator directory</h2>
        <form className={styles.form} onSubmit={event => { event.preventDefault(); setSubmittedAdminSearch(adminSearch.trim()); }}><label><span>Name, email, or username</span><input value={adminSearch} onChange={event => setAdminSearch(event.target.value)}/></label><button className={styles.primaryButton}>Search administrators</button></form>
        <RecordSummaryList value={directory.data} emptyMessage="No administrators match this search."/>
      </section> : null}

      <section className={styles.card}>
        <h2>Tenant alert rules</h2>
        {alertRules.isPending ? <p className={styles.status}>Loading alert rules…</p> : null}
        {alertRules.isError ? <p className={styles.errorMessage}>Alert rules could not be loaded.</p> : null}
        {alerts.version ? <form className={styles.form} onSubmit={event => { event.preventDefault(); alertMutation.mutate(); }}><label><span>Inactivity days</span><input type="number" min="0" value={alerts.inactivityDays} onChange={event => setAlerts(current => ({...current, inactivityDays: event.target.value}))}/></label><label><span>Grading delay days</span><input type="number" min="0" value={alerts.gradingDelayDays} onChange={event => setAlerts(current => ({...current, gradingDelayDays: event.target.value}))}/></label><label><span>Absence count</span><input type="number" min="0" value={alerts.absenceCount} onChange={event => setAlerts(current => ({...current, absenceCount: event.target.value}))}/></label><label><span>Absence window days</span><input type="number" min="0" value={alerts.absenceWindowDays} onChange={event => setAlerts(current => ({...current, absenceWindowDays: event.target.value}))}/></label><button className={styles.primaryButton} disabled={alertMutation.isPending}>Save alert rules</button></form> : !alertRules.isPending && !alertRules.isError ? <p className={styles.hint}>The backend response did not include the version required for safe updates.</p> : null}
      </section>

      {isSystemAdmin ? <section className={styles.card}>
        <h2>Notification digest</h2><p className={styles.hint}>Run the digest for a selected date. Leave tenant blank for a system-wide run.</p>
        <form className={styles.form} onSubmit={event => { event.preventDefault(); digestMutation.mutate(); }}><label><span>Digest date</span><input required type="date" value={digest.date} onChange={event => setDigest(current => ({...current, date: event.target.value}))}/></label><label><span>Tenant</span><select value={digest.tenantId} onChange={event => setDigest(current => ({...current, tenantId: event.target.value}))}><option value="">All tenants</option>{[...new Map(users.map(user => [user.tenantId, user.tenantId])).values()].map(tenantId => <option key={tenantId} value={tenantId}>Tenant #{tenantId}</option>)}</select></label><button className={styles.primaryButton} disabled={!digest.date || digestMutation.isPending}>Run digest</button></form>
      </section> : null}
    </>
  );
};
