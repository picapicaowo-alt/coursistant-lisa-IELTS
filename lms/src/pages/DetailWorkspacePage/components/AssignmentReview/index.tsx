import React, {useState} from "react";
import {formatNumber} from '@/i18n/formatting';
import styles from "./index.module.scss";
import {MainContent} from "./MainContent";
import {useTranslation} from "react-i18next";
import {StudentItem} from "@/pages/DetailWorkspacePage/components/AssignmentReview/StudentItem";
import {useAssignmentReviewStore} from "@/pages/DetailWorkspacePage/stores/useAssignmentReviewStore";
import {PropertyForm} from "@/components/PropertyForm";
import {SubmissionEntity} from "@/pages/DetailWorkspacePage/config";

export const AssignmentReview: React.FC = () => {
  const {t} = useTranslation('detailWorkspace');
  const {assignment, getRelated} = useAssignmentReviewStore();
  
  const submissions: SubmissionEntity[] = React.useMemo(() => {
    return getRelated("assignments", assignment.id, "assignmentSubmissions");
  }, [assignment, getRelated]);
  
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(-1);
  
  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <PropertyForm
          title={t('operations:teacher.submissions', {count: submissions.length, number: formatNumber(submissions.length)})}
        >
          {submissions.map((student) => (
            <StudentItem key={student.id} submission={student}
                         selected={student.id === selectedSubmissionId}
                         onSelected={(studentId) => {
                           setSelectedSubmissionId(studentId);
                         }}
            />
          ))}
        </PropertyForm>
      </div>
      {selectedSubmissionId !== -1 ?
        <MainContent selectedSubmissionId={selectedSubmissionId}/> :
        <React.Fragment>
          <div className={styles.noStudent}>
            <span>{t('courseTools:groups.selectStudent')}</span>
          </div>
        </React.Fragment>
      }
    </div>
  );
};
