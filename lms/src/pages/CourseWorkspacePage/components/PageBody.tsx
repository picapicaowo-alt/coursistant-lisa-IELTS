import {useTranslation} from 'react-i18next';
﻿import React from "react";
import {useParams} from "react-router-dom";
import styles from "./PageBody.module.scss";
import {CourseDetailView} from "./CourseDetailView";
import {CourseEditView} from "./CourseEditView";
import {InstructorCourseView} from './InstructorCourseView';
import {useCourseWorkspaceStore} from "../stores/useCourseWorkspaceStore";

interface PageBodyProps {
  instructorView?: boolean;
  canEditCourse?: boolean;
  canManageTeachingContent?: boolean;
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
  canManageTeachingContent = false,
  canCreateAssignments = false,
  canManageMaterials = false,
  canManageEvents = false,
  canManageGroups = false,
  canPostAnnouncements = false,
  canViewOwnGrades = false,
}) => {
  const {t: translate} = useTranslation();
  const {courseId} = useParams();
  const {workspaceMode} = useCourseWorkspaceStore();
  const isCourseRoute = Boolean(courseId);
  const canOpenEditor = canEditCourse || canManageMaterials;

  if (!isCourseRoute) {
    return (
      <div className={styles.contentArea}>
        <p className={styles.unavailable} role="status">
          {translate("course:workspace.noCourse")}</p>
      </div>
    );
  }

  if (instructorView) {
    return <div className={`${styles.contentArea} ${styles.instructorBody}`}><InstructorCourseView
      canEditCourse={canEditCourse} canManageMaterials={canManageMaterials}
      canManageTeachingContent={canManageTeachingContent}
      canCreateAssignments={canCreateAssignments} canManageEvents={canManageEvents}
      canManageGroups={canManageGroups} canPostAnnouncements={canPostAnnouncements}
    /></div>;
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
        key={`${courseId}:${instructorView ? 'instructor' : 'standard'}`}
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
