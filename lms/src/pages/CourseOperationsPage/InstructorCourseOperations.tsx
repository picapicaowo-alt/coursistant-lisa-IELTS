import { useTranslation } from "react-i18next";

import { useEffect, useState } from "react";
import {
  generatePath,
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { TeachingDialog } from "@/components/TeachingWorkspace";
import { APP_ROUTE_PATHS as routes } from "@/configs/routePaths";
import { OccurrencePanel } from "./OccurrencePanel";
import { AttendancePanel } from "./AttendancePanel";
import { ReportsPanel } from "./ReportsPanel";
import { DiscussionsPanel } from "./DiscussionsPanel";
import { ContentPanel } from "./ContentPanel";
import styles from "@/components/TeachingWorkspace/index.module.scss";

const SECTIONS = [
  { id: "occurrences", labelKey: "operations:tabs.occurrences" },
  { id: "attendance", labelKey: "operations:tabs.attendance" },
  { id: "reports", labelKey: "operations:tabs.reports" },
  { id: "discussion", labelKey: "course:learning.tabs.discussion" },
  { id: "content", labelKey: "operations:tabs.content" },
] as const;
export function InstructorCourseOperations({
  courseId,
  title,
}: {
  courseId: number;
  title: string;
}) {
  const { t: translate } = useTranslation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState({ dirty: false, busy: false });
  const [leave, setLeave] = useState<() => void>();
  useEffect(() => {
    if (!editing.dirty && !editing.busy) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [editing.dirty, editing.busy]);
  const guarded = (action: () => void) => {
    if (editing.busy) return;
    if (editing.dirty) setLeave(() => action);
    else action();
  };
  const section =
    SECTIONS.find((item) => item.id === params.get("section"))?.id ??
    "occurrences";
  const path = (route: string) =>
    generatePath(route, { courseId: String(courseId) });
  const select = (value: string, occurrenceId?: number) =>
    guarded(() =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set("section", value);
        if (occurrenceId) next.set("occurrence", String(occurrenceId));
        return next;
      }),
    );
  return (
    <main
      className={styles.page}
      onClickCapture={(event) => {
        const link =
          event.target instanceof Element
            ? event.target.closest<HTMLAnchorElement>("a[href]")
            : null;
        if (
          !link ||
          (!editing.dirty && !editing.busy) ||
          link.target === "_blank"
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        guarded(() => navigate(`${link.pathname}${link.search}${link.hash}`));
      }}
    >
      <div className={styles.heading}>
        <div>
          <nav
            className={styles.breadcrumb}
            aria-label={translate("operations:breadcrumb")}
          >
            <Link to={routes.course}>
              {translate("course:catalogue.operations")}
            </Link>
            <span aria-hidden="true">/</span>
            <span>{translate("operations:teachingSchedule")}</span>
          </nav>
          <h1>{title}</h1>
        </div>
        <Link to={routes.course} className={styles.textButton}>
          {translate("course:detail.backToCourses")}
        </Link>
      </div>
      <nav
        className={styles.primaryNav}
        aria-label={translate("operations:shortcuts")}
      >
        <Link to={path(routes.courseCourseId)}>
          {translate("course:learning.overview")}
        </Link>
        <Link to={path(routes.courseCourseIdOperations)} aria-current="page">
          {translate("operations:teachingSchedule")}
        </Link>
        <Link to={path(routes.courseCourseIdEvents)}>
          {translate("operations:courseEvents")}
        </Link>
        <Link to={path(routes.rosterCourseId)}>
          {translate("operations:learnerRoster")}
        </Link>
        <Link to={path(routes.courseCourseIdGroups)}>
          {translate("operations:learningGroups")}
        </Link>
        <Link to={path(routes.courseCourseIdGrades)}>
          {translate("course:grades.label")}
        </Link>
        <Link to={path(routes.courseCourseIdAssignmentsNew)}>
          {translate("operations:createAssignment")}
        </Link>
      </nav>
      <nav
        className={styles.tabs}
        aria-label={translate("operations:sections")}
      >
        {SECTIONS.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={section === item.id}
            onClick={() => select(item.id)}
          >
            {translate(item.labelKey)}
          </button>
        ))}
      </nav>
      {section === "occurrences" ? (
        <OccurrencePanel
          courseId={courseId}
          onAttendance={(id) => select("attendance", id)}
        />
      ) : null}
      {section === "attendance" ? (
        <AttendancePanel
          courseId={courseId}
          selectedId={Number(params.get("occurrence")) || undefined}
          onSelect={(id) => select("attendance", id)}
          onEditing={setEditing}
        />
      ) : null}
      {section === "reports" ? <ReportsPanel courseId={courseId} /> : null}
      {section === "discussion" ? (
        <DiscussionsPanel courseId={courseId} />
      ) : null}
      {section === "content" ? <ContentPanel courseId={courseId} /> : null}
      {leave ? (
        <TeachingDialog
          title={translate("operations:leaveAttendance")}
          description={translate("operations:leaveAttendanceHelp")}
          onClose={() => setLeave(undefined)}
        >
          <div className={styles.actions}>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => setLeave(undefined)}
            >
              {translate("operations:keepEditing")}
            </button>
            <button
              className={styles.danger}
              type="button"
              onClick={() => {
                setEditing({ dirty: false, busy: false });
                setLeave(undefined);
                leave();
              }}
            >
              {translate("operations:discardContinue")}
            </button>
          </div>
        </TeachingDialog>
      ) : null}
    </main>
  );
}
