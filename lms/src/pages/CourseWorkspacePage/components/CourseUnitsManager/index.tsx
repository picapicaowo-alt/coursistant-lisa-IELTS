import React from 'react';
import {useTranslation} from 'react-i18next';
import styles from './index.module.scss';
import {CourseUnitItem} from "./CourseUnitItem";
import {useCourseWorkspaceStore} from "../../stores/useCourseWorkspaceStore";
import {CourseUnitEntity} from "../../workspaceEntities";
import {useQueryClient} from '@tanstack/react-query';
import {courseApiService} from "@/apis/services/course-api";
import {useRequiredAuth} from "@/contexts/RequiredAuthContext";

interface CourseUnitsManagerProps {
  activeUnitId: number | null;
  setActiveUnitId: (id: number | null) => void;
}

export const CourseUnitsManager: React.FC<CourseUnitsManagerProps> = ({
                                                                        activeUnitId,
                                                                        setActiveUnitId,
                                                                      }) => {
  const {t} = useTranslation("course");
  const {course, getRelated, delete: deleteEntity, workspaceMode} = useCourseWorkspaceStore();
  
  const courseUnits: CourseUnitEntity[] = getRelated("courses", course.id, "courseCourseUnits");
  const {user} = useRequiredAuth();
  const queryClient = useQueryClient();
  return (
    <React.Fragment>
      <div
        className={`${styles.courseHeader} ${activeUnitId === null ? styles.active : ''}`}
        onClick={() => {
          setActiveUnitId(null);
        }}
      >
        <div className={styles.courseHeaderContent}>
          <div className={styles.courseIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <div className={styles.courseInfo}>
            <h3 className={styles.courseName}>
              {course.name || t('addContent.placeholderCourseName')}
            </h3>
            <div className={styles.courseMeta}>
              <span className={styles.unitCount}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 3h18v18H3zM8 7v10M16 7v10"/>
                </svg>
                {courseUnits.length} {courseUnits.length === 1 ? t('card.weeksSingular') : t('card.weeksPlural')}
              </span>
              {course.id && (
                <>
                  <span>•</span>
                  <span>{course.id}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className={styles.divider}/>
      
      <div className={styles.unitsContainer}>
        {courseUnits.length > 0 ? (
          <div className={styles.unitsList}>
            {courseUnits.map((unit, index) => (
              <CourseUnitItem
                key={unit.id}
                unit={unit}
                sortOrder={index}
                isActive={activeUnitId === unit.id}
                onSelect={() => setActiveUnitId(unit.id)}
                onDelete={() => {
                  // A course unit is a week. Deletion only succeeds on an
                  // empty one — the API refuses a week that still holds
                  // materials — so the local removal below can diverge from
                  // the server. This screen is superseded by CourseEditView.
                  void courseApiService.deleteWeek(course.id, unit.id);
                  
                  const assignments = getRelated("courseUnits", unit.id, "courseUnitAssignments");
                  assignments.forEach((a) => deleteEntity("assignments", a.id));
                  deleteEntity("courseUnits", unit.id);
                  if (activeUnitId === unit.id) {
                    setActiveUnitId(null);
                  }
                  
                  queryClient.invalidateQueries({queryKey: ['course-detail', course.id, user.id]}).then();
                }}
                t={t}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M8 7V3m8 4V3M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4m-6-4 2 2 4-4"/>
              </svg>
            </div>
            <p className={styles.emptyText}>
              {t('list.noCourseUnits')}
            </p>
          </div>
        )}
      </div>
      
      {(workspaceMode === "edit") && (
        <div className={styles.addUnitSection}>
          <button
            className={styles.addUnitButton}
            onClick={() => {
            }}
          >
            <span className={styles.addIcon}>+</span>
            {t('schedule.addNew')}
          </button>
        </div>
      )}
    </React.Fragment>
  );
};
