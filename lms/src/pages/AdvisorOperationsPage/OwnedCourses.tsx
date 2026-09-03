import {CourseIdentityCard} from '@/components/CourseIdentityCard';
import {courseStatusTone} from '@/components/CourseIdentityCard/courseBadges';
import {CreateGroupCourse} from './CreateGroupCourse';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {ADVISOR_PAGE_SIZE, type AdvisorOwnedCourseFilters} from '@/apis/types/advisorWorkspace';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';

export function OwnedCourses() {
  const [filters, setFilters] = useState<AdvisorOwnedCourseFilters>({page: 0, size: ADVISOR_PAGE_SIZE});
  const courses = useQuery({queryKey: ['advisor', 'owned-courses', filters], queryFn: async () => unwrapData(await advisorApiService.listOwnedCourses(filters), 'advisorListOwnedCourses'), retry: false});
  // Owned courses are the advisor's inventory, so they stay visible as cards; only the create form is tucked away.
  return <section className={`${styles.courseCollection} ${styles.disclosureLayout}`} aria-labelledby="owned-courses-heading">
    <div className={styles.sectionHeading}>
      <div className={styles.sectionTitle}><h2 id="owned-courses-heading">Courses you own</h2>{courses.data != null ? <span className={styles.countBadge}>{courses.data.total}</span> : null}</div>
      <p className={styles.muted}>Group courses you launched. Open one to manage delivery, or create a new course.</p>
    </div>
    <div className={styles.filterBar}>
      <label>Search owned courses<input type="search" maxLength={120} placeholder="Course code or title" value={filters.q ?? ''} onChange={event => setFilters(current => ({...current, q: event.target.value || undefined, page: 0}))}/></label>
      <label>Launch state<select value={filters.launchState ?? ''} onChange={event => setFilters(current => ({...current, launchState: event.target.value as AdvisorOwnedCourseFilters['launchState'] || undefined, page: 0}))}><option value="">All</option>{['DRAFT', 'READY', 'PUBLISHED'].map(state => <option key={state}>{state}</option>)}</select></label>
      <label>Course lifecycle<select value={filters.lifecycleState ?? ''} onChange={event => setFilters(current => ({...current, lifecycleState: event.target.value as AdvisorOwnedCourseFilters['lifecycleState'] || undefined, page: 0}))}><option value="">All</option><option>Active</option><option>Archived</option></select></label>
    </div>
    {courses.isPending ? <p role="status" className={styles.status}>Loading courses…</p> : null}
    {courses.isError ? <p role="alert" className={styles.error}>{advisingErrorMessage(courses.error, 'Owned courses could not be loaded.')}</p> : null}
    <div className={styles.courseCardGrid}>
      {courses.data?.items.map(course => (
        <CourseIdentityCard key={course.courseId} courseId={course.courseId} title={course.title || course.courseCode || `Course #${course.courseId}`} code={course.courseCode}
          badges={[{label: 'Group', tone: 'brand'}, {label: course.launchState ?? 'Not configured', tone: courseStatusTone(course.launchState)}]}
          metadata={<><span>{course.activeStudents ?? 0} active students</span><span>{course.remainingCapacity == null ? 'Capacity not configured' : `${course.remainingCapacity} places remaining`}</span></>}>
          <Link className={styles.primaryLink} to={`/advisor/courses/${course.courseId}/delivery`}>Manage delivery</Link>
        </CourseIdentityCard>
      ))}
      <CreateGroupCourse/>
    </div>
    {courses.data?.items.length === 0 ? <p className={styles.muted}>No owned courses match these filters.</p> : null}
    <AdvisingPagination label="Owned course pages" page={filters.page ?? 0} total={courses.data?.total ?? 0} onPage={page => setFilters(current => ({...current, page}))}/>
  </section>;
}
