import {Link} from 'react-router-dom';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {OwnedCourses} from './OwnedCourses';
import styles from '../advising/advising.module.scss';

export default function AdvisorCoursesPage() {
  return <div className={styles.page}>
    <header className={styles.header}><div><h1>Course management</h1><p className={styles.lede}>Manage the courses you own and their delivery.</p></div><Link className={styles.secondaryLink} to={APP_ROUTE_PATHS.advisorOperations}>Back to dashboard</Link></header>
    <OwnedCourses/>
  </div>;
}
