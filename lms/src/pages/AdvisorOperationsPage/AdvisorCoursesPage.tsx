import {useTranslation} from 'react-i18next';
import {Plus} from 'lucide-react';
import {useState} from 'react';
import {CreateGroupCourse} from './CreateGroupCourse';
import {OwnedCourses} from './OwnedCourses';
import styles from '../advising/CourseManagement.module.scss';

export default function AdvisorCoursesPage() {
  const {t: translate} = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const showCreate = () => setCreateOpen(true);

  return <div className={styles.page}>
    <header className={styles.pageHeader}>
      <div><h1>{translate("navigation:courseManagement")}</h1><p>{translate("advising:owned.description")}</p></div>
      <button type="button" className={styles.primaryButton} aria-haspopup="dialog" onClick={showCreate}><Plus size={18} aria-hidden="true" /> {' '}{translate("course:list.createCourse")}</button>
    </header>
    <OwnedCourses onCreate={showCreate} />
    {createOpen ? <CreateGroupCourse onClose={() => setCreateOpen(false)} /> : null}
  </div>;
}
