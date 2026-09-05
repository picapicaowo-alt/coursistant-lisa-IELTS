import React from 'react';
import {CollapsibleSection} from '@/components/CollapsibleSection';
import {useTranslation} from 'react-i18next';
import styles from './Editor.module.scss';
import {RichTextEditor} from "@/components/RichTextEditor";
import {useCourseWorkspaceStore} from "../../stores/useCourseWorkspaceStore";
import {PropertyRow} from "@/components/PropertyRow";
import {PropertyForm} from "@/components/PropertyForm";

export const Editor: React.FC = () => {
  const {t} = useTranslation('course');
  const {course, update} = useCourseWorkspaceStore();

  return (
    <div className={styles.courseInfoEditor}>
      <PropertyForm title={t('course:info.basic')} columns={2}>
        <PropertyRow title={t('course:form.codeLabel')}>
          <input
            type="text"
            value={course.id}
            className={styles.textInput}
            placeholder="CS101"
            disabled={false}
          />
        </PropertyRow>

        <PropertyRow title={t('course:form.titleLabel')}>
          <input
            type="text"
            value={course.name}
            onChange={(e) => update("courses", course.id, {name: e.target.value})}
            className={styles.textInput}
            placeholder={t('course:info.namePlaceholder')}
          />
        </PropertyRow>

        <PropertyRow title={t('course:info.school')}>
          <input
            type="text"
            value={course.school}
            onChange={(e) => update("courses", course.id, {school: e.target.value})}
            className={styles.textInput}
            placeholder={t('course:info.schoolPlaceholder')}
          />
        </PropertyRow>

        <PropertyRow title={t('course:info.semester')}>
          <input
            type="text"
            value={course.semester}
            onChange={(e) => update("courses", course.id, {semester: e.target.value})}
            className={styles.textInput}
            placeholder={t('course:info.semesterPlaceholder')}
          />
        </PropertyRow>
      </PropertyForm>

      <PropertyForm title={t('course:info.instructor')}>
        <PropertyRow title={t('common:fields.name')}>
          <input
            type="text"
            value={course.teacherName}
            onChange={(e) => update("courses", course.id, {teacherName: e.target.value})}
            className={styles.textInput}
            placeholder={t('course:info.instructorPlaceholder')}
          />
        </PropertyRow>

        <PropertyRow title={t('common:fields.email')}>
          <input
            type="email"
            value={course.teacherEmail}
            onChange={(e) => update("courses", course.id, {teacherEmail: e.target.value})}
            className={styles.textInput}
            placeholder="teacher@example.com"
          />
        </PropertyRow>

        <PropertyRow title={t('advising:intake.phone')}>
          <input
            type="tel"
            value={course.teacherPhone}
            onChange={(e) => update("courses", course.id, {teacherPhone: e.target.value})}
            className={styles.textInput}
            placeholder="1234567890"
          />
        </PropertyRow>
      </PropertyForm>

      <CollapsibleSection title={t('common:fields.description')}>
        <RichTextEditor
          content={course.description}
          onChange={(content) => {
            update("courses", course.id, {description: content});
          }}
          placeholder={t('course:info.descriptionPlaceholder')}
        />
      </CollapsibleSection>
    </div>
  );
};
