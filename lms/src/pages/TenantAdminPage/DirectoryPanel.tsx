import {LocalizedError} from '@/i18n/errors';
import { useTranslation } from 'react-i18next';
import {roleLabel} from '@/i18n/presentation';
import {formatNumber} from '@/i18n/formatting';
import { TenantDrawer } from "@/components/TenantWorkspace/TenantDrawer";
import { PersonCell } from "@/components/TenantWorkspace/PersonCell";
import { readableValue } from "@/components/TenantWorkspace/presentation";
import { TENANT_PAGE_SIZE, TENANT_PATHS } from "@/configs/tenantNavigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ResponsiveFilters } from "@/components/TenantWorkspace/ResponsiveFilters";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search, UserPlus } from "lucide-react";
import type {
  CreateManagedUserRequest,
  ManagedUser,
  PatchTenantManagedUserRequest,
  UserLevel,
} from "@/apis";
import { unwrapData } from "@/apis";
import { adminApiService } from "@/apis/services/admin-api";
import { useRequiredAuth } from "@/contexts/RequiredAuthContext";
import {
  getApiErrorCode,
  getApiErrorMessage,
  isRecord,
} from "@/utils/apiError";
import { formatPersonName } from "@/utils/personName";
import {
  idempotencyFingerprint,
  useIdempotencyCheckpoint,
} from "@/hooks/useIdempotencyCheckpoint";
import styles from "@/components/TenantWorkspace/workspace.module.scss";

const PAGE_SIZE = TENANT_PAGE_SIZE;
const STAFF_LEVELS = [
  "COUNSELLOR",
  "ADVISOR",
  "INSTRUCTOR",
  "INSTRUCTOR_ADVISOR",
] as const;

type StaffLevel = (typeof STAFF_LEVELS)[number];
type DirectoryFilters = {
  q: string;
  role: "" | "USER" | "TENANT_ADMIN";
  level: "" | UserLevel;
  status: "" | "ACTIVE" | "DISABLED";
};

const emptyFilters: DirectoryFilters = {
  q: "",
  role: "",
  level: "",
  status: "",
};

const transitionTargets = (account: ManagedUser): StaffLevel[] => {
  if (account.role !== "USER") return [];
  if (account.level === "INSTRUCTOR" || account.level === "ADVISOR")
    return ["INSTRUCTOR_ADVISOR"];
  if (account.level === "INSTRUCTOR_ADVISOR") return ["INSTRUCTOR", "ADVISOR"];
  return [];
};

const blockerGuidance: Record<string, string> = {
  ACTIVE_STUDENT_ASSIGNMENTS:
    "operations:directory.blockers.ACTIVE_STUDENT_ASSIGNMENTS",
  ACTIVE_COURSE_OWNERSHIP: "operations:directory.blockers.ACTIVE_COURSE_OWNERSHIP",
  ACTIVE_INSTRUCTOR_ENROLLMENTS:
    "operations:directory.blockers.ACTIVE_INSTRUCTOR_ENROLLMENTS",
  ACTIVE_STUDENT_ENROLLMENTS:
    "operations:directory.blockers.ACTIVE_STUDENT_ENROLLMENTS",
  ACTIVE_TA_ENROLLMENTS:
    "operations:directory.blockers.ACTIVE_TA_ENROLLMENTS",
  LAST_ACTIVE_TENANT_ADMIN:
    "operations:directory.blockers.LAST_ACTIVE_TENANT_ADMIN",
  ACTIVE_PARENT_LINKS:
    "operations:directory.blockers.ACTIVE_PARENT_LINKS",
};

const getBlockers = (error: unknown): string[] => {
  if (
    !isRecord(error) ||
    !isRecord(error.details) ||
    !isRecord(error.details.data)
  )
    return [];
  const blockers = error.details.data.blockers;
  return Array.isArray(blockers)
    ? blockers.filter((value): value is string => typeof value === "string")
    : [];
};

const blockerCode = (
  blocker: string | { code?: string; type?: string },
): string => {
  if (typeof blocker === "string") return blocker;
  return typeof blocker.code === "string"
    ? blocker.code
    : typeof blocker.type === "string"
      ? blocker.type
      : "RESPONSIBILITY_BLOCKER";
};

// Use the contract code, not an unlocalized server diagnostic, for guidance.
const blockerMessageKey = (blocker: string | {code?: string; type?: string}): string =>
  blockerGuidance[blockerCode(blocker)] ?? 'operations:directory.blockers.unknown';

function profileValidation(form: HTMLFormElement, values: {firstName: string; lastName: string; email: string}): string | null {
  if (!values.firstName.trim()) return 'operations:directory.validation.firstName';
  if (!values.lastName.trim()) return 'operations:directory.validation.lastName';
  const email = form.querySelector<HTMLInputElement>('input[type="email"]');
  if (!values.email.trim() || email?.validity.typeMismatch) return 'auth:signupErrors.emailInvalid';
  return null;
}

export const DirectoryPanel = ({
  createRequested = false,
  onCreateHandled,
}: {
  createRequested?: boolean;
  onCreateHandled?: () => void;
}) => {
  const { t: translate } = useTranslation();
  const { user: currentUser } = useRequiredAuth();
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const [draftFilters, setDraftFilters] =
    useState<DirectoryFilters>(emptyFilters);
  const [filters, setFilters] = useState<DirectoryFilters>(emptyFilters);
  const [page, setPage] = useState(0);
  const [directoryFeedback, setDirectoryFeedback] = useState("");
  const [createOpen, setCreateOpen] = useState(createRequested);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({
    email: "",
    firstName: "",
    middleName: "",
    lastName: "",
    role: "USER" as "USER" | "TENANT_ADMIN",
    level: "COUNSELLOR" as StaffLevel,
  });
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [transitionLevel, setTransitionLevel] = useState<StaffLevel | "">("");
  const [feedback, setFeedback] = useState<string>("");
  const [createValidation, setCreateValidation] = useState<string | null>(null);
  const [editValidation, setEditValidation] = useState<string | null>(null);
  const initializedAccount = useRef<number | null>(null);
  const [reviewedAccountVersion, setReviewedAccountVersion] =
    useState<number>();
  const [reviewedAccount, setReviewedAccount] =
    useState<
      Awaited<ReturnType<typeof adminApiService.getTenantUser>>["data"]
    >();
  const [conflictReviewed, setConflictReviewed] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  useEffect(() => {setEditValidation(null);}, [selectedId]);
  useEffect(() => {setCreateValidation(null);}, [createOpen]);

  const directory = useQuery({
    queryKey: ["tenant", "users", filters, page, PAGE_SIZE],
    queryFn: async () =>
      unwrapData(
        await adminApiService.listTenantUsers({
          q: filters.q || undefined,
          role: filters.role || undefined,
          level: filters.level || undefined,
          status: filters.status || undefined,
          page,
          size: PAGE_SIZE,
        }),
        "tenantUserDirectory",
      ),
    retry: false,
  });
  const detail = useQuery({
    queryKey: ["tenant", "user", selectedId],
    queryFn: async () =>
      unwrapData(
        await adminApiService.getTenantUser(selectedId as number),
        "tenantUserDetail",
      ),
    enabled: selectedId !== null,
    retry: false,
  });

  useEffect(() => {
    if (!detail.data || initializedAccount.current === detail.data.id) return;
    initializedAccount.current = detail.data.id;
    setReviewedAccount(detail.data);
    setReviewedAccountVersion(detail.data.accountVersion);
    setEditForm({
      firstName: detail.data.firstName ?? "",
      middleName: detail.data.middleName ?? "",
      lastName: detail.data.lastName ?? "",
      email: detail.data.email,
      phone: detail.data.phone ?? "",
    });
  }, [detail.data]);

  const refresh = async (message?: string) => {
    if (message) setFeedback(message);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tenant", "users"] }),
      queryClient.invalidateQueries({ queryKey: ["tenant", "audit-events"] }),
      ...(selectedId
        ? [
            queryClient.invalidateQueries({
              queryKey: ["tenant", "user", selectedId],
            }),
          ]
        : []),
    ]);
  };
  const create = useMutation({
    mutationFn: () => {
      const request: CreateManagedUserRequest = {
        email: createForm.email.trim().toLowerCase(),
        firstName: createForm.firstName.trim(),
        ...(createForm.middleName.trim()
          ? { middleName: createForm.middleName.trim() }
          : {}),
        lastName: createForm.lastName.trim(),
        role: createForm.role,
        level:
          createForm.role === "TENANT_ADMIN"
            ? "NOT_APPLICABLE"
            : createForm.level,
      };
      return idempotency.run("tenant-create-account", request, (key, payload) =>
        adminApiService.createTenantManagedUser(payload, key),
      );
    },
    onSuccess: async (response) => {
      const id = unwrapData(response, "tenantManagedUserCreate");
      setCreateForm({
        email: "",
        firstName: "",
        middleName: "",
        lastName: "",
        role: "USER",
        level: "COUNSELLOR",
      });
      setCreateOpen(false);
      onCreateHandled?.();
      setSelectedId(id);
      await refresh(
        "operations:directory.created",
      );
    },
  });
  const patchAccount = useMutation({
    mutationFn: async () => {
      if (!reviewedAccount || reviewedAccountVersion == null)
        throw new LocalizedError("operations:directory.reloadRequired");
      const payload: PatchTenantManagedUserRequest = {
        expectedAccountVersion: reviewedAccountVersion,
      };
      const nextFirstName = editForm.firstName.trim();
      const nextMiddleName = editForm.middleName.trim();
      const nextLastName = editForm.lastName.trim();
      const nextEmail = editForm.email.trim().toLowerCase();
      const nextPhone = editForm.phone.trim();
      if (nextFirstName !== (reviewedAccount.firstName ?? ""))
        payload.firstName = nextFirstName;
      if (nextMiddleName !== (reviewedAccount.middleName ?? ""))
        payload.middleName = nextMiddleName;
      if (nextLastName !== (reviewedAccount.lastName ?? ""))
        payload.lastName = nextLastName;
      if (nextEmail !== reviewedAccount.email.toLowerCase())
        payload.email = nextEmail;
      if (nextPhone !== (reviewedAccount.phone ?? ""))
        payload.phone = nextPhone;
      if (Object.keys(payload).length === 1)
        throw new LocalizedError("operations:directory.changeRequired");
      const key = idempotency.keyFor(
        `tenant-patch-account-${reviewedAccount.id}`,
        idempotencyFingerprint(payload),
      );
      return unwrapData(
        await adminApiService.patchTenantManagedUser(
          reviewedAccount.id,
          payload,
          key,
        ),
        "tenantPatchManagedUser",
      );
    },
    onSuccess: async () => {
      initializedAccount.current = null;
      setConflictReviewed(false);
      await refresh(
        "operations:directory.saved",
      );
    },
  });
  const disablePreview = useMutation({
    mutationFn: async (id: number) =>
      unwrapData(
        await adminApiService.getTenantManagedUserDisableBlockers(id),
        "tenantGetManagedUserDisableBlockers",
      ),
    onSuccess: (preview) =>
      setConfirmDisable(
        preview.canDisable && preview.targetUserId === selectedId,
      ),
  });
  const disable = useMutation({
    mutationFn: (id: number) =>
      idempotency.run("tenant-disable-account", id, (key, target) =>
        adminApiService.disableTenantManagedUser(target, key),
      ),
    onSuccess: async () => {
      setConfirmDisable(false);
      await refresh(
        "operations:directory.disabledReceipt",
      );
    },
  });
  const enable = useMutation({
    mutationFn: (id: number) => adminApiService.enableTenantManagedUser(id),
    onSuccess: async () =>
      refresh(
        "operations:directory.restored",
      ),
  });
  const changeRole = useMutation({
    mutationFn: ({ id, level }: { id: number; level: StaffLevel }) =>
      idempotency.run("tenant-change-role", { id, level }, (key, target) =>
        adminApiService.changeTenantManagedUserRole(
          target.id,
          { role: "USER", level: target.level },
          key,
        ),
      ),
    onSuccess: async () => {
      setTransitionLevel("");
      await refresh("operations:directory.identityChanged");
    },
  });

  const hasFilters = [draftFilters, filters].some(current => Object.values(current).some(Boolean));
  const submitFilters = (event: FormEvent) => {
    event.preventDefault();
    const next = { ...draftFilters, q: draftFilters.q.trim() };
    setDirectoryFeedback("");
    if (
      page === 0 &&
      Object.keys(next).every(
        (key) =>
          next[key as keyof DirectoryFilters] ===
          filters[key as keyof DirectoryFilters],
      )
    )
      void directory.refetch();
    else {
      setPage(0);
      setFilters(next);
    }
  };
  const selected = detail.data;
  const isSelf = selected?.id === currentUser.id;
  const targets = selected ? transitionTargets(selected) : [];
  const operationError =
    create.error ||
    patchAccount.error ||
    disablePreview.error ||
    disable.error ||
    enable.error ||
    changeRole.error;
  const previewBlockers = disablePreview.data?.blockers ?? [];
  const blockers =
    previewBlockers.length > 0 ? previewBlockers : getBlockers(disable.error);
  const patchConflict =
    getApiErrorCode(patchAccount.error) === "ACCOUNT_VERSION_CONFLICT" &&
    !conflictReviewed;
  const hasProfileChanges = Boolean(
    selected &&
    (editForm.firstName.trim() !== (selected.firstName ?? "") ||
      (editForm.middleName.trim() || null) !== (selected.middleName ?? null) ||
      editForm.lastName.trim() !== (selected.lastName ?? "") ||
      editForm.email.trim().toLowerCase() !== selected.email.toLowerCase() ||
      (editForm.phone.trim() || null) !== (selected.phone ?? null)),
  );

  return (
    <>
      <section className={styles.surface} aria-label={translate("operations:directory.title")}>
        <div className={`${styles.sectionHeading} ${styles.directoryHeading}`}>
          <h2 className={styles.srOnly}>{translate("operations:directory.title")}</h2>
          <span className={styles.hint}>{translate("operations:directory.description")}</span>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setCreateOpen(true)}
          >
            <UserPlus size={18} />
            {translate("operations:directory.create")}</button>
        </div>
        <form className={styles.filterBar} onSubmit={submitFilters}>
          <label className={styles.searchField}>
            <span>{translate("common:people.searchLabel")}</span>
            <div>
              <Search size={17} />
              <input
                value={draftFilters.q}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    q: event.target.value,
                  }))
                }
                placeholder={translate("common:people.nameOrEmail")}
              />
            </div>
          </label>
          <ResponsiveFilters>
            <label>
              <span>{translate("auth:signup.steps.account")}</span>
              <select
                value={draftFilters.role}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    role: event.target.value as DirectoryFilters["role"],
                  }))
                }
              >
                <option value="">{translate("course:detail.filterAll")}</option>
                <option value="USER">{translate("operations:directory.staffAndUsers")}</option>
                <option value="TENANT_ADMIN">{translate("operations:directory.admins")}</option>
              </select>
            </label>
            <label>
              <span>{translate("common:admin.identity")}</span>
              <select
                value={draftFilters.level}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    level: event.target.value as DirectoryFilters["level"],
                  }))
                }
              >
                <option value="">{translate("course:detail.filterAll")}</option>
                <option value="STUDENT">{translate("common:roles.STUDENT")}</option>
                <option value="PARENT">{translate("common:roles.PARENT")}</option>
                {STAFF_LEVELS.map((level) => (
                  <option value={level} key={level}>
                    {roleLabel(level)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{translate("common:fields.status")}</span>
              <select
                value={draftFilters.status}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    status: event.target.value as DirectoryFilters["status"],
                  }))
                }
              >
                <option value="">{translate("course:detail.filterAll")}</option>
                <option value="ACTIVE">{translate("common:status.ACTIVE")}</option>
                <option value="DISABLED">{translate("common:admin.status.DISABLED")}</option>
              </select>
            </label>
            <div
              className={`${styles.filterActions} ${styles.directorySecondaryActions}`}
            >
              {hasFilters ? <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setDraftFilters(emptyFilters);
                  setFilters(emptyFilters);
                  setPage(0);
                  setDirectoryFeedback("operations:directory.filtersCleared");
                }}
              >
                {translate("common:actions.clearFilters")}</button> : null}
              <button
                type="button"
                className={styles.iconButton}
                aria-label={translate('common:refreshControls.directory')}
            title={translate('common:refreshControls.directory')}
                disabled={directory.isFetching}
                onClick={() => {
                  setDirectoryFeedback("");
                  void directory.refetch().then((result) => {
                    if (!result.isError)
                      setDirectoryFeedback("operations:directory.refreshed");
                  });
                }}
              >
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            </div>
          </ResponsiveFilters>
          <div
            className={`${styles.filterActions} ${styles.directoryFilterActions}`}
          >
            <button
              className={styles.primaryButton}
              disabled={directory.isFetching}
            >
              {translate("operations:directory.applyFilters")}</button>
          </div>
        </form>

        <p className={styles.directoryStatus} role="status" aria-live="polite">
          {directory.isFetching
            ? translate("operations:directory.updating")
            : directory.isError
              ? ""
              : <>{translate('operations:directory.count', {count: directory.data?.total ?? 0, number: formatNumber(directory.data?.total ?? 0)})}{directoryFeedback ? <> · {translate(directoryFeedback)}</> : null}</>}
        </p>
        {directory.isPending ? (
          <p className={styles.status} role="status">
            {translate("operations:directory.loading")}</p>
        ) : null}
        {directory.isError ? (
          <div className={styles.errorNotice} role="alert">
            <p>
              {getApiErrorMessage(
                directory.error,
                translate("operations:directory.failed"),
              )}
            </p>
            <button type="button" onClick={() => void directory.refetch()}>
              {translate("common:actions.tryAgain")}</button>
          </div>
        ) : null}
        {!directory.isPending &&
        !directory.isError &&
        directory.data.items.length === 0 ? (
          <p className={styles.empty}>{translate("common:admin.noUsers")}</p>
        ) : null}
        <div className={styles.tableWrap} aria-busy={directory.isFetching}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{translate("common:fields.name")}</th>
                <th>{translate("common:admin.identity")}</th>
                <th>{translate("common:fields.status")}</th>
                <th>{translate("common:fields.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {directory.data?.items.map((account) => (
                <tr key={account.id}>
                  <td>
                    <button
                      type="button"
                      className={styles.personButton}
                      onClick={() => {
                        initializedAccount.current = null;
                        setSelectedId(account.id);
                        setConflictReviewed(false);
                        patchAccount.reset();
                        setConfirmDisable(false);
                        disablePreview.reset();
                        setTransitionLevel("");
                        setFeedback("");
                      }}
                    >
                      <PersonCell person={account} />
                    </button>
                  </td>
                  <td data-label={translate("common:admin.identity")}>
                    <span
                      className={styles.badge}
                      data-tone={
                        account.role === "TENANT_ADMIN"
                          ? account.role
                          : account.level
                      }
                    >
                      {readableValue(
                        account.role === "TENANT_ADMIN"
                          ? account.role
                          : account.level,
                      )}
                    </span>
                  </td>
                  <td data-label={translate("common:fields.status")}>
                    <span
                      className={styles.accountStatus}
                      data-active={account.status === "ACTIVE"}
                    >
                      {readableValue(account.status)}
                    </span>
                  </td>
                  <td data-label={translate("common:fields.actions")}>
                    {account.level === "STUDENT" ? (
                      <a
                        className={styles.textButton}
                        href={TENANT_PATHS.student(account.id)}
                      >
                        {translate("operations:directory.viewRecord")}</a>
                    ) : (
                      <button
                        type="button"
                        className={styles.textButton}
                        aria-label={translate('common:admin.managePerson', {name: formatPersonName(account)})}
                        onClick={() => {
                          initializedAccount.current = null;
                          setSelectedId(account.id);
                          setConflictReviewed(false);
                          patchAccount.reset();
                          setConfirmDisable(false);
                          disablePreview.reset();
                          setTransitionLevel("");
                          setFeedback("");
                        }}
                      >
                        {translate("common:admin.manage")}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {directory.data && directory.data.total > PAGE_SIZE ? (
          <nav className={styles.pagination} aria-label={translate("common:admin.directoryPages")}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              {translate("common:actions.previous")}</button>
            <span>
              {translate('operations:directory.pageSummary', {count: directory.data.total, page: formatNumber(page + 1), number: formatNumber(directory.data.total)})}
            </span>
            <button
              type="button"
              disabled={(page + 1) * PAGE_SIZE >= directory.data.total}
              onClick={() => setPage((current) => current + 1)}
            >
              {translate("common:actions.next")}</button>
          </nav>
        ) : null}
      </section>

      {createOpen ? (
        <TenantDrawer
          title={translate("operations:directory.create")}
          description={translate("operations:directory.createHelp")}
          busy={create.isPending}
          onClose={() => {
            setCreateOpen(false);
            onCreateHandled?.();
          }}
        >
          <form
            className={styles.form}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const errorKey = profileValidation(event.currentTarget, createForm);
              setCreateValidation(errorKey);
              if (errorKey) return;
              create.mutate();
            }}
          >
            <label>
              <span>{translate("operations:directory.accountType")}</span>
              <select
                value={createForm.role}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    role: event.target.value as "USER" | "TENANT_ADMIN",
                  }))
                }
              >
                <option value="USER">{translate("operations:directory.staff")}</option>
                <option value="TENANT_ADMIN">{translate("common:admin.tenantAdmin")}</option>
              </select>
            </label>
            {createForm.role === "USER" ? (
              <label>
                <span>{translate("operations:directory.staffIdentity")}</span>
                <select
                  value={createForm.level}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      level: event.target.value as StaffLevel,
                    }))
                  }
                >
                  {STAFF_LEVELS.map((level) => (
                    <option value={level} key={level}>
                      {roleLabel(level)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className={styles.nameGrid}>
              <label>
                <span>{translate("common:fields.firstName")}</span>
                <input
                  required
                  maxLength={100}
                  value={createForm.firstName}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>{translate("auth:signup.middleNameLabel")}</span>
                <input
                  maxLength={100}
                  value={createForm.middleName}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      middleName: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>{translate("common:fields.lastName")}</span>
                <input
                  required
                  maxLength={100}
                  value={createForm.lastName}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label>
              <span>{translate("common:fields.email")}</span>
              <input
                required
                type="email"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </label>
            <p className={styles.hint}>
              {translate("operations:directory.studentParentHelp")}</p>
            <button
              className={styles.primaryButton}
              disabled={create.isPending}
            >
              {create.isPending ? translate("common:actions.creating") : translate("operations:directory.create")}
            </button>
          </form>
          {createValidation || create.isError ? (
            <p className={styles.inlineError} role="alert">
              {createValidation ? translate(createValidation) : getApiErrorMessage(
                create.error,
                translate("operations:directory.createFailed"),
              )}
            </p>
          ) : null}
        </TenantDrawer>
      ) : null}

      {selectedId !== null ? (
        <TenantDrawer
          title={translate("common:admin.accountDetails")}
          description={translate("operations:directory.detailsHelp")}
          busy={
            patchAccount.isPending ||
            disable.isPending ||
            enable.isPending ||
            changeRole.isPending
          }
          onClose={() => setSelectedId(null)}
        >
          {detail.isPending ? (
            <p className={styles.status}>{translate("operations:directory.loadingAccount")}</p>
          ) : null}
          {detail.isError ? (
            <div className={styles.errorNotice} role="alert">
              <p>
                {getApiErrorMessage(
                  detail.error,
                  translate("operations:directory.accountUnavailable"),
                )}
              </p>
              <button type="button" onClick={() => void detail.refetch()}>
                {translate("common:actions.tryAgain")}</button>
            </div>
          ) : null}
          {selected ? (
            <>
              <dl className={styles.detailList}>
                <dt>{translate("common:fields.name")}</dt>
                <dd>{formatPersonName(selected, translate('common:admin.userNumber', {id: formatNumber(selected.id)}))}</dd>
                <dt>{translate("common:fields.email")}</dt>
                <dd>{selected.email}</dd>
                <dt>{translate("common:admin.identity")}</dt>
                <dd>
                  {roleLabel(selected.role)} / {roleLabel(selected.level)}
                </dd>
                <dt>{translate("common:fields.status")}</dt>
                <dd>{readableValue(selected.status)}</dd>
              </dl>
              {!isSelf &&
              (selected.role === "TENANT_ADMIN" ||
                (selected.role === "USER" &&
                  STAFF_LEVELS.some((level) => level === selected.level))) ? (
                <form
                  className={styles.form}
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    const errorKey = profileValidation(event.currentTarget, editForm);
                    setEditValidation(errorKey);
                    if (errorKey) return;
                    patchAccount.mutate();
                  }}
                >
                  <h3 className={styles.subheading}>{translate("operations:directory.correctProfile")}</h3>
                  {editValidation ? <p className={styles.inlineError} role="alert">{translate(editValidation)}</p> : null}
                  <div className={styles.nameGrid}>
                    <label>
                      <span>{translate("common:fields.firstName")}</span>
                      <input
                        required
                        maxLength={100}
                        value={editForm.firstName}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            firstName: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>{translate("auth:signup.middleNameLabel")}</span>
                      <input
                        maxLength={100}
                        value={editForm.middleName}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            middleName: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>{translate("common:fields.lastName")}</span>
                      <input
                        required
                        maxLength={100}
                        value={editForm.lastName}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            lastName: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label>
                    <span>{translate("common:fields.email")}</span>
                    <input
                      required
                      type="email"
                      value={editForm.email}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>{translate("settings:phone")}</span>
                    <input
                      value={editForm.phone}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </label>
                  {editForm.email.trim().toLowerCase() !==
                  selected.email.toLowerCase() ? (
                    <p className={styles.hint}>
                      {translate("operations:directory.emailChangeHelp")}</p>
                  ) : null}
                  <button
                    className={styles.secondaryButton}
                    disabled={
                      patchConflict ||
                      patchAccount.isPending ||
                      selected.accountVersion == null ||
                      !hasProfileChanges
                    }
                  >
                    {patchAccount.isPending
                      ? translate("common:actions.saving")
                      : translate("operations:directory.saveProfile")}
                  </button>
                  {selected.accountVersion == null ? (
                    <p className={styles.inlineError}>
                      {translate("operations:directory.versionMissing")}</p>
                  ) : null}
                  {patchConflict ? (
                    <div className={styles.confirmBox} role="alert">
                      <p>
                        {translate("operations:directory.versionConflict")}</p>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() =>
                          void detail.refetch().then((result) => {
                            if (result.data && !result.isError) {
                              setReviewedAccountVersion(
                                result.data.accountVersion,
                              );
                              setConflictReviewed(true);
                            }
                          })
                        }
                      >
                        {translate("operations:directory.loadLatest")}</button>
                    </div>
                  ) : null}
                </form>
              ) : null}
              {isSelf ? (
                <p className={styles.hint}>
                  {translate("operations:directory.selfRestriction")}</p>
              ) : (
                <div className={styles.governanceActions}>
                  {targets.length > 0 ? (
                    <form
                      noValidate
                      className={styles.form}
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (transitionLevel)
                          changeRole.mutate({
                            id: selected.id,
                            level: transitionLevel,
                          });
                      }}
                    >
                      <label>
                        <span>{translate("operations:directory.convertIdentity")}</span>
                        <select
                          required
                          value={transitionLevel}
                          onChange={(event) =>
                            setTransitionLevel(event.target.value as StaffLevel)
                          }
                        >
                          <option value="">{translate("operations:directory.chooseTarget")}</option>
                          {targets.map((level) => (
                            <option value={level} key={level}>
                              {roleLabel(level)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className={styles.secondaryButton}
                        disabled={!transitionLevel || changeRole.isPending}
                      >
                        {changeRole.isPending
                          ? translate("settings:updating")
                          : translate("operations:directory.confirmIdentity")}
                      </button>
                    </form>
                  ) : (
                    <p className={styles.hint}>
                      {translate("operations:directory.noConversion")}</p>
                  )}
                  {selected.status === "DISABLED" ? (
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={enable.isPending}
                      onClick={() => enable.mutate(selected.id)}
                    >
                      {enable.isPending ? translate("course:catalogue.restoring") : translate("operations:directory.restoreLogin")}
                    </button>
                  ) : confirmDisable ? (
                    <div className={styles.confirmBox}>
                      <p>
                        {translate("operations:directory.disableClear")}</p>
                      <div>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          disabled={disable.isPending}
                          onClick={() => disable.mutate(selected.id)}
                        >
                          {disable.isPending ? translate("operations:directory.disabling") : translate("operations:directory.confirmDisable")}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => setConfirmDisable(false)}
                        >
                          {translate("common:actions.cancel")}</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.dangerLink}
                      disabled={disablePreview.isPending}
                      onClick={() => disablePreview.mutate(selected.id)}
                    >
                      {disablePreview.isPending
                        ? translate("operations:directory.checkingResponsibilities")
                        : translate("operations:directory.checkDisable")}
                    </button>
                  )}
                </div>
              )}
            </>
          ) : null}
          {feedback ? (
            <p className={styles.inlineSuccess} role="status">
              {translate(feedback)}
            </p>
          ) : null}
          {operationError && !create.error ? (
            <p className={styles.inlineError} role="alert">
              {getApiErrorMessage(
                operationError,
                translate("operations:directory.operationFailed"),
              )}
            </p>
          ) : null}
          {blockers.length > 0 ? (
            <div className={styles.blockers} role="alert">
              <strong>{translate("operations:directory.resolveResponsibilities")}</strong>
              <ul>
                {blockers.map((blocker, index) => {
                  const code = blockerCode(blocker);
                  return (
                    <li key={`${code}-${index}`}>
                      <code>{code}</code>
                      <span>
                        {translate(blockerMessageKey(blocker))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </TenantDrawer>
      ) : null}
    </>
  );
};
