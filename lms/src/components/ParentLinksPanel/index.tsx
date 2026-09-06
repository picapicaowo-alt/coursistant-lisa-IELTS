import { useTranslation } from 'react-i18next';
import React, {useEffect, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {type ManagedUser, unwrapData} from '@/apis';
import {TenantUserPicker} from '@/components/TenantUserPicker';
import {parentApiService} from '@/apis/services/parent-api';
import {advisingErrorMessage} from '@/pages/advising/advisingErrors';
import styles from '@/pages/advising/advising.module.scss';
import {formatPersonName} from '@/utils/personName';
import {idempotencyFingerprint, useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {CollapsibleSection} from '@/components/CollapsibleSection';
import {WorkspaceSection} from '@/components/WorkspaceSection';
import {UsersRound} from 'lucide-react';
import panel from './index.module.scss';
import {getApiErrorCode, isNotFound} from '@/utils/apiError';
import {parentLinkQueryKeys} from './queryKeys';
import {formatUtcTimestamp} from '@/utils/datetime';
import {useConfirmationDialog} from '@/components/TeachingWorkspace/useConfirmationDialog';

type Scope = 'counsellor' | 'advisor' | 'tenant';

export const ParentLinksPanel = ({scope, subjectId, onUnavailable, presentation = 'disclosure'}: {scope: Scope; subjectId: number; onUnavailable?: () => void; presentation?: 'disclosure' | 'panel'}) => {
  const { t: translate } = useTranslation();
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const confirmation = useConfirmationDialog(`${scope}/${subjectId}`);
  const [validationKey, setValidationKey] = useState<string | null>(null);
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
  const queryKey = parentLinkQueryKeys.subject(scope, subjectId);
  const links = useQuery({
    meta: scope === 'advisor' ? {advisingStudentId: subjectId} : undefined,
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

  useEffect(() => {
    if ([links.error, save.error, unlink.error].some(isNotFound)) onUnavailable?.();
  }, [links.error, save.error, unlink.error, onUnavailable]);

  const relationshipReadErrorCode = getApiErrorCode(links.error);
  const canRetryRelationshipRead = relationshipReadErrorCode !== 'INVALID_TOKEN'
    && relationshipReadErrorCode !== 'FORBIDDEN'
    && relationshipReadErrorCode !== 'ACCESS_DENIED';
  const mutationError = save.error || unlink.error;
  const description = scope === 'advisor'
    ? translate("advising:parents.description.advisor")
    : scope === 'counsellor'
      ? translate("advising:parents.description.counsellor")
      : translate("advising:parents.description.tenant");
  const content = (
    <div className={presentation === 'panel' ? panel.content : undefined}>
      {confirmation.dialog}
      {presentation === 'panel' ? <p className={panel.description}>{description}</p> : null}
      {links.isError ? (
        <div className={styles.error} role="alert">
          <strong>{advisingErrorMessage(links.error, translate("advising:parents.loadFailed"))}</strong>
          {canRetryRelationshipRead ? <button type="button" className={styles.secondary} onClick={() => void links.refetch()}>{translate("common:actions.tryAgain")}</button> : null}
        </div>
      ) : null}
      {mutationError ? <p className={styles.error} role="alert">{advisingErrorMessage(mutationError, translate("advising:parents.updateFailed"))}</p> : null}
      {save.isSuccess ? <p className={styles.success} role="status">{translate("advising:parents.saved")}</p> : null}
      {unlink.isSuccess ? <p className={styles.success} role="status">{translate("advising:parents.removed")}</p> : null}
      {links.isPending ? <p className={styles.status}>{translate("advising:parents.loading")}</p> : null}
      {!links.isError ? <div className={styles.list}>
        {(links.data ?? []).map((link, index) => (
          <article className={styles.row} key={link.linkId ?? index}>
            <div className={styles.identity}>
              <strong>{formatPersonName({firstName: link.parentFirstName, middleName: link.parentMiddleName, lastName: link.parentLastName}, translate('advising:parents.fallback', {id: link.parentUserId ?? '—'}))}</strong>
              <span>{translate('advising:parents.linkedAt', {email: link.parentEmail || translate('advising:parents.noEmail'), date: link.linkedAt ? formatUtcTimestamp(link.linkedAt) : '—'})}</span>
            </div>
            {scope !== 'advisor' && link.parentUserId != null ? <button type="button" className={styles.danger} disabled={unlink.isPending || save.isPending} onClick={async () => {if (await confirmation.confirm({titleKey: 'advising:parents.unlink', messageKey: 'advising:parents.confirmUnlink'})) unlink.mutate(link.parentUserId!);}}>{unlink.isPending ? translate("advising:parents.unlinking") : translate("advising:parents.unlink")}</button> : null}
          </article>
        ))}
      </div> : null}
      {!links.isPending && !links.isError && (links.data ?? []).length === 0 ? (
        <div className={presentation === 'panel' ? `${panel.empty} ${scope === 'tenant' ? panel.emptyCompact : ''}` : styles.emptyState}>
          {presentation === 'panel' ? <span className={panel.emptyIcon} aria-hidden="true"><UsersRound size={scope === 'tenant' ? 24 : 32}/></span> : null}
          <strong>{translate("advising:parents.empty")}</strong>
          <span>{scope === 'advisor' ? translate("advising:parents.handoverEmpty") : translate("advising:parents.emptyHelp")}</span>
        </div>
      ) : null}
      {scope !== 'advisor' && links.isSuccess ? (
        <form noValidate className={styles.form} onSubmit={event => {
          event.preventDefault();
          const emailField = event.currentTarget.querySelector<HTMLInputElement>('input[type="email"]');
          const invalid = parent.parentUserId
            ? (!/^[1-9]\d*$/.test(parent.parentUserId) || !Number.isSafeInteger(Number(parent.parentUserId)) ? 'advising:parents.invalidId' : null)
            : !parent.email.trim() || emailField?.validity.typeMismatch ? 'auth:signupErrors.emailInvalid'
              : !parent.firstName.trim() ? 'operations:directory.validation.firstName'
                : !parent.lastName.trim() ? 'operations:directory.validation.lastName' : null;
          setValidationKey(invalid);
          if (!invalid && !save.isPending && !unlink.isPending) save.mutate();
        }}>
          {validationKey ? <p className={styles.error} role="alert">{translate(validationKey)}</p> : null}
          {scope === 'tenant' ? <div className={styles.actions}><button type="button" className={tenantMode === 'create' ? styles.selectedOption : styles.secondary} onClick={() => { setTenantMode('create'); setSelectedParent(null); setParent(current => ({...current, parentUserId: ''})); }}>{translate("advising:parents.createByEmail")}</button><button type="button" className={tenantMode === 'existing' ? styles.selectedOption : styles.secondary} onClick={() => setTenantMode('existing')}>{translate("advising:parents.linkExisting")}</button></div> : null}
          {scope === 'tenant' && tenantMode === 'existing' ? <div className={styles.pickerField}><span>{translate("advising:parents.existing")}</span><TenantUserPicker title={translate("advising:parents.chooseExisting")} description={translate("advising:parents.searchHelp")} triggerLabel={translate("advising:parents.choose")} levels={['PARENT']} selectedUser={selectedParent} onSelect={user => { setSelectedParent(user); setParent(current => ({...current, parentUserId: String(user.id)})); }}/></div> : null}
          {scope === 'counsellor' ? <label><span>{translate("advising:parents.existingId")}</span><input inputMode="numeric" value={parent.parentUserId} onChange={event => setParent(current => ({...current, parentUserId: event.target.value}))}/><small className={styles.fieldHelp}>{translate("advising:parents.idHelp")}</small></label> : null}
          <div className={presentation === 'panel' && scope === 'tenant' && tenantMode === 'create' ? panel.formFields : panel.stackedFields}>
          {(scope === 'tenant' ? tenantMode === 'create' : !parent.parentUserId) ? (
            <>
              <label><span>{translate("advising:parents.email")}</span><input required type="email" value={parent.email} onChange={event => setParent(current => ({...current, email: event.target.value}))}/></label>
              <label><span>{translate("common:fields.firstName")}</span><input required maxLength={100} value={parent.firstName} onChange={event => setParent(current => ({...current, firstName: event.target.value}))}/></label>
              <label><span>{translate("auth:signup.middleNameLabel")}</span><input maxLength={100} value={parent.middleName} onChange={event => setParent(current => ({...current, middleName: event.target.value}))}/></label>
              <label><span>{translate("common:fields.lastName")}</span><input required maxLength={100} value={parent.lastName} onChange={event => setParent(current => ({...current, lastName: event.target.value}))}/></label>
            </>
          ) : null}
          <label className={panel.relationshipNote}><span>{translate("advising:parents.note")}</span><input value={parent.reason} onChange={event => setParent(current => ({...current, reason: event.target.value}))}/><small className={styles.fieldHelp}>{translate("advising:parents.noteHelp")}</small></label>
          </div>
          <button className={styles.primary} disabled={save.isPending || unlink.isPending || (tenantMode === 'existing' && !selectedParent)}>{save.isPending ? translate("common:actions.saving") : !parent.parentUserId ? translate("advising:parents.create") : translate("advising:parents.link")}</button>
        </form>
      ) : null}
    </div>
  );
  return presentation === 'panel'
    ? <WorkspaceSection appearance="record" title={translate("advising:parents.title")} icon={scope === 'tenant' ? <UsersRound size={22}/> : undefined} count={links.isSuccess ? links.data?.length : undefined}>{content}</WorkspaceSection>
    : <CollapsibleSection title={translate("advising:parents.title")} summary={description} count={links.data?.length} className={styles.disclosureLayout} revealKey={links.isError || mutationError ? 'error' : undefined}>{content}</CollapsibleSection>;
};
