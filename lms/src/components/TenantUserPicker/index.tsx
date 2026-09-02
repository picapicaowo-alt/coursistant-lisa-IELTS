import {FormEvent, useMemo, useRef, useState} from 'react';
import {useQueries} from '@tanstack/react-query';
import {Search, UserRoundCheck, X} from 'lucide-react';
import type {ManagedUser, UserLevel} from '@/apis';
import {unwrapData} from '@/apis';
import {adminApiService} from '@/apis/services/admin-api';
import {formatPersonName} from '@/utils/personName';
import styles from './index.module.scss';

const PAGE_SIZE = 20;

interface TenantUserPickerProps {
  description: string;
  levels: UserLevel[];
  onSelect: (user: ManagedUser) => void;
  selectedUser?: ManagedUser | null;
  title: string;
  triggerLabel: string;
}

export const TenantUserPicker = ({
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

  const results = useQueries({
    queries: levels.map(level => ({
      queryKey: ['tenant', 'user-picker', level, query, page, PAGE_SIZE],
      queryFn: async () => unwrapData(await adminApiService.listTenantUsers({
        q: query || undefined,
        role: 'USER',
        level,
        status: 'ACTIVE',
        page,
        size: PAGE_SIZE,
      }), `tenant${level}Picker`),
      enabled: isOpen,
      retry: false,
    })),
  });

  const users = useMemo(() => {
    const byId = new Map<number, ManagedUser>();
    results.forEach(result => result.data?.items.forEach(user => byId.set(user.id, user)));
    return [...byId.values()];
  }, [results]);
  const isPending = results.some(result => result.isPending);
  const isError = results.some(result => result.isError);
  const hasNextPage = results.some(result => result.data && (page + 1) * PAGE_SIZE < result.data.total);

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
    <div className={styles.picker}>
      {selectedUser ? (
        <div className={styles.selection}>
          <UserRoundCheck aria-hidden="true" size={19}/>
          <span><strong>{formatPersonName(selectedUser, `User #${selectedUser.id}`)}</strong><small>{selectedUser.email} · {selectedUser.level}</small></span>
          <button type="button" className={styles.changeButton} onClick={open}>Change</button>
        </div>
      ) : <button type="button" className={styles.trigger} onClick={open}>{triggerLabel}</button>}

      <dialog className={styles.dialog} ref={dialogRef} onClose={() => { setIsOpen(false); setPendingSelection(selectedUser ?? null); }}>
        <div className={styles.dialogHeader}>
          <div><h2>{title}</h2><p>{description}</p></div>
          <button type="button" className={styles.iconButton} aria-label="Close selector" onClick={close}><X size={20}/></button>
        </div>
        <form className={styles.search} role="search" onSubmit={submitSearch}>
          <label htmlFor={searchId}>Search by name or email</label>
          <div><Search aria-hidden="true" size={18}/><input id={searchId} value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Name or email"/><button type="submit">Search</button></div>
        </form>

        <div className={styles.results} aria-busy={isPending}>
          {isPending ? <p className={styles.status} role="status">Loading eligible people…</p> : null}
          {isError ? <div className={styles.error} role="alert"><p>Eligible people could not be loaded.</p><button type="button" onClick={() => results.forEach(result => void result.refetch())}>Try again</button></div> : null}
          {!isPending && !isError && users.length === 0 ? <p className={styles.status}>No active users match this search.</p> : null}
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
