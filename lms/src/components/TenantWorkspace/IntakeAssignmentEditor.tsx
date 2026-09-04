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
  const [reviewed, setReviewed] = useState(intake);
  const [advisor, setAdvisor] = useState<ManagedUser | null>(null);
  const [reason, setReason] = useState("");
  const [reloadRequired, setReloadRequired] = useState(false);
  const idempotency = useIdempotencyCheckpoint();
  const assigned = reviewed.assignmentStatus === "ASSIGNED";
  const save = useMutation({
    mutationFn: async (action: "assign" | "cancel") => {
      if (reviewed.lifecycleStatus !== "OPEN" || reloadRequired)
        throw new Error("Reload and review the intake before continuing.");
      if (action === "cancel") {
        if (assigned || !reason.trim())
          throw new Error(
            "Only unassigned intakes can be cancelled. Enter a reason.",
          );
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
      if (!advisor) throw new Error("Select an eligible advisor.");
      if (assigned) {
        if (reviewed.assignmentVersion == null)
          throw new Error("Refresh the intake before reassigning the advisor.");
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
      {save.isError && !reloadRequired ? (
        <p className={feedback.error} role="alert">
          {advisingErrorMessage(
            save.error,
            "The assignment could not be updated.",
          )}
        </p>
      ) : null}
      {save.isSuccess ? (
        <p className={feedback.success} role="status">
          {save.variables === "cancel"
            ? "Intake cancelled."
            : "Advisor assignment saved."}
        </p>
      ) : null}
      {reloadRequired || (assigned && reviewed.assignmentVersion == null) ? (
        <div className={feedback.conflictNotice} role="alert">
          <p>
            Load the latest intake and review its assignment before confirming.
            Your selection and reason are preserved.
          </p>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={busy}
            onClick={() => reload.mutate()}
          >
            Load latest intake
          </button>
        </div>
      ) : null}
      {reload.isError ? (
        <p className={feedback.error} role="alert">
          {advisingErrorMessage(
            reload.error,
            "The latest intake could not be loaded.",
          )}
        </p>
      ) : null}
      {reviewed.lifecycleStatus === "CANCELLED" ? (
        <p>Cancelled intakes cannot be assigned or edited.</p>
      ) : (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate("assign");
          }}
        >
          <div>
            <span>Eligible advisor</span>
            <TenantUserPicker
              title={
                assigned
                  ? "Choose the replacement advisor"
                  : "Choose an advisor"
              }
              description="Searches active Advisor and Instructor Advisor identities in this tenant."
              triggerLabel="Choose advisor"
              levels={[...TENANT_ADVISOR_LEVELS]}
              selectedUser={advisor}
              onSelect={setAdvisor}
            />
          </div>
          <label>
            <span>
              {assigned
                ? "Reason (recommended for reassignment)"
                : "Reason (required only when cancelling)"}
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
                ? "Saving…"
                : assigned
                  ? "Reassign advisor"
                  : "Assign advisor"}
            </button>
            {!assigned ? (
              <button
                type="button"
                className={styles.dangerButton}
                disabled={busy || !reason.trim() || reloadRequired}
                onClick={() => {
                  if (
                    window.confirm(
                      "Cancel this intake? It will no longer be available for assignment.",
                    )
                  )
                    save.mutate("cancel");
                }}
              >
                Cancel intake
              </button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
