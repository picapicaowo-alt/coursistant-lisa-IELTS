import {useState} from 'react';
import {generatePath, Link} from 'react-router-dom';
import {useQueries, useQuery} from '@tanstack/react-query';
import {Activity, BookOpen, CalendarDays, Grid2X2, List, Plus, Search, UsersRound} from 'lucide-react';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {ADVISOR_PAGE_SIZE, type AdvisorOwnedCourseFilters} from '@/apis/types/advisorWorkspace';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {formatPersonName} from '@/utils/personName';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {COURSE_LAUNCH_STATES, COURSE_SEARCH_MAX_LENGTH, courseLaunchLabel, courseTermLabel, isCourseLaunchState} from '../advising/courseManagement';
import styles from '../advising/CourseManagement.module.scss';

type CourseView = 'grid' | 'list';

export function OwnedCourses({onCreate}: {onCreate?: () => void}) {
  const [filters, setFilters] = useState<AdvisorOwnedCourseFilters>({page: 0, size: ADVISOR_PAGE_SIZE});
  const [search, setSearch] = useState('');
  const [view, setView] = useState<CourseView>('grid');
  const courses = useQuery({queryKey: ['advisor', 'owned-courses', filters], queryFn: async () => unwrapData(await advisorApiService.listOwnedCourses(filters), 'advisorListOwnedCourses'), retry: false});
  const statusTotals = useQueries({queries: COURSE_LAUNCH_STATES.map(launchState => ({
    queryKey: ['advisor', 'owned-courses', 'summary', launchState],
    queryFn: async () => unwrapData(await advisorApiService.listOwnedCourses({launchState, page: 0, size: 1}), `advisorOwnedCourses${launchState}`).total,
    retry: false,
    staleTime: 60_000,
  }))});
  const allCoursesTotal = useQuery({
    queryKey: ['advisor', 'owned-courses', 'summary', 'all'],
    queryFn: async () => unwrapData(await advisorApiService.listOwnedCourses({page: 0, size: 1}), 'advisorOwnedCoursesTotal').total,
    retry: false,
    staleTime: 60_000,
  });
  const submitSearch = () => setFilters(current => ({...current, q: search.trim() || undefined, page: 0}));

  return <>
    <section className={styles.toolbar} aria-label="Course filters">
      <div className={styles.filters}>
        <form className={styles.searchControl} role="search" onSubmit={event => {event.preventDefault(); submitSearch();}}>
          <button type="submit" className={styles.searchSubmit} aria-label="Run course search"><Search size={17} aria-hidden="true" /></button>
          <input type="search" aria-label="Search courses" placeholder="Search by course title or code…" maxLength={COURSE_SEARCH_MAX_LENGTH} value={search} onChange={event => {setSearch(event.target.value); if (!event.target.value) setFilters(current => ({...current, q: undefined, page: 0}));}} />
        </form>
        <label className={`${styles.field} ${styles.filterField}`}><span>Status:</span>
          <select value={filters.launchState ?? ''} onChange={event => setFilters(current => ({...current, launchState: isCourseLaunchState(event.target.value) ? event.target.value : undefined, page: 0}))}>
            <option value="">All</option>
            {COURSE_LAUNCH_STATES.map(state => <option key={state} value={state}>{courseLaunchLabel(state)}</option>)}
          </select>
        </label>
        <label className={`${styles.field} ${styles.filterField}`}><span>Lifecycle:</span>
          <select value={filters.lifecycleState ?? ''} onChange={event => setFilters(current => ({...current, lifecycleState: event.target.value === 'Active' || event.target.value === 'Archived' ? event.target.value : undefined, page: 0}))}>
            <option value="">All</option><option value="Active">Active</option><option value="Archived">Archived</option>
          </select>
        </label>
      </div>
      <div className={styles.viewControls} aria-label="Course view">
        <button type="button" className={styles.viewButton} aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={18} /></button>
        <button type="button" className={styles.viewButton} aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={19} /></button>
        <span className={styles.resultCount}>{courses.data ? `Showing ${courses.data.total} ${courses.data.total === 1 ? 'course' : 'courses'}` : courses.isError ? 'Courses unavailable' : 'Loading courses…'}</span>
      </div>
    </section>
    {courses.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(courses.error, 'Owned courses could not be loaded.')} <button type="button" className={styles.ghostButton} onClick={() => void courses.refetch()}>Retry</button></p> : null}
    {courses.isPending ? <p role="status" className={styles.helper}>Loading courses…</p> : null}
    <section className={styles.courseGrid} data-view={view} aria-label="Courses you own" aria-busy={courses.isPending}>
      {courses.data?.items.map(course => {
        const instructorName = course.primaryInstructor ? formatPersonName({firstName: course.primaryInstructor.instructorFirstName, middleName: course.primaryInstructor.instructorMiddleName, lastName: course.primaryInstructor.instructorLastName}) : '';
        return <article key={course.courseId} className={styles.courseCard}>
          <header className={styles.courseHeader}>
            <div className={styles.courseTitleRow}><span className={styles.statusBadge} data-state={course.launchState}>{courseLaunchLabel(course.launchState)}</span><span className={styles.courseCode} title={course.catalogCode || course.courseCode}>{course.catalogCode || course.courseCode || `Course ${course.courseId}`}</span></div>
            <h2>{course.title || course.courseCode || `Course #${course.courseId}`}</h2>
            <p>{course.lifecycleState || 'Lifecycle not provided'}</p>
          </header>
          <dl className={styles.factList}>
            <div><dt><UsersRound size={16} aria-hidden="true" /></dt><dd>{course.activeStudents ?? '—'} / {course.capacity ?? '—'} students enrolled</dd></div>
            <div><dt><BookOpen size={16} aria-hidden="true" /></dt><dd>{course.catalogCode ? `${course.catalogCode} delivery` : 'Delivery details not configured'}</dd></div>
            <div><dt><CalendarDays size={16} aria-hidden="true" /></dt><dd>{courseTermLabel(course)}</dd></div>
          </dl>
          <footer className={styles.cardActions}>
            <span className={styles.instructor}><span className={styles.instructorAvatar} aria-hidden="true">{instructorName.charAt(0) || '—'}</span><span>{instructorName || course.primaryInstructor?.email || 'Instructor not assigned'}</span></span>
            <span className={styles.cardActionGroup}><Link className={styles.linkButton} to={`${generatePath(APP_ROUTE_PATHS.advisorCoursesCourseIdDelivery, {courseId: String(course.courseId)})}?view=delivery`}>Manage delivery</Link></span>
          </footer>
        </article>;
      })}
      {view === 'grid' && !courses.isPending && !courses.isError ? <button type="button" className={styles.createCourseCard} onClick={onCreate}>
        <span className={styles.createCourseIcon}><Plus size={22} aria-hidden="true" /></span>
        <strong>Create new course</strong>
        <span>Set up course identity, term, instructor, and delivery.</span>
      </button> : null}
      {!courses.isPending && !courses.isError && courses.data?.items.length === 0 && (filters.q || filters.launchState || filters.lifecycleState) ? <div className={styles.emptyState}><BookOpen size={26} aria-hidden="true" /><h2>No matching courses</h2><p>Adjust or clear the current filters.</p></div> : null}
    </section>
    <AdvisingPagination label="Owned course pages" page={filters.page ?? 0} total={courses.data?.total ?? 0} onPage={page => setFilters(current => ({...current, page}))} />
    <section className={styles.summaryBar} aria-label="At-a-glance operational summary">
      <div className={styles.summaryLead}><Activity size={20} aria-hidden="true" />At-a-glance operational summary</div>
      <dl className={styles.summaryMetrics}>
        <div><dt>Total courses</dt><dd>{allCoursesTotal.data ?? '—'}</dd></div>
        <div><dt>Draft</dt><dd>{statusTotals[0].data ?? '—'}</dd></div>
        <div><dt>Ready to publish</dt><dd data-tone="success">{statusTotals[1].data ?? '—'}</dd></div>
        <div><dt>Published</dt><dd>{statusTotals[2].data ?? '—'}</dd></div>
      </dl>
    </section>
  </>;
}
