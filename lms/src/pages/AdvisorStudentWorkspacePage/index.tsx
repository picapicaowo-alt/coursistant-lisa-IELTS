import {SkillIcon} from '@/components/SkillIcon';
import React from 'react';
import {generatePath, Link, NavLink, Outlet, useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {
  ArrowLeft,
  MessageSquare,
  Calendar,
} from 'lucide-react';
import {unwrapData} from '@/apis';
import {UserAvatar} from '@/components/UserAvatar';
import {ProgressRing} from '@/components/ProgressRing';
import {TASK_STATUS, formatPlanDate} from '@/utils/studyPlan';
import {advisorApiService} from '@/apis/services/advisor-api';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {isNotFound} from '@/utils/apiError';
import {formatPersonName} from '@/utils/personName';
import {advisingQueryKeys} from '../advising/queryKeys';
import {useAssignmentBoundary} from '../advising/useAssignmentBoundary';
import {advisingErrorMessage} from '../advising/advisingErrors';
import styles from '../advising/advising.module.scss';
import layout from './index.module.scss';

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

  const profile = useQuery({
    meta: {advisingStudentId: id},
    queryKey: advisingQueryKeys.advisorProfile(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudentProfile(id), 'advisorProfile'),
    enabled: Boolean(intake.data),
    retry: false,
  });

  const plan = useQuery({
    meta: {advisingStudentId: id},
    queryKey: advisingQueryKeys.advisorStudyPlan(id),
    queryFn: async () => unwrapData(await advisorApiService.getStudyPlan(id), 'getStudyPlan'),
    enabled: Boolean(intake.data),
    retry: false,
  });
  const tasks = plan.data?.plan?.checkpoints?.flatMap(checkpoint => checkpoint.tasks ?? []) ?? [];
  const completion = tasks.length ? tasks.filter(task => task.status === TASK_STATUS.completed).length / tasks.length * 100 : null;

  const name = formatPersonName(intake.data, `Student #${id}`);
  const studentIdFormatted = `ID: ${id}`;

  if (intake.isError && isNotFound(intake.error)) {
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">This student is not in your current assignment.</p>
      </div>
    );
  }

  const skills = profile.data?.skills ?? [];

  return (
    <div className={`${styles.page} ${layout.workspace}`}>
      <Link to={APP_ROUTE_PATHS.advisorStudents} className={layout.back}>
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Back to Students</span>
      </Link>

      {/* Figma Student Profile Header Card */}
      <header className={layout.studentSummary} aria-label="Student profile summary">
        <UserAvatar userId={intake.data ? id : undefined} className={layout.avatarLarge}/>
        <div className={layout.nameBlock}>
          <h1>{name}</h1>
          <span>Student {studentIdFormatted}</span>
          <small>{intake.data?.email}</small>
        </div>
        <dl className={layout.metadata}>
          <div><dt>Student type</dt><dd>{intake.data?.studentType || 'Not supplied'}</dd></div>
          <div><dt>Active courses</dt><dd>{intake.data?.activeCourseCount ?? '—'}</dd></div>
          <div><dt>Pending requests</dt><dd>{intake.data?.pendingRequestCount ?? '—'}</dd></div>
        </dl>
        <Link className={layout.messageBtn} to={`${APP_ROUTE_PATHS.advisorMessages}?studentUserId=${id}`}>
          <MessageSquare size={20} aria-hidden="true" /><span>Message</span>
        </Link>
        <div className={layout.targetScoreCard}>
          <div className={layout.scoresLine}>
            <div><span>Baseline assessment</span><strong className={layout.baselineValue}>{profile.data?.baselineAssessment || 'Not assessed'}</strong></div>
            <span aria-hidden="true">→</span>
            <div><span>{profile.data?.targetMetric || 'Learning goal'}</span><strong className={layout.targetValue}>{profile.data?.targetValue || profile.data?.targetGoal || 'Not set'}</strong></div>
          </div>
          <span className={layout.targetDate}><Calendar size={20} aria-hidden="true" />Target date · {profile.data?.targetDate ? formatPlanDate(profile.data.targetDate) : 'Not set'}</span>
        </div>
        <div className={layout.progress}><ProgressRing value={completion} label="Advisor task completion" /></div>
        <div className={layout.skillCardsGrid}>
          {skills.map((skill, index) => (
            <div className={layout.skillCard} key={skill.skillCode ?? index}>
              <SkillIcon code={skill.skillCode} size={28}/>
              <span>{skill.displayName || skill.skillCode} Current</span>
              <strong>{skill.currentValue || '—'}</strong>
            </div>
          ))}
          {!skills.length ? <p className={layout.skillEmpty}>{profile.isPending ? 'Loading assessments…' : 'No skill assessments yet.'}</p> : null}
        </div>
      </header>

      {intake.isError ? (
        <p className={styles.error} role="alert">
          {advisingErrorMessage(intake.error, 'Intake could not be loaded.')}
        </p>
      ) : null}

      {/* Tabs */}
      <nav className={layout.tabs} aria-label="Student advising sections">
        <NavLink
          to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdStudyPlan, {studentUserId: String(id)})}
          className={({isActive}) => (isActive ? styles.tabActive : '')}
        >
          Learning Plan
        </NavLink>
        <NavLink
          to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdCourses, {studentUserId: String(id)})}
          className={({isActive}) => (isActive ? styles.tabActive : '')}
        >
          Courses
        </NavLink>
        <NavLink
          to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdExams, {studentUserId: String(id)})}
          className={({isActive}) => (isActive ? styles.tabActive : '')}
        >
          Exams
        </NavLink>
        <NavLink
          to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdSupport, {studentUserId: String(id)})}
          className={({isActive}) => (isActive ? styles.tabActive : '')}
        >
          Support &amp; reports
        </NavLink>
        <NavLink
          to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdProfile, {studentUserId: String(id)})}
          className={({isActive}) => (isActive ? styles.tabActive : '')}
        >
          Profile
        </NavLink>
        <NavLink
          to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdIntake, {studentUserId: String(id)})}
          className={({isActive}) => (isActive ? styles.tabActive : '')}
        >
          Intake
        </NavLink>

      </nav>

      {intake.isPending ? <p role="status">Loading student workspace…</p> : intake.isError ? null : <Outlet key={id} />}
    </div>
  );
};

export default AdvisorStudentLayout;
