import {FormEvent, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowRightLeft, RefreshCw, Search} from 'lucide-react';
import type {ManagedUser, TenantCourseOwnership} from '@/apis';
import {unwrapData} from '@/apis';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {TenantUserPicker} from '@/components/TenantUserPicker';
import {getApiErrorMessage} from '@/utils/apiError';
import {formatPersonName} from '@/utils/personName';
import styles from './index.module.scss';

const PAGE_SIZE = 20;
const ADVISOR_LEVELS = ['ADVISOR', 'INSTRUCTOR_ADVISOR'] as const;

const ownerName = (ownership: TenantCourseOwnership) => formatPersonName({
  firstName: ownership.ownerAdvisorFirstName,
  middleName: ownership.ownerAdvisorMiddleName,
  lastName: ownership.ownerAdvisorLastName,
}, ownership.ownerAdvisorUserId ? `Advisor #${ownership.ownerAdvisorUserId}` : 'No owner');

export const OwnershipPanel = () => {
  const queryClient = useQueryClient();
  const [searchDraft, setSearchDraft] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [advisor, setAdvisor] = useState<ManagedUser | null>(null);
  const [reason, setReason] = useState('');
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [success, setSuccess] = useState('');

  const ownerships = useQuery({
    queryKey: ['tenant', 'course-ownerships', query, page, PAGE_SIZE],
    queryFn: async () => unwrapData(await courseOperationsApiService.listTenantCourseOwnerships({q: query || undefined, page, size: PAGE_SIZE}), 'tenantCourseOwnerships'),
    retry: false,
  });
  const selectedRow = ownerships.data?.items.find(item => item.courseId === selectedCourseId);
  const ownerDetail = useQuery({
    queryKey: ['tenant', 'course-owner', selectedCourseId],
    queryFn: async () => unwrapData(await courseOperationsApiService.getTenantCourseOwner(selectedCourseId as number), 'tenantCourseOwner'),
    enabled: selectedCourseId !== null,
    initialData: selectedRow,
    retry: false,
  });
  const transfer = useMutation({
    mutationFn: () => {
      if (!ownerDetail.data || !advisor) throw new Error('Select a course and an eligible advisor.');
      return courseOperationsApiService.transferTenantCourseOwner(ownerDetail.data.courseId, {
        ownerAdvisorUserId: advisor.id,
        expectedOwnershipVersion: ownerDetail.data.ownershipVersion,
        reason: reason.trim(),
      });
    },
    onSuccess: async response => {
      const updated = unwrapData(response, 'tenantTransferCourseOwner');
      setSuccess(`Ownership transferred to ${formatPersonName(advisor, advisor?.email)}. Version ${updated.ownershipVersion} is now current.`);
      setAdvisor(null);
      setReason('');
      setConfirmTransfer(false);
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['tenant', 'course-ownerships']}),
        queryClient.invalidateQueries({queryKey: ['tenant', 'course-owner', selectedCourseId]}),
      ]);
    },
  });
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(0);
    setQuery(searchDraft.trim());
  };

  return (
    <div className={styles.directoryLayout}>
      <section className={styles.primaryPanel} aria-labelledby="ownership-title">
        <div className={styles.panelHeading}><div><h2 id="ownership-title">Course ownership</h2><p>Govern course owners without opening the teaching Course catalogue.</p></div><button type="button" className={styles.iconButton} aria-label="Refresh ownerships" onClick={() => void ownerships.refetch()}><RefreshCw size={18}/></button></div>
        <form className={styles.singleSearch} role="search" onSubmit={submitSearch}><label><span>Search by course code or title</span><div><Search size={17}/><input value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Course code or title"/></div></label><button className={styles.primaryButton}>Search</button></form>
        {ownerships.isPending ? <p className={styles.status}>Loading ownerships…</p> : null}
        {ownerships.isError ? <div className={styles.errorNotice} role="alert"><p>{getApiErrorMessage(ownerships.error, 'Course ownerships could not be loaded.')}</p><button type="button" onClick={() => void ownerships.refetch()}>Try again</button></div> : null}
        {!ownerships.isPending && !ownerships.isError && ownerships.data.items.length === 0 ? <p className={styles.empty}>No course ownerships match this search.</p> : null}
        <div className={styles.recordList}>
          {ownerships.data?.items.map(item => <button type="button" className={selectedCourseId === item.courseId ? styles.selectedRecord : styles.record} key={item.courseId} onClick={() => { setSelectedCourseId(item.courseId); setAdvisor(null); setReason(''); setConfirmTransfer(false); setSuccess(''); }}><span><strong>{item.courseCode} · {item.title}</strong><small>{item.launchState ?? 'Launch state unavailable'} · {item.lifecycleState ?? 'Lifecycle unavailable'}</small></span><span className={styles.recordMeta}><em>{ownerName(item)}</em><small>Version {item.ownershipVersion}</small></span><ArrowRightLeft size={18}/></button>)}
        </div>
        {ownerships.data && ownerships.data.total > PAGE_SIZE ? <nav className={styles.pagination} aria-label="Ownership pages"><button type="button" disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</button><span>Page {page + 1} · {ownerships.data.total} courses</span><button type="button" disabled={(page + 1) * PAGE_SIZE >= ownerships.data.total} onClick={() => setPage(current => current + 1)}>Next</button></nav> : null}
      </section>

      <aside className={styles.sideColumn}>
        <section className={styles.secondaryPanel} aria-labelledby="transfer-title">
          <div className={styles.panelHeading}><div><h2 id="transfer-title">Transfer owner</h2><p>Use only for a governance handover.</p></div></div>
          {!selectedCourseId ? <p className={styles.empty}>Select a course to prepare a transfer.</p> : ownerDetail.isPending ? <p className={styles.status}>Loading current owner…</p> : ownerDetail.isError ? <div className={styles.errorNotice} role="alert"><p>{getApiErrorMessage(ownerDetail.error, 'The current owner could not be loaded.')}</p><button type="button" onClick={() => void ownerDetail.refetch()}>Try again</button></div> : ownerDetail.data ? <>
            <dl className={styles.detailList}><dt>Course</dt><dd>{ownerDetail.data.courseCode} · {ownerDetail.data.title}</dd><dt>Current owner</dt><dd>{ownerName(ownerDetail.data)}</dd><dt>Ownership version</dt><dd>{ownerDetail.data.ownershipVersion}</dd></dl>
            <form className={styles.form} onSubmit={event => { event.preventDefault(); setConfirmTransfer(true); }}>
              <div className={styles.pickerField}><span>New owner</span><TenantUserPicker title="Choose a new course owner" description="Searches active Advisor and Instructor Advisor identities in this tenant." triggerLabel="Choose eligible advisor" levels={[...ADVISOR_LEVELS]} selectedUser={advisor} onSelect={setAdvisor}/></div>
              <label><span>Reason</span><textarea required minLength={1} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain the governance handover"/></label>
              {!confirmTransfer ? <button className={styles.primaryButton} disabled={!advisor || !reason.trim()}>Review transfer</button> : null}
            </form>
            {confirmTransfer ? <div className={styles.confirmBox}><p>Transfer <strong>{ownerDetail.data.courseCode}</strong> from {ownerName(ownerDetail.data)} to {formatPersonName(advisor, advisor?.email)}?</p><div><button type="button" className={styles.primaryButton} disabled={transfer.isPending} onClick={() => transfer.mutate()}>{transfer.isPending ? 'Transferring…' : 'Confirm transfer'}</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmTransfer(false)}>Back</button></div></div> : null}
            {transfer.isError ? <p className={styles.inlineError} role="alert">{getApiErrorMessage(transfer.error, 'Ownership could not be transferred. Reload the current version and confirm eligibility.')}</p> : null}
            {success ? <p className={styles.inlineSuccess} role="status">{success}</p> : null}
          </> : null}
        </section>
      </aside>
    </div>
  );
};
