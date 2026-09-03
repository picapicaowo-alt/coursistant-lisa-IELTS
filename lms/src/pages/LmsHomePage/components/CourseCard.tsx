import {Link, generatePath} from 'react-router-dom';
import {DashboardCourse} from '@/pages/LmsHomePage/types';
import {formatCourseName, getCourseIdentityTone} from '@/utils/course';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import tones from '@/styles/courseIdentity.module.scss';
import styles from './CourseCard.module.scss';

export default function CourseCard({id, courseCode, title, instructorName, instructorAvatar}: DashboardCourse) {
  return <article className={`${styles.card} ${tones[getCourseIdentityTone(id)]}`}>
    <h3>{formatCourseName(courseCode, title)}</h3>
    {instructorName ? <div className={styles.instructor}>{instructorAvatar ? <img src={instructorAvatar} alt=""/> : null}<span>{instructorName}<small>Instructor</small></span></div> : null}
    <footer><Link to={generatePath(APP_ROUTE_PATHS.courseCourseId, {courseId: String(id)})}>View details<span aria-hidden="true">›</span></Link></footer>
  </article>;
}
