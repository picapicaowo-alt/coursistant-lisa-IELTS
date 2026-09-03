import React from 'react';
import {generatePath, Link, NavLink, Outlet, useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {
  ArrowLeft,
  MessageSquare,
  Calendar,
  BookOpen,
  Edit3,
  Mic,
  Headphones,
} from 'lucide-react';
import {unwrapData} from '@/apis';
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

  const name = formatPersonName(intake.data, `Student #${id}`);
  const initials = [intake.data?.firstName, intake.data?.lastName].filter(Boolean).map(part => part!.slice(0, 1)).join('') || '#';
  const studentIdFormatted = `ID: ${id}`;

  if (intake.isError && isNotFound(intake.error)) {
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">This student is not in your current assignment.</p>
      </div>
    );
  }

  // Skills display
  const skillIcons: Record<string, React.ReactNode> = {
    READING: <BookOpen size={12} aria-hidden="true" />,
    WRITING: <Edit3 size={12} aria-hidden="true" />,
    SPEAKING: <Mic size={12} aria-hidden="true" />,
    LISTENING: <Headphones size={12} aria-hidden="true" />,
  };

  const skills = profile.data?.skills ?? [];

  return (
    <div className={`${styles.page} ${layout.workspace}`}>
      <Link to={APP_ROUTE_PATHS.advisorStudents} className={layout.back}>
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Back to Students</span>
      </Link>

      {/* Figma Student Profile Header Card */}
      <header className={layout.studentSummary} aria-label="Student profile summary">
        <div className={layout.identityRow}>
          <div className={layout.identityLeft}>
            <div className={layout.avatarLarge} aria-hidden="true">
              {initials}
            </div>
            <div className={layout.nameBlock}>
              <h1>{name}</h1>
              <span className={layout.idText}>Student {studentIdFormatted}</span>
              <div className={layout.badgesRow}><span className={layout.metaText}>{intake.data?.email}</span><span className={layout.metaText}>{intake.data?.studentType}</span></div>
            </div>
          </div>

          <Link
            className={layout.messageBtn}
            to={`${generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdSupport, {studentUserId: String(id)})}#conversation`}
          >
            <MessageSquare size={15} aria-hidden="true" />
            <span>Message</span>
          </Link>
        </div>

        {/* Lower Metrics Band */}
        <div className={layout.metricsRow}>
          {/* Target Score */}
          <div className={layout.targetScoreCard}>
            <div className={layout.scoresLine}>
              <div className={layout.scoreItem}>
                <span>Baseline assessment</span>
                <strong>{profile.data?.baselineAssessment || 'Not assessed'}</strong>
              </div>
              <span className={layout.arrowIcon} aria-hidden="true">→</span>
              <div className={layout.scoreItem}>
                <span>{profile.data?.targetMetric || 'Learning goal'}</span>
                <strong>{profile.data?.targetValue || profile.data?.targetGoal || 'Not set'}</strong>
              </div>
            </div>

            <span className={layout.targetDate}>
              <Calendar size={13} aria-hidden="true" />
              <span>Target Date: {profile.data?.targetDate || 'Not set'}</span>
            </span>
          </div>

          {/* 4 Skill Subscore Cards */}
          <div className={layout.skillCardsGrid}>
            {skills.map((skill, index) => {
              const code = (skill.skillCode || '').toUpperCase();
              const icon = skillIcons[code] || <BookOpen size={12} />;
              const score = skill.currentValue || '—';

              return (
                <div className={layout.skillCard} key={skill.skillCode ?? index}>
                  <div className={layout.skillHeader}>
                    {icon}
                    <span>{skill.displayName || skill.skillCode} Current</span>
                  </div>
                  <div className={layout.skillScore}>
                    <strong>{score}</strong>

                  </div>
                </div>
              );
            })}
          </div>
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
        <NavLink
          to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdExams, {studentUserId: String(id)})}
          className={({isActive}) => (isActive ? styles.tabActive : '')}
        >
          Exams
        </NavLink>
      </nav>

      {intake.isPending ? <p role="status">Loading student workspace…</p> : intake.isError ? null : <Outlet key={id} />}
    </div>
  );
};

export default AdvisorStudentLayout;
