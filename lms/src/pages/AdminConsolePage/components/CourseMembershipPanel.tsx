import { useTranslation } from "react-i18next";
import React, { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CourseMember, CourseSummary, unwrapData } from "@/apis";
import { courseApiService } from "@/apis/services/course-api";
import { getApiErrorMessage } from "@/utils/apiError";
import { TeachingDialog } from "@/components/TeachingWorkspace";
import { PersonCell } from "@/components/PersonCell";
import {
  SystemCourseFilters,
  type SystemCourseScope,
} from "@/components/SystemCourseFilters";
import { formatNumber } from "@/i18n/formatting";
import i18n from "@/i18n";
import styles from "../index.module.scss";

const COURSE_PAGE_SIZE = 100;
const MEMBER_PAGE_SIZE = 20;

type Feedback = {
  tone: "success" | "error";
  text: string;
};

type RoleChange = {
  member: CourseMember;
  targetRole: "TA" | "Student";
};

type EnrollmentRole = "Student" | "TA";

class PartialTaAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartialTaAssignmentError";
  }
}

const instructorLabel = (course: CourseSummary): string => {
  const instructor = course.primaryInstructor;
  if (!instructor) return i18n.t("common:admin.noInstructor");
  return (
    instructor.name ||
    instructor.email ||
    i18n.t("common:admin.instructorNumber", { id: instructor.userId })
  );
};

const memberRoleClass = (member: CourseMember): string => {
  if (member.courseRole === "Instructor") return styles.roleInstructor;
  if (member.courseRole === "TA") return styles.roleTa;
  return styles.roleStudent;
};

const CourseMemberRow = ({
  member,
  course,
  busy,
  pendingChange,
  onReviewChange,
  onConfirmChange,
  onCancelChange,
}: {
  member: CourseMember;
  course: CourseSummary;
  busy: boolean;
  pendingChange: RoleChange | null;
  onReviewChange: (change: RoleChange) => void;
  onConfirmChange: (change: RoleChange) => void;
  onCancelChange: () => void;
}) => {
  const { t: translate } = useTranslation();
  const isThisMemberPending = pendingChange?.member.userId === member.userId;
  const displayName =
    member.userName ||
    member.userEmail ||
    translate("common:admin.userNumber", { id: member.userId });

  return (
    <article className={styles.courseMemberRow}>
      <div className={styles.memberIdentity}>
        <PersonCell
          person={{
            id: member.userId,
            firstName: displayName,
            email: member.userEmail,
          }}
        />
        <span className={`${styles.roleBadge} ${memberRoleClass(member)}`}>
          {translate(`common:admin.courseRoles.${member.courseRole}`)}
        </span>
      </div>

      {isThisMemberPending && pendingChange ? (
        <div className={styles.roleChangeReview}>
          <p>
            {pendingChange.targetRole === "TA"
              ? translate("common:admin.taQuestion", {
                  name: displayName,
                  course: course.courseCode,
                })
              : translate("common:admin.studentQuestion", {
                  name: displayName,
                  course: course.courseCode,
                })}
          </p>
          <div className={styles.confirmRow}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={busy}
              onClick={() => onConfirmChange(pendingChange)}
            >
              {busy
                ? translate("settings:updating")
                : pendingChange.targetRole === "TA"
                  ? translate("common:admin.confirmTa")
                  : translate("common:admin.confirmCourseRole")}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={busy}
              onClick={onCancelChange}
            >
              {translate("common:actions.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.memberActions}>
          {member.courseRole === "Student" && member.active ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onReviewChange({ member, targetRole: "TA" })}
            >
              {translate("common:admin.setTa")}
            </button>
          ) : null}
          {member.courseRole === "TA" && member.active ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onReviewChange({ member, targetRole: "Student" })}
            >
              {translate("common:admin.returnStudent")}
            </button>
          ) : null}
        </div>
      )}
    </article>
  );
};

/**
 * Course-scoped membership controls for administrators. The selected course,
 * rather than an editable tenant value, owns the scope; the API remains the
 * authority for tenant boundaries and membership-role constraints.
 */
export const CourseMembershipPanel: React.FC = () => {
  const [scope, setScope] = useState<SystemCourseScope>({});
  return (
    <div>
      <SystemCourseFilters onApply={setScope} />
      <ScopedCourseMembers key={`${scope.q}-${scope.tenantId}`} scope={scope} />
    </div>
  );
};

const ScopedCourseMembers = ({ scope }: { scope: SystemCourseScope }) => {
  const { t: translate } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [enrollmentRole, setEnrollmentRole] =
    useState<EnrollmentRole>("Student");
  const [memberSearchInput, setMemberSearchInput] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPage, setMemberPage] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<RoleChange | null>(
    null,
  );

  const coursesQuery = useQuery({
    queryKey: ["admin", "active-courses", scope],
    queryFn: async () =>
      unwrapData(
        await courseApiService.browseCourses({
          ...scope,
          state: "Active",
          page: 0,
          size: COURSE_PAGE_SIZE,
        }),
        "browseAdminCourses",
      ),
    retry: 1,
  });

  const courses = coursesQuery.data?.items ?? [];
  const effectiveCourseId = selectedCourseId ?? courses[0]?.id ?? null;
  const selectedCourse =
    courses.find((course) => course.id === effectiveCourseId) ?? null;

  const membersQuery = useQuery({
    queryKey: [
      "admin",
      "course-members",
      effectiveCourseId,
      memberPage,
      memberSearch,
    ],
    queryFn: async () =>
      unwrapData(
        await courseApiService.listCourseMembers(effectiveCourseId!, {
          active: true,
          q: memberSearch || undefined,
          page: memberPage,
          size: MEMBER_PAGE_SIZE,
        }),
        "listAdminCourseMembers",
      ),
    enabled: effectiveCourseId !== null,
    retry: 1,
  });

  const members = useMemo(() => {
    const rolePriority = { Instructor: 0, TA: 1, Student: 2 };
    return [...(membersQuery.data?.items ?? [])].sort(
      (left, right) =>
        rolePriority[left.courseRole] - rolePriority[right.courseRole] ||
        left.userId - right.userId,
    );
  }, [membersQuery.data?.items]);

  const refreshMembers = async (courseId: number) => {
    await queryClient.invalidateQueries({
      queryKey: ["admin", "course-members", courseId],
    });
  };

  const enrolStudent = useMutation({
    mutationFn: async ({
      courseId,
      value,
      targetRole,
    }: {
      courseId: number;
      value: string;
      targetRole: EnrollmentRole;
    }) => {
      const userId = /^[1-9]\d*$/.test(value) ? Number(value) : null;
      const result = unwrapData(
        await courseApiService.enrolStudents(
          courseId,
          userId ? { userIds: [userId] } : { emails: [value] },
        ),
        "adminEnrolStudent",
      );

      const successfulItem = result.items.find(
        (item) => item.status === "SUCCESS",
      );
      const failure = result.items.find((item) => item.status === "ERROR");
      if (!successfulItem) {
        throw new Error(
          failure?.message || translate("common:admin.enrollFailed"),
        );
      }

      if (targetRole === "TA") {
        const enrolledUserId =
          successfulItem.userId ?? successfulItem.member?.userId;
        if (!enrolledUserId) {
          throw new PartialTaAssignmentError(
            translate("common:admin.partialTaMissingId"),
          );
        }
        try {
          await courseApiService.promoteToTa(courseId, enrolledUserId);
        } catch (error) {
          throw new PartialTaAssignmentError(
            translate("common:admin.partialTa", {
              detail: getApiErrorMessage(
                error,
                translate("common:admin.taRetry"),
              ),
            }),
          );
        }
      }

      return { result, targetRole };
    },
    onSuccess: async ({ targetRole }, variables) => {
      setIdentifier("");
      setFeedback({
        tone: "success",
        text:
          targetRole === "TA"
            ? translate("common:admin.enrollTaSuccess")
            : translate("common:admin.enrollSuccess"),
      });
      await refreshMembers(variables.courseId);
    },
    onError: async (error, variables) => {
      setFeedback({
        tone: "error",
        text: getApiErrorMessage(error, translate("common:admin.accessFailed")),
      });
      if (error instanceof PartialTaAssignmentError) {
        await refreshMembers(variables.courseId);
      }
    },
  });

  const changeCourseRole = useMutation({
    mutationFn: ({
      courseId,
      member,
      targetRole,
    }: {
      courseId: number;
      member: CourseMember;
      targetRole: "TA" | "Student";
    }) =>
      targetRole === "TA"
        ? courseApiService.promoteToTa(courseId, member.userId)
        : courseApiService.demoteTa(courseId, member.userId),
    onSuccess: async (_response, variables) => {
      setPendingRoleChange(null);
      setFeedback({
        tone: "success",
        text:
          variables.targetRole === "TA"
            ? translate("common:admin.taSuccess")
            : translate("common:admin.studentSuccess"),
      });
      await refreshMembers(variables.courseId);
    },
    onError: (_error, variables) =>
      setFeedback({
        tone: "error",
        text:
          variables.targetRole === "TA"
            ? translate("common:admin.taFailed")
            : translate("common:admin.demoteFailed"),
      }),
  });

  const submitEnrollment = (event: FormEvent) => {
    event.preventDefault();
    const value = identifier.trim();
    if (!effectiveCourseId || !value) return;
    setFeedback(null);
    enrolStudent.mutate({
      courseId: effectiveCourseId,
      value,
      targetRole: enrollmentRole,
    });
  };

  const selectCourse = (courseId: number) => {
    setSelectedCourseId(courseId);
    setMemberPage(0);
    setMemberSearchInput("");
    setMemberSearch("");
    setIdentifier("");
    setEnrollmentRole("Student");
    setFeedback(null);
    setPendingRoleChange(null);
  };

  if (coursesQuery.isPending) {
    return (
      <p className={styles.status}>
        {translate("common:admin.loadingCourses")}
      </p>
    );
  }

  if (coursesQuery.isError) {
    return (
      <div className={styles.status} role="alert">
        <p>{translate("common:admin.coursesFailed")}</p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => void coursesQuery.refetch()}
        >
          {translate("common:actions.tryAgain")}
        </button>
      </div>
    );
  }

  if (!selectedCourse) {
    return (
      <p className={styles.status}>{translate("common:admin.noCourses")}</p>
    );
  }

  const memberPageCount = Math.max(
    1,
    Math.ceil((membersQuery.data?.total ?? 0) / MEMBER_PAGE_SIZE),
  );
  const roleChangeBusy = changeCourseRole.isPending;

  return (
    <div className={styles.membersLayout}>
      <section className={styles.card} aria-labelledby="course-access-title">
        <h2 id="course-access-title">
          {translate("common:admin.courseAccess")}
        </h2>
        <p className={styles.hint}>
          {translate("common:admin.courseAccessHelp")}
        </p>

        <div className={styles.form}>
          <label>
            <span>{translate("common:admin.teacherCourse")}</span>
            <select
              value={effectiveCourseId}
              onChange={(event) => selectCourse(Number(event.target.value))}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.courseCode} — {course.title} ·{" "}
                  {instructorLabel(course)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.courseContext}>
          <span>{selectedCourse.courseCode}</span>
          <strong>{selectedCourse.title}</strong>
          <p>
            {translate("common:admin.teacherLabel", {
              name: instructorLabel(selectedCourse),
            })}
          </p>
          <small>
            {translate("common:admin.courseContext", {
              courseId: selectedCourse.id,
              tenantId: selectedCourse.tenantId,
            })}
          </small>
        </div>

        <button
          className={styles.primaryButton}
          onClick={() => {
            setFeedback(null);
            setEnrollOpen(true);
          }}
        >
          {translate("common:admin.addMember")}
        </button>
        {enrollOpen ? (
          <TeachingDialog
            title={translate("common:admin.addMember")}
            description={selectedCourse.title}
            onClose={() => setEnrollOpen(false)}
            busy={enrolStudent.isPending}
          >
            <form className={styles.form} onSubmit={submitEnrollment}>
              <label>
                <span>{translate("common:admin.userEmailId")}</span>
                <input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder={translate("common:admin.userEmailPlaceholder")}
                />
              </label>
              <label>
                <span>{translate("common:admin.courseRole")}</span>
                <select
                  value={enrollmentRole}
                  onChange={(event) =>
                    setEnrollmentRole(event.target.value as EnrollmentRole)
                  }
                >
                  <option value={"Student"}>
                    {translate("common:roles.STUDENT")}
                  </option>
                  <option value="TA">
                    {translate("common:admin.taLabel")}
                  </option>
                </select>
              </label>
              <button
                className={styles.primaryButton}
                disabled={!identifier.trim() || enrolStudent.isPending}
              >
                {enrolStudent.isPending
                  ? enrollmentRole === "TA"
                    ? translate("common:admin.assigningTa")
                    : translate("common:admin.enrolling")
                  : enrollmentRole === "TA"
                    ? translate("common:admin.enrollTa")
                    : translate("common:admin.enrollStudent")}
              </button>
            </form>
            <p className={styles.hint}>{translate("common:admin.taHelp")}</p>
            {feedback ? (
              <p
                className={
                  feedback.tone === "error"
                    ? styles.inlineError
                    : styles.inlineSuccess
                }
                role={feedback.tone === "error" ? "alert" : "status"}
              >
                {feedback.text}
              </p>
            ) : null}
          </TeachingDialog>
        ) : null}
      </section>

      <section
        className={`${styles.card} ${styles.listCard}`}
        aria-labelledby="course-roster-title"
      >
        <div className={styles.cardHeader}>
          <div>
            <h2 id="course-roster-title">
              {translate("common:admin.tabs.members")}
            </h2>
            <p>{translate("common:admin.memberHelp")}</p>
          </div>
          <span>
            {membersQuery.isSuccess
              ? formatNumber(membersQuery.data.total)
              : null}
          </span>
        </div>

        <form
          className={styles.memberSearch}
          onSubmit={(event) => {
            event.preventDefault();
            setMemberPage(0);
            setMemberSearch(memberSearchInput.trim());
          }}
        >
          <label className={styles.search}>
            <span>{translate("common:admin.searchCourse")}</span>
            <input
              value={memberSearchInput}
              onChange={(event) => setMemberSearchInput(event.target.value)}
              placeholder={translate("common:admin.memberSearchPlaceholder")}
            />
          </label>
          <button type="submit" className={styles.secondaryButton}>
            {translate("common:actions.search")}
          </button>
        </form>

        {membersQuery.isPending ? (
          <p className={styles.status}>
            {translate("common:admin.loadingMembers")}
          </p>
        ) : null}
        {membersQuery.isError ? (
          <div className={styles.status} role="alert">
            <p>{translate("common:admin.membersFailed")}</p>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void membersQuery.refetch()}
            >
              {translate("common:actions.tryAgain")}
            </button>
          </div>
        ) : null}
        {!membersQuery.isPending && !membersQuery.isError && !members.length ? (
          <p className={styles.status}>{translate("common:admin.noMembers")}</p>
        ) : null}

        {!membersQuery.isError && members.length ? (
          <div className={styles.courseMemberList}>
            {members.map((member) => (
              <CourseMemberRow
                key={member.id}
                member={member}
                course={selectedCourse}
                busy={roleChangeBusy}
                pendingChange={pendingRoleChange}
                onReviewChange={setPendingRoleChange}
                onCancelChange={() => setPendingRoleChange(null)}
                onConfirmChange={(change) =>
                  changeCourseRole.mutate({
                    courseId: selectedCourse.id,
                    ...change,
                  })
                }
              />
            ))}
          </div>
        ) : null}

        {!enrollOpen && feedback ? (
          <p
            className={
              feedback.tone === "error"
                ? styles.inlineError
                : styles.inlineSuccess
            }
            role={feedback.tone === "error" ? "alert" : "status"}
          >
            {feedback.text}
          </p>
        ) : null}
        {memberPageCount > 1 ? (
          <nav
            className={styles.pagination}
            aria-label={translate("common:admin.memberPages")}
          >
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={memberPage === 0}
              onClick={() => setMemberPage((page) => page - 1)}
            >
              {translate("common:actions.previous")}
            </button>
            <span>
              {formatNumber(memberPage + 1)} / {formatNumber(memberPageCount)}
            </span>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={memberPage + 1 >= memberPageCount}
              onClick={() => setMemberPage((page) => page + 1)}
            >
              {translate("common:actions.next")}
            </button>
          </nav>
        ) : null}
      </section>
    </div>
  );
};
