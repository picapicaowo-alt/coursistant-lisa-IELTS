import React, {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {type ManagedUser, unwrapData} from '@/apis';
import {TenantUserPicker} from '@/components/TenantUserPicker';
import {parentApiService} from '@/apis/services/parent-api';
import {advisingErrorMessage} from '@/pages/advising/advisingErrors';
import styles from '@/pages/advising/advising.module.scss';
import {formatPersonName} from '@/utils/personName';

type Scope = 'counsellor' | 'advisor' | 'tenant';

export const ParentLinksPanel = ({scope, subjectId}: {scope: Scope; subjectId: number}) => {
  const queryClient = useQueryClient();
  const [tenantMode, setTenantMode] = useState<'create' | 'existing'>('create');
  const [selectedParent, setSelectedParent] = useState<ManagedUser | null>(null);
  const [parent, setParent] = useState({
    parentUserId: '',
    email: '',
    firstName: '',
    middleName: '',
    lastName: '',
    reason: '',
  });
  const queryKey = ['parent-links', scope, subjectId] as const;
  const links = useQuery({
    queryKey,
    enabled: scope !== 'counsellor' && Number.isInteger(subjectId),
    queryFn: async () => unwrapData(
      await (scope === 'advisor'
        ? parentApiService.listAdvisorParentLinks(subjectId)
        : parentApiService.listTenantParentLinks(subjectId)),
      'parentLinks',
    ),
    retry: false,
  });
  const save = useMutation({
    mutationFn: () => {
      if (scope === 'counsellor' && parent.parentUserId) {
        return parentApiService.linkExistingParent(subjectId, Number(parent.parentUserId), {reason: parent.reason || undefined});
      }
      const createRequest = {
        email: parent.email.trim().toLowerCase(),
        ...(parent.firstName.trim() ? {firstName: parent.firstName.trim()} : {}),
        ...(parent.middleName.trim() ? {middleName: parent.middleName.trim()} : {}),
        ...(parent.lastName.trim() ? {lastName: parent.lastName.trim()} : {}),
        ...(parent.reason.trim() ? {reason: parent.reason.trim()} : {}),
      };
      if (scope === 'counsellor') {
        return parentApiService.createOrReuseParentLink(subjectId, createRequest);
      }
      if (!parent.parentUserId) {
        return parentApiService.createOrReuseTenantParentLink(subjectId, createRequest);
      }
      return parentApiService.linkTenantParent(subjectId, Number(parent.parentUserId), {reason: parent.reason || undefined});
    },
    onSuccess: async () => {
      setParent({parentUserId: '', email: '', firstName: '', middleName: '', lastName: '', reason: ''});
      setSelectedParent(null);
      await queryClient.invalidateQueries({queryKey});
    },
  });
  const unlink = useMutation({
    mutationFn: (parentUserId: number) => scope === 'counsellor'
      ? parentApiService.unlinkIntakeParent(subjectId, parentUserId)
      : parentApiService.unlinkTenantParent(subjectId, parentUserId),
    onSuccess: async () => queryClient.invalidateQueries({queryKey}),
  });

  const error = links.error || save.error || unlink.error;
  return (
    <section className={styles.card}>
      <h2>Parent links</h2>
      {error ? <p className={styles.error} role="alert">{advisingErrorMessage(error, 'Parent links could not be updated.')}</p> : null}
      {scope !== 'counsellor' && links.isPending ? <p className={styles.status}>Loading parent links…</p> : null}
      <div className={styles.list}>
        {(links.data ?? []).map((link, index) => (
          <article className={styles.row} key={link.linkId ?? index}>
            <div className={styles.identity}>
              <strong>{formatPersonName({firstName: link.parentFirstName, middleName: link.parentMiddleName, lastName: link.parentLastName}, `Parent #${link.parentUserId ?? '—'}`)}</strong>
              <span>{link.parentEmail || 'No email in response'} · linked {link.linkedAt || '—'}</span>
            </div>
            {scope === 'tenant' && link.parentUserId != null ? <button className={styles.danger} onClick={() => unlink.mutate(link.parentUserId!)}>Unlink</button> : null}
          </article>
        ))}
      </div>
      {scope !== 'advisor' ? (
        <form className={styles.form} onSubmit={event => { event.preventDefault(); save.mutate(); }}>
          {scope === 'tenant' ? <div className={styles.actions}><button type="button" className={tenantMode === 'create' ? styles.selectedOption : styles.secondary} onClick={() => { setTenantMode('create'); setSelectedParent(null); setParent(current => ({...current, parentUserId: ''})); }}>Create or reuse by email</button><button type="button" className={tenantMode === 'existing' ? styles.selectedOption : styles.secondary} onClick={() => setTenantMode('existing')}>Link existing Parent</button></div> : null}
          {scope === 'tenant' && tenantMode === 'existing' ? <div className={styles.pickerField}><span>Existing Parent</span><TenantUserPicker title="Choose an existing Parent" description="Searches active Parent identities in this tenant by name or email." triggerLabel="Choose Parent" levels={['PARENT']} selectedUser={selectedParent} onSelect={user => { setSelectedParent(user); setParent(current => ({...current, parentUserId: String(user.id)})); }}/></div> : null}
          {scope === 'counsellor' ? <label>Existing parent user ID (optional)<input inputMode="numeric" value={parent.parentUserId} onChange={event => setParent(current => ({...current, parentUserId: event.target.value}))}/></label> : null}
          {(scope === 'tenant' ? tenantMode === 'create' : !parent.parentUserId) ? (
            <>
              <label>Parent email<input required type="email" value={parent.email} onChange={event => setParent(current => ({...current, email: event.target.value}))}/></label>
              <label>First name<input required maxLength={100} value={parent.firstName} onChange={event => setParent(current => ({...current, firstName: event.target.value}))}/></label>
              <label>Middle name<input maxLength={100} value={parent.middleName} onChange={event => setParent(current => ({...current, middleName: event.target.value}))}/></label>
              <label>Last name<input required maxLength={100} value={parent.lastName} onChange={event => setParent(current => ({...current, lastName: event.target.value}))}/></label>
            </>
          ) : null}
          <label>Reason<input value={parent.reason} onChange={event => setParent(current => ({...current, reason: event.target.value}))}/></label>
          <button className={styles.primary} disabled={save.isPending || (tenantMode === 'existing' && !selectedParent)}>{save.isPending ? 'Saving…' : !parent.parentUserId ? 'Create or reuse Parent' : 'Link Parent'}</button>
        </form>
      ) : null}
    </section>
  );
};
