import React, {Suspense} from 'react';
import {useParams, useSearchParams} from 'react-router-dom';
import styles from './index.module.scss';
import {PageHeader} from "./components/PageHeader";
import {PageBody} from "./components/PageBody";
import {LoadingOverlay} from "@/components/LoadingOverlay";
import {useCourseEdit} from "./hooks/useCourseEdit";
import {useCourseWorkspaceStore} from "./stores/useCourseWorkspaceStore";
import {useCourseAccess} from '@/hooks/useCourseAccess';

const CourseWorkspacePage: React.FC = () => {
  return (
    <Suspense fallback={<LoadingOverlay/>}>
      <Container/>
    </Suspense>
  );
};

const Container: React.FC = () => {
  useCourseEdit();
  const [searchParams] = useSearchParams();
  const readingMaterial = Number(searchParams.get('materialId')) > 0;
  const workspaceMode = useCourseWorkspaceStore(state => state.workspaceMode);
  const setWorkspaceMode = useCourseWorkspaceStore(state => state.setWorkspaceMode);
  const setRole = useCourseWorkspaceStore(state => state.setRole);
  const {courseId} = useParams();
  const parsedCourseId = courseId ? Number(courseId) : null;
  const validCourseId = parsedCourseId !== null && Number.isInteger(parsedCourseId) && parsedCourseId > 0
    ? parsedCourseId
    : null;
  const access = useCourseAccess(validCourseId);

  // The workspace store is a module singleton, so the mode outlives the page
  // that set it — arriving here after the create screen would otherwise leave
  // the course showing the create layout. Opening a course always starts in
  // view mode.
  React.useEffect(() => {
    setWorkspaceMode("view");
  }, [courseId, setWorkspaceMode]);

  // The workspace store survives route changes. If an old instructor session
  // left it in edit mode, a Student or TA must not inherit that privileged UI.
  React.useEffect(() => {
    if (
      workspaceMode === 'edit'
      && access.isResolved
      && !access.canEditCourse
      && !access.canUploadMaterials
    ) {
      setWorkspaceMode('view');
    }
  }, [
    access.canEditCourse,
    access.canUploadMaterials,
    access.isResolved,
    setWorkspaceMode,
    workspaceMode,
  ]);

  React.useEffect(() => {
    if (access.isResolved) {
      setRole(access.canGrade ? 'teacher' : 'student');
    }
  }, [access.canGrade, access.isResolved, setRole]);

  return (
    <div className={`${styles.container} ${(access.isInstructor || (access.isStudent && workspaceMode === 'view')) && !readingMaterial ? styles.instructorOverview : ''}`}>
      {workspaceMode !== "detailWorkspace" && !readingMaterial && (
        <PageHeader
          instructorView={access.isInstructor}
          studentView={access.isStudent}
          canEditCourse={access.canEditCourse}
          canManageMaterials={access.canUploadMaterials}
        />
      )}
      {access.isLoading ? <LoadingOverlay/> : <PageBody
        instructorView={access.isInstructor}
        canEditCourse={access.canEditCourse}
        canManageTeachingContent={access.canManageTeachingContent}
        canCreateAssignments={access.canConfigureAssignments}
        canManageMaterials={access.canUploadMaterials}
        canManageEvents={access.canManageCourseEvents}
        canManageGroups={access.canManageGroups}
        canPostAnnouncements={access.canPostAnnouncements}
        canViewOwnGrades={access.isStudent}
      />}
    </div>
  );
}

export default CourseWorkspacePage;
