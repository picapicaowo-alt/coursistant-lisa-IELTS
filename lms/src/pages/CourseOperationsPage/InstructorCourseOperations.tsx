import {useTranslation} from 'react-i18next';

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
  { id: "occurrences", label: "Occurrences" },
  { id: "attendance", label: "Attendance" },
  { id: "reports", label: "Reports" },
  { id: "discussion", label: "Discussion" },
  { id: "content", label: "Content" },
] as const;
export function InstructorCourseOperations({
  courseId,
  title,
}: {
  courseId: number;
  title: string;
}) {
  const {t: translate} = useTranslation();
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
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link to={routes.course}>Course operations</Link>
            <span aria-hidden="true">/</span>
            <span>Teaching schedule</span>
          </nav>
          <h1>{title}</h1>
        </div>
        <Link to={routes.course} className={styles.textButton}>
          {translate("course:detail.backToCourses")}
        </Link>
      </div>
      <nav
        className={styles.primaryNav}
        aria-label="Course workspace shortcuts"
      >
        <Link to={path(routes.courseCourseId)}>Course overview</Link>
        <Link to={path(routes.courseCourseIdOperations)} aria-current="page">
          Teaching schedule
        </Link>
        <Link to={path(routes.courseCourseIdEvents)}>Course events</Link>
        <Link to={path(routes.rosterCourseId)}>Learner roster</Link>
        <Link to={path(routes.courseCourseIdGroups)}>Learning groups</Link>
        <Link to={path(routes.courseCourseIdGrades)}>Grades</Link>
        <Link to={path(routes.courseCourseIdAssignmentsNew)}>
          Create assignment
        </Link>
      </nav>
      <nav className={styles.tabs} aria-label="Course operation sections">
        {SECTIONS.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={section === item.id}
            onClick={() => select(item.id)}
          >
            {item.label}
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
          title="Leave unsaved attendance?"
          description="Your attendance changes have not been saved. Stay here to save them, or discard them and continue."
          onClose={() => setLeave(undefined)}
        >
          <div className={styles.actions}>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => setLeave(undefined)}
            >
              Keep editing
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
              Discard and continue
            </button>
          </div>
        </TeachingDialog>
      ) : null}
    </main>
  );
}
