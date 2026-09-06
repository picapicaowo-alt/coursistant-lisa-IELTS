import React from "react";
import {useTranslation} from "react-i18next";
import {FileSection} from "@/components/FileSection";
import styles from "./index.module.scss";
import {useAssignmentEditStore} from "../../stores/useAssignmentEditStore";
import {ActionButtons} from "./ActionButtons";
import {PropertyRow} from "@/components/PropertyRow";
import {PropertyForm} from "@/components/PropertyForm";
import {RichTextEditor} from "@/components/RichTextEditor";
import {IntegerInput} from "@/components/IntegerInput";
import {EnglishDateTimeInput} from '@/components/EnglishDateInput';

const DOCUMENT_CATEGORIES = ["Homework", "Lab", "Project", "Others"];

const toLocalDateTimeValue = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

export const AssignmentEdit: React.FC = () => {
  const {t} = useTranslation("detailWorkspace");
  
  const {update, assignment} = useAssignmentEditStore();
  
  return (
    <form
      className={styles.container}
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <div className={styles.titleContainer}>
        <input
          type="text"
          value={assignment.title}
          onChange={(e) => {
            update("assignments", assignment.id, {
              title: e.target.value,
            })
          }}
          placeholder={t("course:assignmentModal.titlePlaceholder")}
          className={styles.titleInput}
          maxLength={50}
        />
      </div>
      
      <PropertyForm title={t("course:info.basic")}>
        <PropertyRow title={t("course:assignmentModal.dueTimeLabel")}>
          <EnglishDateTimeInput
            value={toLocalDateTimeValue(assignment.dueTime)}
            onChangeValue={(value) => {
              if (value) update("assignments", assignment.id, {dueTime: new Date(value)});
            }}
            className={styles.datetimeInput}
            required
          />
        </PropertyRow>
        
        <PropertyRow title={t("common:fields.type")}>
          <select
            value={assignment.type}
            onChange={(e) => {
              update("assignments", assignment.id, {type: e.target.value});
            }}
            className={styles.typeSelect}
          >
            {DOCUMENT_CATEGORIES.map((type) => (
              <option key={type} value={type}>
                {t(`course:assignmentModal.categories.${type.toLowerCase()}`)}
              </option>
            ))}
          </select>
        </PropertyRow>
      </PropertyForm>
      
      <PropertyForm title={t('assignmentEdit.settings')}>
        <PropertyRow title={t('assignmentEdit.allowLateSubmission')}
                     description={t('assignmentEdit.allowLateSubmissionHint')}
        >
          <input
            type="checkbox"
            checked={assignment.settings.allowLateSubmission}
            onChange={(e) => {
              update("assignments", assignment.id, {
                settings: {
                  allowedResubmissionCount: assignment.settings.allowedResubmissionCount,
                  allowLateSubmission: e.target.checked,
                }
              });
            }}
            className={styles.settingCheckbox}
          />
        </PropertyRow>
        <PropertyRow title={t('assignmentEdit.allowedResubmissionCount')}
                     description={t('assignmentEdit.allowedResubmissionCountHint')}
        >
          <IntegerInput value={assignment.settings.allowedResubmissionCount}
                        onUpdate={(value) => {
                          update("assignments", assignment.id, {
                            settings: {
                              allowedResubmissionCount: value,
                              allowLateSubmission: assignment.settings.allowLateSubmission,
                            }
                          });
                        }}/>
        </PropertyRow>
      </PropertyForm>
      
      <PropertyForm title={t('assignmentEdit.description')} transparent={true}>
        <RichTextEditor
          content={assignment.description}
          placeholder={t("course:blockEditor.placeholder")}
          onChange={(value) => {
            update("assignments", assignment.id, {
              description: value,
            })
          }}
        />
      </PropertyForm>
      
      <PropertyForm title={t('assignmentEdit.attachments')} transparent={true}>
        <FileSection
          files={[]}
          uploadFunction={async () => ""}
          onUploaded={() => {
          }}
        />
      </PropertyForm>
      
      <ActionButtons/>
    </form>
  );
};
