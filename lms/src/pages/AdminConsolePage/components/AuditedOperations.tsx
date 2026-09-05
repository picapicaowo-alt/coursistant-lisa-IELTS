import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { type AssignmentGradeCorrectionRequest } from "@/apis";
import { adminApiService } from "@/apis/services/admin-api";
import styles from "../index.module.scss";

export function AuditedOperations({ view }: { view: "reassign" | "grade" }) {
  const { t: translate } = useTranslation();
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [courseId, setCourseId] = useState("");
  const [primaryInstructorUserId, setPrimaryInstructorUserId] = useState("");
  const [confirmReassignment, setConfirmReassignment] = useState(false);
  const [correction, setCorrection] =
    useState<AssignmentGradeCorrectionRequest>({
      assignmentId: 0,
      studentUserId: 0,
      score: 0,
      reason: "",
    });
  const [confirmCorrection, setConfirmCorrection] = useState(false);
  const reassignInstructor = useMutation({
    mutationFn: () =>
      adminApiService.reassignPrimaryInstructor(Number(courseId), {
        primaryInstructorUserId: Number(primaryInstructorUserId),
      }),
    onSuccess: () => {
      setConfirmReassignment(false);
      setMessage({
        tone: "success",
        text: translate("common:admin.reassignSuccess"),
      });
    },
    onError: () =>
      setMessage({
        tone: "error",
        text: translate("common:admin.reassignFailed"),
      }),
  });
  const correctGrade = useMutation({
    mutationFn: () =>
      adminApiService.correctAssignmentGrade({
        ...correction,
        reason: correction.reason.trim(),
      }),
    onSuccess: () => {
      setConfirmCorrection(false);
      setMessage({
        tone: "success",
        text: translate("common:admin.gradeSuccess"),
      });
    },
    onError: () =>
      setMessage({
        tone: "error",
        text: translate("common:admin.gradeFailed"),
      }),
  });

  return (
    <div>
      {message ? (
        <p
          className={
            message.tone === "error" ? styles.errorMessage : styles.message
          }
          role={message.tone === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}
      {view === "reassign" ? (
        <section
          className={styles.card}
          aria-labelledby="reassign-instructor-title"
        >
          <h2 id="reassign-instructor-title">
            {translate("common:admin.reassignTitle")}
          </h2>
          <p className={styles.hint}>
            {translate("common:admin.reassignHelp")}
          </p>
          <div className={styles.form}>
            <label>
              <span>{translate("common:admin.courseId")}</span>
              <input
                type="number"
                min="1"
                value={courseId}
                onChange={(event) => {
                  setCourseId(event.target.value);
                  setConfirmReassignment(false);
                }}
              />
            </label>
            <label>
              <span>{translate("common:admin.newInstructorId")}</span>
              <input
                type="number"
                min="1"
                value={primaryInstructorUserId}
                onChange={(event) => {
                  setPrimaryInstructorUserId(event.target.value);
                  setConfirmReassignment(false);
                }}
              />
            </label>
            {confirmReassignment ? (
              <div className={styles.confirmStack}>
                <p>
                  {translate("common:admin.reassignQuestion", {
                    courseId,
                    userId: primaryInstructorUserId,
                  })}
                </p>
                <div className={styles.confirmRow}>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    disabled={reassignInstructor.isPending}
                    onClick={() => reassignInstructor.mutate()}
                  >
                    {reassignInstructor.isPending
                      ? translate("common:admin.reassigning")
                      : translate("common:admin.confirmReassign")}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => setConfirmReassignment(false)}
                  >
                    {translate("common:actions.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={styles.primaryButton}
                disabled={!Number(courseId) || !Number(primaryInstructorUserId)}
                onClick={() => setConfirmReassignment(true)}
              >
                {translate("common:admin.reviewReassign")}
              </button>
            )}
          </div>
        </section>
      ) : null}

      {view === "grade" ? (
        <section className={styles.card} aria-labelledby="correct-grade-title">
          <h2 id="correct-grade-title">
            {translate("common:admin.gradeTitle")}
          </h2>
          <p className={styles.hint}>{translate("common:admin.gradeHelp")}</p>
          <div className={styles.form}>
            <label>
              <span>{translate("common:admin.assignmentId")}</span>
              <input
                type="number"
                min="1"
                value={correction.assignmentId || ""}
                onChange={(event) => {
                  setCorrection((current) => ({
                    ...current,
                    assignmentId: Number(event.target.value),
                  }));
                  setConfirmCorrection(false);
                }}
              />
            </label>
            <label>
              <span>{translate("common:admin.studentId")}</span>
              <input
                type="number"
                min="1"
                value={correction.studentUserId || ""}
                onChange={(event) => {
                  setCorrection((current) => ({
                    ...current,
                    studentUserId: Number(event.target.value),
                  }));
                  setConfirmCorrection(false);
                }}
              />
            </label>
            <label>
              <span>{translate("common:admin.score")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={correction.score}
                onChange={(event) => {
                  setCorrection((current) => ({
                    ...current,
                    score: Number(event.target.value),
                  }));
                  setConfirmCorrection(false);
                }}
              />
            </label>
            <label>
              <span>{translate("common:admin.auditReason")}</span>
              <textarea
                required
                value={correction.reason}
                onChange={(event) => {
                  setCorrection((current) => ({
                    ...current,
                    reason: event.target.value,
                  }));
                  setConfirmCorrection(false);
                }}
                placeholder={translate("common:admin.auditPlaceholder")}
              />
            </label>
            {confirmCorrection ? (
              <div className={styles.confirmStack}>
                <p>
                  {translate("common:admin.gradeQuestion", {
                    assignmentId: correction.assignmentId,
                    studentId: correction.studentUserId,
                    score: correction.score,
                  })}
                </p>
                <div className={styles.confirmRow}>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    disabled={correctGrade.isPending}
                    onClick={() => correctGrade.mutate()}
                  >
                    {correctGrade.isPending
                      ? translate("common:admin.correcting")
                      : translate("common:admin.confirmGrade")}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => setConfirmCorrection(false)}
                  >
                    {translate("common:actions.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={styles.primaryButton}
                disabled={
                  correction.assignmentId < 1 ||
                  correction.studentUserId < 1 ||
                  !Number.isFinite(correction.score) ||
                  !correction.reason.trim()
                }
                onClick={() => setConfirmCorrection(true)}
              >
                {translate("common:admin.reviewGrade")}
              </button>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
