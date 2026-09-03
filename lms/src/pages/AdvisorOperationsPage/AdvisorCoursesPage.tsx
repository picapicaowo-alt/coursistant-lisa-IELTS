import {Plus} from 'lucide-react';
import {useRef} from 'react';
import {CreateGroupCourse} from './CreateGroupCourse';
import {OwnedCourses} from './OwnedCourses';
import styles from '../advising/CourseManagement.module.scss';

export default function AdvisorCoursesPage() {
  const createRef = useRef<HTMLDetailsElement>(null);
  const showCreate = () => {
    if (!createRef.current) return;
    createRef.current.open = true;
    createRef.current.scrollIntoView({behavior: 'smooth', block: 'start'});
  };

  return <div className={styles.page}>
    <header className={styles.pageHeader}>
      <div><h1>Course management</h1><p>Manage the courses you own and their delivery.</p></div>
      <button type="button" className={styles.primaryButton} onClick={showCreate}><Plus size={18} aria-hidden="true" /> Create course</button>
    </header>
    <CreateGroupCourse ref={createRef} />
    <OwnedCourses onCreate={showCreate} />
  </div>;
}
