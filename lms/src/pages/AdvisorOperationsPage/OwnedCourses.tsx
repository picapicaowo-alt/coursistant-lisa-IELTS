import {formatNumber} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import { useTranslation } from 'react-i18next';
import {useState} from 'react';
import {generatePath, Link} from 'react-router-dom';
import {useQueries, useQuery} from '@tanstack/react-query';
import {Activity, BookOpen, CalendarDays, Grid2X2, List, Plus, Search, UsersRound} from 'lucide-react';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {ADVISOR_PAGE_SIZE, type AdvisorOwnedCourseFilters} from '@/apis/types/advisorWorkspace';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {CourseIdentityCard} from '@/components/CourseIdentityCard';
import {CourseCardGrid} from '@/components/CourseIdentityCard/CourseCardGrid';
import {formatPersonName} from '@/utils/personName';
import {AdvisingPagination} from '../advising/AdvisingPagination';
import {advisingErrorMessage} from '../advising/advisingErrors';
import {COURSE_LAUNCH_STATES, COURSE_SEARCH_MAX_LENGTH, courseLaunchLabel, courseTermLabel, isCourseLaunchState} from '../advising/courseManagement';
import styles from '../advising/CourseManagement.module.scss';

type CourseView = 'grid' | 'list';

export function OwnedCourses({onCreate}: {onCreate?: () => void}) {
  const { t: translate } = useTranslation();
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
    <section className={styles.toolbar} aria-label={translate("advising:owned.filters")}>
      <div className={styles.filters}>
        <form className={styles.searchControl} role="search" onSubmit={event => {event.preventDefault(); submitSearch();}}>
          <button type="submit" className={styles.searchSubmit} aria-label={translate("advising:owned.search")}><Search size={17} aria-hidden="true" /></button>
          <input type="search" aria-label={translate("navigation:searchCourses")} placeholder={translate("advising:owned.searchPlaceholder")} maxLength={COURSE_SEARCH_MAX_LENGTH} value={search} onChange={event => {setSearch(event.target.value); if (!event.target.value) setFilters(current => ({...current, q: undefined, page: 0}));}} />
        </form>
        <label className={`${styles.field} ${styles.filterField}`}><span>{translate("advising:owned.status")}</span>
          <select value={filters.launchState ?? ''} onChange={event => setFilters(current => ({...current, launchState: isCourseLaunchState(event.target.value) ? event.target.value : undefined, page: 0}))}>
            <option value="">{translate("course:detail.filterAll")}</option>
            {COURSE_LAUNCH_STATES.map(state => <option key={state} value={state}>{courseLaunchLabel(state)}</option>)}
          </select>
        </label>
        <label className={`${styles.field} ${styles.filterField}`}><span>{translate("advising:owned.lifecycle")}</span>
          <select value={filters.lifecycleState ?? ''} onChange={event => setFilters(current => ({...current, lifecycleState: event.target.value === 'Active' || event.target.value === 'Archived' ? event.target.value : undefined, page: 0}))}>
            <option value="">{translate("course:detail.filterAll")}</option><option value="Active">{translate("common:status.ACTIVE")}</option><option value="Archived">{translate("common:status.ARCHIVED")}</option>
          </select>
        </label>
      </div>
      <div className={styles.viewControls} aria-label={translate("advising:owned.view")}>
        <button type="button" className={styles.viewButton} aria-label={translate("course:catalogue.grid")} aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={18} /></button>
        <button type="button" className={styles.viewButton} aria-label={translate("course:catalogue.list")} aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={19} /></button>
        <span className={styles.resultCount}>{courses.data ? translate('advising:owned.showing', {count: courses.data.total, number: formatNumber(courses.data.total)}) : courses.isError ? translate("advising:owned.unavailable") : translate("advising:owned.loading")}</span>
      </div>
    </section>
    {courses.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(courses.error, translate("advising:owned.failed"))} <button type="button" className={styles.ghostButton} onClick={() => void courses.refetch()}>{translate("common:actions.retry")}</button></p> : null}
    {courses.isPending ? <p role="status" className={styles.helper}>{translate("advising:owned.loading")}</p> : null}
    <CourseCardGrid view={view} label={translate("advising:owned.courses")} busy={courses.isPending}>
      {courses.data?.items.map(course => {
        const instructorName = course.primaryInstructor ? formatPersonName({firstName: course.primaryInstructor.instructorFirstName, middleName: course.primaryInstructor.instructorMiddleName, lastName: course.primaryInstructor.instructorLastName}) : '';
        return <CourseIdentityCard key={course.courseId} courseId={course.courseId}
          title={course.title || course.courseCode || translate('assistant:courseFallback', {id: formatNumber(course.courseId)})} headingLevel={2}
          code={course.catalogCode || course.courseCode || translate('assistant:courseFallback', {id: formatNumber(course.courseId)})}
          status={<span className={styles.statusBadge} data-state={course.launchState}>{courseLaunchLabel(course.launchState)}</span>}
          instructor={instructorName || course.primaryInstructor?.email || translate("course:catalogue.unassignedInstructor")}
          metadata={course.lifecycleState ? statusLabel(course.lifecycleState) : translate("advising:owned.noLifecycle")}
          footer={<dl className={styles.factList}>
            <div><dt><UsersRound size={16} aria-hidden="true" /></dt><dd>{translate("advising:owned.enrolled", {number: course.activeStudents == null ? '—' : formatNumber(course.activeStudents), capacity: course.capacity == null ? '—' : formatNumber(course.capacity)})}</dd></div>
            <div><dt><BookOpen size={16} aria-hidden="true" /></dt><dd>{course.catalogCode ? translate("advising:owned.catalogDelivery", {code: course.catalogCode}) : translate("advising:owned.noDelivery")}</dd></div>
            <div><dt><CalendarDays size={16} aria-hidden="true" /></dt><dd>{courseTermLabel(course)}</dd></div>
          </dl>}
          actions={<Link to={`${generatePath(APP_ROUTE_PATHS.advisorCoursesCourseIdDelivery, {courseId: String(course.courseId)})}?view=delivery`}>{translate("advising:owned.manageDelivery")}</Link>}
        />;
      })}
      {view === 'grid' && !courses.isPending && !courses.isError ? <button type="button" className={styles.createCourseCard} aria-haspopup="dialog" onClick={onCreate}>
        <span className={styles.createCourseIcon}><Plus size={22} aria-hidden="true" /></span>
        <strong>{translate("advising:owned.create")}</strong>
        <span>{translate("advising:owned.createHelp")}</span>
      </button> : null}
      {!courses.isPending && !courses.isError && courses.data?.items.length === 0 && (filters.q || filters.launchState || filters.lifecycleState) ? <div className={styles.emptyState}><BookOpen size={26} aria-hidden="true" /><h2>{translate("advising:owned.noMatches")}</h2><p>{translate("advising:owned.clearHelp")}</p></div> : null}
    </CourseCardGrid>
    <AdvisingPagination label={translate("advising:owned.pages")} page={filters.page ?? 0} total={courses.data?.total ?? 0} onPage={page => setFilters(current => ({...current, page}))} />
    <section className={styles.summaryBar} aria-label={translate("advising:owned.summary")}>
      <div className={styles.summaryLead}><Activity size={20} aria-hidden="true" />{translate("advising:owned.summary")}</div>
      <dl className={styles.summaryMetrics}>
        <div><dt>{translate("advising:owned.total")}</dt><dd>{allCoursesTotal.data == null ? '—' : formatNumber(allCoursesTotal.data)}</dd></div>
        <div><dt>{translate("common:status.DRAFT")}</dt><dd>{statusTotals[0].data == null ? '—' : formatNumber(statusTotals[0].data)}</dd></div>
        <div><dt>{translate("courseTools:delivery.readyToPublish")}</dt><dd data-tone="success">{statusTotals[1].data == null ? '—' : formatNumber(statusTotals[1].data)}</dd></div>
        <div><dt>{translate("common:status.PUBLISHED")}</dt><dd>{statusTotals[2].data == null ? '—' : formatNumber(statusTotals[2].data)}</dd></div>
      </dl>
    </section>
  </>;
}
