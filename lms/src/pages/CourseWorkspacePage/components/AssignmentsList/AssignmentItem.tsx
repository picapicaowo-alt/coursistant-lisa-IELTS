import React, {useCallback, useEffect, useMemo, useState} from "react";
import styles from "./AssignmentItem.module.scss";
import {IconButton} from "@/components/IconButton";
import {AssignmentPreview} from "../../types";
import {useTranslation} from "react-i18next";
import {useCourseWorkspaceStore} from "../../stores/useCourseWorkspaceStore";

interface AssignmentItemProps {
  activeUnitId: number | null;
  assignment: AssignmentPreview;
}

export const AssignmentItem: React.FC<AssignmentItemProps> = ({
                                                                activeUnitId,
                                                                assignment
                                                              }) => {
  const {t} = useTranslation("course");
  const {
    workspaceMode,
    role,
    openDetailWorkspace,
  } = useCourseWorkspaceStore();
  
  if (activeUnitId === null) throw new Error("Unknown unit");
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(assignment.title);
  
  useEffect(() => {
    setEditedTitle(assignment.title);
  }, [assignment.title]);
  
  const saveTitle = useCallback(() => {
    if (editedTitle.trim() !== assignment.title && editedTitle.trim()) {
      // setAssignmentDetail({title: editedTitle.trim()});
    }
    setIsEditingTitle(false);
  }, [editedTitle, assignment.title]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveTitle();
    } else if (e.key === 'Escape') {
      setEditedTitle(assignment.title);
      setIsEditingTitle(false);
    }
  };
  
  const handleBlur = () => {
    saveTitle();
  };
  
  const getBadgeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      homework: styles.homeworkBadge,
      quiz: styles.quizBadge,
      project: styles.projectBadge,
      exam: styles.examBadge,
      lab: styles.labBadge
    };
    return colorMap[type.toLowerCase()] || styles.defaultBadge;
  };
  
  const ActionButtonsList = useMemo(() => {
    if (workspaceMode === "view") {
      return (
        <React.Fragment>
          <IconButton
            type={"view"}
            onClick={(e) => {
              e.stopPropagation();
              if (role === "teacher") {
                openDetailWorkspace({
                  type: "teacher-assignment-review",
                  query: {
                    assignmentId: assignment.id
                  }
                });
              } else {
                openDetailWorkspace({
                  type: "student-assignment",
                  query: {
                    assignmentId: assignment.id
                  }
                })
              }
            }}
            title={t('common:actions.viewDetails')}
          />
        </React.Fragment>
      );
    }
    return (
      <React.Fragment>
        <IconButton
          type={"edit"}
          onClick={(e) => {
            e.stopPropagation();
            if (activeUnitId === null) return;
            openDetailWorkspace({
              type: "teacher-assignment-edit",
              query: {
                assignmentId: assignment.id,
              }
            });
          }}
          title={t('common:actions.edit')}
        />
        <IconButton
          type={"delete"}
          onClick={(e) => {
            e.stopPropagation();
            if (activeUnitId === null) return;
          }}
          title={t('common:actions.delete')}
        />
      </React.Fragment>
    );
  }, [workspaceMode, openDetailWorkspace, activeUnitId, assignment.id, t]);
  
  const handleItemClick = (e: React.MouseEvent) => {
    if (workspaceMode !== 'view' && !e.defaultPrevented) {
      const target = e.target as HTMLElement;
      const isButton = target.closest(`.${styles.actionButtonsList}`) ||
        target.closest('button') ||
        target.tagName === 'BUTTON';
      
      if (!isButton && !isEditingTitle) {
        setIsEditingTitle(true);
        e.preventDefault();
      }
    }
  };
  
  return (
    <div
      key={assignment.id}
      className={`${styles.assignmentItem} ${workspaceMode === 'view' ? styles.viewMode : styles.editMode}`}
      onClick={handleItemClick}
    >
      <div className={styles.assignmentInfo}>
        <div className={styles.assignmentType}>
          <span className={`${styles.typeBadge} ${getBadgeColor(assignment.type)}`}>
            {assignment.type}
          </span>
        </div>
        
        <div className={styles.titleContainer}>
          {workspaceMode === 'view' ? (
            <React.Fragment>
              <span className={styles.assignmentTitle}>
                {assignment.title}
              </span>
              {assignment.dueTime && (
                <span className={styles.dueTime}>
                  {assignment.dueTime}
                </span>
              )}
            </React.Fragment>
          ) : (
            <React.Fragment>
              {isEditingTitle ? (
                <input
                  type="text"
                  className={styles.titleInput}
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span className={styles.editableTitle}>
                  {assignment.title}
                </span>
              )}
              <span className={styles.dueTime}>
                {assignment.dueTime}
              </span>
            </React.Fragment>
          )}
        </div>
      </div>
      
      <div className={styles.actionButtonsList}>
        {ActionButtonsList}
      </div>
    </div>
  );
};
