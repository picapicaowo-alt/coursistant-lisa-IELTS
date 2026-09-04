import { formatInstructorName } from "@/utils/personName";
import { useState } from "react";
import { generatePath, Link, useSearchParams } from "react-router-dom";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { useCourseWorkspaceData } from "../../hooks/useCourseWorkspaceData";
import { useCourseWorkspaceStore } from "../../stores/useCourseWorkspaceStore";
import { useRequiredAuth } from "@/contexts/RequiredAuthContext";
import { TeachingBadge, TeachingState } from "@/components/TeachingWorkspace";
import { APP_ROUTE_PATHS as routes } from "@/configs/routePaths";
import { WeekWorkspace } from "./WeekWorkspace";
import { CourseSettings } from "./CourseSettings";
import { MaterialReader } from "../CourseDetailView/MaterialReader";
import { AssignmentsCard } from "../CourseDetailView/AssignmentsCard";
import { QuizzesCard } from "../CourseDetailView/QuizzesCard";
import { AnnouncementsCard } from "../CourseDetailView/AnnouncementsCard";
import { DiscussionPanel } from "../CourseDetailView/DiscussionPanel";
import { ScheduleCard } from "../CourseDetailView/ScheduleCard";
import { EventsCard } from "../CourseDetailView/EventsCard";
import { GroupsCard } from "../CourseDetailView/GroupsCard";
import { RosterCard } from "../CourseDetailView/RosterCard";
import { SyllabusCard } from "../SyllabusCard";
import styles from "./index.module.scss";

const TABS = [
  ["courses", "Course content"],
  ["assignments", "Assignments & Quizzes"],
  ["discussion", "Discussion"],
  ["announcements", "Announcements"],
  ["schedule", "Schedule & Groups"],
  ["syllabus", "Syllabus"],
] as const;
type Tab = (typeof TABS)[number][0];
export function InstructorCourseView({
  canEditCourse,
  canManageMaterials,
  canCreateAssignments,
  canManageEvents,
  canManageGroups,
  canPostAnnouncements,
}: {
  canEditCourse: boolean;
  canManageMaterials: boolean;
  canCreateAssignments: boolean;
  canManageEvents: boolean;
  canManageGroups: boolean;
  canPostAnnouncements: boolean;
}) {
  const data = useCourseWorkspaceData();
  const { user } = useRequiredAuth();
  const { workspaceMode, setWorkspaceMode } = useCourseWorkspaceStore();
  const [params, setParams] = useSearchParams();
  const [scheduleSection, setScheduleSection] = useState<
    "schedule" | "groups" | "members"
  >("schedule");
  const activeTab: Tab =
    TABS.find(([id]) => id === params.get("tab"))?.[0] ?? "courses";
  const setTab = (tab: Tab) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", tab);
      next.delete("materialId");
      return next;
    });
  const openMaterial = (id?: number) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("materialId", String(id));
      else next.delete("materialId");
      return next;
    });
  const selectWeek = (id: number) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("weekId", String(id));
        return next;
      },
      { replace: true },
    );
  if (data.isLoading) return <TeachingState loading />;
  if (data.isError || !data.course)
    return (
      <div className={styles.page}>
        <TeachingState
          error={
            new Error(
              data.isUnavailable
                ? "This course does not exist, or you do not have access."
                : "This course could not be loaded.",
            )
          }
          onRetry={data.isUnavailable ? undefined : data.refetch}
        />
      </div>
    );
  const { course, weeks } = data;
  const path = (route: string) =>
    generatePath(route, { courseId: String(course.id) });
  const writable = course.state !== "Archived";
  const materialId = Number(params.get("materialId"));
  const ordered = [...weeks].sort(
    (a, b) => (a.orderPosition ?? 0) - (b.orderPosition ?? 0),
  );
  if (materialId > 0)
    return (
      <MaterialReader
        courseId={course.id}
        title={course.title || course.name}
        weeks={ordered}
        materialId={materialId}
        onSelect={openMaterial}
        onClose={() => openMaterial()}
        onDiscussion={() => setTab("discussion")}
      />
    );
  return (
    <div className={styles.page}>
      <header className={styles.courseHeader}>
        <div>
          <h1>{course.title || course.name || course.courseCode}</h1>
          {course.description ? (
            <p className={styles.description}>{course.description}</p>
          ) : null}
          <div className={styles.courseContext}>
            <span>
              Course code <strong>{course.courseCode}</strong>
            </span>
            <span>
              Instructor{" "}
              <strong>
                {formatInstructorName(course.primaryInstructor, "Not assigned")}
              </strong>
            </span>
            <span>
              Term{" "}
              <strong>
                {[course.termStartDate, course.termEndDate]
                  .filter(Boolean)
                  .join(" – ") || "Not provided"}
              </strong>
            </span>
            <TeachingBadge value={course.state}>{course.state}</TeachingBadge>
          </div>
        </div>
        <section
          className={styles.courseSummary}
          aria-label="Course content totals"
        >
          <div className={styles.summaryTitle}>
            <span>
              <BookOpen size={20} />
            </span>
            Course content
          </div>
          <dl>
            {[
              ["Learning units", weeks.length],
              [
                "Assignments",
                data.assignmentsFailed
                  ? "Unavailable"
                  : data.assignmentsLoading
                    ? "…"
                    : data.assignments.length,
              ],
              [
                "Quizzes",
                data.quizzesFailed
                  ? "Unavailable"
                  : data.quizzesLoading
                    ? "…"
                    : data.quizzes.length,
              ],
            ].map(([label, count]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
        </section>
      </header>
      <nav className={styles.tabs} aria-label="Course sections">
        {TABS.map(([id, title]) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === activeTab}
            onClick={() => setTab(id)}
          >
            {title}
          </button>
        ))}
      </nav>
      {activeTab === "courses" ? (
        <WeekWorkspace
          courseId={course.id}
          weeks={ordered}
          selectedId={Number(params.get("weekId")) || undefined}
          onSelect={selectWeek}
          onOpenMaterial={openMaterial}
          canEdit={canEditCourse && writable}
          canUpload={canManageMaterials && writable}
          currentUserId={user.id}
        />
      ) : null}
      {activeTab === "assignments" ? (
        <div className={styles.sectionStack}>
          <div className={styles.sectionIntro}>
            <p>Manage coursework, assessments and feedback.</p>
            <Link
              className={styles.textButton}
              to={path(routes.courseCourseIdGrades)}
            >
              Course grades
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className={styles.pairedPanels}>
            <AssignmentsCard
              courseId={course.id}
              assignments={data.assignments}
              failed={data.assignmentsFailed}
              canCreate={canCreateAssignments && writable}
            />
            <QuizzesCard
              courseId={course.id}
              quizzes={data.quizzes}
              failed={data.quizzesFailed}
              canCreate={canCreateAssignments && writable}
            />
          </div>
        </div>
      ) : null}
      {activeTab === "discussion" ? (
        <div className={styles.supportingSurface}>
          <DiscussionPanel courseId={course.id} />
        </div>
      ) : null}
      {activeTab === "announcements" ? (
        <div className={styles.supportingSurface}>
          <AnnouncementsCard
            courseId={course.id}
            announcements={data.announcements}
            failed={data.announcementsFailed}
            canManage={canPostAnnouncements && writable}
          />
        </div>
      ) : null}
      {activeTab === "syllabus" ? (
        <div className={styles.supportingSurface}>
          <SyllabusCard
            courseId={course.id}
            canManage={canEditCourse && writable}
          />
        </div>
      ) : null}
      {activeTab === "schedule" ? (
        <div className={styles.sectionStack}>
          <div className={styles.sectionIntro}>
            <nav className={styles.subnav} aria-label="Schedule sections">
              {(
                [
                  ["schedule", "Schedule"],
                  ["groups", "Groups"],
                  ["members", "Members"],
                ] as const
              ).map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={scheduleSection === id}
                  onClick={() => setScheduleSection(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <Link
              className={styles.textButton}
              to={path(routes.courseCourseIdOperations)}
            >
              Classes, attendance & reports
              <ArrowUpRight size={16} />
            </Link>
          </div>
          {scheduleSection === "schedule" ? (
            <div className={styles.pairedPanels}>
              <ScheduleCard
                sessions={data.sessions}
                failed={data.sessionsFailed}
                courseId={course.id}
                canManage={canManageEvents && writable}
              />
              <EventsCard
                courseId={course.id}
                events={data.events}
                failed={data.eventsFailed}
                canManage={canManageEvents && writable}
              />
            </div>
          ) : null}
          {scheduleSection === "groups" ? (
            <div className={styles.supportingSurface}>
              <GroupsCard
                courseId={course.id}
                groupSets={data.groupSets}
                failed={data.groupSetsFailed}
                canManage={canManageGroups && writable}
              />
            </div>
          ) : null}
          {scheduleSection === "members" ? (
            <div className={styles.supportingSurface}>
              <RosterCard courseId={course.id} />
            </div>
          ) : null}
        </div>
      ) : null}
      {workspaceMode === "edit" && canEditCourse ? (
        <CourseSettings
          course={course}
          writable={writable}
          onClose={() => setWorkspaceMode("view")}
        />
      ) : null}
    </div>
  );
}
