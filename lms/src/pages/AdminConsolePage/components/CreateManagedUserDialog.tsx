import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrapData, type CreateManagedUserRequest } from "@/apis";
import { adminApiService } from "@/apis/services/admin-api";
import { TeachingDialog } from "@/components/TeachingWorkspace";
import { getManagedUserCreateError } from "../adminFeedback";
import { LevelSelect } from "./ManagedUserFields";
import {
  SYSTEM_MANAGED_LEVEL_OPTIONS,
  type ManagedLevel,
} from "../managedUserOptions";
import styles from "../index.module.scss";

export function CreateManagedUserDialog({ onClose }: { onClose: () => void }) {
  const { t: translate } = useTranslation();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [role, setRole] = useState<CreateManagedUserRequest["role"]>("USER");
  const [level, setLevel] = useState<ManagedLevel>("STUDENT");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const createUser = useMutation({
    mutationFn: (request: CreateManagedUserRequest) =>
      adminApiService.createManagedUser("system", request),
    onSuccess: async (response) => {
      setCreatedId(unwrapData(response, "createManagedUser"));
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
  const submitUser = (event: FormEvent) => {
    event.preventDefault();
    if (!Number.isSafeInteger(Number(tenantId)) || Number(tenantId) < 1) return;
    createUser.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      ...(middleName.trim() ? { middleName: middleName.trim() } : {}),
      email: email.trim(),
      tenantId: Number(tenantId),
      role,
      level: role === "USER" ? level : "NOT_APPLICABLE",
    });
  };
  return (
    <TeachingDialog
      title={translate("common:admin.createManagedUser")}
      onClose={onClose}
      busy={createUser.isPending}
    >
      {createdId !== null ? (
        <div className={styles.form}>
          <p role="status">
            {translate("common:admin.userCreated", { id: createdId })}
          </p>
          <button className={styles.primaryButton} onClick={onClose}>
            {translate("common:admin.done")}
          </button>
        </div>
      ) : (
        <>
          <form className={styles.form} onSubmit={submitUser}>
            <label>
              <span>{translate("common:fields.firstName")}</span>
              <input
                required
                maxLength={100}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </label>
            <label>
              <span>{translate("auth:signup.middleNameLabel")}</span>
              <input
                maxLength={100}
                value={middleName}
                onChange={(event) => setMiddleName(event.target.value)}
              />
            </label>
            <label>
              <span>{translate("common:fields.lastName")}</span>
              <input
                required
                maxLength={100}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </label>
            <label>
              <span>{translate("common:fields.email")}</span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              <span>{translate("common:admin.tenantId")}</span>
              <input
                aria-label={translate("common:admin.tenantId")}
                aria-describedby="managed-user-tenant-hint"
                required
                type="number"
                min="1"
                step="1"
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
              />
              <small id="managed-user-tenant-hint">
                {translate("common:admin.existingTenantHint")}
              </small>
            </label>
            <label>
              <span>{translate("settings:accountRole")}</span>
              <select
                value={role}
                onChange={(event) =>
                  setRole(
                    event.target.value as CreateManagedUserRequest["role"],
                  )
                }
              >
                <option value="USER">{translate("common:roles.USER")}</option>
                <option value="TENANT_ADMIN">
                  {translate("common:admin.tenantAdmin")}
                </option>
              </select>
            </label>
            {role === "USER" ? (
              <LevelSelect
                value={level}
                onChange={setLevel}
                options={SYSTEM_MANAGED_LEVEL_OPTIONS}
              />
            ) : null}
            <button
              className={styles.primaryButton}
              disabled={
                createUser.isPending ||
                !firstName.trim() ||
                !lastName.trim() ||
                !email.trim() ||
                !Number.isSafeInteger(Number(tenantId)) ||
                Number(tenantId) < 1
              }
            >
              {createUser.isPending
                ? translate("common:actions.creating")
                : translate("common:admin.createUser")}
            </button>
          </form>
          <p className={styles.hint}>
            {translate("common:admin.passwordHelp")}
          </p>
          {createUser.isError ? (
            <p className={styles.errorMessage} role="alert">
              {getManagedUserCreateError(createUser.error)}
            </p>
          ) : null}
        </>
      )}
    </TeachingDialog>
  );
}
