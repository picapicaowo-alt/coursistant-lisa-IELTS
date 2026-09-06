import {useTranslation} from 'react-i18next';
import {statusLabel} from '@/i18n/presentation';
import React, {useState} from "react";
import styles from "./index.module.scss";
import {AssignmentSummary} from "@/apis";
import {formatDeadline} from "@/utils/datetime";
import {generatePath, Link} from 'react-router-dom';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';

interface AssignmentsCardProps {
  courseId: number;
  assignments: AssignmentSummary[];
  failed: boolean;
  canCreate?: boolean;
}

/** Category choices come from the returned summaries, so the filter never invents content. */
export const AssignmentsCard: React.FC<AssignmentsCardProps> = ({courseId, assignments, failed, canCreate = false}) => {
  const {t: translate} = useTranslation();
  const [learningType, setLearningType] = useState('');
  const categories = Array.from(new Set(assignments.flatMap(item => item.learningType ? [item.learningType] : [])));
  const visibleAssignments = learningType ? assignments.filter(item => item.learningType === learningType) : assignments;
  return (
  <section className={styles.card}>
    <div className={styles.cardHeader}>
      <h2 className={styles.cardTitle}>{translate("course:workspace.homework")}</h2>
      {canCreate ? <Link to={generatePath(APP_ROUTE_PATHS.courseCourseIdAssignmentsNew, {courseId: String(courseId)})} className={styles.addButton}>{translate("course:schedule.addNew")}</Link> : null}
    </div>

    {categories.length ? <label className={styles.assignmentFilter}>{translate("course:workspace.learningType")}<select value={learningType} onChange={event => setLearningType(event.target.value)}><option value="">{translate("advising:actionTasks.allTypes")}</option>{categories.map(category => <option key={category} value={category}>{statusLabel(category)}</option>)}</select></label> : null}
    {failed ? (
      <p className={styles.cardEmpty} role="alert">{translate("course:workspace.assignmentsFailed")}</p>
    ) : visibleAssignments.length === 0 ? (
      <p className={styles.cardEmpty}>{translate("course:workspace.assignmentsEmpty")}</p>
    ) : (
      <ul className={styles.rowList}>
        {visibleAssignments.map((assignment) => (
          <li key={assignment.id} className={styles.row}>
            <Link
              to={generatePath(APP_ROUTE_PATHS.courseCourseIdAssignmentsAssignmentId, {courseId: String(courseId), assignmentId: String(assignment.id)})}
              className={styles.rowLink}
            >
              {assignment.learningType ? <span className={styles.groupBadge}>{statusLabel(assignment.learningType)}</span> : null}
              {assignment.submissionType === "Group" && (
                <span className={styles.groupBadge}>{translate("course:assignmentSubmissionDetail.group")}</span>
              )}
              <span className={styles.rowTitle}>{assignment.title}</span>
              <span className={styles.rowMeta}>
                {formatDeadline(assignment.dueAtLocal, assignment.timezone)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </section>
);
};
