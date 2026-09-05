import {useTranslation} from 'react-i18next';
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
    "Reassign the user’s active students in Student intakes.",
  ACTIVE_COURSE_OWNERSHIP: "Transfer their courses in Course ownership.",
  ACTIVE_INSTRUCTOR_ENROLLMENTS:
    "Active instructor enrolments must be resolved by an authorized teaching operator.",
  ACTIVE_STUDENT_ENROLLMENTS:
    "Active student enrolments must be resolved by an authorized teaching operator.",
  ACTIVE_TA_ENROLLMENTS:
    "Active teaching-assistant enrolments must be resolved by an authorized teaching operator.",
  LAST_ACTIVE_TENANT_ADMIN:
    "Ensure another active Tenant Admin is available before disabling this account.",
  ACTIVE_PARENT_LINKS:
    "Unlink active Parent relationships from the relevant student record.",
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

const blockerMessage = (
  blocker: string | { code?: string; type?: string; message?: string },
): string | undefined => {
  if (typeof blocker === "string") return blockerGuidance[blocker];
  return typeof blocker.message === "string"
    ? blocker.message
    : blockerGuidance[blockerCode(blocker)];
};

export const DirectoryPanel = ({
  createRequested = false,
  onCreateHandled,
}: {
  createRequested?: boolean;
  onCreateHandled?: () => void;
}) => {
  const {t: translate} = useTranslation();
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
        "Account created. The user can set their first password through Forgot password.",
      );
    },
  });
  const patchAccount = useMutation({
    mutationFn: async () => {
      if (!reviewedAccount || reviewedAccountVersion == null)
        throw new Error(
          "Reload this account before saving changes.",
        );
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
        throw new Error("Change at least one profile field before saving.");
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
        "Account profile updated. If the email changed, the user must sign in again with the new email.",
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
        "Account disabled. Responsibilities are not automatically reassigned.",
      );
    },
  });
  const enable = useMutation({
    mutationFn: (id: number) => adminApiService.enableTenantManagedUser(id),
    onSuccess: async () =>
      refresh(
        "Login restored. Previous assignments, enrolments, Parent links, and course ownership were not restored.",
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
      await refresh("Identity updated. Existing sessions were signed out.");
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
      <section className={styles.surface} aria-label="User directory">
        <div className={`${styles.sectionHeading} ${styles.directoryHeading}`}>
          <h2 className={styles.srOnly}>User directory</h2>
          <span className={styles.hint}>People in your institution</span>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setCreateOpen(true)}
          >
            <UserPlus size={18} />
            Create account
          </button>
        </div>
        <form className={styles.filterBar} onSubmit={submitFilters}>
          <label className={styles.searchField}>
            <span>Search by name or email</span>
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
                placeholder="Name or email"
              />
            </div>
          </label>
          <ResponsiveFilters>
            <label>
              <span>Account</span>
              <select
                value={draftFilters.role}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    role: event.target.value as DirectoryFilters["role"],
                  }))
                }
              >
                <option value="">All</option>
                <option value="USER">Staff and users</option>
                <option value="TENANT_ADMIN">Tenant admins</option>
              </select>
            </label>
            <label>
              <span>Identity</span>
              <select
                value={draftFilters.level}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    level: event.target.value as DirectoryFilters["level"],
                  }))
                }
              >
                <option value="">All</option>
                <option value="STUDENT">Student</option>
                <option value="PARENT">Parent</option>
                {STAFF_LEVELS.map((level) => (
                  <option value={level} key={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                value={draftFilters.status}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    status: event.target.value as DirectoryFilters["status"],
                  }))
                }
              >
                <option value="">All</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
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
                  setDirectoryFeedback("Filters cleared.");
                }}
              >{translate("common:actions.clearFilters")}</button> : null}
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
                      setDirectoryFeedback("Directory refreshed.");
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
              Apply filters
            </button>
          </div>
        </form>

        <p className={styles.directoryStatus} role="status" aria-live="polite">
          {directory.isFetching
            ? "Updating directory…"
            : directory.isError
              ? ""
              : `${directory.data?.total ?? 0} users${directoryFeedback ? `. ${directoryFeedback}` : ""}`}
        </p>
        {directory.isPending ? (
          <p className={styles.status} role="status">
            Loading directory…
          </p>
        ) : null}
        {directory.isError ? (
          <div className={styles.errorNotice} role="alert">
            <p>
              {getApiErrorMessage(
                directory.error,
                "The directory could not be loaded.",
              )}
            </p>
            <button type="button" onClick={() => void directory.refetch()}>
              Try again
            </button>
          </div>
        ) : null}
        {!directory.isPending &&
        !directory.isError &&
        directory.data.items.length === 0 ? (
          <p className={styles.empty}>No users match these filters.</p>
        ) : null}
        <div className={styles.tableWrap} aria-busy={directory.isFetching}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Identity</th>
                <th>Status</th>
                <th>Actions</th>
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
                  <td data-label="Identity">
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
                  <td data-label="Status">
                    <span
                      className={styles.accountStatus}
                      data-active={account.status === "ACTIVE"}
                    >
                      {readableValue(account.status)}
                    </span>
                  </td>
                  <td data-label="Actions">
                    {account.level === "STUDENT" ? (
                      <a
                        className={styles.textButton}
                        href={TENANT_PATHS.student(account.id)}
                      >
                        View record
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={styles.textButton}
                        aria-label={`Manage ${formatPersonName(account)}`}
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
                        Manage
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {directory.data && directory.data.total > PAGE_SIZE ? (
          <nav className={styles.pagination} aria-label="Directory pages">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            <span>
              Page {page + 1} · {directory.data.total} users
            </span>
            <button
              type="button"
              disabled={(page + 1) * PAGE_SIZE >= directory.data.total}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </nav>
        ) : null}
      </section>

      {createOpen ? (
        <TenantDrawer
          title="Create account"
          description="Add a staff member or an additional Tenant Admin."
          busy={create.isPending}
          onClose={() => {
            setCreateOpen(false);
            onCreateHandled?.();
          }}
        >
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <label>
              <span>Account type</span>
              <select
                value={createForm.role}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    role: event.target.value as "USER" | "TENANT_ADMIN",
                  }))
                }
              >
                <option value="USER">Staff</option>
                <option value="TENANT_ADMIN">Tenant admin</option>
              </select>
            </label>
            {createForm.role === "USER" ? (
              <label>
                <span>Staff identity</span>
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
                      {level}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className={styles.nameGrid}>
              <label>
                <span>First name</span>
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
                <span>Middle name</span>
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
                <span>Last name</span>
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
              <span>Email</span>
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
              Students are created through Student intake. Parents are created
              or reused from a student’s Parent links.
            </p>
            <button
              className={styles.primaryButton}
              disabled={create.isPending}
            >
              {create.isPending ? "Creating…" : "Create account"}
            </button>
          </form>
          {create.isError ? (
            <p className={styles.inlineError} role="alert">
              {getApiErrorMessage(
                create.error,
                "The account could not be created.",
              )}
            </p>
          ) : null}
        </TenantDrawer>
      ) : null}

      {selectedId !== null ? (
        <TenantDrawer
          title="Account details"
          description="Identity and lifecycle governance."
          busy={
            patchAccount.isPending ||
            disable.isPending ||
            enable.isPending ||
            changeRole.isPending
          }
          onClose={() => setSelectedId(null)}
        >
          {detail.isPending ? (
            <p className={styles.status}>Loading account…</p>
          ) : null}
          {detail.isError ? (
            <div className={styles.errorNotice} role="alert">
              <p>
                {getApiErrorMessage(
                  detail.error,
                  "This account is unavailable.",
                )}
              </p>
              <button type="button" onClick={() => void detail.refetch()}>
                Try again
              </button>
            </div>
          ) : null}
          {selected ? (
            <>
              <dl className={styles.detailList}>
                <dt>Name</dt>
                <dd>{formatPersonName(selected, `User #${selected.id}`)}</dd>
                <dt>Email</dt>
                <dd>{selected.email}</dd>
                <dt>Identity</dt>
                <dd>
                  {selected.role} / {selected.level}
                </dd>
                <dt>Status</dt>
                <dd>{selected.status}</dd>
              </dl>
              {!isSelf &&
              (selected.role === "TENANT_ADMIN" ||
                (selected.role === "USER" &&
                  STAFF_LEVELS.some((level) => level === selected.level))) ? (
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault();
                    patchAccount.mutate();
                  }}
                >
                  <h3 className={styles.subheading}>Correct staff profile</h3>
                  <div className={styles.nameGrid}>
                    <label>
                      <span>First name</span>
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
                      <span>Middle name</span>
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
                      <span>Last name</span>
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
                    <span>Email</span>
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
                    <span>Phone</span>
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
                      Changing email invalidates this user’s current sessions
                      and tokens.
                    </p>
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
                      ? "Saving…"
                      : "Save profile changes"}
                  </button>
                  {selected.accountVersion == null ? (
                    <p className={styles.inlineError}>
                      The current response has no accountVersion. Update is
                      disabled to preserve CAS safety.
                    </p>
                  ) : null}
                  {patchConflict ? (
                    <div className={styles.confirmBox} role="alert">
                      <p>
                        Someone else changed this account. Your typed values are
                        preserved. Load the latest account before deciding what
                        to submit again.
                      </p>
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
                        Load latest account
                      </button>
                    </div>
                  ) : null}
                </form>
              ) : null}
              {isSelf ? (
                <p className={styles.hint}>
                  You cannot disable, enable, or change your own Tenant Admin
                  identity.
                </p>
              ) : (
                <div className={styles.governanceActions}>
                  {targets.length > 0 ? (
                    <form
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
                        <span>Convert identity</span>
                        <select
                          required
                          value={transitionLevel}
                          onChange={(event) =>
                            setTransitionLevel(event.target.value as StaffLevel)
                          }
                        >
                          <option value="">Choose allowed target</option>
                          {targets.map((level) => (
                            <option value={level} key={level}>
                              {level}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className={styles.secondaryButton}
                        disabled={!transitionLevel || changeRole.isPending}
                      >
                        {changeRole.isPending
                          ? "Updating…"
                          : "Confirm identity change"}
                      </button>
                    </form>
                  ) : (
                    <p className={styles.hint}>
                      This identity has no permitted conversion.
                    </p>
                  )}
                  {selected.status === "DISABLED" ? (
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={enable.isPending}
                      onClick={() => enable.mutate(selected.id)}
                    >
                      {enable.isPending ? "Restoring…" : "Restore login"}
                    </button>
                  ) : confirmDisable ? (
                    <div className={styles.confirmBox}>
                      <p>
                        This account has no outstanding responsibilities preventing login from being disabled.
                      </p>
                      <div>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          disabled={disable.isPending}
                          onClick={() => disable.mutate(selected.id)}
                        >
                          {disable.isPending ? "Disabling…" : "Confirm disable"}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => setConfirmDisable(false)}
                        >
                          Cancel
                        </button>
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
                        ? "Checking responsibilities…"
                        : "Check before disabling"}
                    </button>
                  )}
                </div>
              )}
            </>
          ) : null}
          {feedback ? (
            <p className={styles.inlineSuccess} role="status">
              {feedback}
            </p>
          ) : null}
          {operationError && !create.error ? (
            <p className={styles.inlineError} role="alert">
              {getApiErrorMessage(
                operationError,
                "The account operation could not be completed.",
              )}
            </p>
          ) : null}
          {blockers.length > 0 ? (
            <div className={styles.blockers} role="alert">
              <strong>Resolve these responsibilities, then check again:</strong>
              <ul>
                {blockers.map((blocker, index) => {
                  const code = blockerCode(blocker);
                  return (
                    <li key={`${code}-${index}`}>
                      <code>{code}</code>
                      <span>
                        {blockerMessage(blocker) ??
                          "Resolve this responsibility in its owning workflow."}
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
