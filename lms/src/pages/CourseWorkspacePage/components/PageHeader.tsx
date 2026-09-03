import React, {useMemo} from "react";
import {useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import styles from "./PageHeader.module.scss";
import {useCourseWorkspaceStore} from "../stores/useCourseWorkspaceStore";
import {APP_ROUTE_PATHS} from '@/configs/routePaths';

interface PageHeaderProps {
  canEditCourse?: boolean;
  canManageMaterials?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  canEditCourse = false,
  canManageMaterials = false,
}) => {
  const navigate = useNavigate();
  const {t} = useTranslation("course");
  const {workspaceMode, setWorkspaceMode, course} = useCourseWorkspaceStore();
  
  const renderActionButtons = useMemo(() => {
    if (workspaceMode === "view") {
      return canEditCourse || canManageMaterials ? (
        <button
          className={styles.secondaryButton}
          onClick={() => setWorkspaceMode("edit")}
        >
          {canEditCourse ? t("detail.editCourse") : t("detail.manageContent")}
        </button>
      ) : null;
    }
    
    return (
      <React.Fragment>
        <button
          className={styles.cancelButton}
          onClick={() => {
            if (workspaceMode === "edit") setWorkspaceMode("view");
            if (workspaceMode === "create") navigate(APP_ROUTE_PATHS.course);
          }}
        >
          {t("addContent.cancelButton")}
        </button>
        <button
          className={styles.publishButton}
          onClick={() => {
            if (workspaceMode === 'edit') setWorkspaceMode('view');
          }}
        >
          {workspaceMode === "edit"
            ? t("addContent.saveButton")
            : t("addContent.publishButton")
          }
        </button>
      </React.Fragment>
    );
  }, [canEditCourse, canManageMaterials, workspaceMode, t, navigate, setWorkspaceMode]);
  
  return (
    <div className={styles.workspaceHeader}>
      <button
        className={styles.backButton}
        onClick={() => navigate(APP_ROUTE_PATHS.course)}
        aria-label={t("detail.backToCourses")}
        title={t("detail.backToCourses")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      
      <div className={styles.titleContainer}>
        <span className={`${styles.courseTitle} ${!course.name ? styles.placeholderTitle : ''}`}>
          {course.name || t('addContent.untitledCourse')}
        </span>
        <svg className={styles.titleArrow} width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      
      <div className={styles.headerActions}>
        {renderActionButtons}
      </div>
    </div>
  );
};
