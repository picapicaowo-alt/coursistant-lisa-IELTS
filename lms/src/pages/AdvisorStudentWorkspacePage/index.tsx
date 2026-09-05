import {ADVISING_ERROR_CODES} from '@/apis';
import {isMissingResource} from '@/utils/apiError';
import { useTranslation } from 'react-i18next';
import {formatNumber, formatNumericText} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import React, {useId, useState} from 'react';
import {generatePath, Link, NavLink, Outlet, useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {MessageSquare, Calendar, ChevronDown} from 'lucide-react';
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
  const { t: translate } = useTranslation();
  const {studentUserId} = useParams();
  const id = Number(studentUserId);
  const summaryId = useId();
  const [summaryExpanded, setSummaryExpanded] = useState(false);
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
  const completedTasks = tasks.filter(task => task.status === TASK_STATUS.completed).length;
  const completion = tasks.length ? completedTasks / tasks.length * 100 : null;

  const name = formatPersonName(intake.data, translate('common:people.studentFallback', {id: formatNumber(id)}));

  if (intake.isError && isNotFound(intake.error)) {
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">{translate("advising:studentWorkspace.notAssigned")}</p>
      </div>
    );
  }

  const skills = profile.data?.skills ?? [];

  return (
    <div className={`${styles.page} ${layout.workspace}`}>
      <Link to={APP_ROUTE_PATHS.advisorStudents} className={layout.back}>

        <span>{translate('common:navigationControls.backToStudents')}</span>
      </Link>

      <header className={layout.studentSummary} aria-label={translate("advising:studentWorkspace.summary")}>
        <div className={layout.identityRow}>
        <UserAvatar userId={intake.data ? id : undefined} className={layout.avatarLarge}/>
        <div className={layout.nameBlock}>
          <h1>{name}</h1>
          <span>{translate('advising:studentWorkspace.studentId', {id: formatNumber(id)})}</span>
          <small>{intake.data?.email}</small>
        </div>
        <dl className={layout.metadata}>
          <div><dt>{translate("advising:actionTasks.studentType")}</dt><dd>{intake.data?.studentType ? statusLabel(intake.data.studentType) : translate("advising:studentWorkspace.notSupplied")}</dd></div>
          <div><dt>{translate("dashboard:activeCourses")}</dt><dd>{intake.data?.activeCourseCount == null ? '—' : formatNumber(intake.data.activeCourseCount)}</dd></div>
          <div><dt>{translate("advising:studentWorkspace.pendingRequests")}</dt><dd>{intake.data?.pendingRequestCount == null ? '—' : formatNumber(intake.data.pendingRequestCount)}</dd></div>
        </dl>
        <Link className={layout.messageBtn} to={`${APP_ROUTE_PATHS.advisorMessages}?studentUserId=${id}`}>
          <MessageSquare size={20} aria-hidden="true" /><span>{translate("operations:message")}</span>
        </Link>
        </div>
        <button type="button" className={layout.summaryToggle} aria-expanded={summaryExpanded} aria-controls={summaryId} onClick={() => setSummaryExpanded(current => !current)}>{translate("advising:studentPlan.learning")}<ChevronDown size={18} aria-hidden="true"/></button>
        <div className={layout.learningSummary} id={summaryId} data-expanded={summaryExpanded}>
        <div className={layout.targetScoreCard}>
          <div className={layout.scoresLine}>
            <div><span>{translate("learning:plan.baseline")}</span><strong className={layout.baselineValue}>{profile.data?.baselineAssessment || translate("common:risk.notAssessed")}</strong></div>
            <span aria-hidden="true">→</span>
            <div><span>{profile.data?.targetMetric || translate("learning:plan.goalLabel")}</span><strong className={layout.targetValue}>{formatNumericText(profile.data?.targetValue) || profile.data?.targetGoal || translate("assessment:submission.notSet")}</strong></div>
          </div>
          <span className={layout.targetDate}><Calendar size={20} aria-hidden="true" />{translate('advising:studentWorkspace.targetDate')} · {profile.data?.targetDate ? formatPlanDate(profile.data.targetDate) : translate("assessment:submission.notSet")}</span>
        </div>
        <div className={layout.progress}>
          <ProgressRing value={completion} label={translate("learning:plan.completion")} compact />
          <div><strong>{translate("advising:studentWorkspace.planProgress")}</strong><span>{plan.isPending ? translate("advising:studentWorkspace.loadingPlan") : plan.isError ? translate("advising:studentWorkspace.planUnavailable") : tasks.length ? translate('advising:studentWorkspace.completedTasks', {count: tasks.length, completed: formatNumber(completedTasks), number: formatNumber(tasks.length)}) : translate("advising:studentWorkspace.noTasks")}</span></div>
        </div>
        <div className={layout.skillCardsGrid}>
          {skills.map((skill, index) => (
            <div className={layout.skillCard} key={skill.skillCode ?? index}>
              <span>{skill.displayName || skill.skillCode}</span>
              <strong>{formatNumericText(skill.currentValue) || '—'}</strong>
              {skill.targetValue ? <small>{translate('advising:studentWorkspace.targetValue', {value: formatNumericText(skill.targetValue)})}</small> : null}
            </div>
          ))}
          {!skills.length ? <p className={layout.skillEmpty}>{profile.isPending ? translate("advising:studentWorkspace.loadingAssessments") : translate("learning:plan.noSkills")}</p> : null}
        </div>
        </div>
        {profile.isError && !isMissingResource(profile.error, ADVISING_ERROR_CODES.profileNotFound) ? <p className={styles.error} role="alert">{translate("advising:studentWorkspace.profileFailed")}{' '}<button type="button" onClick={() => void profile.refetch()}>{translate("learning:plan.retryProfile")}</button></p> : null}
      </header>

      {intake.isError ? (
        <p className={styles.error} role="alert">
          {advisingErrorMessage(intake.error, translate('advising:studentWorkspace.intakeFailed'))}
        </p>
      ) : null}

      {/* Tabs */}
      <nav className={layout.tabs} aria-label={translate("advising:studentWorkspace.sections")}>
        <NavLink
          to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdStudyPlan, {studentUserId: String(id)})}
          className={({isActive}) => (isActive ? styles.tabActive : '')}
        >
          {translate("advising:studentWorkspace.learningPlan")}</NavLink>
        <NavLink
          to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdCourses, {studentUserId: String(id)})}
          className={({isActive}) => (isActive ? styles.tabActive : '')}
        >
          {translate("common:fields.courses")}</NavLink>
        <NavLink
          to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdExams, {studentUserId: String(id)})}
          className={({isActive}) => (isActive ? styles.tabActive : '')}
        >
          {translate("navigation:exams")}</NavLink>
        <NavLink
          to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdSupport, {studentUserId: String(id)})}
          className={({isActive}) => (isActive ? styles.tabActive : '')}
        >
          {translate("advising:studentWorkspace.supportReports")}</NavLink>
        <NavLink
          to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdProfile, {studentUserId: String(id)})}
          className={({isActive}) => (isActive ? styles.tabActive : '')}
        >
          {translate("common:menu.profile")}</NavLink>
        <NavLink
          to={generatePath(APP_ROUTE_PATHS.advisorStudentsStudentUserIdIntake, {studentUserId: String(id)})}
          className={({isActive}) => (isActive ? styles.tabActive : '')}
        >
          {translate("advising:actionTasks.intake")}</NavLink>

      </nav>

      {intake.isPending ? <p role="status">{translate("advising:studentWorkspace.loading")}</p> : intake.isError ? null : <Outlet key={id} />}
    </div>
  );
};

export default AdvisorStudentLayout;
