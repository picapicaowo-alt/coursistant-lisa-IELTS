import React, {FormEvent, useEffect, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, Plus, RefreshCw, Search} from 'lucide-react';
import {TenantDrawer} from '@/components/TenantWorkspace/TenantDrawer';
import {PersonCell} from '@/components/TenantWorkspace/PersonCell';
import {useTenantPeople} from '@/components/TenantWorkspace/useTenantPeople';
import {readableValue} from '@/components/TenantWorkspace/presentation';
import {TENANT_PAGE_SIZE, TENANT_PATHS} from '@/configs/tenantNavigation';
import ui from '@/components/TenantWorkspace/workspace.module.scss';
import {
  IntakeAssignmentStatus,
  IntakeLifecycleStatus,
  type PatchStudentIntakeRequest,
  type StudentIntakeResponse,
  type TenantIntakeListParams,
  unwrapData,
} from '@/apis';
import {StudentIntakeFormFields} from '@/components/StudentIntakeFormFields';
import {IntakeAssignmentEditor} from '@/components/TenantWorkspace/IntakeAssignmentEditor';
import {
  emptyStudentIntakeForm,
  type StudentIntakeFormValue,
} from '@/components/StudentIntakeFormFields/model';
import {tenantAdvisingApiService} from '@/apis/services/tenant-advising-api';
import {
  idempotencyFingerprint,
  useIdempotencyCheckpoint,
} from '@/hooks/useIdempotencyCheckpoint';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {advisingQueryKeys} from '../advising/queryKeys';
import styles from '../advising/advising.module.scss';
import {formatPersonName} from '@/utils/personName';
import {getApiErrorCode} from '@/utils/apiError';
import {CreateIntakeDialog} from './CreateIntakeDialog';

const PAGE_SIZE = TENANT_PAGE_SIZE;

type FilterDraft = {
  q: string;
  lifecycleStatus: IntakeLifecycleStatus | '';
  assignmentStatus: IntakeAssignmentStatus | '';
  searchBy: 'q' | 'intakeId' | 'studentUserId';
};

const emptyFilters: FilterDraft = {
  q: '',
  lifecycleStatus: '',
  assignmentStatus: '',
  searchBy: 'q',
};

const formFromIntake = (
  intake: StudentIntakeResponse,
): StudentIntakeFormValue => ({
  firstName: intake.firstName ?? '',
  middleName: intake.middleName ?? '',
  lastName: intake.lastName ?? '',
  email: intake.email ?? '',
  studentType: intake.studentType ?? 'STANDARD',
  courseRequest: intake.courseRequest ?? '',
  contactPhone: intake.contactPhone ?? '',
  basicBackground: intake.basicBackground ?? '',
});

const TenantIntakesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Number(searchParams.get('page') ?? 0);
  const [page, updatePage] = useState(Number.isInteger(pageParam) && pageParam >= 0 ? pageParam : 0);
  const initialFilters: FilterDraft = {
    q: searchParams.get('q') ?? '',
    lifecycleStatus: searchParams.get('lifecycleStatus') === 'OPEN' ? 'OPEN' : searchParams.get('lifecycleStatus') === 'CANCELLED' ? 'CANCELLED' : '',
    assignmentStatus: searchParams.get('assignmentStatus') === 'ASSIGNED' ? 'ASSIGNED' : searchParams.get('assignmentStatus') === 'UNASSIGNED' ? 'UNASSIGNED' : '',
    searchBy: searchParams.get('searchBy') === 'intakeId' ? 'intakeId' : searchParams.get('searchBy') === 'studentUserId' ? 'studentUserId' : 'q',
  };
  const [draftFilters, setDraftFilters] = useState<FilterDraft>(initialFilters);
  const [filters, setFilters] = useState<FilterDraft>(initialFilters);
  const [createOpen, setCreateOpen] = useState(
    searchParams.get('action') === 'create',
  );
  const managedId = Number(searchParams.get('manage'));
  const [selectedIntakeId, setSelectedIntakeId] = useState<number | null>(Number.isInteger(managedId) && managedId > 0 ? managedId : null);
  const [assignmentPending, setAssignmentPending] = useState(false);
  const [createForm, setCreateForm] = useState(emptyStudentIntakeForm);
  const [editForm, setEditForm] = useState<StudentIntakeFormValue>(
    emptyStudentIntakeForm,
  );

  const params: TenantIntakeListParams = {
    page,
    size: PAGE_SIZE,
    ...(filters.q
      ? {
          [filters.searchBy]:
            filters.searchBy === 'q' ? filters.q : Number(filters.q),
        }
      : {}),
    ...(filters.lifecycleStatus
      ? {lifecycleStatus: filters.lifecycleStatus}
      : {}),
    ...(filters.assignmentStatus
      ? {assignmentStatus: filters.assignmentStatus}
      : {}),
  };
  const intakes = useQuery({
    queryKey: advisingQueryKeys.tenantIntakes(params),
    queryFn: async () =>
      unwrapData(
        await tenantAdvisingApiService.listStudentIntakes(params),
        'tenantIntakes',
      ),
    retry: false,
  });
  const detail = useQuery({
    queryKey: ['tenant', 'intake', selectedIntakeId],
    queryFn: async () =>
      unwrapData(
        await tenantAdvisingApiService.getStudentIntake(
          selectedIntakeId as number,
        ),
        'tenantIntakeDetail',
      ),
    enabled: selectedIntakeId !== null,
    retry: false,
  });
  const selected = detail.data;
  const people = useTenantPeople(
    (intakes.data?.items ?? []).map((intake) => intake.advisorUserId),
  );
  const closeCreate = () => {
    setCreateOpen(false);
    setSearchParams(current => {current.delete('action'); return current;}, {replace: true});
  };
  const syncListLocation = (nextFilters: FilterDraft, nextPage: number) => {
    const params = new URLSearchParams();
    if (nextPage) params.set('page', String(nextPage));
    if (nextFilters.q) params.set('q', nextFilters.q);
    if (nextFilters.searchBy !== 'q') params.set('searchBy', nextFilters.searchBy);
    if (nextFilters.lifecycleStatus) params.set('lifecycleStatus', nextFilters.lifecycleStatus);
    if (nextFilters.assignmentStatus) params.set('assignmentStatus', nextFilters.assignmentStatus);
    setSearchParams(params, {replace: true});
  };
  const setPage = (next: number | ((current: number) => number)) => {
    const nextPage = typeof next === 'function' ? next(page) : next;
    updatePage(nextPage);
    syncListLocation(filters, nextPage);
  };

  useEffect(() => {
    if (selected) setEditForm(formFromIntake(selected));
  }, [selected]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({queryKey: ['tenant', 'intakes']}),
      ...(selectedIntakeId
        ? [
            queryClient.invalidateQueries({
              queryKey: ['tenant', 'intake', selectedIntakeId],
            }),
          ]
        : []),
      queryClient.invalidateQueries({queryKey: ['advisor', 'students']}),
      queryClient.invalidateQueries({queryKey: ['counsellor']}),
      queryClient.invalidateQueries({queryKey: ['tenant', 'audit-events']}),
    ]);
  };

  const patchIntake = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select an intake.');
      const payload: PatchStudentIntakeRequest = {
        expectedIntakeVersion: selected.intakeVersion,
      };
      const fields = {
        firstName: editForm.firstName.trim(),
        middleName: editForm.middleName.trim(),
        lastName: editForm.lastName.trim(),
        studentType: editForm.studentType,
        courseRequest: editForm.courseRequest.trim(),
        contactPhone: editForm.contactPhone.trim(),
        basicBackground: editForm.basicBackground.trim(),
      };
      if (fields.firstName !== (selected.firstName ?? ''))
        payload.firstName = fields.firstName;
      if (fields.middleName !== (selected.middleName ?? ''))
        payload.middleName = fields.middleName;
      if (fields.lastName !== (selected.lastName ?? ''))
        payload.lastName = fields.lastName;
      if (fields.studentType !== selected.studentType)
        payload.studentType = fields.studentType;
      if (fields.courseRequest !== (selected.courseRequest ?? ''))
        payload.courseRequest = fields.courseRequest;
      if (fields.contactPhone !== (selected.contactPhone ?? ''))
        payload.contactPhone = fields.contactPhone;
      if (fields.basicBackground !== (selected.basicBackground ?? ''))
        payload.basicBackground = fields.basicBackground;
      if (Object.keys(payload).length === 1)
        throw new Error('Change at least one intake field before saving.');
      const key = idempotency.keyFor(
        `tenant-patch-intake-${selected.intakeId}`,
        idempotencyFingerprint(payload),
      );
      return unwrapData(
        await tenantAdvisingApiService.patchStudentIntake(
          selected.intakeId,
          payload,
          key,
        ),
        'tenantPatchStudentIntake',
      );
    },
    onSuccess: refresh,
  });
  const createIntake = useMutation({
    mutationFn: async () => {
      const payload = {
        firstName: createForm.firstName.trim(),
        ...(createForm.middleName.trim()
          ? {middleName: createForm.middleName.trim()}
          : {}),
        lastName: createForm.lastName.trim(),
        email: createForm.email.trim().toLowerCase(),
        studentType: createForm.studentType,
        courseRequest: createForm.courseRequest.trim(),
        ...(createForm.contactPhone.trim()
          ? {contactPhone: createForm.contactPhone.trim()}
          : {}),
        ...(createForm.basicBackground.trim()
          ? {basicBackground: createForm.basicBackground.trim()}
          : {}),
      };
      const key = idempotency.keyFor(
        'tenant-create-intake',
        idempotencyFingerprint(payload),
      );
      return unwrapData(
        await tenantAdvisingApiService.createStudentIntake(payload, key),
        'tenantCreateIntake',
      );
    },
    onSuccess: async (created) => {
      setCreateForm(emptyStudentIntakeForm);
      closeCreate();
      manage(created.intakeId);
      await refresh();
    },
  });

  const busy =
    assignmentPending ||
    patchIntake.isPending ||
    createIntake.isPending;
  const mutationError =
    patchIntake.error;
  const intakeConflict =
    getApiErrorCode(patchIntake.error) ===
    'STUDENT_INTAKE_VERSION_CONFLICT';
  const hasIntakeChanges = Boolean(
    selected &&
    (editForm.firstName.trim() !== (selected.firstName ?? '') ||
      editForm.middleName.trim() !== (selected.middleName ?? '') ||
      editForm.lastName.trim() !== (selected.lastName ?? '') ||
      editForm.studentType !== selected.studentType ||
      editForm.courseRequest.trim() !== (selected.courseRequest ?? '') ||
      editForm.contactPhone.trim() !== (selected.contactPhone ?? '') ||
      editForm.basicBackground.trim() !== (selected.basicBackground ?? '')),
  );
  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    updatePage(0);
    setFilters({...draftFilters, q: draftFilters.q.trim()});
    syncListLocation({...draftFilters, q: draftFilters.q.trim()}, 0);
  };
  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    updatePage(0);
    syncListLocation(emptyFilters, 0);
  };
  const manage = (intakeId: number) => {
    clearOperationErrors();
    setSelectedIntakeId(intakeId);
  };
  const clearOperationErrors = () => {
    patchIntake.reset();
  };

  return (
    <div className={ui.page}>
      <header className={ui.pageHeader}>
        <div>
          <h1>Student intakes</h1>
          <p>
            Search, correct, assign, reassign, or cancel intake records within
            the governance boundary.
          </p>
        </div>
        <div className={ui.headerActions}>
          <Link className={ui.secondaryButton} to={TENANT_PATHS.governance}>
            <ArrowLeft size={18} />
            Back to governance
          </Link>
          <button
            type="button"
            className={ui.primaryButton}
            onClick={() => setCreateOpen(true)}
            aria-haspopup="dialog"
          >
            <Plus size={17} /> Create student intake
          </button>
        </div>
      </header>
      {createOpen ? (
        <CreateIntakeDialog
          value={createForm}
          onChange={setCreateForm}
          onClose={closeCreate}
          pending={createIntake.isPending}
          error={
            createIntake.isError
              ? advisingErrorMessage(
                  createIntake.error,
                  'The intake could not be created. Your entries are preserved.',
                )
              : undefined
          }
          onSubmit={(event) => {
            event.preventDefault();
            createIntake.mutate();
          }}
        />
      ) : null}

      <section className={ui.surface} aria-label="Student intake records">
        <form className={ui.filterBar} onSubmit={applyFilters}>
          <label className={ui.searchField}>
            <span>
              {draftFilters.searchBy === 'q'
                ? 'Search by name or email'
                : draftFilters.searchBy === 'intakeId'
                  ? 'Intake ID'
                  : 'Student ID'}
            </span>
            <div>
              <Search size={17} />
              <input
                type={draftFilters.searchBy === 'q' ? 'text' : 'number'}
                min={draftFilters.searchBy === 'q' ? undefined : 1}
                value={draftFilters.q}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    q: event.target.value,
                  }))
                }
                placeholder="Search intakes"
              />
            </div>
          </label>
          <label>
            <span>Search field</span>
            <select
              value={draftFilters.searchBy}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  q: '',
                  searchBy: event.target.value as FilterDraft['searchBy'],
                }))
              }
            >
              <option value="q">Name or email</option>
              <option value="intakeId">Intake ID</option>
              <option value="studentUserId">Student ID</option>
            </select>
          </label>
          <label>
            <span>Lifecycle</span>
            <select
              value={draftFilters.lifecycleStatus}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  lifecycleStatus: event.target
                    .value as FilterDraft['lifecycleStatus'],
                }))
              }
            >
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          <label>
            <span>Assignment</span>
            <select
              value={draftFilters.assignmentStatus}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  assignmentStatus: event.target
                    .value as FilterDraft['assignmentStatus'],
                }))
              }
            >
              <option value="">All</option>
              <option value="UNASSIGNED">Unassigned</option>
              <option value="ASSIGNED">Assigned</option>
            </select>
          </label>
          <button className={ui.primaryButton}>Apply filters</button>
          <button
            type="button"
            className={ui.secondaryButton}
            onClick={clearFilters}
          >
            Clear filters
          </button>
          <button
            type="button"
            className={ui.iconButton}
            aria-label="Refresh intakes"
            disabled={intakes.isFetching}
            onClick={() => void intakes.refetch()}
          >
            <RefreshCw size={17} />
          </button>
        </form>

        {intakes.isPending ? (
          <p className={styles.status}>Loading intakes…</p>
        ) : null}
        {intakes.isError ? (
          <p className={styles.error} role="alert">
            {advisingErrorMessage(
              intakes.error,
              'Intakes could not be loaded.',
            )}
          </p>
        ) : null}
        {!intakes.isPending &&
        !intakes.isError &&
        intakes.data?.items.length === 0 ? (
          <p className={styles.status}>No intakes match these filters.</p>
        ) : null}
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Intake ID</th>
                <th>Lifecycle status</th>
                <th>Assignment</th>
                <th>Advisor</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(intakes.data?.items ?? []).map((intake) => (
                <tr key={intake.intakeId}>
                  <td>
                    <PersonCell
                      person={{...intake, id: intake.studentUserId}}
                    />
                  </td>
                  <td data-label="Intake ID">#{intake.intakeId}</td>
                  <td data-label="Lifecycle">
                    <span
                      className={ui.badge}
                      data-tone={intake.lifecycleStatus}
                    >
                      {readableValue(intake.lifecycleStatus)}
                    </span>
                  </td>
                  <td data-label="Assignment">
                    <span
                      className={ui.badge}
                      data-tone={intake.assignmentStatus}
                    >
                      {readableValue(intake.assignmentStatus)}
                    </span>
                  </td>
                  <td data-label="Advisor">
                    {intake.advisorUserId ? (
                      <PersonCell
                        person={
                          people.get(intake.advisorUserId) ?? {
                            id: intake.advisorUserId,
                          }
                        }
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className={ui.actions}>
                      {intake.studentUserId ? (
                        <Link
                          className={ui.textButton}
                          to={TENANT_PATHS.student(intake.studentUserId)}
                          state={{returnTo: `${TENANT_PATHS.intakes}${searchParams.size ? `?${searchParams}` : ''}`}}
                        >
                          View record
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className={ui.textButton}
                        onClick={() => manage(intake.intakeId)}
                      >
                        Manage
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {intakes.data && intakes.data.total > PAGE_SIZE ? (
          <nav className={styles.pagination} aria-label="Intake pages">
            <button
              type="button"
              className={styles.secondary}
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            <span>
              Page {page + 1} · {intakes.data.total} intakes
            </span>
            <button
              type="button"
              className={styles.secondary}
              disabled={(page + 1) * PAGE_SIZE >= intakes.data.total}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </nav>
        ) : null}
      </section>
      {selectedIntakeId !== null ? (
        <TenantDrawer
          title="Intake management"
          description={
            selected
              ? formatPersonName(selected, `Intake #${selectedIntakeId}`)
              : `Intake #${selectedIntakeId}`
          }
          busy={busy}
          onClose={() => {setSelectedIntakeId(null); setSearchParams(current => {current.delete('manage'); return current;}, {replace: true});}}
        >
          {mutationError && !intakeConflict ? (
            <p className={styles.error} role="alert">
              {advisingErrorMessage(
                mutationError,
                'The operation failed. Your entries are preserved.',
              )}
            </p>
          ) : null}
          {detail.isPending ? (
            <p className={styles.status}>Loading intake details…</p>
          ) : null}
          {detail.isError ? (
            <p className={styles.error} role="alert">
              {advisingErrorMessage(
                detail.error,
                'Intake details could not be loaded.',
              )}
            </p>
          ) : null}
          {intakeConflict ? (
            <div className={styles.dashboardNotice} role="alert">
              <strong>This intake changed on the server.</strong>
              <p>
                Your current form values are preserved. Load the latest intake
                only when you are ready to review the newer version.
              </p>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => void detail.refetch()}
              >
                Load latest intake
              </button>
            </div>
          ) : null}
          {selected ? (
            <div className={ui.form}>
              <section>
                <h3>Intake profile</h3>
                {selected.lifecycleStatus === 'OPEN' &&
                selected.assignmentStatus === 'UNASSIGNED' ? (
                  <form
                    className={styles.form}
                    onSubmit={(event) => {
                      event.preventDefault();
                      clearOperationErrors();
                      patchIntake.mutate();
                    }}
                  >
                    <StudentIntakeFormFields
                      value={editForm}
                      onChange={setEditForm}
                      emailDisabled
                    />
                    <p className={styles.muted}>
                      Student email cannot be changed from an intake.
                    </p>
                    <button
                      className={styles.primary}
                      disabled={busy || !hasIntakeChanges}
                    >
                      {patchIntake.isPending
                        ? 'Saving…'
                        : 'Save intake changes'}
                    </button>
                  </form>
                ) : (
                  <dl className={styles.readonly}>
                    <dt>Status</dt>
                    <dd>
                      {selected.lifecycleStatus} / {selected.assignmentStatus}
                    </dd>
                    <dt>Course request</dt>
                    <dd>{selected.courseRequest || '—'}</dd>
                    <dt>Contact phone</dt>
                    <dd>{selected.contactPhone || '—'}</dd>
                    <dt>Background</dt>
                    <dd>{selected.basicBackground || '—'}</dd>
                  </dl>
                )}
              </section>
              <section>
                <h3>{selected.assignmentStatus === 'ASSIGNED' ? 'Reassign advisor' : 'Assign advisor'}</h3>
                <IntakeAssignmentEditor key={selected.intakeId} intake={selected} onUpdated={refresh} onPendingChange={setAssignmentPending}/>
              </section>
            </div>
          ) : null}
        </TenantDrawer>
      ) : null}
    </div>
  );
};

export default TenantIntakesPage;
