import {FormEvent, useMemo, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ChevronDown, Search, UserRoundCheck, X} from 'lucide-react';
import type {ManagedUser, UserLevel} from '@/apis';
import {unwrapData} from '@/apis';
import {adminApiService} from '@/apis/services/admin-api';
import {formatPersonName} from '@/utils/personName';
import styles from './index.module.scss';

const PAGE_SIZE = 20;

interface TenantUserPickerProps {
  variant?: 'action' | 'filter';
  includeAllAccounts?: boolean;
  description: string;
  levels: UserLevel[];
  onSelect: (user: ManagedUser) => void;
  selectedUser?: ManagedUser | null;
  title: string;
  triggerLabel: string;
}

export const TenantUserPicker = ({
  variant = 'action',
  includeAllAccounts = false,
  description,
  levels,
  onSelect,
  selectedUser,
  title,
  triggerLabel,
}: TenantUserPickerProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [pendingSelection, setPendingSelection] = useState<ManagedUser | null>(selectedUser ?? null);

  const results = useQuery({
    queryKey: ['tenant', 'user-picker', includeAllAccounts, levels, query, page, PAGE_SIZE],
    queryFn: async () => unwrapData(await adminApiService.listTenantUsers({
      q: query || undefined,
      role: includeAllAccounts ? undefined : 'USER',
      levels: includeAllAccounts ? undefined : levels,
      status: includeAllAccounts ? undefined : 'ACTIVE',
      page,
      size: PAGE_SIZE,
    }), 'tenantUserPicker'),
    enabled: isOpen,
    retry: false,
  });

  const users = useMemo(() => results.data?.items ?? [], [results.data?.items]);
  const isPending = results.isPending;
  const isError = results.isError;
  const hasNextPage = Boolean(results.data && (page + 1) * PAGE_SIZE < results.data.total);

  const open = () => {
    setPendingSelection(selectedUser ?? null);
    setIsOpen(true);
    dialogRef.current?.showModal();
  };
  const close = () => {
    setIsOpen(false);
    dialogRef.current?.close();
  };
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(0);
    setQuery(searchDraft.trim());
  };
  const confirm = () => {
    if (!pendingSelection) return;
    onSelect(pendingSelection);
    close();
  };
  const searchId = `${title.replace(/\s+/g, '-').toLowerCase()}-search`;

  return (
    <div className={`${styles.picker} ${variant === 'filter' ? styles.filterPicker : ''}`}>
      {selectedUser ? (
        <div className={styles.selection}>
          <UserRoundCheck aria-hidden="true" size={19}/>
          <span><strong>{formatPersonName(selectedUser, `User #${selectedUser.id}`)}</strong><small>{selectedUser.email} · {selectedUser.level}</small></span>
          <button type="button" className={styles.changeButton} onClick={open}>Change</button>
        </div>
      ) : <button type="button" className={styles.trigger} onClick={open}>{triggerLabel}{variant === 'filter' ? <ChevronDown size={16}/> : null}</button>}

      <dialog className={styles.dialog} ref={dialogRef} aria-labelledby={`${searchId}-title`} onClose={() => { setIsOpen(false); setPendingSelection(selectedUser ?? null); }}>
        <div className={styles.dialogHeader}>
          <div><h2 id={`${searchId}-title`}>{title}</h2><p>{description}</p></div>
          <button type="button" className={styles.iconButton} aria-label="Close selector" onClick={close}><X size={20}/></button>
        </div>
        <form className={styles.search} role="search" onSubmit={submitSearch}>
          <label htmlFor={searchId}>Search by name or email</label>
          <div><Search aria-hidden="true" size={18}/><input id={searchId} value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Name or email"/><button type="submit">Search</button></div>
        </form>

        <div className={styles.results} aria-busy={isPending}>
          {isPending ? <p className={styles.status} role="status">Loading eligible people…</p> : null}
          {isError ? <div className={styles.error} role="alert"><p>Eligible people could not be loaded.</p><button type="button" onClick={() => void results.refetch()}>Try again</button></div> : null}
          {!isPending && !isError && users.length === 0 ? <p className={styles.status}>No {includeAllAccounts ? '' : 'active '}users match this search.</p> : null}
          {users.map(user => (
            <label className={pendingSelection?.id === user.id ? styles.selectedRow : styles.row} key={user.id}>
              <input type="radio" name="tenant-user" checked={pendingSelection?.id === user.id} onChange={() => setPendingSelection(user)}/>
              <span><strong>{formatPersonName(user, `User #${user.id}`)}</strong><small>{user.email}</small></span>
              <em>{user.level}</em>
            </label>
          ))}
        </div>

        <div className={styles.pagination}>
          <button type="button" disabled={page === 0 || isPending} onClick={() => setPage(current => Math.max(0, current - 1))}>Previous</button>
          <span>Page {page + 1}</span>
          <button type="button" disabled={!hasNextPage || isPending} onClick={() => setPage(current => current + 1)}>Next</button>
        </div>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.cancelButton} onClick={close}>Cancel</button>
          <button type="button" className={styles.confirmButton} disabled={!pendingSelection} onClick={confirm}>Use selected person</button>
        </div>
      </dialog>
    </div>
  );
};
