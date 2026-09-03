import React, {useState} from 'react';
import {generatePath, Link, Navigate, useLocation, useParams} from 'react-router-dom';
import {CourseRole} from '@/apis';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {useRequiredAuth} from '@/contexts/RequiredAuthContext';
import {useCourseAccess} from '@/hooks/useCourseAccess';
import {isRecord} from '@/utils/apiError';
import {EnrolStudentsPanel} from './EnrolStudentsPanel';
import {MemberRow} from './MemberRow';
import {useRoster} from './useRoster';
import styles from './index.module.scss';

const ROLE_FILTERS: Array<CourseRole | 'All'> = ['All', 'Instructor', 'TA', 'Student'];

const RosterPage: React.FC = () => {
  const {courseId: courseIdParam} = useParams();
  const {state: navigationState} = useLocation();
  const parsedCourseId = Number(courseIdParam);
  const requestedCourseId = Number.isInteger(parsedCourseId) && parsedCourseId > 0 ? parsedCourseId : null;
  const {user} = useRequiredAuth();
  const access = useCourseAccess(requestedCourseId);
  const isSystemAdmin = user.role === 'SYSTEM_ADMIN';
  const canViewRoster = isSystemAdmin || (access.isResolved && access.isInstructor);
  const {
    courseId, members, total, page, pageCount, setPage, filters, setFilters,
    isLoading, isError, isForbidden, refetch, withdraw, promote, demote, updatePermissions, enrol,
  } = useRoster({enabled: canViewRoster});
  const [search, setSearch] = useState('');

  if (courseId === null) return <div className={styles.status}><p>Open a course to see its roster.</p><Link to={APP_ROUTE_PATHS.course}>Choose a course</Link></div>;
  if (!isSystemAdmin && access.isLoading) return <p className={styles.status} role="status">Checking course access…</p>;
  if (!isSystemAdmin && access.isError) return <p className={styles.status} role="alert">Course access could not be verified.</p>;
  if (!canViewRoster) return <Navigate to={access.membership ? `/course/${courseId}` : '/course'} replace/>;
  if (isForbidden) return <p className={styles.status} role="alert">Only the course instructor can view the roster.</p>;

  const isBusy = withdraw.isPending || promote.isPending || demote.isPending || updatePermissions.isPending;
  const coursePath = generatePath(APP_ROUTE_PATHS.courseCourseId, {courseId: String(courseId)});
  // Only accept this course's overview as an alternate parent. Deep links and
  // the teaching operations entry return to the course's management workspace.
  const fromOverview = isRecord(navigationState) && navigationState.rosterParent === coursePath;
  const backPath = fromOverview ? coursePath : generatePath(APP_ROUTE_PATHS.courseCourseIdOperations, {courseId: String(courseId)});

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} to={backPath}>← {fromOverview ? 'Back to course' : 'Back to course operations'}</Link>
          <h1 className={styles.title}>Roster</h1>
        </div>
        <span className={styles.count}>{total} {total === 1 ? 'member' : 'members'}</span>
      </header>

      <EnrolStudentsPanel onEnrol={emails => enrol.mutate(emails)} isPending={enrol.isPending} result={enrol.data?.data ?? null} failed={enrol.isError}/>

      <div className={styles.toolbar}>
        <form className={styles.searchForm} onSubmit={event => { event.preventDefault(); setFilters({...filters, q: search}); }}>
          <label className={styles.visuallyHidden} htmlFor="roster-search">Search roster</label>
          <input id="roster-search" className={styles.search} placeholder="Search by name or email" value={search} onChange={event => setSearch(event.target.value)}/>
          <button type="submit" className={styles.searchButton}>Search</button>
        </form>
        <div className={styles.roleFilters} aria-label="Filter by role">
          {ROLE_FILTERS.map(role => <button type="button" key={role} aria-pressed={filters.role === role} className={`${styles.filterChip} ${filters.role === role ? styles.filterChipActive : ''}`} onClick={() => setFilters({...filters, role})}>{role}</button>)}
        </div>
        <label className={styles.toggle}><input type="checkbox" checked={filters.includeWithdrawn} onChange={event => setFilters({...filters, includeWithdrawn: event.target.checked})}/>Show withdrawn</label>
      </div>

      {isLoading ? <p className={styles.status}>Loading roster…</p> : null}
      {isError && !isForbidden ? <div className={styles.status} role="alert"><p>Couldn&apos;t load the roster.</p><button type="button" className={styles.retry} onClick={refetch}>Try again</button></div> : null}
      {!isLoading && !isError && !members.length ? <p className={styles.status}>No members match these filters.</p> : null}

      {!isError && members.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Name</th><th>Email</th><th>Course role</th><th>Status</th><th><span className={styles.visuallyHidden}>Actions</span></th></tr></thead>
            <tbody>{members.map(member => <MemberRow key={member.id} member={member} onWithdraw={() => withdraw.mutate(member)} onPromote={() => promote.mutate(member)} onDemote={() => demote.mutate(member)} onUpdatePermissions={permissions => updatePermissions.mutate({member, permissions})} isBusy={isBusy}/>)}</tbody>
          </table>
        </div>
      ) : null}

      {pageCount > 1 ? <nav className={styles.pagination} aria-label="Roster pages"><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>{page + 1} / {pageCount}</span><button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Next</button></nav> : null}
    </main>
  );
};

export default RosterPage;
