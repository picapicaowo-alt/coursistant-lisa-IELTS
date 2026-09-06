import React from "react";
import styles from "./SubmissionForm.module.scss";
import {useAssignmentSubmitStore} from "../../stores/useAssignmentSubmitStore";
import {useTranslation} from "react-i18next";
import {FileEntity, SubmissionEntity} from "@/pages/DetailWorkspacePage/config";
import {PropertyForm} from "@/components/PropertyForm";
import {RichTextEditor} from "@/components/RichTextEditor";
import {FileSection} from "@/components/FileSection";
import {DictionaryArea} from "@/components/DictionaryArea";
import ReactMarkdown from "react-markdown";

export const SubmissionForm: React.FC = () => {
  const {t} = useTranslation("detailWorkspace");
  const {assignment, getRelated} = useAssignmentSubmitStore();
  
  const submission = React.useMemo(() => {
    const s: SubmissionEntity = getRelated("assignments", assignment.id, "assignmentSubmissions")[0];
    if (!s) return null;
    return s;
  }, [assignment, getRelated]);
  
  const submissionFiles = React.useMemo(() => {
    if (submission === null) return Array<{
      id: number;
      filename: string;
      mimeType: string;
      fileSize: number;
      updatedAt: Date;
    }>();
    const su: FileEntity[] = getRelated("submissions", submission.id, "submissionFiles");
    return su.map(s => {
      return {
        ...s,
      };
    });
  }, [submission]);
  
  const settings = React.useMemo(() => {
    const result: Record<string, string> = {};
    if (submission === null) {
      result[t("assignment.allowLateSubmission")] = assignment.settings.allowLateSubmission ? t("common:common.yes") : t("common:common.no");
      result[t("assignment.allowedResubmissionCount")] = assignment.settings.allowedResubmissionCount.toFixed();
    } else {
      result[t("assignmentSubmit.submittedAt")] = submission.updatedAt.toLocaleString('en-US');
      result[t("assignment.remainingResubmissions")] = Math.max(0, assignment.settings.allowedResubmissionCount - (submission.submissionCount)).toFixed();
    }
    return result;
  }, [assignment, submission]);
  
  return (
    <div className={styles.submissionSection}>
      {submission !== null ? (
        <React.Fragment>
          <PropertyForm title={t("assignmentSubmit.submissionContent")}>
            <ReactMarkdown>{submission.submissionContent}</ReactMarkdown>
          </PropertyForm>
          
          {submissionFiles.length > 0 &&
            <PropertyForm>
              <FileSection files={submissionFiles}
                           uploadFunction={async () => ""}
                           onUploaded={() => {
                           }}
                           disabled={true}/>
            </PropertyForm>
          }
        </React.Fragment>
      ) : (
        <React.Fragment>
          <PropertyForm title={t("assignmentSubmit.submit")}
                        transparent={true}>
            <RichTextEditor/>
          </PropertyForm>
          
          <PropertyForm title={t("detailWorkspace:assignmentSubmit.uploadFiles")}>
            <FileSection files={submissionFiles}
                         uploadFunction={async () => ""}
                         onUploaded={() => {
                         }}/>
          </PropertyForm>
        </React.Fragment>
      )}
      <DictionaryArea dictionary={settings}/>
    </div>
  );
};
