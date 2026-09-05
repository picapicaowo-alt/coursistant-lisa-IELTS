import {LocalizedError} from '@/i18n/errors';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import {formatNumber} from '@/i18n/formatting';
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
      ? i18n.t('common:records.advisor', {id: formatNumber(ownership.ownerAdvisorUserId)})
      : i18n.t('operations:ownership.noOwner'),
  );

export const OwnershipPanel = () => {
  const { t: translate } = useTranslation();
  const queryClient = useQueryClient();
  const [searchDraft, setSearchDraft] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [filterAdvisor, setFilterAdvisor] = useState<ManagedUser | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [advisor, setAdvisor] = useState<ManagedUser | null>(null);
  const [reason, setReason] = useState('');
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [success, setSuccess] = useState<{name: string; version: number} | null>(null);

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
        throw new LocalizedError("operations:ownership.selectRequired");
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
      setSuccess({name: formatPersonName(advisor, advisor?.email), version: updated.ownershipVersion});
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
      <section className={styles.surface} aria-label={translate("operations:governance.ownership")}>
        <form
          className={styles.filterBar}
          role="search"
          onSubmit={submitSearch}
        >
          <label className={styles.searchField}>
            <span>{translate("operations:ownership.searchLabel")}</span>
            <div>
              <Search size={17} />
              <input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={translate("operations:ownership.searchPlaceholder")}
              />
            </div>
          </label>
          <button className={styles.primaryButton}>{translate("common:actions.search")}</button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={translate('common:refreshControls.ownerships')}
            title={translate('common:refreshControls.ownerships')}
            onClick={() => void ownerships.refetch()}
          >
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </form>
        <div className={styles.filterBar}>
          <TenantUserPicker
            variant="filter"
            title={translate("operations:ownership.filterOwner")}
            description={translate("operations:ownership.filterHelp")}
            triggerLabel={translate("operations:ownership.allOwners")}
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
              {translate("operations:ownership.clearOwner")}</button>
          ) : null}
        </div>
        {ownerships.isPending ? (
          <p className={styles.status}>{translate("operations:ownership.loading")}</p>
        ) : null}
        {ownerships.isError ? (
          <div className={styles.errorNotice} role="alert">
            <p>
              {getApiErrorMessage(
                ownerships.error,
                translate('operations:ownership.failed'),
              )}
            </p>
            <button type="button" onClick={() => void ownerships.refetch()}>
              {translate("common:actions.tryAgain")}</button>
          </div>
        ) : null}
        {!ownerships.isPending &&
        !ownerships.isError &&
        ownerships.data.items.length === 0 ? (
          <p className={styles.empty}>
            {translate("operations:ownership.empty")}</p>
        ) : null}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{translate("operations:ownership.courseName")}</th>
                <th>{translate("operations:ownership.owner")}</th>
                <th>{translate("course:learning.status")}</th>
                <th>{translate("operations:ownership.ownership")}</th>
                <th>{translate("common:fields.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {ownerships.data?.items.map((item) => (
                <tr key={item.courseId}>
                  <td>
                    <strong>{item.title}</strong>
                    <small>{item.courseCode}</small>
                  </td>
                  <td data-label={translate("operations:ownership.owner")}>{ownerName(item)}</td>
                  <td data-label={translate("common:fields.status")}>
                    {readableValue(item.launchState)}
                    <small>{readableValue(item.lifecycleState)}</small>
                  </td>
                  <td data-label={translate("operations:ownership.ownership")}>
                    {translate('assessment:submission.version', {number: formatNumber(item.ownershipVersion)})}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.textButton}
                      aria-label={translate('operations:ownership.transferCourse', {course: item.title})}
                      onClick={() => {
                        setSelectedCourseId(item.courseId);
                        setAdvisor(null);
                        setReason('');
                        setConfirmTransfer(false);
                        setSuccess(null);
                        transfer.reset();
                      }}
                    >
                      <ArrowRightLeft size={16} />
                      {translate("operations:ownership.transfer")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ownerships.data && ownerships.data.total > PAGE_SIZE ? (
          <nav className={styles.pagination} aria-label={translate("operations:ownership.pages")}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              {translate("common:actions.previous")}</button>
            <span>
              {translate('operations:ownership.pageSummary', {count: ownerships.data.total, page: formatNumber(page + 1), number: formatNumber(ownerships.data.total)})}
            </span>
            <button
              type="button"
              disabled={(page + 1) * PAGE_SIZE >= ownerships.data.total}
              onClick={() => setPage((current) => current + 1)}
            >
              {translate("common:actions.next")}</button>
          </nav>
        ) : null}
      </section>

      {selectedCourseId !== null ? (
        <TenantDrawer
          title={translate("operations:ownership.transfer")}
          description={translate("operations:ownership.transferHelp")}
          busy={transfer.isPending}
          onClose={() => setSelectedCourseId(null)}
        >
          {!selectedCourseId ? (
            <p className={styles.empty}>
              {translate("operations:ownership.selectCourse")}</p>
          ) : ownerDetail.isPending ? (
            <p className={styles.status}>{translate("operations:ownership.loadingOwner")}</p>
          ) : ownerDetail.isError ? (
            <div className={styles.errorNotice} role="alert">
              <p>
                {getApiErrorMessage(
                  ownerDetail.error,
                  translate('operations:ownership.ownerFailed'),
                )}
              </p>
              <button type="button" onClick={() => void ownerDetail.refetch()}>
                {translate("common:actions.tryAgain")}</button>
            </div>
          ) : ownerDetail.data ? (
            <>
              <dl className={styles.detailList}>
                <dt>{translate("common:fields.course")}</dt>
                <dd>
                  {ownerDetail.data.courseCode} · {ownerDetail.data.title}
                </dd>
                <dt>{translate("operations:ownership.currentOwner")}</dt>
                <dd>{ownerName(ownerDetail.data)}</dd>
                <dt>{translate("operations:ownership.version")}</dt>
                <dd>{formatNumber(ownerDetail.data.ownershipVersion)}</dd>
              </dl>
              <form
                noValidate
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (advisor && reason.trim() && reason.length <= 1000) setConfirmTransfer(true);
                }}
              >
                <div className={styles.pickerField}>
                  <span>{translate("operations:ownership.newOwner")}</span>
                  <TenantUserPicker
                    title={translate("operations:ownership.chooseOwner")}
                    description={translate("advising:intake.advisorSearchHelp")}
                    triggerLabel={translate("operations:ownership.chooseAdvisor")}
                    levels={[...ADVISOR_LEVELS]}
                    selectedUser={advisor}
                    onSelect={setAdvisor}
                  />
                </div>
                <label>
                  <span>{translate("common:fields.reason")}</span>
                  <textarea
                    required
                    minLength={1}
                    maxLength={1000}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={translate("operations:ownership.reasonPlaceholder")}
                  />
                </label>
                {!confirmTransfer ? (
                  <button
                    className={styles.primaryButton}
                    disabled={!advisor || !reason.trim()}
                  >
                    {translate("operations:ownership.reviewTransfer")}</button>
                ) : null}
              </form>
              {confirmTransfer ? (
                <div className={styles.confirmBox}>
                  <p>
                    {translate('operations:ownership.confirmQuestion', {course: ownerDetail.data.courseCode, from: ownerName(ownerDetail.data), to: formatPersonName(advisor, advisor?.email)})}
                  </p>
                  <div>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={transfer.isPending}
                      onClick={() => transfer.mutate()}
                    >
                      {transfer.isPending
                        ? translate("operations:ownership.transferring")
                        : translate("operations:ownership.confirmTransfer")}
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setConfirmTransfer(false)}
                    >
                      {translate("common:actions.back")}</button>
                  </div>
                </div>
              ) : null}
              {transfer.isError ? (
                <p className={styles.inlineError} role="alert">
                  {getApiErrorMessage(
                    transfer.error,
                    translate('operations:ownership.transferFailed'),
                  )}
                </p>
              ) : null}
              {success ? (
                <p className={styles.inlineSuccess} role="status">
                  {translate('operations:ownership.transferred', {name: success.name, version: formatNumber(success.version)})}
                </p>
              ) : null}
            </>
          ) : null}
        </TenantDrawer>
      ) : null}
    </>
  );
};
