import React from "react";
import {useParams} from "react-router-dom";
import styles from "./PageBody.module.scss";
import {CourseDetailView} from "./CourseDetailView";
import {CourseEditView} from "./CourseEditView";
import {useCourseWorkspaceStore} from "../stores/useCourseWorkspaceStore";

interface PageBodyProps {
  instructorView?: boolean;
  canEditCourse?: boolean;
  canCreateAssignments?: boolean;
  canManageMaterials?: boolean;
  canManageEvents?: boolean;
  canManageGroups?: boolean;
  canPostAnnouncements?: boolean;
  canViewOwnGrades?: boolean;
}

export const PageBody: React.FC<PageBodyProps> = ({
  instructorView = false,
  canEditCourse = false,
  canCreateAssignments = false,
  canManageMaterials = false,
  canManageEvents = false,
  canManageGroups = false,
  canPostAnnouncements = false,
  canViewOwnGrades = false,
}) => {
  const {courseId} = useParams();
  const {workspaceMode} = useCourseWorkspaceStore();
  const isCourseRoute = Boolean(courseId);
  const canOpenEditor = canEditCourse || canManageMaterials;

  if (!isCourseRoute) {
    return (
      <div className={styles.contentArea}>
        <p className={styles.unavailable} role="status">
          This course workspace is not available without a course in the URL.
        </p>
      </div>
    );
  }

  if (workspaceMode === "edit" && canOpenEditor) {
    return (
      <div className={styles.contentArea}>
        <CourseEditView
          canEditStructure={canEditCourse}
          canUploadMaterials={canManageMaterials}
          canManageEvents={canManageEvents}
        />
      </div>
    );
  }

  return (
    <div className={`${styles.contentArea} ${instructorView ? styles.instructorBody : ''}`}>
      <CourseDetailView
        key={instructorView ? 'instructor' : 'standard'}
        instructorView={instructorView}
        canCreateAssignments={canCreateAssignments}
        canManageEvents={canManageEvents}
        canManageGroups={canManageGroups}
        canPostAnnouncements={canPostAnnouncements}
        canViewOwnGrades={canViewOwnGrades}
      />
    </div>
  );
};
