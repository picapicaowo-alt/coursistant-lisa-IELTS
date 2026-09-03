import {teachingLabel} from '@/components/TeachingWorkspace/presentation';
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { generatePath, Link, useSearchParams } from "react-router-dom";
import { Bell, CalendarDays, ChevronRight, TriangleAlert } from "lucide-react";
import { unwrapData, type GradingQueueItem } from "@/apis";
import { courseOperationsApiService as api } from "@/apis/services/course-operations-api";
import { dashboardApiService } from "@/apis/services/dashboard-api";
import { APP_ROUTE_PATHS } from "@/configs/routePaths";
import { assignmentGradingPath } from "@/configs/coursePaths";
import { registeredDestination } from "@/utils/registeredDestination";
import { formatPersonName } from "@/utils/personName";
import {
  TeachingAvatar,
  TeachingBadge,
  TeachingDialog,
  TeachingState,
} from "@/components/TeachingWorkspace";
import CalendarPage from "@/pages/CalendarPage";
import { TeacherOperationsSections } from "./TeacherOperationsSections";
import { ScheduleReview } from "../CourseOperationsPage/OccurrenceRequests";
import {
  dateLabel,
  timeRange,
  recordId,
  recordPage,
  textValue,
  optionalNumber,
  type OperationRecord,
} from "../CourseOperationsPage/records";
import s from "@/components/TeachingWorkspace/index.module.scss";
import local from "./instructor.module.scss";

const SECTIONS = ["teaching", "availability", "calendar"] as const;
export function InstructorOperationsPage() {
  const [params, setParams] = useSearchParams();
  const section =
    SECTIONS.find((item) => item === params.get("view")) ?? "teaching";
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
  return (
    <main className={s.page}>
      <header className={s.heading}>
        <div>
          <h1>Teaching Operations</h1>
          <p>
            Your live teaching queue, classes, personal calendar, and
            availability.
          </p>
        </div>
      </header>
      <nav className={s.primaryNav} aria-label="Operations sections">
        {SECTIONS.map((item) => (
          <button
            type="button"
            key={item}
            aria-pressed={section === item}
            onClick={() => setParams({ view: item })}
          >
            {teachingLabel(item)}
          </button>
        ))}
      </nav>
      {section === "teaching" ? (
        <TeachingOverview />
      ) : section === "availability" ? (
        <div className={local.availability}>
          <TeacherOperationsSections
            section="availability"
            timezone={timezone}
          />
        </div>
      ) : (
        <div className={local.calendar}>
          <CalendarPage />
        </div>
      )}
    </main>
  );
}

function Card({
  title,
  meta,
  children,
  full = false,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <section
      className={`${s.panel} ${full ? local.full : ""}`}
      aria-label={title}
    >
      <header className={local.cardHeader}>
        <h2>{title}</h2>
        {meta}
      </header>
      {children}
    </section>
  );
}
const personName = (item: {
  studentFirstName?: string;
  studentMiddleName?: string;
  studentLastName?: string;
  studentUserId: number;
}) =>
  formatPersonName(
    {
      firstName: item.studentFirstName,
      middleName: item.studentMiddleName,
      lastName: item.studentLastName,
    },
    `Student #${item.studentUserId}`,
  );
const coursePath = (id: number) =>
  generatePath(APP_ROUTE_PATHS.courseCourseId, { courseId: String(id) });

function TeachingOverview() {
  const today = useQuery({
    queryKey: ["me", "teaching-today"],
    queryFn: async () =>
      unwrapData(await api.getMyTeachingTodayClasses(), "today classes"),
    retry: false,
  });
  const queue = useQuery({
    queryKey: ["dashboard", "teaching", "grading-queue"],
    queryFn: async () =>
      unwrapData(await dashboardApiService.getGradingQueue(), "grading queue"),
    retry: false,
  });
  const grading = useQuery({
    queryKey: ["me", "teaching-grading-items"],
    queryFn: async () =>
      unwrapData(await api.getMyTeachingGradingItems(), "grading submissions"),
    retry: false,
  });
  const support = useQuery({
    queryKey: ["me", "teaching-support"],
    queryFn: async () =>
      unwrapData(
        await api.getMyTeachingStudentsNeedingSupport(),
        "students needing support",
      ),
    retry: false,
  });
  const alerts = useQuery({
    queryKey: ["me", "teaching-alerts"],
    queryFn: async () =>
      recordPage(
        unwrapData(await api.getMyTeachingAlerts(), "teaching alerts"),
        ["alerts"],
      ),
    retry: false,
  });
  const courses = useQuery({
    queryKey: ["me", "teaching-courses"],
    queryFn: async () =>
      unwrapData(
        await dashboardApiService.getTeachingCourses(),
        "teaching courses",
      ),
    retry: false,
  });
  const requests = useQuery({
    queryKey: ["me", "teaching-schedule-requests"],
    queryFn: async () =>
      recordPage(
        unwrapData(
          await api.getMyTeachingScheduleRequests(),
          "schedule requests",
        ),
        ["requests"],
      ),
    retry: false,
  });
  const [selected, setSelected] = useState<OperationRecord>();
  const groups = useMemo(() => {
    if (queue.data?.length) return queue.data;
    // Some deployments expose only the per-student assignment projection. Preserve that real queue without counting released work as pending.
    const grouped = new Map<string, Pick<GradingQueueItem, 'kind' | 'courseId' | 'courseCode' | 'title' | 'pendingCount' | 'assignmentId' | 'quizId'>>();
    for (const item of grading.data ?? []) {
      if (item.status === "COMPLETED") continue;
      const kind =
        item.status === "IN_PROGRESS"
          ? "AssignmentAwaitingRelease"
          : "AssignmentUngraded";
      const key = `${item.courseId}-${item.assignmentId}-${kind}`;
      const previous = grouped.get(key);
      grouped.set(key, {
        kind,
        courseId: item.courseId,
        courseCode: item.courseCode ?? "",
        title: item.title,
        pendingCount: (previous?.pendingCount ?? 0) + 1,
        assignmentId: item.assignmentId,
        quizId: null,
      });
    }
    return [...grouped.values()];
  }, [queue.data, grading.data]);
  const count = groups.reduce((sum, item) => sum + item.pendingCount, 0);
  return (
    <div className={local.grid}>
      <Card
        title="Today's classes"
        meta={
          <Link
            to={`${APP_ROUTE_PATHS.myOperations}?view=calendar`}
            className={s.iconButton}
            aria-label="Open teaching calendar"
          >
            <CalendarDays size={19} />
          </Link>
        }
      >
        {today.isPending || today.isError || !today.data?.length ? (
          <TeachingState compact
            loading={today.isPending}
            error={today.error}
            empty="No classes scheduled for today."
            onRetry={() => void today.refetch()}
          />
        ) : (
          <div>
            {today.data.map((item) => (
              <Link
                key={
                  item.occurrenceId ??
                  `${item.courseId}-${item.sessionId}-${item.startTime}`
                }
                className={local.row}
                to={
                  item.occurrenceId
                    ? `${generatePath(APP_ROUTE_PATHS.courseCourseIdOperations, { courseId: String(item.courseId) })}?section=attendance&occurrence=${item.occurrenceId}`
                    : coursePath(item.courseId)
                }
              >
                <span>
                  <strong>{item.courseTitle || item.courseCode}</strong>
                  <small>
                    {timeRange(item.startTime, item.endTime)}
                    {item.timezone ? ` · ${item.timezone}` : ""}
                  </small>
                  {item.location ? <small>{item.location}</small> : null}
                </span>
                <ChevronRight size={18} />
              </Link>
            ))}
          </div>
        )}
      </Card>
      <Card
        title="Grading queue"
        meta={
          !queue.isPending &&
          !grading.isPending &&
          (!queue.isError || !grading.isError) ? (
            <TeachingBadge value="PENDING">{count} pending</TeachingBadge>
          ) : null
        }
      >
        {!groups.length && (queue.isPending || grading.isPending) ? (
          <TeachingState compact loading />
        ) : groups.length ? (
          <div>
            {queue.isError ? (
              <p className={s.notice}>
                Showing assignment submissions. The combined assignment/quiz
                queue is unavailable.
              </p>
            ) : null}
            {groups.map((item) => (
              <Link
                className={local.row}
                key={`${item.kind}-${item.courseId}-${item.assignmentId ?? item.quizId}`}
                to={
                  item.assignmentId
                    ? assignmentGradingPath(item.courseId, item.assignmentId)
                    : generatePath(
                        APP_ROUTE_PATHS.courseCourseIdQuizzesQuizIdGrading,
                        {
                          courseId: String(item.courseId),
                          quizId: String(item.quizId),
                        },
                      )
                }
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {item.courseCode} · {item.pendingCount}{" "}
                    {item.kind.includes("Release")
                      ? "awaiting release"
                      : "submissions"}
                  </small>
                </span>
                <span className={local.action}>
                  {item.kind.includes("Release") ? "Review" : "Grade"}
                </span>
              </Link>
            ))}
          </div>
        ) : queue.isError || grading.isError ? (
          <TeachingState compact
            error={queue.error || grading.error}
            onRetry={() => {
              void queue.refetch();
              void grading.refetch();
            }}
          />
        ) : (
          <TeachingState compact empty="All caught up. No submissions waiting for review." />
        )}
      </Card>
      <Card
        title="Students needing support"
        meta={
          support.isSuccess ? (
            <TeachingBadge value={support.data?.length ? "ABSENT" : undefined}>
              {support.data?.length ?? 0} flagged
            </TeachingBadge>
          ) : null
        }
      >
        {support.isPending || support.isError || !support.data?.length ? (
          <TeachingState compact
            loading={support.isPending}
            error={support.error}
            empty="No students currently flagged for support."
            onRetry={() => void support.refetch()}
          />
        ) : (
          support.data.map((item) => (
            <Link
              className={local.row}
              key={`${item.courseId}-${item.studentUserId}`}
              to={
                registeredDestination(item.deepLink) ??
                coursePath(item.courseId)
              }
            >
              <div className={s.person}>
                <TeachingAvatar name={personName(item)} />
                <span>
                  <strong>{personName(item)}</strong>
                  <small>
                    {(item.reasons ?? []).map(teachingLabel).join(" · ") ||
                      item.courseTitle ||
                      "Review course context"}
                  </small>
                </span>
              </div>
              <span className={local.action}>Review</span>
            </Link>
          ))
        )}
      </Card>
      <Card title="Teaching alerts">
        {alerts.isPending || alerts.isError || !alerts.data?.items.length ? (
          <TeachingState compact
            loading={alerts.isPending}
            error={alerts.error}
            empty="No teaching alerts right now."
            onRetry={() => void alerts.refetch()}
          />
        ) : (
          alerts.data.items.map((item, index) => {
            const destination = registeredDestination(
              textValue(item, "deepLink", "destination"),
            );
            const content = (
              <>
                <span className={local.alertIcon}>
                  {textValue(item, "type", "alertType") ===
                  "SCHEDULE_CONFLICT" ? (
                    <TriangleAlert size={19} />
                  ) : (
                    <Bell size={19} />
                  )}
                </span>
                <span>
                  {textValue(item, "message", "title") ||
                    teachingLabel(textValue(item, "type", "alertType"))}
                </span>
              </>
            );
            return destination ? (
              <Link className={`${local.row} ${local.alertRow}`} to={destination} key={index}>
                {content}
              </Link>
            ) : (
              <div className={`${local.row} ${local.alertRow}`} key={index}>
                {content}
              </div>
            );
          })
        )}
      </Card>
      <Card title="My teaching courses" full>
        {courses.isPending || courses.isError || !courses.data?.length ? (
          <TeachingState compact
            loading={courses.isPending}
            error={courses.error}
            empty="No teaching courses assigned yet."
            onRetry={() => void courses.refetch()}
          />
        ) : (
          courses.data.map((item) => (
            <Link className={local.row} key={item.id} to={coursePath(item.id)}>
              <span>
                <strong>{item.title}</strong>
                <small>{item.courseCode}</small>
              </span>
              <ChevronRight size={20} />
            </Link>
          ))
        )}
      </Card>
      <Card
        title="Schedule requests"
        full
        meta={
          requests.isSuccess ? (
            <span className={s.muted}>
              {requests.data?.total ?? requests.data?.items.length} requests
            </span>
          ) : null
        }
      >
        {requests.isPending ||
        requests.isError ||
        !requests.data?.items.length ? (
          <TeachingState compact
            loading={requests.isPending}
            error={requests.error}
            empty="No schedule requests to review."
            onRetry={() => void requests.refetch()}
          />
        ) : (
          requests.data.items.map((item, index) => (
            <div
              className={local.row}
              key={optionalNumber(item, "requestId", "id") ?? index}
            >
              <span>
                <strong>{teachingLabel(textValue(item, "requestType"))}</strong>
                <small>
                  {[
                    textValue(item, "courseTitle", "courseCode"),
                    dateLabel(
                      textValue(
                        item,
                        "proposedOccurrenceDate",
                        "occurrenceDate",
                      ),
                    ),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </span>
              <div className={s.recordActions}>
                <TeachingBadge value={textValue(item, "status")} />
                {optionalNumber(item, "courseId") &&
                optionalNumber(item, "requestId", "id") ? (
                  <button
                    type="button"
                    className={s.textButton}
                    onClick={() => setSelected(item)}
                  >
                    Review
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </Card>
      {selected ? (
        <TeachingDialog
          title="Schedule request review"
          description={
            textValue(selected, "reason") ||
            "Review the requested change for this course."
          }
          onClose={() => setSelected(undefined)}
        >
          <ScheduleReview
            key={recordId(selected, "requestId", "id")}
            courseId={optionalNumber(selected, "courseId")!}
            request={selected}
            onSaved={async () => {
              await requests.refetch();
              setSelected(undefined);
            }}
          />
        </TeachingDialog>
      ) : null}
    </div>
  );
}
