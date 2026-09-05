import { useTranslation } from 'react-i18next';
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
  const { t: translate } = useTranslation();
  const {courseId: courseIdParam} = useParams();
  const {state: navigationState} = useLocation();
  const parsedCourseId = Number(courseIdParam);
  const requestedCourseId = Number.isInteger(parsedCourseId) && parsedCourseId > 0 ? parsedCourseId : null;
  const {user} = useRequiredAuth();
  const access = useCourseAccess(requestedCourseId);
  const isSystemAdmin = user.role === 'SYSTEM_ADMIN';
  // A membership read failure is not evidence of denial. Probe the roster and
  // let its 403/404 decide; a known TA, Student or inactive enrollment cannot read.
  const canViewRoster = isSystemAdmin || (user.role === 'USER' &&
    (access.isInstructor || access.isError || (access.isResolved && !access.membership)));
  const canManageMembers = isSystemAdmin;
  const {
    courseId, members, total, page, pageCount, setPage, filters, setFilters,
    isLoading, isError, isForbidden, isNotFound, refetch, withdraw, promote, demote, updatePermissions, enrol,
  } = useRoster({enabled: canViewRoster, canManageMembers});
  const [search, setSearch] = useState('');

  if (courseId === null) return <div className={styles.status}><p>{translate("course:roster.chooseHint")}</p><Link to={APP_ROUTE_PATHS.course}>{translate("course:roster.choose")}</Link></div>;
  if (!isSystemAdmin && access.isLoading) return <p className={styles.status} role="status">{translate("course:roster.checking")}</p>;
  if (!canViewRoster) return <Navigate to={access.membership ? `/course/${courseId}` : '/course'} replace/>;
  if (isForbidden) return <p className={styles.status} role="alert">{translate("course:roster.accessDenied")}</p>;

  if (isNotFound) return <p className={styles.status} role="alert">{translate("course:roster.notFound")}</p>;

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
          <Link className={styles.backLink} to={backPath}>{fromOverview ? translate("course:grades.back") : translate('common:navigationControls.backToCourseOperations')}</Link>
          <h1 className={styles.title}>{translate("course:roster.title")}</h1>
        </div>
        <span className={styles.count}>{translate("course:roster.count", {count: total})}</span>
      </header>

      {canManageMembers ? <EnrolStudentsPanel onEnrol={emails => enrol.mutate(emails)} isPending={enrol.isPending} result={enrol.data?.data ?? null} failed={enrol.isError}/> : null}

      <div className={styles.toolbar}>
        <form className={styles.searchForm} onSubmit={event => { event.preventDefault(); setFilters({...filters, q: search}); }}>
          <label className={styles.visuallyHidden} htmlFor="roster-search">{translate("course:roster.search")}</label>
          <input id="roster-search" className={styles.search} placeholder={translate("common:people.searchLabel")} value={search} onChange={event => setSearch(event.target.value)}/>
          <button type="submit" className={styles.searchButton}>{translate("common:actions.search")}</button>
        </form>
        <div className={styles.roleFilters} aria-label={translate("course:roster.filterRole")}>
          {ROLE_FILTERS.map(role => <button type="button" key={role} aria-pressed={filters.role === role} className={`${styles.filterChip} ${filters.role === role ? styles.filterChipActive : ''}`} onClick={() => setFilters({...filters, role})}>{translate(`course:roster.roles.${role}`)}</button>)}
        </div>
        <label className={styles.toggle}><input type="checkbox" checked={filters.includeWithdrawn} onChange={event => setFilters({...filters, includeWithdrawn: event.target.checked})}/>{translate("course:roster.withdrawn")}</label>
      </div>

      {isLoading ? <p className={styles.status}>{translate("course:roster.loading")}</p> : null}
      {isError && !isForbidden ? <div className={styles.status} role="alert"><p>{translate("course:roster.loadFailed")}</p><button type="button" className={styles.retry} onClick={refetch}>{translate("common:actions.tryAgain")}</button></div> : null}
      {!isLoading && !isError && !members.length ? <p className={styles.status}>{translate("course:roster.empty")}</p> : null}

      {!isError && members.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>{translate("common:fields.name")}</th><th>{translate("common:fields.email")}</th><th>{translate("course:roster.role")}</th><th>{translate("common:fields.status")}</th>{canManageMembers ? <th><span className={styles.visuallyHidden}>{translate("common:fields.actions")}</span></th> : null}</tr></thead>
            <tbody>{members.map(member => <MemberRow canManageMembers={canManageMembers} key={member.id} member={member} onWithdraw={() => withdraw.mutate(member)} onPromote={() => promote.mutate(member)} onDemote={() => demote.mutate(member)} onUpdatePermissions={permissions => updatePermissions.mutate({member, permissions})} isBusy={isBusy}/>)}</tbody>
          </table>
        </div>
      ) : null}

      {pageCount > 1 ? <nav className={styles.pagination} aria-label={translate("course:roster.pages")}><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{translate("common:actions.previous")}</button><span>{page + 1} / {pageCount}</span><button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>{translate("common:actions.next")}</button></nav> : null}
    </main>
  );
};

export default RosterPage;
