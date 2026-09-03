import {LectureProgress} from '@/components/LectureProgress';
import {UserAvatar} from '@/components/UserAvatar';
import {Link, generatePath} from 'react-router-dom';
import {DashboardCourse} from '@/pages/LmsHomePage/types';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import styles from './CourseCard.module.scss';

export default function CourseCard({id, courseCode, title, instructorName, instructorAvatar, lectureTotal, lectureCompleted}: DashboardCourse) {
  return <article className={styles.card}>
    <h3>{title || courseCode}</h3>
    {instructorName ? <div className={styles.instructor}><UserAvatar src={instructorAvatar}/><span>{instructorName}<small>Instructor</small></span></div> : null}
    <LectureProgress completed={lectureCompleted} total={lectureTotal}/>
    <footer><Link to={generatePath(APP_ROUTE_PATHS.courseCourseId, {courseId: String(id)})}>View details<span aria-hidden="true">›</span></Link></footer>
  </article>;
}
