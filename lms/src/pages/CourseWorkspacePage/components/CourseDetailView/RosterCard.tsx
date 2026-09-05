import {useTranslation} from 'react-i18next';
import React from 'react';
import {generatePath, Link} from 'react-router-dom';
import {UsersRound} from 'lucide-react';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import styles from './index.module.scss';

export const RosterCard: React.FC<{courseId: number}> = ({courseId}) => {
  const {t} = useTranslation();
  return (
  <section className={styles.card}>
    <div className={styles.cardHeader}>
      <h2 className={styles.cardTitle}>{t("course:roster.title")}</h2>
      <Link className={styles.addButton} to={generatePath(APP_ROUTE_PATHS.rosterCourseId, {courseId: String(courseId)})} state={{rosterParent: generatePath(APP_ROUTE_PATHS.courseCourseId, {courseId: String(courseId)})}}>{t("course:roster.view")}</Link>
    </div>
    <div className={styles.rosterSummary}>
      <UsersRound size={22} aria-hidden="true"/>
      <p>{t("course:roster.readSummary")}</p>
    </div>
  </section>
);
};
