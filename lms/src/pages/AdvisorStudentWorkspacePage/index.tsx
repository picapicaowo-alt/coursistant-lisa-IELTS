import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {ArrowLeft, MessageSquare} from 'lucide-react';
import {advisingQueryKeys} from '../advising/queryKeys';
import layout from './index.module.scss';
import {useAssignmentBoundary} from '../advising/useAssignmentBoundary';
import React from 'react';
import {generatePath, Link, NavLink, Outlet, useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {isNotFound} from '@/utils/apiError';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';
import {formatPersonName} from '@/utils/personName';

const AdvisorStudentLayout: React.FC = () => {
  const {studentUserId} = useParams();
  const id = Number(studentUserId);
  useAssignmentBoundary(id);
  const intake = useQuery({
    meta: {advisingStudentId: id},
    queryKey: ['advisor', 'student-hub', id],
    queryFn: async () => unwrapData(await advisorApiService.getStudentHub(id), 'advisorIntake'),
    enabled: Number.isInteger(id),
    retry: false,
  });

  const profile = useQuery({meta: {advisingStudentId: id}, queryKey: advisingQueryKeys.advisorProfile(id), queryFn: async () => unwrapData(await advisorApiService.getStudentProfile(id), 'advisorProfile'), enabled: Boolean(intake.data), retry: false});
  const name = formatPersonName(intake.data, `Student #${id}`);
  const initials = [intake.data?.firstName, intake.data?.lastName].filter(Boolean).map(part => part!.slice(0, 1)).join('') || '#';

  if (intake.isError && isNotFound(intake.error)) {
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">This student is not in your current assignment.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${layout.workspace}`}>
      <Link to={APP_ROUTE_PATHS.advisorStudents} className={layout.back}><ArrowLeft size={16} aria-hidden="true"/>Back to students</Link>
      <header className={layout.studentSummary}>
        <div className={layout.identity}>
          <span className={layout.avatar} aria-hidden="true">{initials}</span>
          <div className={layout.name}><h1>{name}</h1><p>Student ID: {id}</p>{intake.data?.email ? <p>{intake.data.email}</p> : null}</div>
          <Link className={styles.secondaryLink} to={`${generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdSupport, {studentUserId: String(id)})}#conversation`}><MessageSquare size={16} aria-hidden="true"/>Message</Link>
        </div>
        {profile.data ? <>
          <dl className={layout.facts}>
            {profile.data.targetGoal ? <div><dt>Learning goal</dt><dd>{profile.data.targetGoal}</dd></div> : null}
            {profile.data.targetValue ? <div><dt>{profile.data.targetMetric || 'Target'}</dt><dd>{profile.data.targetValue}</dd></div> : null}
            {profile.data.targetDate ? <div><dt>Target date</dt><dd>{profile.data.targetDate}</dd></div> : null}
            {intake.data?.activeCourseCount != null ? <div><dt>Active courses</dt><dd>{intake.data.activeCourseCount}</dd></div> : null}
          </dl>
          {profile.data.skills?.length ? <ul className={layout.skills}>{profile.data.skills.map((skill, index) => <li key={skill.skillCode ?? index}><span>{skill.displayName || skill.skillCode}</span><strong>{skill.currentValue || '—'} → {skill.targetValue || '—'}</strong></li>)}</ul> : null}
        </> : null}
      </header>
      {intake.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(intake.error, 'Intake could not be loaded.')}</p> : null}
      <nav className={layout.tabs} aria-label="Student advising sections">
        <NavLink to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdIntake, {studentUserId: String(id)})} className={({isActive}) => isActive ? styles.tabActive : ''}>Intake</NavLink>
        <NavLink to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdProfile, {studentUserId: String(id)})} className={({isActive}) => isActive ? styles.tabActive : ''}>Profile</NavLink>
        <NavLink to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdStudyPlan, {studentUserId: String(id)})} className={({isActive}) => isActive ? styles.tabActive : ''}>Study plan</NavLink>
        <NavLink to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdCourses, {studentUserId: String(id)})} className={({isActive}) => isActive ? styles.tabActive : ''}>Courses</NavLink>
        <NavLink to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdSupport, {studentUserId: String(id)})} className={({isActive}) => isActive ? styles.tabActive : ''}>Support &amp; reports</NavLink>
      </nav>
      {intake.isPending ? <p role="status">Loading student workspace…</p> : intake.isError ? null : <Outlet key={id}/>}
    </div>
  );
};

export default AdvisorStudentLayout;
