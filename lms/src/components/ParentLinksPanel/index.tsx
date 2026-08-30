import React, {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {parentApiService} from '@/apis/services/parent-api';
import {advisingErrorMessage} from '@/pages/advising/advisingErrors';
import styles from '@/pages/advising/advising.module.scss';

type Scope = 'counsellor' | 'advisor' | 'tenant';

export const ParentLinksPanel = ({scope, subjectId}: {scope: Scope; subjectId: number}) => {
  const queryClient = useQueryClient();
  const [parent, setParent] = useState({parentUserId: '', email: '', name: '', reason: ''});
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
      if (scope === 'counsellor') {
        return parentApiService.createOrReuseParentLink(subjectId, {email: parent.email.trim(), name: parent.name.trim(), reason: parent.reason || undefined});
      }
      return parentApiService.linkTenantParent(subjectId, Number(parent.parentUserId), {reason: parent.reason || undefined});
    },
    onSuccess: async () => {
      setParent({parentUserId: '', email: '', name: '', reason: ''});
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
              <strong>{link.parentName || `Parent #${link.parentUserId ?? '—'}`}</strong>
              <span>{link.parentEmail || 'No email in response'} · linked {link.linkedAt || '—'}</span>
            </div>
            {scope === 'tenant' && link.parentUserId != null ? <button className={styles.danger} onClick={() => unlink.mutate(link.parentUserId!)}>Unlink</button> : null}
          </article>
        ))}
      </div>
      {scope !== 'advisor' ? (
        <form className={styles.form} onSubmit={event => { event.preventDefault(); save.mutate(); }}>
          <label>Existing parent user ID<input inputMode="numeric" required={scope === 'tenant'} value={parent.parentUserId} onChange={event => setParent(current => ({...current, parentUserId: event.target.value}))}/></label>
          {scope === 'counsellor' && !parent.parentUserId ? (
            <>
              <label>Parent email<input required type="email" value={parent.email} onChange={event => setParent(current => ({...current, email: event.target.value}))}/></label>
              <label>Parent name<input required value={parent.name} onChange={event => setParent(current => ({...current, name: event.target.value}))}/></label>
            </>
          ) : null}
          <label>Reason<input value={parent.reason} onChange={event => setParent(current => ({...current, reason: event.target.value}))}/></label>
          <button className={styles.primary} disabled={save.isPending}>{scope === 'counsellor' && !parent.parentUserId ? 'Create or reuse parent' : 'Link parent'}</button>
        </form>
      ) : null}
    </section>
  );
};
