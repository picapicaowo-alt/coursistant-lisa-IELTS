import {useCourseAccess} from '@/hooks/useCourseAccess';
import { useTranslation } from 'react-i18next';
import React, {useEffect, useState} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import styles from "../CourseDetailView/index.module.scss";
import editStyles from "./index.module.scss";
import {useCourseWorkspaceData} from "../../hooks/useCourseWorkspaceData";
import {courseApiService} from "@/apis/services/course-api";
import {formatCourseName} from "@/utils/course";
import {ScheduleCard} from "../CourseDetailView/ScheduleCard";
import {WeekEditorList} from "./WeekEditorList";
import {WeekContentCard} from "./WeekContentCard";
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';

interface CourseEditViewProps {
  canEditStructure: boolean;
  canUploadMaterials: boolean;
  canManageEvents: boolean;
}

/**
 * Course detail, edit mode — see docs/design/14-course-edit-empty.png and 16.
 *
 * Same two-column shape as view mode, with the cards turned into editors. Two
 * of the design's four cards are absent, both because there is nothing behind
 * them:
 *
 *  - "Assignments are weighted by group". Weighted grade groups do not exist
 *    in the PRD, which gives a student per-item scores and no course total,
 *    and no endpoint stores a weight (B-3).
 *  - "Homework / Problem Set". Creating an assignment is possible, but this
 *    card needs the Lecture projection described by the current assignment
 *    contract. Its generic summary schema does not define that shape; the
 *    shared course Assignments tab remains the available entry point.
 *
 * The block editor behind "Course Content" is also not built. A week holds
 * materials, not rich text; there is no document to edit and no field to save
 * one into. Its AI affordances are out of scope for V1 regardless (B-4).
 */
export const CourseEditView: React.FC<CourseEditViewProps> = ({
  canEditStructure,
  canUploadMaterials,
  canManageEvents,
}) => {
  const {t: translate} = useTranslation();
  const {courseId, course, weeks, sessions, isLoading, isError, sessionsFailed, refetch} =
    useCourseWorkspaceData();
  const queryClient = useQueryClient();
  const materialAccess = useCourseAccess(courseId);
  const {user} = useRequiredAuth();

  const [activeWeekId, setActiveWeekId] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);

  useEffect(() => {
    if (weeks.length === 0) {
      if (activeWeekId !== null) setActiveWeekId(null);
      return;
    }
    if (activeWeekId === null || !weeks.some(week => week.id === activeWeekId)) {
      setActiveWeekId(weeks[0].id);
    }
  }, [weeks, activeWeekId]);

  const invalidate = () => {
    void queryClient.invalidateQueries({queryKey: ['course', courseId]});
    void queryClient.invalidateQueries({queryKey: ['course-weeks', courseId]});
  };

  const renameCourse = useMutation({
    // Declared above the guard that narrows courseId, so it checks again.
    // Throwing here lands in onError rather than unmounting the page.
    mutationFn: (title: string) => {
      if (courseId === null) throw new Error('No course to rename');
      return courseApiService.updateCourse(courseId, {title});
    },
    onSuccess: invalidate,
  });

  if (isLoading) return <div className={styles.status}>{translate("course:learning.loading")}</div>;

  // courseId is null only on a route with no course in it, which this screen
  // is never reached from — isError already covers it, and naming it here
  // lets the mutations below take a plain number.
  if (isError || !course || courseId === null) {
    return (
      <div className={styles.status} role="alert">
        <p>{translate("course:learning.loadFailed")}</p>
        <button type="button" className={styles.retry} onClick={refetch}>{translate("common:actions.tryAgain")}</button>
      </div>
    );
  }

  const currentTitle = course.title ?? course.name;
  const activeWeek = weeks.find((week) => week.id === activeWeekId) ?? null;

  const commitTitle = () => {
    const next = titleDraft?.trim();
    setTitleDraft(null);
    if (next && next !== currentTitle) renameCourse.mutate(next);
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.outline}>
        {titleDraft === null ? (
          <h1 className={styles.courseTitle}>
            {formatCourseName(course.courseCode, currentTitle)}
            {canEditStructure ? (
              <button
                type="button"
                className={editStyles.inlineEdit}
                onClick={() => setTitleDraft(currentTitle)}
                aria-label={translate("course:workspace.rename")}
              >
                ✎
              </button>
            ) : null}
          </h1>
        ) : (
          <input
            className={editStyles.titleInput}
            value={titleDraft}
            autoFocus
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitTitle();
              if (event.key === 'Escape') setTitleDraft(null);
            }}
          />
        )}

        {renameCourse.isError && (
          <p className={editStyles.error} role="alert">{translate("course:workspace.renameFailed")}</p>
        )}

        <div className={styles.divider}/>

        <WeekEditorList
          courseId={courseId}
          weeks={weeks}
          activeWeekId={activeWeekId}
          onSelect={setActiveWeekId}
          onChanged={invalidate}
          canEditStructure={canEditStructure}
        />
      </aside>

      <div className={styles.cards}>
        <WeekContentCard
          courseId={courseId}
          week={activeWeek}
          weeks={weeks}
          currentUserId={user.id}
          canManageExistingMaterials={false}
          canDeleteOwnPublishedMaterials={materialAccess.isTa}
          canUploadMaterials={canUploadMaterials}
          onChanged={invalidate}
        />
        <ScheduleCard sessions={sessions} failed={sessionsFailed} courseId={course.id} canManage={canManageEvents}/>
      </div>
    </div>
  );
};
