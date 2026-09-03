import {WorkspaceSection} from '@/components/WorkspaceSection';
import {FormEvent, useEffect, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {RefreshCw} from 'lucide-react';
import type {TenantAlertRuleMode, TenantAlertRuleResponse} from '@/apis';
import {unwrapData} from '@/apis';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {getApiErrorMessage} from '@/utils/apiError';
import styles from './index.module.scss';

type NumericField = 'deadlineWindowDays' | 'absenceCount' | 'absenceWindowDays' | 'completionPercentage' | 'completionWindowDays' | 'completionMinimumSample' | 'inactivityDays' | 'performancePercentage' | 'performanceMinimumGradedSample' | 'gradingDelayDays';
type ToggleField = 'negativeHoursEnabled' | 'overdueTaskEnabled' | 'checkpointIncompleteEnabled';
type AlertForm = {mode: TenantAlertRuleMode} & Record<NumericField, string> & Record<ToggleField, boolean>;

const emptyForm: AlertForm = {
  mode: 'SYSTEM_DEFAULT',
  deadlineWindowDays: '', absenceCount: '', absenceWindowDays: '', completionPercentage: '', completionWindowDays: '', completionMinimumSample: '', inactivityDays: '', performancePercentage: '', performanceMinimumGradedSample: '', gradingDelayDays: '',
  negativeHoursEnabled: false, overdueTaskEnabled: false, checkpointIncompleteEnabled: false,
};
const numericFields: {key: NumericField; label: string; step?: string}[] = [
  {key: 'deadlineWindowDays', label: 'Deadline window (days)'},
  {key: 'absenceCount', label: 'Absence count'},
  {key: 'absenceWindowDays', label: 'Absence window (days)'},
  {key: 'completionPercentage', label: 'Completion percentage', step: '0.01'},
  {key: 'completionWindowDays', label: 'Completion window (days)'},
  {key: 'completionMinimumSample', label: 'Completion minimum sample'},
  {key: 'inactivityDays', label: 'Inactivity (days)'},
  {key: 'performancePercentage', label: 'Performance percentage', step: '0.01'},
  {key: 'performanceMinimumGradedSample', label: 'Minimum graded sample'},
  {key: 'gradingDelayDays', label: 'Grading delay (days)'},
];
const toggleFields: {key: ToggleField; label: string}[] = [
  {key: 'negativeHoursEnabled', label: 'Negative hours'},
  {key: 'overdueTaskEnabled', label: 'Overdue tasks'},
  {key: 'checkpointIncompleteEnabled', label: 'Incomplete checkpoints'},
];

const toForm = (data: TenantAlertRuleResponse): AlertForm => {
  const form = {...emptyForm, mode: data.mode};
  numericFields.forEach(({key}) => { form[key] = data[key] == null ? '' : String(data[key]); });
  toggleFields.forEach(({key}) => { form[key] = data[key] === 1; });
  return form;
};
const numberOrNull = (value: string): number | null => value.trim() ? Number(value) : null;

export const AlertRulesPanel = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AlertForm>(emptyForm);
  const [saved, setSaved] = useState(false);
  const rules = useQuery({queryKey: ['tenant', 'alert-rules'], queryFn: async () => unwrapData(await courseOperationsApiService.getTenantAlertRules(), 'tenantAlertRules'), retry: false});
  useEffect(() => { if (rules.data) setForm(toForm(rules.data)); }, [rules.data]);
  const save = useMutation({
    mutationFn: () => courseOperationsApiService.putTenantAlertRules(form.mode === 'TENANT_OVERRIDE' ? {
      mode: form.mode,
      ...(rules.data ? {expectedVersion: rules.data.version} : {}),
      ...Object.fromEntries(numericFields.map(({key}) => [key, numberOrNull(form[key])])),
      ...Object.fromEntries(toggleFields.map(({key}) => [key, form[key] ? 1 : null])),
    } : {mode: form.mode, ...(rules.data ? {expectedVersion: rules.data.version} : {})}),
    onSuccess: async response => {
      const latest = unwrapData(response, 'tenantPutAlertRules');
      setSaved(true);
      setForm(toForm(latest));
      queryClient.setQueryData(['tenant', 'alert-rules'], latest);
    },
  });
  const submit = (event: FormEvent) => { event.preventDefault(); setSaved(false); save.mutate(); };

  return <WorkspaceSection title="Tenant alert rules" headingId="alert-rules-title" summary="Choose the tenant-level policy. This page does not read individual student alerts or risk.">
    <div className={styles.panelHeading}><button type="button" className={styles.iconButton} aria-label="Refresh alert rules" onClick={() => void rules.refetch()}><RefreshCw size={18}/></button></div>
    {rules.isPending ? <p className={styles.status}>Loading alert rules…</p> : null}
    {rules.isError ? <div className={styles.errorNotice} role="alert"><p>{getApiErrorMessage(rules.error, 'Alert rules could not be loaded.')}</p><button type="button" onClick={() => void rules.refetch()}>Try again</button></div> : null}
    {rules.data ? <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.modePicker}><legend>Rule mode</legend><label><input type="radio" name="mode" checked={form.mode === 'SYSTEM_DEFAULT'} onChange={() => setForm(current => ({...current, mode: 'SYSTEM_DEFAULT'}))}/><span><strong>System default</strong><small>Use platform-managed thresholds.</small></span></label><label><input type="radio" name="mode" checked={form.mode === 'TENANT_OVERRIDE'} onChange={() => setForm(current => ({...current, mode: 'TENANT_OVERRIDE'}))}/><span><strong>Tenant override</strong><small>Set thresholds for this tenant.</small></span></label><label><input type="radio" name="mode" checked={form.mode === 'DISABLED'} onChange={() => setForm(current => ({...current, mode: 'DISABLED'}))}/><span><strong>Disabled</strong><small>Disable tenant alert evaluation.</small></span></label></fieldset>
      {form.mode === 'TENANT_OVERRIDE' ? <><div className={styles.thresholdGrid}>{numericFields.map(({key, label, step}) => <label key={key}><span>{label}</span><input type="number" min="0" step={step ?? '1'} value={form[key]} onChange={event => setForm(current => ({...current, [key]: event.target.value}))}/></label>)}</div><fieldset className={styles.toggleGrid}><legend>Boolean alert checks</legend>{toggleFields.map(({key, label}) => <label key={key}><input type="checkbox" checked={form[key]} onChange={event => setForm(current => ({...current, [key]: event.target.checked}))}/><span>{label}</span></label>)}</fieldset></> : <p className={styles.hint}>{form.mode === 'SYSTEM_DEFAULT' ? 'Custom thresholds are ignored while System default is selected.' : 'Custom thresholds are ignored while alerts are disabled.'}</p>}
      <div className={styles.formFooter}><span>Current version {rules.data.version}{rules.data.updatedAt ? ` · updated ${new Date(rules.data.updatedAt).toLocaleString()}` : ''}</span><button className={styles.primaryButton} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save alert rules'}</button></div>
      {save.isError ? <p className={styles.inlineError} role="alert">{getApiErrorMessage(save.error, 'Alert rules could not be saved. Refresh the latest version and try again.')}</p> : null}
      {saved ? <p className={styles.inlineSuccess} role="status">Alert rules saved from the latest server response.</p> : null}
    </form> : null}
  </WorkspaceSection>;
};
