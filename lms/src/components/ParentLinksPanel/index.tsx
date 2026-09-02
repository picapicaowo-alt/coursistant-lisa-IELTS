import React, {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {type ManagedUser, unwrapData} from '@/apis';
import {TenantUserPicker} from '@/components/TenantUserPicker';
import {parentApiService} from '@/apis/services/parent-api';
import {advisingErrorMessage} from '@/pages/advising/advisingErrors';
import styles from '@/pages/advising/advising.module.scss';
import {formatPersonName} from '@/utils/personName';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {WorkspaceSectionHeader} from '@/components/WorkspaceSectionHeader';
import {getApiErrorCode} from '@/utils/apiError';

type Scope = 'counsellor' | 'advisor' | 'tenant';

export const ParentLinksPanel = ({scope, subjectId}: {scope: Scope; subjectId: number}) => {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
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
    enabled: Number.isInteger(subjectId),
    queryFn: async () => unwrapData(
      await (scope === 'counsellor'
        ? parentApiService.listCounsellorParentLinks(subjectId)
        : scope === 'advisor'
          ? parentApiService.listAdvisorParentLinks(subjectId)
          : parentApiService.listTenantParentLinks(subjectId)),
      'parentLinks',
    ),
    retry: false,
  });
  const save = useMutation({
    mutationFn: async () => {
      if (scope === 'counsellor' && parent.parentUserId) {
        const request = {reason: parent.reason.trim() || undefined};
        const fingerprint = idempotencyFingerprint({parentUserId: Number(parent.parentUserId), ...request});
        const operation = `counsellor-link-parent-${subjectId}`;
        const key = idempotency.keyFor(operation, fingerprint);
        await parentApiService.linkExistingParent(subjectId, Number(parent.parentUserId), request, key);
        return {operation, fingerprint};
      }
      const createRequest = {
        email: parent.email.trim().toLowerCase(),
        ...(parent.firstName.trim() ? {firstName: parent.firstName.trim()} : {}),
        ...(parent.middleName.trim() ? {middleName: parent.middleName.trim()} : {}),
        ...(parent.lastName.trim() ? {lastName: parent.lastName.trim()} : {}),
        ...(parent.reason.trim() ? {reason: parent.reason.trim()} : {}),
      };
      if (scope === 'counsellor') {
        const fingerprint = idempotencyFingerprint(createRequest);
        const operation = `counsellor-create-parent-${subjectId}`;
        const key = idempotency.keyFor(operation, fingerprint);
        await parentApiService.createOrReuseParentLink(subjectId, createRequest, key);
        return {operation, fingerprint};
      }
      if (!parent.parentUserId) {
        const fingerprint = idempotencyFingerprint(createRequest);
        const operation = `tenant-create-parent-${subjectId}`;
        // The tenant create-or-reuse operation does not declare Idempotency-Key
        // in the consumed Parent OpenAPI contract.
        await parentApiService.createOrReuseTenantParentLink(subjectId, createRequest);
        return {operation, fingerprint};
      }
      const request = {reason: parent.reason.trim() || undefined};
      const fingerprint = idempotencyFingerprint({parentUserId: Number(parent.parentUserId), ...request});
      const operation = `tenant-link-parent-${subjectId}`;
      const key = idempotency.keyFor(operation, fingerprint);
      await parentApiService.linkTenantParent(subjectId, Number(parent.parentUserId), request, key);
      return {operation, fingerprint};
    },
    onSuccess: async result => {
      idempotency.completeFingerprint(result.operation, result.fingerprint);
      setParent({parentUserId: '', email: '', firstName: '', middleName: '', lastName: '', reason: ''});
      setSelectedParent(null);
      await queryClient.invalidateQueries({queryKey});
    },
  });
  const unlink = useMutation({
    mutationFn: async (parentUserId: number) => {
      const operation = `${scope}-unlink-parent-${subjectId}-${parentUserId}`;
      const fingerprint = idempotencyFingerprint({parentUserId});
      const key = idempotency.keyFor(operation, fingerprint);
      if (scope === 'counsellor') await parentApiService.unlinkIntakeParent(subjectId, parentUserId, {}, key);
      else await parentApiService.unlinkTenantParent(subjectId, parentUserId, {}, key);
      return {operation, fingerprint};
    },
    onSuccess: async result => {
      idempotency.completeFingerprint(result.operation, result.fingerprint);
      await queryClient.invalidateQueries({queryKey});
    },
  });

  const relationshipReadErrorCode = getApiErrorCode(links.error);
  const canRetryRelationshipRead = relationshipReadErrorCode !== 'INVALID_TOKEN'
    && relationshipReadErrorCode !== 'FORBIDDEN'
    && relationshipReadErrorCode !== 'ACCESS_DENIED';
  const mutationError = save.error || unlink.error;
  const description = scope === 'advisor'
    ? 'Parent links connect this student to a parent or guardian account. Advisors can view the relationship, but cannot change it.'
    : scope === 'counsellor'
      ? 'Connect a parent or guardian before the intake is handed to an Advisor. You can create, reuse, or unlink a relationship while you still own the intake.'
      : 'Review and manage the parent or guardian accounts connected to this student.';
  return (
    <section className={styles.card}>
      <WorkspaceSectionHeader
        title="Parent or guardian access"
        description={description}
        meta={scope === 'advisor' ? <span className={styles.readOnlyBadge}>Read only</span> : undefined}
      />
      {links.isError ? (
        <div className={styles.error} role="alert">
          <strong>{advisingErrorMessage(links.error, 'Parent links could not be loaded.')}</strong>
          {canRetryRelationshipRead ? <button type="button" className={styles.secondary} onClick={() => void links.refetch()}>Try again</button> : null}
        </div>
      ) : null}
      {mutationError ? <p className={styles.error} role="alert">{advisingErrorMessage(mutationError, 'Parent links could not be updated.')}</p> : null}
      {links.isPending ? <p className={styles.status}>Loading parent links…</p> : null}
      {!links.isError ? <div className={styles.list}>
        {(links.data ?? []).map((link, index) => (
          <article className={styles.row} key={link.linkId ?? index}>
            <div className={styles.identity}>
              <strong>{formatPersonName({firstName: link.parentFirstName, middleName: link.parentMiddleName, lastName: link.parentLastName}, `Parent #${link.parentUserId ?? '—'}`)}</strong>
              <span>{link.parentEmail || 'No email in response'} · linked {link.linkedAt || '—'}</span>
            </div>
            {scope !== 'advisor' && link.parentUserId != null ? <button type="button" className={styles.danger} disabled={unlink.isPending} onClick={() => unlink.mutate(link.parentUserId!)}>{unlink.isPending ? 'Unlinking…' : 'Unlink'}</button> : null}
          </article>
        ))}
      </div> : null}
      {!links.isPending && !links.isError && (links.data ?? []).length === 0 ? (
        <div className={styles.emptyState}>
          <strong>No parent or guardian linked</strong>
          <span>{scope === 'advisor' ? 'No relationship was included in the handover record.' : 'Add a relationship below if the student needs parent or guardian access.'}</span>
        </div>
      ) : null}
      {scope !== 'advisor' && !links.isError ? (
        <form className={styles.form} onSubmit={event => { event.preventDefault(); save.mutate(); }}>
          {scope === 'tenant' ? <div className={styles.actions}><button type="button" className={tenantMode === 'create' ? styles.selectedOption : styles.secondary} onClick={() => { setTenantMode('create'); setSelectedParent(null); setParent(current => ({...current, parentUserId: ''})); }}>Create or reuse by email</button><button type="button" className={tenantMode === 'existing' ? styles.selectedOption : styles.secondary} onClick={() => setTenantMode('existing')}>Link existing Parent</button></div> : null}
          {scope === 'tenant' && tenantMode === 'existing' ? <div className={styles.pickerField}><span>Existing Parent</span><TenantUserPicker title="Choose an existing Parent" description="Searches active Parent identities in this tenant by name or email." triggerLabel="Choose Parent" levels={['PARENT']} selectedUser={selectedParent} onSelect={user => { setSelectedParent(user); setParent(current => ({...current, parentUserId: String(user.id)})); }}/></div> : null}
          {scope === 'counsellor' ? <label><span>Existing parent user ID (optional)</span><input inputMode="numeric" value={parent.parentUserId} onChange={event => setParent(current => ({...current, parentUserId: event.target.value}))}/><small className={styles.fieldHelp}>Use this only when you already know the parent account ID. Otherwise, create or reuse the account by email.</small></label> : null}
          {(scope === 'tenant' ? tenantMode === 'create' : !parent.parentUserId) ? (
            <>
              <label><span>Parent email</span><input required type="email" value={parent.email} onChange={event => setParent(current => ({...current, email: event.target.value}))}/></label>
              <label><span>First name</span><input required maxLength={100} value={parent.firstName} onChange={event => setParent(current => ({...current, firstName: event.target.value}))}/></label>
              <label><span>Middle name</span><input maxLength={100} value={parent.middleName} onChange={event => setParent(current => ({...current, middleName: event.target.value}))}/></label>
              <label><span>Last name</span><input required maxLength={100} value={parent.lastName} onChange={event => setParent(current => ({...current, lastName: event.target.value}))}/></label>
            </>
          ) : null}
          <label><span>Relationship note</span><input value={parent.reason} onChange={event => setParent(current => ({...current, reason: event.target.value}))}/><small className={styles.fieldHelp}>Optional context for staff, such as “guardian” or “primary contact”.</small></label>
          <button className={styles.primary} disabled={save.isPending || (tenantMode === 'existing' && !selectedParent)}>{save.isPending ? 'Saving…' : !parent.parentUserId ? 'Create or reuse Parent' : 'Link Parent'}</button>
        </form>
      ) : null}
    </section>
  );
};
