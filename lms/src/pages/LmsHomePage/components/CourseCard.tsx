import {CourseIdentityCard} from '@/components/CourseIdentityCard';
import {Link, generatePath} from 'react-router-dom';
import {DashboardCourse} from '@/pages/LmsHomePage/types';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';

export default function CourseCard({id, courseCode, title, instructorName, instructorAvatar}: DashboardCourse) {
  return <CourseIdentityCard courseId={id} title={title || courseCode} code={courseCode}
    instructor={instructorName || 'Instructor not assigned'} instructorAvatar={instructorAvatar}
    actions={<Link to={generatePath(APP_ROUTE_PATHS.courseCourseId, {courseId: String(id)})}>View details</Link>}
  />;
}
