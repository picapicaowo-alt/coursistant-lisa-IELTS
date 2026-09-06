import {LocalizedError} from '@/i18n/errors';
import {useConfirmationDialog} from '@/components/TeachingWorkspace/useConfirmationDialog';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  type ManagedUser,
  type StudentIntakeResponse,
  unwrapData,
} from "@/apis";
import { tenantAdvisingApiService } from "@/apis/services/tenant-advising-api";
import { TenantUserPicker } from "@/components/TenantUserPicker";
import { TENANT_ADVISOR_LEVELS } from "@/configs/tenantNavigation";
import {
  idempotencyFingerprint,
  useIdempotencyCheckpoint,
} from "@/hooks/useIdempotencyCheckpoint";
import { advisingErrorMessage } from "@/pages/advising/advisingErrors";
import { getApiErrorCode } from "@/utils/apiError";
import styles from "./workspace.module.scss";
import feedback from "@/pages/advising/advising.module.scss";

/** The list drawer and student record share the same reviewed-version mutation boundary. */
export function IntakeAssignmentEditor({
  intake,
  onUpdated,
  onPendingChange,
}: {
  intake: StudentIntakeResponse;
  onUpdated: () => Promise<void>;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { t: translate } = useTranslation();
  const [reviewed, setReviewed] = useState(intake);
  const confirmation = useConfirmationDialog(`${intake.intakeId}/${intake.intakeVersion}`);
  const [advisor, setAdvisor] = useState<ManagedUser | null>(null);
  const [reason, setReason] = useState("");
  const [reloadRequired, setReloadRequired] = useState(false);
  const idempotency = useIdempotencyCheckpoint();
  const assigned = reviewed.assignmentStatus === "ASSIGNED";
  const save = useMutation({
    mutationFn: async (action: "assign" | "cancel") => {
      if (reviewed.lifecycleStatus !== "OPEN" || reloadRequired)
        throw new LocalizedError("advising:intake.reviewRequired");
      if (action === "cancel") {
        if (assigned || !reason.trim())
          throw new LocalizedError("advising:intake.cancelValidation");
        const request = {
          expectedIntakeVersion: reviewed.intakeVersion,
          reason: reason.trim(),
        };
        const key = idempotency.keyFor(
          `tenant-cancel-${reviewed.intakeId}`,
          idempotencyFingerprint(request),
        );
        return unwrapData(
          await tenantAdvisingApiService.cancelStudentIntake(
            reviewed.intakeId,
            request,
            key,
          ),
          "tenantCancel",
        );
      }
      if (!advisor) throw new LocalizedError("advising:intake.selectEligible");
      if (assigned) {
        if (reviewed.assignmentVersion == null)
          throw new LocalizedError("advising:intake.refreshRequired");
        const request = {
          advisorUserId: advisor.id,
          expectedAssignmentVersion: reviewed.assignmentVersion,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        };
        const key = idempotency.keyFor(
          `tenant-reassign-${reviewed.studentUserId}`,
          idempotencyFingerprint(request),
        );
        return unwrapData(
          await tenantAdvisingApiService.reassignAdvisor(
            reviewed.studentUserId,
            request,
            key,
          ),
          "tenantReassign",
        );
      }
      const request = {
        advisorUserId: advisor.id,
        expectedIntakeVersion: reviewed.intakeVersion,
      };
      const key = idempotency.keyFor(
        `tenant-assign-${reviewed.intakeId}`,
        idempotencyFingerprint(request),
      );
      return unwrapData(
        await tenantAdvisingApiService.assignAdvisor(
          reviewed.intakeId,
          request,
          key,
        ),
        "tenantAssign",
      );
    },
    onError: (error) => {
      if (getApiErrorCode(error)?.endsWith("VERSION_CONFLICT"))
        setReloadRequired(true);
    },
    onSuccess: async (updated) => {
      setReviewed(updated);
      setAdvisor(null);
      setReason("");
      await onUpdated();
    },
  });
  const reload = useMutation({
    mutationFn: async () =>
      unwrapData(
        await tenantAdvisingApiService.getStudentIntake(intake.intakeId),
        "tenantIntakeDetail",
      ),
    onSuccess: (updated) => {
      setReviewed(updated);
      setReloadRequired(false);
      save.reset();
    },
  });
  const busy = save.isPending || reload.isPending;
  useEffect(() => {
    onPendingChange?.(busy);
    return () => onPendingChange?.(false);
  }, [busy, onPendingChange]);

  return (
    <div className={styles.form}>
      {confirmation.dialog}
      {save.isError && !reloadRequired ? (
        <p className={feedback.error} role="alert">
          {advisingErrorMessage(
            save.error,
            translate("advising:intake.assignmentFailed"),
          )}
        </p>
      ) : null}
      {save.isSuccess ? (
        <p className={feedback.success} role="status">
          {save.variables === "cancel"
            ? translate("advising:intake.cancelled")
            : translate("advising:intake.assignmentSaved")}
        </p>
      ) : null}
      {reloadRequired || (assigned && reviewed.assignmentVersion == null) ? (
        <div className={feedback.conflictNotice} role="alert">
          <p>
            {translate("advising:intake.reloadHelp")}</p>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={busy}
            onClick={() => reload.mutate()}
          >
            {translate("advising:intake.loadLatest")}</button>
        </div>
      ) : null}
      {reload.isError ? (
        <p className={feedback.error} role="alert">
          {advisingErrorMessage(
            reload.error,
            translate("advising:intake.loadFailed"),
          )}
        </p>
      ) : null}
      {reviewed.lifecycleStatus === "CANCELLED" ? (
        <p>{translate("advising:intake.cancelledReadonly")}</p>
      ) : (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate("assign");
          }}
        >
          <div>
            <span>{translate("advising:intake.eligibleAdvisor")}</span>
            <TenantUserPicker
              title={
                assigned
                  ? translate("advising:intake.chooseReplacement")
                  : translate("common:intake.chooseAdvisor")
              }
              description={translate("advising:intake.advisorSearchHelp")}
              triggerLabel={translate("advising:intake.chooseAdvisor")}
              levels={[...TENANT_ADVISOR_LEVELS]}
              selectedUser={advisor}
              onSelect={setAdvisor}
            />
          </div>
          <label>
            <span>
              {assigned
                ? translate("advising:intake.reassignReason")
                : translate("advising:intake.cancelReason")}
            </span>
            <textarea
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className={styles.formFooter}>
            <button
              className={styles.primaryButton}
              disabled={
                busy ||
                !advisor ||
                reloadRequired ||
                (assigned && reviewed.assignmentVersion == null)
              }
            >
              {save.isPending
                ? translate("common:actions.saving")
                : assigned
                  ? translate("advising:intake.reassign")
                  : translate("advising:intake.assign")}
            </button>
            {!assigned ? (
              <button
                type="button"
                className={styles.dangerButton}
                disabled={busy || !reason.trim() || reloadRequired}
                onClick={async () => {
                  if (
                    !busy && !reloadRequired && reason.trim() && await confirmation.confirm({titleKey: 'advising:intake.cancel', messageKey: 'advising:intake.confirmCancel'})
                  )
                    save.mutate("cancel");
                }}
              >
                {translate("advising:intake.cancel")}</button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
