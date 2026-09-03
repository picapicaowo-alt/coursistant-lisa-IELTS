import {TenantDrawer} from '@/components/TenantWorkspace/TenantDrawer';
import {readableValue} from '@/components/TenantWorkspace/presentation';
import {
  TENANT_PAGE_SIZE,
  TENANT_ADVISOR_LEVELS,
} from '@/configs/tenantNavigation';
import {FormEvent, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowRightLeft, RefreshCw, Search} from 'lucide-react';
import type {ManagedUser, TenantCourseOwnership} from '@/apis';
import {unwrapData} from '@/apis';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';
import {TenantUserPicker} from '@/components/TenantUserPicker';
import {getApiErrorMessage} from '@/utils/apiError';
import {formatPersonName} from '@/utils/personName';
import styles from '@/components/TenantWorkspace/workspace.module.scss';

const PAGE_SIZE = TENANT_PAGE_SIZE;
const ADVISOR_LEVELS = TENANT_ADVISOR_LEVELS;

const ownerName = (ownership: TenantCourseOwnership) =>
  formatPersonName(
    {
      firstName: ownership.ownerAdvisorFirstName,
      middleName: ownership.ownerAdvisorMiddleName,
      lastName: ownership.ownerAdvisorLastName,
    },
    ownership.ownerAdvisorUserId
      ? `Advisor #${ownership.ownerAdvisorUserId}`
      : 'No owner',
  );

export const OwnershipPanel = () => {
  const queryClient = useQueryClient();
  const [searchDraft, setSearchDraft] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [filterAdvisor, setFilterAdvisor] = useState<ManagedUser | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [advisor, setAdvisor] = useState<ManagedUser | null>(null);
  const [reason, setReason] = useState('');
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [success, setSuccess] = useState('');

  const ownerships = useQuery({
    queryKey: [
      'tenant',
      'course-ownerships',
      query,
      filterAdvisor?.id,
      page,
      PAGE_SIZE,
    ],
    queryFn: async () =>
      unwrapData(
        await courseOperationsApiService.listTenantCourseOwnerships({
          q: query || undefined,
          ownerAdvisorUserId: filterAdvisor?.id,
          page,
          size: PAGE_SIZE,
        }),
        'tenantCourseOwnerships',
      ),
    retry: false,
  });
  const selectedRow = ownerships.data?.items.find(
    (item) => item.courseId === selectedCourseId,
  );
  const ownerDetail = useQuery({
    queryKey: ['tenant', 'course-owner', selectedCourseId],
    queryFn: async () =>
      unwrapData(
        await courseOperationsApiService.getTenantCourseOwner(
          selectedCourseId as number,
        ),
        'tenantCourseOwner',
      ),
    enabled: selectedCourseId !== null,
    initialData: selectedRow,
    retry: false,
  });
  const transfer = useMutation({
    mutationFn: () => {
      if (!ownerDetail.data || !advisor)
        throw new Error('Select a course and an eligible advisor.');
      return courseOperationsApiService.transferTenantCourseOwner(
        ownerDetail.data.courseId,
        {
          ownerAdvisorUserId: advisor.id,
          expectedOwnershipVersion: ownerDetail.data.ownershipVersion,
          reason: reason.trim(),
        },
      );
    },
    onSuccess: async (response) => {
      const updated = unwrapData(response, 'tenantTransferCourseOwner');
      setSuccess(
        `Ownership transferred to ${formatPersonName(advisor, advisor?.email)}. Version ${updated.ownershipVersion} is now current.`,
      );
      setAdvisor(null);
      setReason('');
      setConfirmTransfer(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['tenant', 'course-ownerships'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['tenant', 'course-owner', selectedCourseId],
        }),
        queryClient.invalidateQueries({queryKey: ['tenant', 'audit-events']}),
      ]);
    },
  });
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(0);
    setQuery(searchDraft.trim());
  };

  return (
    <>
      <section className={styles.surface} aria-label="Course ownership">
        <form
          className={styles.filterBar}
          role="search"
          onSubmit={submitSearch}
        >
          <label className={styles.searchField}>
            <span>Search by course code or title</span>
            <div>
              <Search size={17} />
              <input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search courses…"
              />
            </div>
          </label>
          <button className={styles.primaryButton}>Search</button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Refresh ownerships"
            onClick={() => void ownerships.refetch()}
          >
            <RefreshCw size={18} />
          </button>
        </form>
        <div className={styles.filterBar}>
          <TenantUserPicker
            variant="filter"
            title="Filter by course owner"
            description="Choose an active owner in this tenant."
            triggerLabel="All owners"
            levels={[...ADVISOR_LEVELS]}
            selectedUser={filterAdvisor}
            onSelect={(person) => {
              setFilterAdvisor(person);
              setPage(0);
            }}
          />
          {filterAdvisor ? (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => {
                setFilterAdvisor(null);
                setPage(0);
              }}
            >
              Clear owner filter
            </button>
          ) : null}
        </div>
        {ownerships.isPending ? (
          <p className={styles.status}>Loading ownerships…</p>
        ) : null}
        {ownerships.isError ? (
          <div className={styles.errorNotice} role="alert">
            <p>
              {getApiErrorMessage(
                ownerships.error,
                'Course ownerships could not be loaded.',
              )}
            </p>
            <button type="button" onClick={() => void ownerships.refetch()}>
              Try again
            </button>
          </div>
        ) : null}
        {!ownerships.isPending &&
        !ownerships.isError &&
        ownerships.data.items.length === 0 ? (
          <p className={styles.empty}>
            No course ownerships match this search.
          </p>
        ) : null}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Course name</th>
                <th>Owner</th>
                <th>Course status</th>
                <th>Ownership</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ownerships.data?.items.map((item) => (
                <tr key={item.courseId}>
                  <td>
                    <strong>{item.title}</strong>
                    <small>{item.courseCode}</small>
                  </td>
                  <td data-label="Owner">{ownerName(item)}</td>
                  <td data-label="Status">
                    {readableValue(item.launchState)}
                    <small>{readableValue(item.lifecycleState)}</small>
                  </td>
                  <td data-label="Ownership">
                    Version {item.ownershipVersion}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.textButton}
                      aria-label={`Transfer owner of ${item.title}`}
                      onClick={() => {
                        setSelectedCourseId(item.courseId);
                        setAdvisor(null);
                        setReason('');
                        setConfirmTransfer(false);
                        setSuccess('');
                        transfer.reset();
                      }}
                    >
                      <ArrowRightLeft size={16} />
                      Transfer owner
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ownerships.data && ownerships.data.total > PAGE_SIZE ? (
          <nav className={styles.pagination} aria-label="Ownership pages">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            <span>
              Page {page + 1} · {ownerships.data.total} courses
            </span>
            <button
              type="button"
              disabled={(page + 1) * PAGE_SIZE >= ownerships.data.total}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </nav>
        ) : null}
      </section>

      {selectedCourseId !== null ? (
        <TenantDrawer
          title="Transfer owner"
          description="Use only for a governance handover."
          busy={transfer.isPending}
          onClose={() => setSelectedCourseId(null)}
        >
          {!selectedCourseId ? (
            <p className={styles.empty}>
              Select a course to prepare a transfer.
            </p>
          ) : ownerDetail.isPending ? (
            <p className={styles.status}>Loading current owner…</p>
          ) : ownerDetail.isError ? (
            <div className={styles.errorNotice} role="alert">
              <p>
                {getApiErrorMessage(
                  ownerDetail.error,
                  'The current owner could not be loaded.',
                )}
              </p>
              <button type="button" onClick={() => void ownerDetail.refetch()}>
                Try again
              </button>
            </div>
          ) : ownerDetail.data ? (
            <>
              <dl className={styles.detailList}>
                <dt>Course</dt>
                <dd>
                  {ownerDetail.data.courseCode} · {ownerDetail.data.title}
                </dd>
                <dt>Current owner</dt>
                <dd>{ownerName(ownerDetail.data)}</dd>
                <dt>Ownership version</dt>
                <dd>{ownerDetail.data.ownershipVersion}</dd>
              </dl>
              <form
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  setConfirmTransfer(true);
                }}
              >
                <div className={styles.pickerField}>
                  <span>New owner</span>
                  <TenantUserPicker
                    title="Choose a new course owner"
                    description="Searches active Advisor and Instructor Advisor identities in this tenant."
                    triggerLabel="Choose eligible advisor"
                    levels={[...ADVISOR_LEVELS]}
                    selectedUser={advisor}
                    onSelect={setAdvisor}
                  />
                </div>
                <label>
                  <span>Reason</span>
                  <textarea
                    required
                    minLength={1}
                    maxLength={1000}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain the governance handover"
                  />
                </label>
                {!confirmTransfer ? (
                  <button
                    className={styles.primaryButton}
                    disabled={!advisor || !reason.trim()}
                  >
                    Review transfer
                  </button>
                ) : null}
              </form>
              {confirmTransfer ? (
                <div className={styles.confirmBox}>
                  <p>
                    Transfer <strong>{ownerDetail.data.courseCode}</strong> from{' '}
                    {ownerName(ownerDetail.data)} to{' '}
                    {formatPersonName(advisor, advisor?.email)}?
                  </p>
                  <div>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={transfer.isPending}
                      onClick={() => transfer.mutate()}
                    >
                      {transfer.isPending
                        ? 'Transferring…'
                        : 'Confirm transfer'}
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setConfirmTransfer(false)}
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : null}
              {transfer.isError ? (
                <p className={styles.inlineError} role="alert">
                  {getApiErrorMessage(
                    transfer.error,
                    'Ownership could not be transferred. Reload the current version and confirm eligibility.',
                  )}
                </p>
              ) : null}
              {success ? (
                <p className={styles.inlineSuccess} role="status">
                  {success}
                </p>
              ) : null}
            </>
          ) : null}
        </TenantDrawer>
      ) : null}
    </>
  );
};
