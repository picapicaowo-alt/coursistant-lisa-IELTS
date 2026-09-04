import {Plus} from 'lucide-react';
import {useState} from 'react';
import {CreateGroupCourse} from './CreateGroupCourse';
import {OwnedCourses} from './OwnedCourses';
import styles from '../advising/CourseManagement.module.scss';

export default function AdvisorCoursesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const showCreate = () => setCreateOpen(true);

  return <div className={styles.page}>
    <header className={styles.pageHeader}>
      <div><h1>Course management</h1><p>Manage the courses you own and their delivery.</p></div>
      <button type="button" className={styles.primaryButton} aria-haspopup="dialog" onClick={showCreate}><Plus size={18} aria-hidden="true" /> Create course</button>
    </header>
    <OwnedCourses onCreate={showCreate} />
    {createOpen ? <CreateGroupCourse onClose={() => setCreateOpen(false)} /> : null}
  </div>;
}
