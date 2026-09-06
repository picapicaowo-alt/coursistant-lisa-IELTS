import React from 'react';
import {useTranslation} from 'react-i18next';
import {RichTextEditor} from '@/components/RichTextEditor';
import styles from './Display.module.scss';
import {useCourseWorkspaceStore} from "../../stores/useCourseWorkspaceStore";

export const Display: React.FC = () => {
  const {t} = useTranslation("course");
  const {course} = useCourseWorkspaceStore();
  
  const formatCourseName = (code: string, name: string) => {
    if (name.startsWith(`[${code}]`)) {
      return name;
    }
    return `[${code}] ${name}`;
  };
  
  return (
    <div className={styles.courseInfoDisplay}>
      <div className={styles.headerCard}>
        <div className={styles.courseHeader}>
          <h1 className={styles.courseTitle}>
            {formatCourseName(course.courseCode, course.name)}
          </h1>
          <div className={styles.courseMeta}>
            <span className={styles.courseCode}>{course.id}</span>
            <span className={styles.separator}>•</span>
            <span className={styles.semester}>{course.semester}</span>
            <span className={styles.separator}>•</span>
            <span className={styles.school}>{course.school}</span>
          </div>
        </div>
      </div>
      
      <div className={styles.infoSection}>
        <h3 className={styles.sectionTitle}>{t('course:info.instructor')}</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('common:fields.name')}:</span>
            <span className={styles.infoValue}>{course.teacherName}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('common:fields.email')}:</span>
            <a href={`mailto:${course.teacherEmail}`} className={styles.infoLink}>
              {course.teacherEmail}
            </a>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('advising:intake.phone')}:</span>
            <a href={`tel:${course.teacherPhone}`} className={styles.infoLink}>
              {course.teacherPhone}
            </a>
          </div>
        </div>
      </div>
      
      <div className={styles.infoSection}>
        <h3 className={styles.sectionTitle}>{t('common:fields.description')}</h3>
        <div className={styles.markdownContent}>
          <RichTextEditor
            content={course.description}
            disabled
            displayOnly
            showToolbar={false}
            ariaLabel={t('common:fields.description')}
          />
        </div>
      </div>
    </div>
  );
};
