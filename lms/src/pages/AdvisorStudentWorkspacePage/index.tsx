import {useAssignmentBoundary} from '../advising/useAssignmentBoundary';
import React from 'react';
import {NavLink, Outlet, useParams} from 'react-router-dom';
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

  if (intake.isError && isNotFound(intake.error)) {
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">This student is not in your current assignment.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>{formatPersonName(intake.data, `Student #${id}`)}</h1>
          <p className={styles.lede}>{intake.data?.email} · {intake.data?.studentType}</p>
        </div>
      </header>
      {intake.isError ? <p className={styles.error} role="alert">{advisingErrorMessage(intake.error, 'Intake could not be loaded.')}</p> : null}
      <nav className={styles.tabs} aria-label="Student advising sections">
        <NavLink to={`/advisor/students/${id}/intake`} className={({isActive}) => isActive ? styles.tabActive : ''}>Intake</NavLink>
        <NavLink to={`/advisor/students/${id}/profile`} className={({isActive}) => isActive ? styles.tabActive : ''}>Profile</NavLink>
        <NavLink to={`/advisor/students/${id}/study-plan`} className={({isActive}) => isActive ? styles.tabActive : ''}>Study plan</NavLink>
        <NavLink to={`/advisor/students/${id}/courses`} className={({isActive}) => isActive ? styles.tabActive : ''}>Courses</NavLink>
        <NavLink to={`/advisor/students/${id}/support`} className={({isActive}) => isActive ? styles.tabActive : ''}>Support &amp; reports</NavLink>
      </nav>
      {intake.isPending ? <p role="status">Loading student workspace…</p> : intake.isError ? null : <Outlet key={id}/>}
    </div>
  );
};

export default AdvisorStudentLayout;
